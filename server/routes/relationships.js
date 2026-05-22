const express = require('express');
const { getDb, saveToDisk } = require('../db/init');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

function queryToObjects(result) {
  if (!result || result.length === 0) return [];
  const columns = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

// 获取当前用户所有关系（图谱数据）
router.get('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    // 同时返回娃娃信息，用于图谱渲染
    const dollsResult = db.exec('SELECT id, name, avatar, bio FROM dolls WHERE owner_id = ?', [req.userId]);
    const relResult = db.exec(
      `SELECT r.*, d1.name as from_name, d2.name as to_name
       FROM relationships r
       JOIN dolls d1 ON r.from_doll = d1.id
       JOIN dolls d2 ON r.to_doll = d2.id
       WHERE r.owner_id = ?`,
      [req.userId]
    );

    res.json({
      dolls: queryToObjects(dollsResult),
      relationships: queryToObjects(relResult)
    });
  } catch (err) {
    res.status(500).json({ error: '获取关系数据失败：' + err.message });
  }
});

// 创建关系
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { from_doll, to_doll, type } = req.body;
    if (!from_doll || !to_doll || !type) {
      return res.status(400).json({ error: '双方娃娃和关系类型不能为空' });
    }
    if (from_doll === to_doll) {
      return res.status(400).json({ error: '不能和自己建立关系' });
    }

    const db = await getDb();

    // 检查娃娃是否属于当前用户
    const fromCheck = db.exec('SELECT id FROM dolls WHERE id = ? AND owner_id = ?', [from_doll, req.userId]);
    const toCheck = db.exec('SELECT id FROM dolls WHERE id = ? AND owner_id = ?', [to_doll, req.userId]);
    if (fromCheck.length === 0 || toCheck.length === 0) {
      return res.status(400).json({ error: '娃娃不存在或不属于你' });
    }

    // 检查是否已存在相同关系（双向）
    const existing = db.exec(
      'SELECT id FROM relationships WHERE owner_id = ? AND ((from_doll = ? AND to_doll = ?) OR (from_doll = ? AND to_doll = ?))',
      [req.userId, from_doll, to_doll, to_doll, from_doll]
    );
    if (existing.length > 0 && existing[0].values.length > 0) {
      return res.status(400).json({ error: '这两个娃娃之间已有关系' });
    }

    db.run(
      'INSERT INTO relationships (from_doll, to_doll, type, owner_id) VALUES (?, ?, ?, ?)',
      [from_doll, to_doll, type, req.userId]
    );
    saveToDisk();

    const result = db.exec('SELECT * FROM relationships WHERE owner_id = ? ORDER BY id DESC LIMIT 1', [req.userId]);
    res.status(201).json(queryToObjects(result)[0]);
  } catch (err) {
    res.status(500).json({ error: '创建关系失败：' + err.message });
  }
});

// 更新关系类型
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { type } = req.body;
    if (!type) {
      return res.status(400).json({ error: '关系类型不能为空' });
    }

    const db = await getDb();
    const existing = db.exec('SELECT id FROM relationships WHERE id = ? AND owner_id = ?', [req.params.id, req.userId]);

    if (existing.length === 0 || existing[0].values.length === 0) {
      return res.status(404).json({ error: '关系不存在' });
    }

    db.run('UPDATE relationships SET type=? WHERE id=? AND owner_id=?', [type, req.params.id, req.userId]);
    saveToDisk();

    const result = db.exec('SELECT * FROM relationships WHERE id = ?', [req.params.id]);
    res.json(queryToObjects(result)[0]);
  } catch (err) {
    res.status(500).json({ error: '更新关系失败：' + err.message });
  }
});

// 删除关系
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const existing = db.exec('SELECT id FROM relationships WHERE id = ? AND owner_id = ?', [req.params.id, req.userId]);

    if (existing.length === 0 || existing[0].values.length === 0) {
      return res.status(404).json({ error: '关系不存在' });
    }

    db.run('DELETE FROM relationships WHERE id = ?', [req.params.id]);
    saveToDisk();

    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: '删除关系失败：' + err.message });
  }
});

module.exports = router;
