const express = require('express');
const multer = require('multer');
const path = require('path');
const { getDb, saveToDisk } = require('../db/init');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `diary_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

function queryToObjects(result) {
  if (!result || result.length === 0) return [];
  const columns = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

// 获取娃娃的所有日记
router.get('/:dollId', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const result = db.exec(
      'SELECT * FROM diary_entries WHERE doll_id = ? AND owner_id = ? ORDER BY created_at DESC',
      [req.params.dollId, req.userId]
    );
    res.json(queryToObjects(result));
  } catch (err) {
    res.status(500).json({ error: '获取日记失败：' + err.message });
  }
});

// 创建日记
router.post('/', authMiddleware, upload.single('media'), async (req, res) => {
  try {
    const { doll_id, title, content, mood, media_type } = req.body;
    if (!doll_id || !title) {
      return res.status(400).json({ error: '娃娃ID和标题不能为空' });
    }

    const mediaUrl = req.file ? `/uploads/${req.file.filename}` : '';

    const db = await getDb();
    db.run(
      'INSERT INTO diary_entries (doll_id, title, content, media_type, media_url, mood, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [doll_id, title, content || '', media_type || 'text', mediaUrl, mood || '', req.userId]
    );
    saveToDisk();

    const result = db.exec('SELECT * FROM diary_entries WHERE owner_id = ? ORDER BY id DESC LIMIT 1', [req.userId]);
    res.status(201).json(queryToObjects(result)[0]);
  } catch (err) {
    res.status(500).json({ error: '创建日记失败：' + err.message });
  }
});

// 更新日记
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const existing = db.exec('SELECT * FROM diary_entries WHERE id = ? AND owner_id = ?', [req.params.id, req.userId]);

    if (existing.length === 0 || existing[0].values.length === 0) {
      return res.status(404).json({ error: '日记不存在' });
    }

    const current = queryToObjects(existing)[0];
    const { title, content, mood } = req.body;

    db.run(
      'UPDATE diary_entries SET title=?, content=?, mood=? WHERE id=? AND owner_id=?',
      [title || current.title, content ?? current.content, mood ?? current.mood, req.params.id, req.userId]
    );
    saveToDisk();

    const result = db.exec('SELECT * FROM diary_entries WHERE id = ?', [req.params.id]);
    res.json(queryToObjects(result)[0]);
  } catch (err) {
    res.status(500).json({ error: '更新日记失败：' + err.message });
  }
});

// 删除日记
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const existing = db.exec('SELECT id FROM diary_entries WHERE id = ? AND owner_id = ?', [req.params.id, req.userId]);

    if (existing.length === 0 || existing[0].values.length === 0) {
      return res.status(404).json({ error: '日记不存在' });
    }

    db.run('DELETE FROM diary_entries WHERE id = ?', [req.params.id]);
    saveToDisk();

    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: '删除日记失败：' + err.message });
  }
});

module.exports = router;
