import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { diary } from '../api';
import './DiaryEditor.css';

const MOODS = ['开心', '困困', '兴奋', '难过', '生气', '害羞', '无聊', '害怕'];
const MOOD_EMOJI = {
  '开心': '😊', '困困': '😴', '兴奋': '🤩', '难过': '😢',
  '生气': '😤', '害羞': '😳', '无聊': '😑', '害怕': '😨'
};

export default function DiaryEditor() {
  const { dollId } = useParams();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mood, setMood] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleMediaChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('标题不能为空');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('doll_id', dollId);
      formData.append('title', title);
      formData.append('content', content);
      formData.append('mood', mood);
      if (mediaFile) {
        formData.append('media', mediaFile);
        formData.append('media_type', mediaFile.type.startsWith('video') ? 'video' : 'image');
      } else {
        formData.append('media_type', 'text');
      }

      await diary.create(formData);
      navigate(`/doll/${dollId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="diary-editor-page container fade-in-up">
      <h1>写日记</h1>

      <form onSubmit={handleSubmit} className="diary-form card">
        {error && <div className="error-msg">{error}</div>}

        <div className="form-group">
          <label htmlFor="title">标题 *</label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="今天发生了什么有趣的事？"
            required
          />
        </div>

        <div className="form-group">
          <label>心情</label>
          <div className="mood-selector">
            {MOODS.map(m => (
              <button
                key={m}
                type="button"
                className={`mood-btn ${mood === m ? 'active' : ''}`}
                onClick={() => setMood(mood === m ? '' : m)}
              >
                {MOOD_EMOJI[m]} {m}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="content">正文</label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="写下你的故事..."
            rows={8}
          />
        </div>

        <div className="form-group">
          <label>添加图片/视频</label>
          <div className="upload-area" onClick={() => document.getElementById('media-input').click()}>
            {mediaPreview ? (
              mediaFile?.type?.startsWith('video') ? (
                <video src={mediaPreview} className="upload-preview" controls />
              ) : (
                <img src={mediaPreview} alt="预览" className="upload-preview" />
              )
            ) : (
              <span className="upload-hint">点击上传图片或视频</span>
            )}
          </div>
          <input id="media-input" type="file" accept="image/*,video/*" onChange={handleMediaChange} hidden />
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-outline" onClick={() => navigate(-1)}>取消</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? '发布中...' : '发布日记'}
          </button>
        </div>
      </form>
    </div>
  );
}
