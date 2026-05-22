import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { dolls } from '../api';
import DatePicker from '../components/DatePicker';
import './DollForm.css';

export default function DollForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [bio, setBio] = useState('');
  const [story, setStory] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isEdit) {
      dolls.get(id).then(doll => {
        setName(doll.name);
        setBirthday(doll.birthday || '');
        setBio(doll.bio || '');
        setStory(doll.story || '');
        if (doll.avatar) setAvatarPreview(doll.avatar);
        if (doll.image) setImagePreview(doll.image);
      }).catch(() => navigate('/'));
    }
  }, [id, isEdit, navigate]);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('娃娃名字不能为空');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('birthday', birthday);
      formData.append('bio', bio);
      formData.append('story', story);
      if (avatarFile) formData.append('avatar', avatarFile);
      if (imageFile) formData.append('image', imageFile);

      if (isEdit) {
        await dolls.update(id, formData);
        navigate(`/doll/${id}`);
      } else {
        const newDoll = await dolls.create(formData);
        navigate(`/doll/${newDoll.id}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="doll-form-page container fade-in-up">
      <h1>{isEdit ? '编辑娃娃' : '添加新娃娃'}</h1>

      <form onSubmit={handleSubmit} className="doll-form card">
        {error && <div className="error-msg">{error}</div>}

        <div className="form-row">
          <div className="upload-group">
            <label className="upload-label">头像</label>
            <div className="upload-area" onClick={() => document.getElementById('avatar-input').click()}>
              {avatarPreview ? (
                <img src={avatarPreview} alt="头像预览" className="upload-preview" />
              ) : (
                <span className="upload-hint">点击上传</span>
              )}
            </div>
            <input id="avatar-input" type="file" accept="image/*" onChange={handleAvatarChange} hidden />
          </div>

          <div className="upload-group">
            <label className="upload-label">全身照</label>
            <div className="upload-area wide" onClick={() => document.getElementById('image-input').click()}>
              {imagePreview ? (
                <img src={imagePreview} alt="照片预览" className="upload-preview" />
              ) : (
                <span className="upload-hint">点击上传</span>
              )}
            </div>
            <input id="image-input" type="file" accept="image/*" onChange={handleImageChange} hidden />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="name">娃娃名字 *</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="给娃娃起个名字" required />
        </div>

        <div className="form-group">
          <label htmlFor="birthday">生日 / 入坑日</label>
          <DatePicker value={birthday} onChange={setBirthday} placeholder="点击选择日期" />
        </div>

        <div className="form-group">
          <label htmlFor="bio">一句话简介</label>
          <input id="bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="用一句话介绍这个娃娃" maxLength={100} />
        </div>

        <div className="form-group">
          <label htmlFor="story">专属故事</label>
          <textarea id="story" value={story} onChange={(e) => setStory(e.target.value)} placeholder="写下这个娃娃的故事..." rows={6} />
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-outline" onClick={() => navigate(-1)}>取消</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? '保存中...' : (isEdit ? '保存修改' : '创建娃娃')}
          </button>
        </div>
      </form>
    </div>
  );
}
