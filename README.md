# LLM Chatbot

以 React（前端）+ Flask（後端）建構的 LLM 聊天機器人。

## 啟動前端開發伺服器

```bash
cd frontend
npm run dev
```

啟動後開啟瀏覽器前往：[http://localhost:5173](http://localhost:5173)

若要停止伺服器，在 terminal 按 `Ctrl + C`。

## 啟動後端開發伺服器

先進入 Conda 虛擬環境，再啟動 Flask：

```bash
conda activate LLM_Chatbot
cd backend
python app.py
```

### 安裝後端套件

```bash
conda activate LLM_Chatbot
pip install -r backend/requirements.txt
```
