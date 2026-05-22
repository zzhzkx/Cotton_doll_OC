import { Link, useNavigate, useLocation } from 'react-router-dom';
import './Navbar.css';

export default function Navbar({ user, setUser }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">
          <span className="brand-icon">🌸</span>
          <span className="brand-text">棉花娃娃之家</span>
        </Link>

        <div className="navbar-links">
          <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>
            首页
          </Link>
          <Link to="/graph" className={`nav-link ${location.pathname === '/graph' ? 'active' : ''}`}>
            关系图谱
          </Link>
          <Link to="/profile" className={`nav-link ${location.pathname === '/profile' ? 'active' : ''}`}>
            我的
          </Link>
        </div>

        <div className="navbar-user">
          <span className="username">{user.username}</span>
          <button onClick={handleLogout} className="btn btn-outline btn-sm">
            退出
          </button>
        </div>
      </div>
    </nav>
  );
}
