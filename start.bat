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
    call npm install
    cd ..
    echo  [√] 依赖安装完成
    echo.
)

echo  [*] 正在启动服务器...
node server/index.js
pause
