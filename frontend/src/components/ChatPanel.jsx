import { useState, useRef, useEffect } from 'react'

export default function ChatPanel({ messages, onSendMessage, active, isTyping }) {
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const handleSend = () => {
    const text = input.trim()
    if (!text || !active) return
    onSendMessage(text)
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleChange = (e) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px'
  }

  return (
    <main className="chat-panel">
      <div className="messages-area">
        {!active ? (
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <p>請在左側新增或選擇對話</p>
          </div>
        ) : messages.length === 0 && !isTyping ? (
          <div className="empty-state">
            <div className="empty-icon">✦</div>
            <p>開始輸入來展開對話</p>
          </div>
        ) : (
          <>
            {messages.map(msg => (
              <div key={msg.id} className={`message message--${msg.role}`}>
                <div className="message-bubble">
                  <p>{msg.text}</p>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="message message--system">
                <div className="message-bubble typing-indicator">
                  <span /><span /><span />
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="input-area">
        <button className="btn-upload" disabled title="圖片上傳（即將開放）">
          📎
        </button>
        <textarea
          ref={textareaRef}
          className="chat-input"
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={active ? '輸入訊息… Enter 送出 ／ Shift+Enter 換行' : '請先選擇或新增對話'}
          disabled={!active}
          rows={1}
        />
        <button
          className="btn-send"
          onClick={handleSend}
          disabled={!input.trim() || !active}
          title="送出"
        >↑</button>
      </div>
    </main>
  )
}
