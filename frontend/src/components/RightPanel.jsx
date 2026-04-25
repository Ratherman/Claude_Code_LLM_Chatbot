import { useState } from 'react'

const MODELS = [
  { value: 'gpt-4o',        label: 'GPT-4o' },
  { value: 'gpt-5.4',       label: 'GPT-5.4' },
  { value: 'gpt-5.4-mini',  label: 'GPT-5.4 mini' },
]

const TOGGLES = [
  { key: 'rag',          label: 'RAG 知識庫檢索' },
  { key: 'skill',        label: 'SKILL 技能加載' },
  { key: 'functionCall', label: 'Function Call 上網查詢' },
  { key: 'guardrail',    label: 'NeMo Guardrail 安全防護' },
  { key: 'tokenLog',     label: 'Token 與模型記錄' },
]

export default function RightPanel({ collapsed, onToggleCollapse, settings, onModelChange, onTemperatureChange, onSystemPromptSave }) {
  const [tempValue, setTempValue] = useState(settings?.temperature ?? 1.0)
  const [promptValue, setPromptValue] = useState(settings?.systemPrompt ?? '')

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
          <select
            className="setting-select"
            value={settings?.model ?? 'gpt-4o'}
            onChange={e => onModelChange(e.target.value)}
          >
            {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>

        <div className="setting-group">
          <div className="setting-row">
            <label className="setting-label">溫度值</label>
            <span className="setting-value">{tempValue.toFixed(1)}</span>
          </div>
          <input
            type="range" min="0" max="1" step="0.1"
            value={tempValue}
            onChange={e => setTempValue(parseFloat(e.target.value))}
            onPointerUp={e => onTemperatureChange(parseFloat(e.target.value))}
            className="setting-slider"
          />
        </div>

        <div className="setting-group">
          <label className="setting-label">系統提示詞</label>
          <textarea
            className="setting-textarea"
            value={promptValue}
            onChange={e => setPromptValue(e.target.value)}
            placeholder="輸入 System Prompt…"
            rows={4}
          />
          <button className="btn-save" onClick={() => onSystemPromptSave(promptValue)}>
            儲存
          </button>
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
