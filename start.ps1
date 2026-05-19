$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$env:Path = "D:\nodejs;" + $env:Path

Write-Host ""
Write-Host "  ============================================"
Write-Host "    仓库进销存管理系统 - 启动中..."
Write-Host "  ============================================"
Write-Host ""

if (-not (Test-Path "server\node_modules")) {
    Write-Host "  [*] 首次运行，正在安装依赖..."
    Set-Location server
    & D:\nodejs\npm install
    Set-Location $scriptDir
    Write-Host "  [√] 依赖安装完成"
    Write-Host ""
}

Write-Host "  [*] 正在启动本地服务器..."
$serverJob = Start-Process -FilePath "D:\nodejs\node.exe" -ArgumentList "server\index.js" -WindowStyle Minimized -PassThru

Write-Host "  [*] 正在启动公网隧道..."
$tunnelJob = Start-Process -FilePath "D:\nodejs\npx.cmd" -ArgumentList "localtunnel --port 3000" -WindowStyle Normal

Write-Host ""
Write-Host "  ============================================"
Write-Host "  本地访问: http://localhost:3000"
Write-Host "  公网地址: 查看弹出的隧道窗口"
Write-Host "  ============================================"
Write-Host ""
Write-Host "按任意键退出（不影响后台运行的服务）"
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
