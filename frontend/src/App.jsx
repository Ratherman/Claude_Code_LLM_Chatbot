import { useState, useRef } from 'react'
import LeftPanel from './components/LeftPanel'
import ChatPanel from './components/ChatPanel'
import RightPanel from './components/RightPanel'
import './App.css'

export default function App() {
  const [chats, setChats] = useState([{ id: 1, name: '新對話' }])
  const [activeChatId, setActiveChatId] = useState(1)
  const [messages, setMessages] = useState({ 1: [] })
  const [isTyping, setIsTyping] = useState({})
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [theme, setTheme] = useState('dark')
  const nextId = useRef(2)

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
    if (activeChatId === id) {
      setActiveChatId(remaining.length > 0 ? remaining[0].id : null)
    }
  }

  const renameChat = (id, name) => {
    setChats(prev => prev.map(c => c.id === id ? { ...c, name } : c))
  }

  const sendMessage = (text) => {
    if (!activeChatId) return
    const ts = Date.now()
    const userMsg = { id: ts, role: 'user', text }
    const sysMsg  = { id: ts + 1, role: 'system', text: `我收到你的訊息了，你的訊息是：${text}` }

    setMessages(prev => ({
      ...prev,
      [activeChatId]: [...(prev[activeChatId] || []), userMsg]
    }))

    const chat = chats.find(c => c.id === activeChatId)
    if (chat?.name === '新對話') renameChat(activeChatId, text.slice(0, 16))

    setIsTyping(prev => ({ ...prev, [activeChatId]: true }))

    setTimeout(() => {
      setMessages(prev => ({
        ...prev,
        [activeChatId]: [...(prev[activeChatId] || []), sysMsg]
      }))
      setIsTyping(prev => ({ ...prev, [activeChatId]: false }))
    }, 700)
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
      />
      <RightPanel
        collapsed={rightCollapsed}
        onToggleCollapse={() => setRightCollapsed(v => !v)}
      />
    </div>
  )
}
