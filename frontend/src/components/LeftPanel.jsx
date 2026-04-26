import { useState, useEffect } from 'react'

export default function LeftPanel({
  chats, activeChatId, onSelectChat, onAddChat, onDeleteChat, onRenameChat,
  collapsed, onToggleCollapse, theme, onToggleTheme,
  mobileOpen, onMobileClose
}) {
  const [openMenuId, setOpenMenuId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')

  useEffect(() => {
    if (!openMenuId) return
    const close = () => setOpenMenuId(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [openMenuId])

  const startEdit = (chat, e) => {
    e.stopPropagation()
    setEditingId(chat.id)
    setEditValue(chat.name)
    setOpenMenuId(null)
  }

  const submitEdit = (id) => {
    if (editValue.trim()) onRenameChat(id, editValue.trim())
    setEditingId(null)
  }

  if (collapsed && !mobileOpen) {
    return (
      <aside className="left-panel left-panel--collapsed">
        <button className="collapse-toggle" onClick={onToggleCollapse} title="展開側邊欄">›</button>
        <button
          className="btn-theme-icon"
          onClick={onToggleTheme}
          title={theme === 'dark' ? '切換至亮色模式' : '切換至暗色模式'}
        >
          {theme === 'dark' ? '☀' : '☽'}
        </button>
      </aside>
    )
  }

  return (
    <aside className={`left-panel${mobileOpen ? ' left-panel--mobile-open' : ''}`}>
      <div className="panel-header">
        <span className="panel-title">對話記錄</span>
        <button className="btn-icon" onClick={onAddChat} title="新增對話">＋</button>
      </div>

      <ul className="chat-list">
        {chats.length === 0 && (
          <li className="chat-empty-hint">尚無對話，請點擊 ＋ 新增</li>
        )}
        {chats.map(chat => (
          <li
            key={chat.id}
            className={`chat-item${activeChatId === chat.id ? ' chat-item--active' : ''}`}
            onClick={() => { if (editingId !== chat.id) onSelectChat(chat.id) }}
          >
            {editingId === chat.id ? (
              <input
                className="chat-rename-input"
                value={editValue}
                autoFocus
                onChange={e => setEditValue(e.target.value)}
                onBlur={() => submitEdit(chat.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter') submitEdit(chat.id)
                  if (e.key === 'Escape') setEditingId(null)
                }}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span className="chat-name">{chat.name}</span>
            )}

            <div className="chat-menu-container" onClick={e => e.stopPropagation()}>
              <button
                className="btn-icon btn-gear"
                title="設定"
                onClick={() => setOpenMenuId(openMenuId === chat.id ? null : chat.id)}
              >⚙</button>
              {openMenuId === chat.id && (
                <div className="chat-dropdown">
                  <button onClick={(e) => startEdit(chat, e)}>編輯名稱</button>
                  <button
                    className="danger"
                    onClick={() => { onDeleteChat(chat.id); setOpenMenuId(null) }}
                  >刪除對話</button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="panel-footer">
        <button
          className="btn-theme"
          onClick={onToggleTheme}
          title={theme === 'dark' ? '切換至亮色模式' : '切換至暗色模式'}
        >
          {theme === 'dark' ? '☀ 亮色' : '☽ 暗色'}
        </button>
        <button className="collapse-toggle" onClick={onToggleCollapse} title="收起側邊欄">‹</button>
      </div>
    </aside>
  )
}
