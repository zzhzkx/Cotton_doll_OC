import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dolls } from '../api';
import DollCard from '../components/DollCard';
import './Home.css';

export default function Home() {
  const [dollList, setDollList] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dolls.list()
      .then(setDollList)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = dollList.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="container" style={{ paddingTop: '40px' }}>加载中...</div>;
  }

  return (
    <div className="home container fade-in-up">
      <div className="home-header">
        <h1>我的棉花娃娃</h1>
        <Link to="/doll/new" className="btn btn-primary">
          + 添加娃娃
        </Link>
      </div>

      {dollList.length > 0 && (
        <div className="search-bar">
          <input
            type="text"
            placeholder="搜索娃娃名字..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🧸</div>
          <h2>{dollList.length === 0 ? '还没有娃娃哦' : '没有找到匹配的娃娃'}</h2>
          <p>{dollList.length === 0 ? '快来添加你的第一个棉花娃娃吧！' : '试试其他关键词？'}</p>
          {dollList.length === 0 && (
            <Link to="/doll/new" className="btn btn-primary" style={{ marginTop: '16px' }}>
              + 添加第一个娃娃
            </Link>
          )}
        </div>
      ) : (
        <div className="doll-grid">
          {filtered.map(doll => (
            <DollCard key={doll.id} doll={doll} />
          ))}
        </div>
      )}
    </div>
  );
}
