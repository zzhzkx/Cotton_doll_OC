export default function ModeBanner({ createMode, relStep, relNodeA, relNodeB, onConfirmRel, highlightNodeName, onClearHighlight, allDolls }) {
  if (createMode) {
    return (
      <div className="mode-banner fade-in-up">
        {relStep === 0 && <span>👆 <strong>第一步：</strong>点击选择第一个娃娃（A）</span>}
        {relStep === 1 && <span>👆 <strong>第二步：</strong>点击选择第二个娃娃（B）<small> 已选：{relNodeA?.name}</small></span>}
        {relStep === 2 && (
          <span className="rel-confirm-row">
            <span className="rel-confirm-info">
              ✅ <strong>{relNodeA?.name}</strong> ↔ <strong>{relNodeB?.name}</strong>
              <small> 选择关系类型：</small>
            </span>
            <span className="rel-confirm-btns">
              {['朋友','恋人','家人','对手','师徒','室友','邻居'].map(t => (
                <button key={t} className="mode-type-btn" onClick={() => onConfirmRel(t)}>{t}</button>
              ))}
            </span>
          </span>
        )}
      </div>
    );
  }

  if (highlightNodeName) {
    return (
      <div className="mode-banner highlight-banner fade-in-up">
        <span>🔍 <strong>{highlightNodeName}</strong> 的关系网络</span>
        <button className="banner-close" onClick={onClearHighlight}>✕</button>
      </div>
    );
  }

  return null;
}
