const initSQL = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'database.db');

let db = null;

async function getDb() {
  if (db) return db;

  const SQL = await initSQL();
  let fileBuffer = null;
  if (fs.existsSync(DB_PATH)) {
    fileBuffer = fs.readFileSync(DB_PATH);
  }
  db = new SQL.Database(fileBuffer || undefined);

  // 创建表
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      avatar TEXT DEFAULT ''
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS dolls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      avatar TEXT DEFAULT '',
      image TEXT DEFAULT '',
      birthday TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      story TEXT DEFAULT '',
      owner_id INTEGER NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS diary_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doll_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      media_type TEXT DEFAULT 'text',
      media_url TEXT DEFAULT '',
      mood TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      owner_id INTEGER NOT NULL,
      FOREIGN KEY (doll_id) REFERENCES dolls(id),
      FOREIGN KEY (owner_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS relationships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_doll INTEGER NOT NULL,
      to_doll INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT '朋友',
      owner_id INTEGER NOT NULL,
      FOREIGN KEY (from_doll) REFERENCES dolls(id),
      FOREIGN KEY (to_doll) REFERENCES dolls(id),
      FOREIGN KEY (owner_id) REFERENCES users(id)
    )
  `);

  saveToDisk();
  return db;
}

function saveToDisk() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

module.exports = { getDb, saveToDisk };
