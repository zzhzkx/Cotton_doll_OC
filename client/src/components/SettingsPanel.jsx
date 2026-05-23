import './SettingsPanel.css';

export default function SettingsPanel({ settings, setSettings }) {
  const { centerStrength, repulsion, nodeSize, linkThickness, showArrows, textOpacity } = settings;
  const { setCenterStrength, setRepulsion, setNodeSize, setLinkThickness, setShowArrows, setTextOpacity } = setSettings;

  return (
    <div className="settings-panel fade-in-up">
      <div className="settings-section">
        <h3 className="settings-section-title">力学</h3>
        <div className="settings-row">
          <span className="settings-label">向心力</span>
          <input type="range" min="0" max="100" value={centerStrength} onInput={e => setCenterStrength(Number(e.target.value))} className="settings-slider" />
          <span className="settings-value">{centerStrength}%</span>
        </div>
        <div className="settings-row">
          <span className="settings-label">排斥力</span>
          <input type="range" min="0" max="100" value={repulsion} onInput={e => setRepulsion(Number(e.target.value))} className="settings-slider" />
          <span className="settings-value">{repulsion}%</span>
        </div>
      </div>
      <div className="settings-section">
        <h3 className="settings-section-title">外观</h3>
        <div className="settings-row">
          <span className="settings-label">箭头</span>
          <button className={`toggle-btn ${showArrows ? 'on' : 'off'}`} onClick={() => setShowArrows(!showArrows)}>
            {showArrows ? '开' : '关'}
          </button>
        </div>
        <div className="settings-row">
          <span className="settings-label">文本透明度</span>
          <input type="range" min="0" max="100" value={textOpacity} onInput={e => setTextOpacity(Number(e.target.value))} className="settings-slider" />
          <span className="settings-value">{textOpacity}%</span>
        </div>
        <div className="settings-row">
          <span className="settings-label">节点大小</span>
          <input type="range" min="12" max="50" value={nodeSize} onInput={e => setNodeSize(Number(e.target.value))} className="settings-slider" />
          <span className="settings-value">{nodeSize}</span>
        </div>
        <div className="settings-row">
          <span className="settings-label">连线粗细</span>
          <input type="range" min="0.5" max="6" step="0.25" value={linkThickness} onInput={e => setLinkThickness(Number(e.target.value))} className="settings-slider" />
          <span className="settings-value">{linkThickness}</span>
        </div>
      </div>
    </div>
  );
}
