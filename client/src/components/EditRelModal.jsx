const RELATION_TYPES = ['朋友', '恋人', '家人', '对手', '师徒', '室友', '邻居'];

export default function EditRelModal({ selectedRel, editType, setEditType, onSave, onDelete, onClose }) {
  if (!selectedRel) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content card" onClick={e => e.stopPropagation()}>
        <h3>编辑关系</h3>
        <p className="rel-info">{selectedRel.from_name} ↔ {selectedRel.to_name}</p>
        <div className="form-group">
          <label>关系类型</label>
          <div className="rel-type-selector">
            {RELATION_TYPES.map(t => (
              <button key={t} type="button" className={`mood-btn ${editType === t ? 'active' : ''}`} onClick={() => setEditType(t)}>{t}</button>
            ))}
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-danger" onClick={onDelete}>删除关系</button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-outline" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={onSave}>保存</button>
        </div>
      </div>
    </div>
  );
}
