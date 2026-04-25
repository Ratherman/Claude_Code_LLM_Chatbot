# LLM Chatbot

以 React（前端）+ Flask（後端）建構的 LLM 聊天機器人。

## 初始設定

### 1. 設定 API Key

在專案根目錄建立 `.env` 檔案，加入你的 OpenAI API Key：

```
OPENAI_API_KEY=sk-...
```

### 2. 安裝後端套件

```bash
conda activate LLM_Chatbot
pip install -r backend/requirements.txt
```

---

## 啟動後端開發伺服器

```bash
conda activate LLM_Chatbot
python backend/app.py
```

後端預設監聽 [http://localhost:5000](http://localhost:5000)

## 啟動前端開發伺服器

```bash
cd frontend
npm run dev
```

啟動後開啟瀏覽器前往：[http://localhost:5173](http://localhost:5173)

前端啟動後會自動驗證 API Key，驗證通過才可使用介面。

若要停止伺服器，在 terminal 按 `Ctrl + C`。
