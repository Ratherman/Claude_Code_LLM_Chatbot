import { useState, useRef, useEffect } from 'react'

export default function ChatPanel({ messages, onSendMessage, active, isTyping }) {
  const [input, setInput] = useState('')
  const [pendingImage, setPendingImage] = useState(null)
  const [lightboxSrc, setLightboxSrc] = useState(null)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const handleSend = () => {
    const text = input.trim()
    if ((!text && !pendingImage) || !active) return
    onSendMessage(text, pendingImage)
    setInput('')
    setPendingImage(null)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleChange = (e) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px'
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setPendingImage(ev.target.result)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const canSend = active && (!!input.trim() || !!pendingImage)

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
                  {msg.image && (
                    <img
                      src={msg.image}
                      className="message-img"
                      onClick={() => setLightboxSrc(msg.image)}
                      alt="uploaded"
                    />
                  )}
                  {msg.text && <p>{msg.text}</p>}
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
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button
          className="btn-upload"
          title="上傳圖片"
          disabled={!active}
          onClick={() => fileInputRef.current?.click()}
        >
          📎
        </button>

        <div className="input-col">
          {pendingImage && (
            <div className="image-preview-wrap">
              <img src={pendingImage} className="image-preview" alt="preview" />
              <button className="image-preview-remove" onClick={() => setPendingImage(null)}>×</button>
            </div>
          )}
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
        </div>

        <button
          className="btn-send"
          onClick={handleSend}
          disabled={!canSend}
          title="送出"
        >↑</button>
      </div>

      {lightboxSrc && (
        <div className="lightbox" onClick={() => setLightboxSrc(null)}>
          <img src={lightboxSrc} className="lightbox-img" onClick={e => e.stopPropagation()} alt="full size" />
          <button className="lightbox-close" onClick={() => setLightboxSrc(null)}>×</button>
        </div>
      )}
    </main>
  )
}
