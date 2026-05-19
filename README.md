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

## 异地/远程访问

本机双击 `start.bat` 即可同时启动本地服务和公网隧道，公网地址显示在隧道窗口中。

或手动启动：

```bash
# 终端1：启动本地服务
node server/index.js

# 终端2：启动公网隧道
npx localtunnel --port 3000
```

隧道窗口会显示一个 `https://xxx.loca.lt` 的公网地址，在任何地方打开该地址即可访问系统。

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
