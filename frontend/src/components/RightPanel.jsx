import { useState } from 'react'

const MODELS = [
  { value: 'gpt-4o',        label: 'GPT-4o' },
  { value: 'gpt-5.4',       label: 'GPT-5.4' },
  { value: 'gpt-5.4-mini',  label: 'GPT-5.4 mini' },
]

const FEATURE_TOGGLES = [
  { key: 'ragEnabled',          label: 'RAG 知識庫檢索' },
  { key: 'skillEnabled',        label: 'SKILL 技能加載' },
  { key: 'functionCallEnabled', label: 'Function Call 上網查詢' },
]

const DISABLED_TOGGLES = [
  { key: 'guardrail', label: 'NeMo Guardrail 安全防護' },
  { key: 'tokenLog',  label: 'Token 與模型記錄' },
]

export default function RightPanel({
  collapsed, onToggleCollapse,
  settings, onModelChange, onTemperatureChange, onSystemPromptSave, onMemoryChange, onToggleChange
}) {
  const [tempValue, setTempValue] = useState(settings?.temperature ?? 1.0)
  const [promptValue, setPromptValue] = useState(settings?.systemPrompt ?? '')
  const [memoryValue, setMemoryValue] = useState(settings?.memoryCount ?? 5)

  if (collapsed) {
    return (
      <aside className="right-panel right-panel--collapsed">
        <button className="collapse-toggle" onClick={onToggleCollapse} title="展開設定欄">‹</button>
      </aside>
    )
  }

  const routerOn = !!settings?.contextRouter

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
          <button className="btn-save" onClick={() => onSystemPromptSave(promptValue)}>儲存</button>
        </div>

        <div className="setting-group">
          <div className="setting-row">
            <label className="setting-label">對話記憶輪數</label>
            <span className="setting-value">{memoryValue}</span>
          </div>
          <input
            type="range" min="1" max="10" step="1"
            value={memoryValue}
            onChange={e => setMemoryValue(parseInt(e.target.value))}
            onPointerUp={e => onMemoryChange(parseInt(e.target.value))}
            className="setting-slider"
          />
        </div>

        <div className="setting-divider" />

        {/* Context Router — master switch */}
        <div className="setting-toggle">
          <div className="toggle-label-group">
            <span className="toggle-label">Context Router 分流</span>
            <span className="toggle-sublabel">啟用後才可使用下方功能</span>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={routerOn}
              onChange={e => onToggleChange('contextRouter', e.target.checked)}
            />
            <span className="toggle-track"><span className="toggle-thumb" /></span>
          </label>
        </div>

        {/* Auto Mode — dim when router is off */}
        <div className={`setting-toggle${!routerOn ? ' setting-toggle--dim' : ''}`}>
          <div className="toggle-label-group">
            <span className="toggle-label">自動分流模式</span>
            <span className="toggle-sublabel">AI 判斷後直接送出，不等確認</span>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={!!settings?.autoRoute}
              disabled={!routerOn}
              onChange={e => onToggleChange('autoRoute', e.target.checked)}
            />
            <span className="toggle-track"><span className="toggle-thumb" /></span>
          </label>
        </div>

        <div className="setting-divider" />

        {/* Sub-features — dim when router is off */}
        {FEATURE_TOGGLES.map(t => (
          <div key={t.key} className={`setting-toggle${!routerOn ? ' setting-toggle--dim' : ''}`}>
            <span className="toggle-label">{t.label}</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={!!settings?.[t.key]}
                disabled={!routerOn}
                onChange={e => onToggleChange(t.key, e.target.checked)}
              />
              <span className="toggle-track"><span className="toggle-thumb" /></span>
            </label>
          </div>
        ))}

        <div className="setting-divider" />

        {/* Still disabled */}
        {DISABLED_TOGGLES.map(t => (
          <div key={t.key} className="setting-toggle setting-toggle--dim">
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
