import { useState } from 'react';
import { auth } from '../api';
import './Login.css';

export default function Login({ setUser }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        await auth.register(username, password);
        // 注册成功后自动登录
        const { token } = await auth.login(username, password);
        localStorage.setItem('token', token);
        const user = await auth.me();
        setUser(user);
      } else {
        const { token } = await auth.login(username, password);
        localStorage.setItem('token', token);
        const user = await auth.me();
        setUser(user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container fade-in-up">
        <div className="login-header">
          <h1>🌸 棉花娃娃之家</h1>
          <p>记录你的每一个棉花娃娃</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <h2>{isRegister ? '注册账号' : '欢迎回来'}</h2>

          {error && <div className="error-msg">{error}</div>}

          <div className="form-group">
            <label htmlFor="username">用户名</label>
            <input
              id="username"
              type="text"
              placeholder="请输入用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">密码</label>
            <input
              id="password"
              type="password"
              placeholder={isRegister ? '至少6位' : '请输入密码'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading ? '请稍候...' : (isRegister ? '注册并登录' : '登录')}
          </button>

          <p className="login-switch">
            {isRegister ? '已有账号？' : '没有账号？'}
            <button type="button" className="link-btn" onClick={() => { setIsRegister(!isRegister); setError(''); }}>
              {isRegister ? '去登录' : '去注册'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
