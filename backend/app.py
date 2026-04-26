from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import Literal
import pathlib
import os
import json

load_dotenv(pathlib.Path(__file__).parent.parent / '.env', override=True)

app = Flask(__name__)
CORS(app)

api_key = os.getenv('OPENAI_API_KEY')
client = OpenAI(api_key=api_key) if api_key else None


# ── Pydantic schema for Context Router output ──────────────────────────────────
class RouteResult(BaseModel):
    mode: Literal['chat', 'rag', 'skill', 'function_call']
    reason: str


ROUTER_SYSTEM_PROMPT = """你是一個智慧對話分流器。根據對話脈絡判斷最後一則使用者訊息應由哪個模式處理。
回覆必須是純 JSON，不得包含任何 markdown 或多餘文字。

## 四種模式定義
- chat        : 一般聊天、問候、閒聊、通用知識問答、不屬於其他三類的問題
- rag         : MIS 相關問題，例如：系統操作說明、IT 設定、公司內部規定、ERP/HR 系統、設備管理
- skill       : 發票辨識，例如：使用者上傳發票圖片、要求讀取或解析發票、統編查詢
- function_call: 需要即時網路資料，例如：今日天氣、最新新聞、即時股價、近期發生的事件

## 輸出格式（嚴格遵守，只輸出此 JSON）
{"mode": "<chat|rag|skill|function_call>", "reason": "<判斷原因，一句話，不超過 30 字>"}"""


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

    # Placeholder responses for unimplemented pipeline modes
    placeholders = {
        'rag':           '（RAG）MIS 相關問題功能尚未實踐，敬請期待。',
        'skill':         '（Skill）發票辨識功能尚未實踐，敬請期待。',
        'function_call': '（Function Call）上網找資料功能尚未實踐，敬請期待。',
    }
    if mode in placeholders:
        return jsonify({'text': placeholders[mode]})

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
