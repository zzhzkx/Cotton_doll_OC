import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { dolls } from '../api';
import './DollDetail.css';

const MOOD_EMOJI = {
  '开心': '😊', '困困': '😴', '兴奋': '🤩', '难过': '😢',
  '生气': '😤', '害羞': '😳', '无聊': '😑', '害怕': '😨'
};

export default function DollDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doll, setDoll] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dolls.get(id)
      .then(setDoll)
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleDelete = async () => {
    if (!window.confirm('确定要删除这个娃娃吗？相关的日记和关系也会被删除。')) return;
    try {
      await dolls.delete(id);
      navigate('/');
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div className="container" style={{ paddingTop: '40px' }}>加载中...</div>;
  if (!doll) return null;

  return (
    <div className="doll-detail container fade-in-up">
      <div className="detail-main">
        <div className="detail-image">
          {doll.image || doll.avatar ? (
            <img src={doll.image || doll.avatar} alt={doll.name} />
          ) : (
            <div className="image-placeholder">
              <span>{doll.name.charAt(0)}</span>
            </div>
          )}
        </div>

        <div className="detail-info">
          <div className="detail-header">
            <h1>{doll.name}</h1>
            <div className="detail-actions">
              <Link to={`/doll/${id}/edit`} className="btn btn-outline btn-sm">编辑</Link>
              <button onClick={handleDelete} className="btn btn-danger btn-sm">删除</button>
            </div>
          </div>

          {doll.birthday && (
            <div className="detail-field">
              <span className="field-label">生日</span>
              <span>{doll.birthday}</span>
            </div>
          )}

          {doll.bio && (
            <div className="detail-field">
              <span className="field-label">简介</span>
              <span>{doll.bio}</span>
            </div>
          )}

          {doll.story && (
            <div className="detail-story">
              <span className="field-label">故事</span>
              <p>{doll.story}</p>
            </div>
          )}

          {doll.relationships && doll.relationships.length > 0 && (
            <div className="detail-relationships">
              <span className="field-label">关系</span>
              <div className="rel-list">
                {doll.relationships.map(rel => {
                  const otherId = rel.from_doll === doll.id ? rel.to_doll : rel.from_doll;
                  const otherName = rel.from_doll === doll.id ? rel.to_name : rel.from_name;
                  return (
                    <Link key={rel.id} to={`/doll/${otherId}`} className="rel-tag">
                      {rel.type}：{otherName}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="detail-diary">
        <div className="diary-header">
          <h2>日记</h2>
          <Link to={`/diary/${id}/new`} className="btn btn-secondary btn-sm">
            + 写日记
          </Link>
        </div>

        {doll.diary && doll.diary.length > 0 ? (
          <div className="diary-timeline">
            {doll.diary.map(entry => (
              <div key={entry.id} className="diary-entry card fade-in-up">
                <div className="diary-meta">
                  <span className="diary-date">
                    {new Date(entry.created_at).toLocaleDateString('zh-CN')}
                  </span>
                  {entry.mood && (
                    <span className="diary-mood">
                      {MOOD_EMOJI[entry.mood] || ''} {entry.mood}
                    </span>
                  )}
                </div>
                <h3 className="diary-title">{entry.title}</h3>
                <p className="diary-content">{entry.content}</p>
                {entry.media_url && entry.media_type === 'image' && (
                  <img
                    src={entry.media_url}
                    alt="日记图片"
                    className="diary-media"
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-diary">
            <p>还没有日记呢，为 {doll.name} 写第一篇吧！</p>
          </div>
        )}
      </div>
    </div>
  );
}
