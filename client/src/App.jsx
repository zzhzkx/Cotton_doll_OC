import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { auth } from './api';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import DollDetail from './pages/DollDetail';
import DollForm from './pages/DollForm';
import DiaryEditor from './pages/DiaryEditor';
import GraphPage from './pages/GraphPage';
import Profile from './pages/Profile';
import './styles/global.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      auth.me()
        .then(setUser)
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '18px', color: 'var(--color-primary-dark)' }}>
        加载中...
      </div>
    );
  }

  return (
    <BrowserRouter>
      {user && <Navbar user={user} setUser={setUser} />}
      <main style={{ paddingTop: user ? '80px' : '0' }}>
        <Routes>
          <Route path="/login" element={
            user ? <Navigate to="/" /> : <Login setUser={setUser} />
          } />
          <Route path="/" element={
            user ? <Home /> : <Navigate to="/login" />
          } />
          <Route path="/doll/:id" element={
            user ? <DollDetail /> : <Navigate to="/login" />
          } />
          <Route path="/doll/new" element={
            user ? <DollForm /> : <Navigate to="/login" />
          } />
          <Route path="/doll/:id/edit" element={
            user ? <DollForm /> : <Navigate to="/login" />
          } />
          <Route path="/diary/:dollId/new" element={
            user ? <DiaryEditor /> : <Navigate to="/login" />
          } />
          <Route path="/graph" element={
            user ? <GraphPage /> : <Navigate to="/login" />
          } />
          <Route path="/profile" element={
            user ? <Profile user={user} /> : <Navigate to="/login" />
          } />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
