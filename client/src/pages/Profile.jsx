import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dolls } from '../api';
import DollCard from '../components/DollCard';
import './Profile.css';

export default function Profile({ user }) {
  const [dollList, setDollList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dolls.list()
      .then(setDollList)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="profile-page container fade-in-up">
      <div className="profile-header card">
        <div className="profile-avatar">
          {user.avatar ? (
            <img src={user.avatar} alt={user.username} />
          ) : (
            <div className="avatar-placeholder-lg">
              {user.username.charAt(0)}
            </div>
          )}
        </div>
        <div className="profile-info">
          <h1>{user.username}</h1>
          <p className="profile-stats">
            共有 <strong>{dollList.length}</strong> 个棉花娃娃
          </p>
        </div>
      </div>

      <div className="profile-section">
        <div className="section-header">
          <h2>我的娃娃</h2>
          <Link to="/doll/new" className="btn btn-primary btn-sm">
            + 添加娃娃
          </Link>
        </div>

        {loading ? (
          <p>加载中...</p>
        ) : dollList.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🧸</div>
            <p>还没有娃娃，快去添加吧！</p>
          </div>
        ) : (
          <div className="doll-grid">
            {dollList.map(doll => (
              <DollCard key={doll.id} doll={doll} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
