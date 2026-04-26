"""
執行此腳本一次，將 data/qa.json 的 20 個問題轉換成向量並儲存至 embeddings/。
Usage: python backend/generate_embeddings.py
"""
from openai import OpenAI
from dotenv import load_dotenv
import pathlib
import json
import numpy as np
import os

_BASE = pathlib.Path(__file__).parent
load_dotenv(_BASE.parent / '.env', override=True)

client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

qa_path = _BASE / 'data' / 'qa.json'
emb_dir = _BASE / 'embeddings'
emb_dir.mkdir(exist_ok=True)

with open(qa_path, encoding='utf-8') as f:
    qa_data = json.load(f)

questions = [qa['question'] for qa in qa_data]
print(f'正在為 {len(questions)} 個問題生成 Embedding（model: text-embedding-3-small）...')

response = client.embeddings.create(
    model='text-embedding-3-small',
    input=questions,
)

embeddings = [item.embedding for item in response.data]
embeddings_array = np.array(embeddings, dtype=np.float32)

out_path = emb_dir / 'qa_embeddings.npy'
np.save(str(out_path), embeddings_array)

print(f'完成！已儲存至 {out_path}')
print(f'向量矩陣維度：{embeddings_array.shape}  (題數 × 向量維度)')
