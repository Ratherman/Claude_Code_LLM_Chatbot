from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
from dotenv import load_dotenv
import pathlib
import os

load_dotenv(pathlib.Path(__file__).parent.parent / '.env', override=True)

app = Flask(__name__)
CORS(app)

api_key = os.getenv('OPENAI_API_KEY')
client = OpenAI(api_key=api_key) if api_key else None


def _mask_key(key):
    if not key:
        return '(未設定)'
    if len(key) <= 12:
        return key[:4] + '...'
    return key[:10] + '...' + key[-6:]


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


@app.route('/api/chat', methods=['POST'])
def chat():
    if not client:
        return jsonify({'error': '後端未設定 API Key'}), 500

    data = request.json
    messages = data.get('messages', [])
    model = data.get('model', 'gpt-4o')
    temperature = float(data.get('temperature', 1.0))
    system_prompt = data.get('systemPrompt', '').strip()

    def build_content(msg):
        text = msg.get('text', '')
        image = msg.get('image', '')
        if image:
            content = []
            if text:
                content.append({'type': 'text', 'text': text})
            content.append({'type': 'image_url', 'image_url': {'url': image}})
            return content
        return text

    api_messages = []
    if system_prompt:
        api_messages.append({'role': 'system', 'content': system_prompt})
    api_messages.extend([{'role': m['role'], 'content': build_content(m)} for m in messages])

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
