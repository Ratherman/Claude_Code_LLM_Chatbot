import { useState } from 'react'

const TOGGLES = [
  { key: 'rag',          label: 'RAG 知識庫檢索' },
  { key: 'skill',        label: 'SKILL 技能加載' },
  { key: 'functionCall', label: 'Function Call 上網查詢' },
  { key: 'guardrail',    label: 'NeMo Guardrail 安全防護' },
  { key: 'tokenLog',     label: 'Token 與模型記錄' },
]

export default function RightPanel({ collapsed, onToggleCollapse }) {
  const [temperature, setTemperature] = useState(1.0)

  if (collapsed) {
    return (
      <aside className="right-panel right-panel--collapsed">
        <button className="collapse-toggle" onClick={onToggleCollapse} title="展開設定欄">‹</button>
      </aside>
    )
  }

  return (
    <aside className="right-panel">
      <div className="panel-header">
        <span className="panel-title">參數設定</span>
        <button className="collapse-toggle" onClick={onToggleCollapse} title="收起設定欄">›</button>
      </div>

      <div className="settings-content">

        <div className="setting-group">
          <label className="setting-label">切換模型</label>
          <select className="setting-select" disabled>
            <option>GPT-4o</option>
            <option>GPT-4o mini</option>
            <option>GPT-3.5 Turbo</option>
          </select>
          <span className="setting-soon">即將開放</span>
        </div>

        <div className="setting-group">
          <div className="setting-row">
            <label className="setting-label">溫度值</label>
            <span className="setting-value">{temperature.toFixed(1)}</span>
          </div>
          <input
            type="range" min="0" max="2" step="0.1"
            value={temperature}
            onChange={e => setTemperature(parseFloat(e.target.value))}
            className="setting-slider"
            disabled
          />
          <span className="setting-soon">即將開放</span>
        </div>

        <div className="setting-group">
          <label className="setting-label">系統提示詞</label>
          <textarea
            className="setting-textarea"
            placeholder="輸入 System Prompt…"
            rows={4}
            disabled
          />
          <span className="setting-soon">即將開放</span>
        </div>

        <div className="setting-group">
          <label className="setting-label">多輪對話記憶數量</label>
          <input type="number" className="setting-number" min="1" max="20" defaultValue={10} disabled />
          <span className="setting-soon">即將開放</span>
        </div>

        <div className="setting-divider" />

        {TOGGLES.map(t => (
          <div key={t.key} className="setting-toggle">
            <span className="toggle-label">{t.label}</span>
            <label className="toggle-switch">
              <input type="checkbox" disabled />
              <span className="toggle-track"><span className="toggle-thumb" /></span>
            </label>
          </div>
        ))}

      </div>
    </aside>
  )
}
