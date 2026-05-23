import './GraphToolbar.css';

export default function GraphToolbar({ showSettings, setShowSettings, onFitView, createMode, toggleCreateMode, onManualCreate }) {
  return (
    <div className="graph-toolbar">
      <h2>关系图谱</h2>
      <div className="toolbar-center">
        <button className="toolbar-icon-btn" onClick={onFitView} title="自动适配视图">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
          </svg>
        </button>
        <button className={`toolbar-icon-btn ${showSettings ? 'active' : ''}`} onClick={() => setShowSettings(!showSettings)} title="图谱设置">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
          </svg>
        </button>
      </div>
      <div className="toolbar-actions">
        <button className={`btn btn-sm ${createMode ? 'btn-danger' : 'btn-secondary'}`} onClick={toggleCreateMode}>
          {createMode ? '✕ 退出创建' : '🔗 新建关系'}
        </button>
        <button className="btn btn-outline btn-sm" onClick={onManualCreate}>手动选择</button>
      </div>
    </div>
  );
}
