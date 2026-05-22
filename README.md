# 棉花娃娃之家 (Cotton Doll OC)

一个用于管理棉花娃娃收藏的网站，记录每个娃娃的个人信息、故事和彼此之间的关系。

## 功能

- 娃娃档案管理（姓名、头像、照片、简介、故事）
- 娃娃日记系统（图文日记、心情标签）
- 交互式关系图谱（类 Obsidian 知识图谱）
  - 可拖拽节点
  - 点击高亮关联节点
  - 缩放自适应（缩小时变星座图）
  - A 字形雁群编队拖动
  - 可调节向心力/排斥力/吸引力
- 多用户系统（注册/登录）
- 自定义日期选择器

## 技术栈

- **前端**: React + Vite
- **后端**: Node.js + Express
- **数据库**: SQLite (sql.js)
- **图谱**: react-force-graph-2d + d3-force

## 启动

```bash
# 终端 1 - 启动后端
cd server
npm install
npm run dev

# 终端 2 - 启动前端
cd client
npm install
npm run dev
```

打开浏览器访问 `http://localhost:5173`
