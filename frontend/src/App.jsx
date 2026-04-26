import { useState, useRef, useEffect } from 'react'
import LeftPanel from './components/LeftPanel'
import ChatPanel from './components/ChatPanel'
import RightPanel from './components/RightPanel'
import './App.css'

const API_BASE = 'http://localhost:5000'

const FEATURE_LABELS = {
  contextRouter:       'Context Router 分流',
  autoRoute:           '自動分流模式',
  ragEnabled:          'RAG 知識庫檢索',
  skillEnabled:        'SKILL 技能加載',
  functionCallEnabled: 'Function Call 上網查詢',
}

const FEATURE_REQUIRED = {
  rag:           'ragEnabled',
  skill:         'skillEnabled',
  function_call: 'functionCallEnabled',
}

export default function App() {
  const [chats, setChats] = useState([{ id: 1, name: '新對話' }])
  const [activeChatId, setActiveChatId] = useState(1)
  const [messages, setMessages] = useState({ 1: [] })
  const [isTyping, setIsTyping] = useState({})
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [theme, setTheme] = useState('dark')
  const [apiStatus, setApiStatus] = useState('checking')
  const [apiError, setApiError] = useState('')
  const [maskedKey, setMaskedKey] = useState('')
  const [settings, setSettings] = useState({
    model: 'gpt-4o',
    temperature: 1.0,
    systemPrompt: '',
    memoryCount: 5,
    contextRouter: false,
    autoRoute: false,
    ragEnabled: false,
    skillEnabled: false,
    functionCallEnabled: false,
  })
  const [toasts, setToasts] = useState([])
  const [retryCount, setRetryCount] = useState(0)
  const nextId = useRef(2)
  const pendingHistoryRef = useRef({})

  useEffect(() => {
    setApiStatus('checking')
    fetch(`${API_BASE}/api/verify`)
      .then(r => r.json())
      .then(data => {
        if (data.maskedKey) setMaskedKey(data.maskedKey)
        if (data.ok) setApiStatus('ok')
        else { setApiError(data.error || 'API Key 驗證失敗'); setApiStatus('error') }
      })
      .catch(() => {
        setApiError('無法連接到後端伺服器，請確認 Flask 是否已啟動（python backend/app.py）')
        setApiStatus('error')
      })
  }, [retryCount])

  const showToast = (msg) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, msg }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }

  const addChat = () => {
    const id = nextId.current++
    setChats(prev => [...prev, { id, name: '新對話' }])
    setMessages(prev => ({ ...prev, [id]: [] }))
    setActiveChatId(id)
  }

  const deleteChat = (id) => {
    const remaining = chats.filter(c => c.id !== id)
    setChats(remaining)
    setMessages(prev => { const n = { ...prev }; delete n[id]; return n })
    setIsTyping(prev => { const n = { ...prev }; delete n[id]; return n })
    if (activeChatId === id) setActiveChatId(remaining.length > 0 ? remaining[0].id : null)
  }

  const renameChat = (id, name) => setChats(prev => prev.map(c => c.id === id ? { ...c, name } : c))

  // ── Core chat API call ──────────────────────────────────────────────────────
  const callChat = async (history, mode, chatId) => {
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.map(m => ({ role: m.role, text: m.text, ...(m.image && { image: m.image }) })),
          model: settings.model,
          temperature: settings.temperature,
          systemPrompt: settings.systemPrompt,
          mode,
        })
      })
      const data = await res.json()
      const reply = {
        id: Date.now(), role: 'assistant',
        text: data.error ? `錯誤：${data.error}` : data.text,
        ...(data.refs && { refs: data.refs }),
      }
      setMessages(prev => ({ ...prev, [chatId]: [...(prev[chatId] || []), reply] }))
    } catch {
      const errMsg = { id: Date.now(), role: 'assistant', text: '無法連接到伺服器，請確認後端是否正在運行。' }
      setMessages(prev => ({ ...prev, [chatId]: [...(prev[chatId] || []), errMsg] }))
    } finally {
      setIsTyping(prev => ({ ...prev, [chatId]: false }))
    }
  }

  // ── Auto-confirm helper (used when autoRoute is on) ────────────────────────
  const _autoConfirm = async (routerId, mode, reason, chatId) => {
    setMessages(prev => ({
      ...prev,
      [chatId]: prev[chatId].map(m =>
        m.id === routerId
          ? { ...m, status: 'confirmed', suggestedMode: mode, confirmedMode: mode, reason }
          : m
      )
    }))
    const featureKey = FEATURE_REQUIRED[mode]
    if (featureKey && !settings[featureKey]) {
      const errMsg = { id: Date.now(), role: 'assistant', text: `請先在右側面板開啟「${FEATURE_LABELS[featureKey]}」功能。` }
      setMessages(prev => ({ ...prev, [chatId]: [...(prev[chatId] || []), errMsg] }))
      return
    }
    setIsTyping(prev => ({ ...prev, [chatId]: true }))
    const history = pendingHistoryRef.current[routerId] || []
    delete pendingHistoryRef.current[routerId]
    await callChat(history, mode, chatId)
  }

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = async (text, image = null) => {
    if (!activeChatId) return
    const chatId = activeChatId
    const ts = Date.now()
    const userMsg = { id: ts, role: 'user', text, ...(image && { image }) }

    const prevHistory = messages[chatId] || []
    const chatHistory = prevHistory.filter(m => m.role === 'user' || m.role === 'assistant')
    const recentPrev = settings.memoryCount > 0 ? chatHistory.slice(-(settings.memoryCount * 2)) : []
    const historyToSend = [...recentPrev, userMsg]

    const chat = chats.find(c => c.id === chatId)
    if (chat?.name === '新對話') renameChat(chatId, text.slice(0, 16))

    if (settings.contextRouter) {
      // ── Router flow ──
      const routerId = ts + 1
      const routerMsg = { id: routerId, role: 'router', status: 'routing', suggestedMode: null, selectedMode: null, reason: '' }
      setMessages(prev => ({ ...prev, [chatId]: [...(prev[chatId] || []), userMsg, routerMsg] }))
      pendingHistoryRef.current[routerId] = historyToSend

      try {
        const res = await fetch(`${API_BASE}/api/route`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: historyToSend.map(m => ({ role: m.role, text: m.text, ...(m.image && { image: m.image }) })) })
        })
        const data = await res.json()
        if (settings.autoRoute) {
          await _autoConfirm(routerId, data.mode, data.reason, chatId)
        } else {
          setMessages(prev => ({
            ...prev,
            [chatId]: prev[chatId].map(m =>
              m.id === routerId
                ? { ...m, status: 'pending', suggestedMode: data.mode, selectedMode: data.mode, reason: data.reason }
                : m
            )
          }))
        }
      } catch {
        if (settings.autoRoute) {
          await _autoConfirm(routerId, 'chat', '分流服務暫時不可用', chatId)
        } else {
          setMessages(prev => ({
            ...prev,
            [chatId]: prev[chatId].map(m =>
              m.id === routerId
                ? { ...m, status: 'pending', suggestedMode: 'chat', selectedMode: 'chat', reason: '分流服務暫時不可用' }
                : m
            )
          }))
        }
      }
    } else {
      // ── Direct chat flow ──
      setMessages(prev => ({ ...prev, [chatId]: [...(prev[chatId] || []), userMsg] }))
      setIsTyping(prev => ({ ...prev, [chatId]: true }))
      await callChat(historyToSend, 'chat', chatId)
    }
  }

  // ── Router: user selects a different mode ───────────────────────────────────
  const updateRouterMode = (routerId, mode) => {
    setMessages(prev => ({
      ...prev,
      [activeChatId]: prev[activeChatId].map(m =>
        m.id === routerId ? { ...m, selectedMode: mode } : m
      )
    }))
  }

  // ── Router: user confirms mode ──────────────────────────────────────────────
  const confirmRoute = async (routerId, mode) => {
    const chatId = activeChatId

    setMessages(prev => ({
      ...prev,
      [chatId]: prev[chatId].map(m =>
        m.id === routerId ? { ...m, status: 'confirmed', confirmedMode: mode } : m
      )
    }))

    // Check if required feature is enabled
    const featureKey = FEATURE_REQUIRED[mode]
    if (featureKey && !settings[featureKey]) {
      const errMsg = {
        id: Date.now(), role: 'assistant',
        text: `請先在右側面板開啟「${FEATURE_LABELS[featureKey]}」功能。`,
      }
      setMessages(prev => ({ ...prev, [chatId]: [...(prev[chatId] || []), errMsg] }))
      return
    }

    setIsTyping(prev => ({ ...prev, [chatId]: true }))
    const history = pendingHistoryRef.current[routerId] || []
    delete pendingHistoryRef.current[routerId]
    await callChat(history, mode, chatId)
  }

  // ── Toggle settings (contextRouter + sub-features) ──────────────────────────
  const handleToggleChange = (key, value) => {
    setSettings(s => {
      const next = { ...s, [key]: value }
      if (key === 'contextRouter' && !value) {
        next.autoRoute = false
        next.ragEnabled = false
        next.skillEnabled = false
        next.functionCallEnabled = false
      }
      return next
    })
    showToast(value ? `已開啟 ${FEATURE_LABELS[key]}` : `已關閉 ${FEATURE_LABELS[key]}`)
  }

  // ── Verification screens ────────────────────────────────────────────────────
  if (apiStatus === 'checking') {
    return (
      <div className="api-overlay">
        <div className="api-overlay-card">
          <div className="api-spinner" />
          <p>正在驗證 API Key…</p>
        </div>
      </div>
    )
  }

  if (apiStatus === 'error') {
    return (
      <div className="api-overlay">
        <div className="api-overlay-card api-overlay-card--error">
          <div className="api-error-icon">⚠</div>
          <h2>無法啟動</h2>
          {maskedKey && <p className="api-key-reading">後端讀到的 Key：<code>{maskedKey}</code></p>}
          <p className="api-error-msg">{apiError}</p>
          <div className="api-error-hint">
            <p>請確認以下步驟：</p>
            <ol>
              <li>在專案根目錄建立 <code>.env</code> 檔案</li>
              <li>加入 <code>OPENAI_API_KEY=sk-...</code></li>
              <li>啟動後端：<code>conda activate LLM_Chatbot &amp;&amp; python backend/app.py</code></li>
              <li>重新整理頁面</li>
            </ol>
          </div>
          <button className="btn-retry" onClick={() => setRetryCount(c => c + 1)}>重新驗證</button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-layout" data-theme={theme}>
      <LeftPanel
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={setActiveChatId}
        onAddChat={addChat}
        onDeleteChat={deleteChat}
        onRenameChat={renameChat}
        collapsed={leftCollapsed}
        onToggleCollapse={() => setLeftCollapsed(v => !v)}
        theme={theme}
        onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
      />
      <ChatPanel
        messages={activeChatId ? (messages[activeChatId] || []) : []}
        onSendMessage={sendMessage}
        active={!!activeChatId}
        isTyping={!!isTyping[activeChatId]}
        onUpdateRouterMode={updateRouterMode}
        onConfirmRoute={confirmRoute}
      />
      <RightPanel
        collapsed={rightCollapsed}
        onToggleCollapse={() => setRightCollapsed(v => !v)}
        settings={settings}
        onModelChange={model => { setSettings(s => ({ ...s, model })); showToast(`模型已切換為 ${model}`) }}
        onTemperatureChange={temperature => { setSettings(s => ({ ...s, temperature })); showToast(`溫度值已設為 ${temperature.toFixed(1)}`) }}
        onSystemPromptSave={systemPrompt => { setSettings(s => ({ ...s, systemPrompt })); showToast('系統提示詞已儲存') }}
        onMemoryChange={memoryCount => { setSettings(s => ({ ...s, memoryCount })); showToast(`對話記憶設為 ${memoryCount} 輪`) }}
        onToggleChange={handleToggleChange}
      />
      <div className="toast-container">
        {toasts.map(t => <div key={t.id} className="toast">{t.msg}</div>)}
      </div>
    </div>
  )
}
