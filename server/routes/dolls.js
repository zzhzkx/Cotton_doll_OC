const express = require('express');
const multer = require('multer');
const path = require('path');
const { getDb, saveToDisk } = require('../db/init');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// 图片上传配置
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `doll_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

// 辅助：将 sql.js 查询结果转为对象数组
function queryToObjects(result) {
  if (!result || result.length === 0) return [];
  const columns = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

// 获取当前用户所有娃娃
router.get('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const result = db.exec('SELECT * FROM dolls WHERE owner_id = ? ORDER BY id DESC', [req.userId]);
    res.json(queryToObjects(result));
  } catch (err) {
    res.status(500).json({ error: '获取娃娃列表失败：' + err.message });
  }
});

// 获取娃娃详情（含日记）
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const dollResult = db.exec('SELECT * FROM dolls WHERE id = ? AND owner_id = ?', [req.params.id, req.userId]);

    if (dollResult.length === 0 || dollResult[0].values.length === 0) {
      return res.status(404).json({ error: '娃娃不存在' });
    }

    const doll = queryToObjects(dollResult)[0];
    const diaryResult = db.exec(
      'SELECT * FROM diary_entries WHERE doll_id = ? AND owner_id = ? ORDER BY created_at DESC',
      [req.params.id, req.userId]
    );
    doll.diary = queryToObjects(diaryResult);

    const relResult = db.exec(
      `SELECT r.*, d1.name as from_name, d2.name as to_name
       FROM relationships r
       JOIN dolls d1 ON r.from_doll = d1.id
       JOIN dolls d2 ON r.to_doll = d2.id
       WHERE (r.from_doll = ? OR r.to_doll = ?) AND r.owner_id = ?`,
      [req.params.id, req.params.id, req.userId]
    );
    doll.relationships = queryToObjects(relResult);

    res.json(doll);
  } catch (err) {
    res.status(500).json({ error: '获取娃娃详情失败：' + err.message });
  }
});

// 创建娃娃
router.post('/', authMiddleware, upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'image', maxCount: 1 }
]), async (req, res) => {
  try {
    const { name, birthday, bio, story } = req.body;
    if (!name) {
      return res.status(400).json({ error: '娃娃名字不能为空' });
    }

    const avatarPath = req.files?.avatar ? `/uploads/${req.files.avatar[0].filename}` : '';
    const imagePath = req.files?.image ? `/uploads/${req.files.image[0].filename}` : '';

    const db = await getDb();
    db.run(
      'INSERT INTO dolls (name, avatar, image, birthday, bio, story, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, avatarPath, imagePath, birthday || '', bio || '', story || '', req.userId]
    );
    saveToDisk();

    // 获取刚创建的娃娃
    const result = db.exec('SELECT * FROM dolls WHERE owner_id = ? ORDER BY id DESC LIMIT 1', [req.userId]);
    res.status(201).json(queryToObjects(result)[0]);
  } catch (err) {
    res.status(500).json({ error: '创建娃娃失败：' + err.message });
  }
});

// 更新娃娃
router.put('/:id', authMiddleware, upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'image', maxCount: 1 }
]), async (req, res) => {
  try {
    const db = await getDb();
    const existing = db.exec('SELECT * FROM dolls WHERE id = ? AND owner_id = ?', [req.params.id, req.userId]);

    if (existing.length === 0 || existing[0].values.length === 0) {
      return res.status(404).json({ error: '娃娃不存在' });
    }

    const current = queryToObjects(existing)[0];
    const { name, birthday, bio, story } = req.body;

    const avatarPath = req.files?.avatar ? `/uploads/${req.files.avatar[0].filename}` : current.avatar;
    const imagePath = req.files?.image ? `/uploads/${req.files.image[0].filename}` : current.image;

    db.run(
      'UPDATE dolls SET name=?, avatar=?, image=?, birthday=?, bio=?, story=? WHERE id=? AND owner_id=?',
      [name || current.name, avatarPath, imagePath, birthday ?? current.date, bio ?? current.bio, story ?? current.story, req.params.id, req.userId]
    );
    saveToDisk();

    const result = db.exec('SELECT * FROM dolls WHERE id = ?', [req.params.id]);
    res.json(queryToObjects(result)[0]);
  } catch (err) {
    res.status(500).json({ error: '更新娃娃失败：' + err.message });
  }
});

// 删除娃娃
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const existing = db.exec('SELECT id FROM dolls WHERE id = ? AND owner_id = ?', [req.params.id, req.userId]);

    if (existing.length === 0 || existing[0].values.length === 0) {
      return res.status(404).json({ error: '娃娃不存在' });
    }

    // 删除关联数据
    db.run('DELETE FROM diary_entries WHERE doll_id = ?', [req.params.id]);
    db.run('DELETE FROM relationships WHERE from_doll = ? OR to_doll = ?', [req.params.id, req.params.id]);
    db.run('DELETE FROM dolls WHERE id = ?', [req.params.id]);
    saveToDisk();

    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: '删除娃娃失败：' + err.message });
  }
});

module.exports = router;
