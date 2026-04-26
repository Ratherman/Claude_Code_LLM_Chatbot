import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const MODE_CONFIG = [
  { key: 'chat',          label: '一般聊天',     icon: '💬' },
  { key: 'rag',           label: 'MIS 相關問題',  icon: '🗃' },
  { key: 'skill',         label: '發票辨識',      icon: '🧾' },
  { key: 'function_call', label: '上網找資料',    icon: '🌐' },
]

const STAGE_LABEL = {
  router:        'Router',
  embed:         'Embed',
  rag:           'RAG',
  skill:         'Skill',
  function_call: 'Func',
  chat:          'Chat',
  input_check:   'Guard-in',
  output_check:  'Guard-out',
}

function TokenBar({ stats }) {
  const [expanded, setExpanded] = useState(false)
  if (!stats || stats.length === 0) return null

  const totals = stats.reduce(
    (acc, s) => ({ input: acc.input + s.input_tokens, output: acc.output + s.output_tokens }),
    { input: 0, output: 0 }
  )

  const byModel = {}
  for (const s of stats) {
    if (!byModel[s.model]) byModel[s.model] = { input: 0, output: 0 }
    byModel[s.model].input  += s.input_tokens
    byModel[s.model].output += s.output_tokens
  }

  return (
    <div className="token-bar">
      <button className="token-bar-toggle" onClick={() => setExpanded(v => !v)}>
        <span className="token-bar-summary">
          ▸ Token 用量　輸入 <strong>{totals.input.toLocaleString()}</strong>　輸出 <strong>{totals.output.toLocaleString()}</strong>
        </span>
        <span className={`token-bar-arrow${expanded ? ' token-bar-arrow--open' : ''}`}>▾</span>
      </button>
      {expanded && (
        <div className="token-bar-detail">
          <div className="token-bar-models">
            {Object.entries(byModel).map(([m, v]) => (
              <div key={m} className="token-bar-model-row">
                <span className="token-bar-model-name">{m}</span>
                <span className="token-bar-model-nums">↑{v.input.toLocaleString()} ↓{v.output.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="token-bar-stages">
            {stats.map((s, i) => (
              <span key={i} className="token-bar-stage-chip">
                {STAGE_LABEL[s.stage] ?? s.stage} {s.input_tokens}+{s.output_tokens}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MessageRefs({ refs }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="message-refs">
      <button className="message-refs-toggle" onClick={() => setExpanded(v => !v)}>
        <span className="message-refs-label">REF：</span>
        <span className="message-refs-badges">
          {refs.map((_, i) => <span key={i} className="message-ref-badge">[{i + 1}]</span>)}
        </span>
        <span className={`message-refs-arrow${expanded ? ' message-refs-arrow--open' : ''}`}>▸</span>
      </button>
      {expanded && (
        <div className="message-refs-list">
          {refs.map((ref, i) => (
            <div key={i} className="message-ref-item">
              <span className="message-ref-badge">[{i + 1}]</span>
              {ref.url ? (
                <a href={ref.url} target="_blank" rel="noreferrer" className="message-ref-link">
                  {ref.title || ref.url}
                </a>
              ) : (
                <span className="message-ref-text">{ref.question}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ChatPanel({ messages, onSendMessage, active, isTyping, onUpdateRouterMode, onConfirmRoute, tokenStats }) {
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
      <TokenBar stats={tokenStats} />
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
            {messages.map(msg => {
              if (msg.role === 'router') {
                return (
                  <div key={msg.id} className="router-card">
                    {msg.status === 'routing' && (
                      <div className="router-loading">
                        <div className="router-spinner" />
                        <span>AI 正在分析訊息…</span>
                      </div>
                    )}

                    {msg.status === 'pending' && (
                      <>
                        <div className="router-header">
                          <span className="router-label">AI 判斷分流</span>
                          {msg.reason && <span className="router-reason">{msg.reason}</span>}
                        </div>
                        <div className="router-modes">
                          {MODE_CONFIG.map(m => (
                            <button
                              key={m.key}
                              className={`router-mode-btn${msg.selectedMode === m.key ? ' router-mode-btn--selected' : ''}`}
                              onClick={() => onUpdateRouterMode(msg.id, m.key)}
                            >
                              <span className="router-mode-icon">{m.icon}</span>
                              <span className="router-mode-label">{m.label}</span>
                              {msg.suggestedMode === m.key && <span className="router-ai-tag">AI</span>}
                            </button>
                          ))}
                        </div>
                        <button
                          className="router-confirm-btn"
                          onClick={() => onConfirmRoute(msg.id, msg.selectedMode)}
                        >
                          確認並送出
                        </button>
                      </>
                    )}

                    {msg.status === 'confirmed' && (() => {
                      const m = MODE_CONFIG.find(m => m.key === msg.confirmedMode)
                      return m ? (
                        <div className="router-confirmed">
                          {m.icon} 已使用：{m.label}
                        </div>
                      ) : null
                    })()}
                  </div>
                )
              }

              return (
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
                    {msg.text && (
                      <ReactMarkdown remarkPlugins={[remarkGfm]} className="md">
                        {msg.text}
                      </ReactMarkdown>
                    )}
                  </div>
                  {msg.refs && msg.refs.length > 0 && <MessageRefs refs={msg.refs} />}
                </div>
              )
            })}

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

        <button className="btn-send" onClick={handleSend} disabled={!canSend} title="送出">↑</button>
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
