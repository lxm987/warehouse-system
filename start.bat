@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  ============================================
echo    仓库进销存管理系统 - 启动中...
echo  ============================================
echo.

if not exist "server\node_modules\" (
    echo  [*] 首次运行，正在安装依赖...
    cd server
    D:\nodejs\npm install
    cd ..
    echo  [√] 依赖安装完成
    echo.
)

echo  [*] 正在启动本地服务器...
start "仓库-本地服务" D:\nodejs\node.exe "%~dp0server\index.js"

echo  [*] 正在启动公网隧道...
start "仓库-公网隧道" D:\nodejs\npx.cmd localtunnel --port 3000

echo.
echo  ============================================
echo  本地访问: http://localhost:3000
echo  公网地址: 查看"仓库-公网隧道"窗口中的 URL
echo  ============================================
echo.
pause
