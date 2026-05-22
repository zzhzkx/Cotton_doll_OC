const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3001;

// 中间件
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dolls', require('./routes/dolls'));
app.use('/api/diary', require('./routes/diary'));
app.use('/api/relationships', require('./routes/relationships'));

// 启动服务器
app.listen(PORT, () => {
  console.log(`🌸 棉花娃娃后端已启动: http://localhost:${PORT}`);
});
