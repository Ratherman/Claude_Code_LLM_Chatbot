from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
from tavily import TavilyClient
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import Literal
import pathlib
import os
import re
import json
import numpy as np

load_dotenv(pathlib.Path(__file__).parent.parent / '.env', override=True)

app = Flask(__name__)
CORS(app)

api_key = os.getenv('OPENAI_API_KEY')
client = OpenAI(api_key=api_key) if api_key else None

tavily_key = os.getenv('TAVILY_API_KEY')
tavily_client = TavilyClient(api_key=tavily_key) if tavily_key else None

_BASE = pathlib.Path(__file__).parent


# ── Pydantic schema for Context Router output ──────────────────────────────────
class RouteResult(BaseModel):
    mode: Literal['chat', 'rag', 'skill', 'function_call']
    reason: str


# ── Skills: load all .md files under backend/skills/ ──────────────────────────
SKILLS = {}


def _load_skills():
    global SKILLS
    skills_dir = _BASE / 'skills'
    if not skills_dir.exists():
        return
    for path in sorted(skills_dir.glob('*.md')):
        content = path.read_text(encoding='utf-8')
        m = re.match(r'^---\s*\n(.*?)\n---\s*\n(.*)', content, re.DOTALL)
        if m:
            fm_text, instructions = m.group(1), m.group(2).strip()
        else:
            fm_text, instructions = '', content
        fm = {}
        for line in fm_text.splitlines():
            if ':' in line:
                k, _, v = line.partition(':')
                fm[k.strip()] = v.strip()
        SKILLS[path.stem] = {
            'name': fm.get('name', path.stem),
            'description': fm.get('description', ''),
            'instructions': instructions,
        }


_load_skills()


def _skill_summary():
    if not SKILLS:
        return '發票辨識，例如：使用者上傳發票圖片、要求讀取或解析發票、統編查詢'
    return '、'.join(f"【{s['name']}】{s['description']}" for s in SKILLS.values())


ROUTER_SYSTEM_PROMPT = f"""你是一個智慧對話分流器。根據對話脈絡判斷最後一則使用者訊息應由哪個模式處理。
回覆必須是純 JSON，不得包含任何 markdown 或多餘文字。

## 四種模式定義
- chat        : 一般聊天、問候、閒聊、通用知識問答、不屬於其他三類的問題
- rag         : MIS／IT 支援相關問題，例如：忘記密碼（Windows/Email/ERP/VPN）、電腦開不起來或速度慢、藍色死亡畫面（BSOD）、程式當機、螢幕閃爍或顯示異常、雙螢幕設定、Gmail 收發信件或附件問題、網路無法連線、Wi-Fi 問題、印表機無法列印、軟體安裝申請、資料誤刪救援等 IT 支援問題
- skill       : {_skill_summary()}
- function_call: 需要即時網路資料，例如：今日天氣、最新新聞、即時股價、近期發生的事件

## 輸出格式（嚴格遵守，只輸出此 JSON）
{{"mode": "<chat|rag|skill|function_call>", "reason": "<判斷原因，一句話，不超過 30 字>"}}"""


# ── RAG: load QA data and embeddings on startup ────────────────────────────────
QA_DATA = []
QA_EMBEDDINGS = None


def _load_rag_data():
    global QA_DATA, QA_EMBEDDINGS
    qa_path = _BASE / 'data' / 'qa.json'
    emb_path = _BASE / 'embeddings' / 'qa_embeddings.npy'
    if qa_path.exists():
        with open(qa_path, encoding='utf-8') as f:
            QA_DATA = json.load(f)
    if emb_path.exists():
        QA_EMBEDDINGS = np.load(str(emb_path))


_load_rag_data()


def _rag_search(query_embedding, top_k=3):
    query_vec = np.array(query_embedding, dtype=np.float32)
    norms = np.linalg.norm(QA_EMBEDDINGS, axis=1) * np.linalg.norm(query_vec)
    similarities = QA_EMBEDDINGS @ query_vec / np.maximum(norms, 1e-10)
    top_indices = np.argsort(similarities)[::-1][:top_k]
    return [QA_DATA[i] for i in top_indices]


def _mask_key(key):
    if not key:
        return '(未設定)'
    if len(key) <= 12:
        return key[:4] + '...'
    return key[:10] + '...' + key[-6:]


def _build_content(msg):
    text = msg.get('text', '')
    image = msg.get('image', '')
    if image:
        content = []
        if text:
            content.append({'type': 'text', 'text': text})
        content.append({'type': 'image_url', 'image_url': {'url': image}})
        return content
    return text


# ── /api/verify ───────────────────────────────────────────────────────────────
@app.route('/api/verify', methods=['GET'])
def verify():
    key = os.getenv('OPENAI_API_KEY', '')
    masked = _mask_key(key)
    if not client:
        return jsonify({'ok': False, 'error': 'OPENAI_API_KEY 未設定，請在 .env 檔案中加入 OPENAI_API_KEY=sk-...', 'maskedKey': masked}), 401
    try:
        client.models.list()
        return jsonify({'ok': True, 'maskedKey': masked})
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e), 'maskedKey': masked}), 401


