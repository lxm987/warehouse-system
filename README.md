# 仓库进销存管理系统

基于 Node.js + Express + SQLite 的仓库进销存管理系统，支持货物管理、入库/出库、库存台账、数据备份等功能。

## 技术栈

- **前端**：原生 HTML/CSS/JS 单页应用
- **后端**：Node.js + Express
- **数据库**：SQLite (better-sqlite3)
- **认证**：JWT + bcryptjs 密码加密

## 本地运行

### 环境要求

- [Node.js](https://nodejs.org/) >= 18.x

### 启动步骤

```bash
# 1. 进入后端目录，安装依赖
cd server
npm install

# 2. 返回项目根目录，启动服务
cd ..
node server/index.js
```

或者直接双击 `start.bat`（会自动安装依赖并启动）。

启动后浏览器访问 `http://localhost:3000`。

首次启动后需自行注册账号，第一个注册的用户拥有全部功能权限。

## 异地/远程运行

### 方式一：免费云部署（推荐）

1. 将项目推送到 GitHub
2. 在 [Railway](https://railway.app) 或 [Render](https://render.com) 导入 GitHub 仓库
3. 设置启动命令：`node server/index.js`
4. 注意：免费服务 SQLite 数据重启后会丢失，建议定期备份

### 方式二：VPS 部署

在云服务器（阿里云/腾讯云等）上：

```bash
git clone <你的仓库地址>
cd project1/server
npm install
cd ..
nohup node server/index.js > server.log 2>&1 &
```

### 方式三：内网穿透（临时使用）

在本地启动服务后，使用 Cloudflare Tunnel 临时暴露到公网：

```bash
cloudflared tunnel --url http://localhost:3000
```

## 项目结构

```
project1/
├── index.html          # 前端主页面
├── styles.css          # 样式
├── js/
│   ├── app.js          # 主应用逻辑
│   ├── api.js          # API 调用封装
│   ├── auth.js         # 登录认证逻辑
│   └── database.js     # 数据库操作
├── server/
│   ├── index.js        # Express 入口
│   ├── db.js           # 数据库初始化
│   ├── utils.js        # 工具函数
│   ├── middleware/
│   │   └── auth.js     # JWT 认证中间件
│   └── routes/
│       ├── auth.js     # 登录/注册/忘记密码
│       ├── goods.js    # 货物管理
│       ├── cards.js    # 入库管理
│       ├── ledger.js   # 出库/台账
│       ├── profile.js  # 个人信息
│       └── backup.js   # 数据备份
├── start.bat           # Windows 一键启动
└── deploy.html         # 部署说明页
```
