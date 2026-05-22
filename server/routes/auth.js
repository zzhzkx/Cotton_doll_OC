const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb, saveToDisk } = require('../db/init');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// 注册
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少6位' });
    }

    const db = await getDb();

    // 检查用户名是否已存在
    const existing = db.exec('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0 && existing[0].values.length > 0) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
    saveToDisk();

    res.json({ message: '注册成功' });
  } catch (err) {
    res.status(500).json({ error: '注册失败：' + err.message });
  }
});

// 登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const db = await getDb();
    const result = db.exec('SELECT id, password FROM users WHERE username = ?', [username]);

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const [userId, hashedPassword] = result[0].values[0];
    const isValid = await bcrypt.compare(password, hashedPassword);
    if (!isValid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, message: '登录成功' });
  } catch (err) {
    res.status(500).json({ error: '登录失败：' + err.message });
  }
});

// 获取当前用户信息
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const result = db.exec('SELECT id, username, avatar FROM users WHERE id = ?', [req.userId]);

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const [id, username, avatar] = result[0].values[0];
    res.json({ id, username, avatar });
  } catch (err) {
    res.status(500).json({ error: '获取用户信息失败：' + err.message });
  }
});

module.exports = router;