# ── /api/route ────────────────────────────────────────────────────────────────
@app.route('/api/route', methods=['POST'])
def route():
    if not client:
        return jsonify({'mode': 'chat', 'reason': '未設定 API Key，預設一般聊天'}), 200

    data = request.json
    messages = data.get('messages', [])

    context_lines = []
    for m in messages:
        role_label = '使用者' if m['role'] == 'user' else 'AI'
        text = m.get('text', '')
        has_image = '（含圖片）' if m.get('image') else ''
        if text or has_image:
            context_lines.append(f"{role_label}{has_image}：{text}")
    context = '\n'.join(context_lines) or '（無對話內容）'

    try:
        response = client.chat.completions.create(
            model='gpt-4o-mini',
            messages=[
                {'role': 'system', 'content': ROUTER_SYSTEM_PROMPT},
                {'role': 'user', 'content': f'請根據以下對話判斷分流模式：\n\n{context}'},
            ],
            response_format={'type': 'json_object'},
            temperature=0,
        )
        raw = response.choices[0].message.content
        result = RouteResult(**json.loads(raw))
        return jsonify({'mode': result.mode, 'reason': result.reason})
    except Exception:
        return jsonify({'mode': 'chat', 'reason': '分流判斷失敗，預設一般聊天模式'}), 200


# ── /api/chat ─────────────────────────────────────────────────────────────────
@app.route('/api/chat', methods=['POST'])
def chat():
    if not client:
        return jsonify({'error': '後端未設定 API Key'}), 500

    data = request.json
    messages = data.get('messages', [])
    model = data.get('model', 'gpt-4o')
    temperature = float(data.get('temperature', 1.0))
    system_prompt = data.get('systemPrompt', '').strip()
    mode = data.get('mode', 'chat')

    # ── RAG mode ──────────────────────────────────────────────────────────────
    if mode == 'rag':
        if QA_EMBEDDINGS is None:
            return jsonify({'text': '（RAG）知識庫向量尚未建立，請先執行：python backend/generate_embeddings.py'})

        user_messages = [m for m in messages if m.get('role') == 'user']
        query_text = user_messages[-1].get('text', '') if user_messages else ''
        if not query_text:
            return jsonify({'text': '未收到使用者問題'})

        try:
            emb_response = client.embeddings.create(
                model='text-embedding-3-small',
                input=query_text,
            )
            query_embedding = emb_response.data[0].embedding
            relevant_qas = _rag_search(query_embedding, top_k=3)
            context = '\n\n'.join(
                f"Q: {qa['question']}\nA: {qa['answer']}" for qa in relevant_qas
            )
            rag_system = (
                "你是公司的 MIS 支援助手。請根據以下知識庫資料回答使用者的問題。\n\n"
                f"相關知識庫資料：\n{context}\n\n"
                "請根據上述資料提供清楚、具體的解答。"
                "若知識庫資料不足以完整回答，請說明建議直接聯繫 MIS 人員進一步協助。"
            )
            api_messages = [{'role': 'system', 'content': rag_system}]
            api_messages.extend(
                [{'role': m['role'], 'content': _build_content(m)} for m in messages]
            )
            response = client.chat.completions.create(
                model=model,
                messages=api_messages,
                temperature=temperature,
            )
            refs = [{'id': qa['id'], 'question': qa['question']} for qa in relevant_qas]
            return jsonify({'text': response.choices[0].message.content, 'refs': refs})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    # ── Skill mode: load full instructions from skills/*.md ───────────────────
    if mode == 'skill':
        skill = next(iter(SKILLS.values()), None)
        if not skill:
            return jsonify({'text': '（Skill）找不到技能設定檔，請確認 backend/skills/ 目錄下有 .md 檔案。'})
        api_messages = [{'role': 'system', 'content': skill['instructions']}]
        api_messages.extend([{'role': m['role'], 'content': _build_content(m)} for m in messages])
        try:
            response = client.chat.completions.create(
                model=model,
                messages=api_messages,
                temperature=temperature,
            )
            return jsonify({'text': response.choices[0].message.content})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    # ── Function Call mode: Tavily search + LLM summarise ─────────────────────
    if mode == 'function_call':
        if not tavily_client:
            return jsonify({'text': '（Function Call）未設定 TAVILY_API_KEY，請在 .env 中加入 TAVILY_API_KEY=tvly-...'})

        user_messages = [m for m in messages if m.get('role') == 'user']
        query_text = user_messages[-1].get('text', '') if user_messages else ''
        if not query_text:
            return jsonify({'text': '未收到搜尋關鍵字'})

        try:
            results = tavily_client.search(query=query_text, max_results=5).get('results', [])
            context = '\n\n'.join(
                f"[{i+1}] 標題：{r['title']}\n來源：{r['url']}\n內容：{r['content']}"
                for i, r in enumerate(results)
            )
            fc_system = (
                "你是一個資訊彙整助手。根據以下即時網路搜尋結果，用繁體中文回答使用者的問題。\n\n"
                f"搜尋結果：\n{context}\n\n"
                "回覆時可在適當位置引用來源編號，格式為 [1]、[2]，讓使用者知道資訊出處。"
            )
            api_messages = [{'role': 'system', 'content': fc_system}]
            api_messages.extend([{'role': m['role'], 'content': _build_content(m)} for m in messages])
            response = client.chat.completions.create(
                model=model,
                messages=api_messages,
                temperature=temperature,
            )
            refs = [{'title': r['title'], 'url': r['url']} for r in results]
            return jsonify({'text': response.choices[0].message.content, 'refs': refs})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    # ── General chat ──────────────────────────────────────────────────────────
    api_messages = []
    if system_prompt:
        api_messages.append({'role': 'system', 'content': system_prompt})
    api_messages.extend([{'role': m['role'], 'content': _build_content(m)} for m in messages])

    try:
        response = client.chat.completions.create(
            model=model,
            messages=api_messages,
            temperature=temperature,
        )
        return jsonify({'text': response.choices[0].message.content})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)
