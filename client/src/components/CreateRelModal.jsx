import { useState } from 'react';

const RELATION_TYPES = ['朋友', '恋人', '家人', '对手', '师徒', '室友', '邻居'];

export default function CreateRelModal({ allDolls, onSubmit, onClose }) {
  const [fromDoll, setFromDoll] = useState('');
  const [toDoll, setToDoll] = useState('');
  const [type, setType] = useState('朋友');

  const handleSubmit = () => {
    if (!fromDoll || !toDoll) return;
    onSubmit({ from_doll: Number(fromDoll), to_doll: Number(toDoll), type });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content card" onClick={e => e.stopPropagation()}>
        <h3>新建关系</h3>
        <div className="form-group">
          <label>娃娃A</label>
          <select value={fromDoll} onChange={e => setFromDoll(e.target.value)}>
            <option value="">请选择</option>
            {allDolls.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>娃娃B</label>
          <select value={toDoll} onChange={e => setToDoll(e.target.value)}>
            <option value="">请选择</option>
            {allDolls.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>关系类型</label>
          <div className="rel-type-selector">
            {RELATION_TYPES.map(t => (
              <button key={t} type="button" className={`mood-btn ${type === t ? 'active' : ''}`} onClick={() => setType(t)}>{t}</button>
            ))}
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-outline" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSubmit}>创建</button>
        </div>
      </div>
    </div>
  );
}
