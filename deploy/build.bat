@echo off
chcp 65001 >nul
echo ==========================================
echo   AgentHub 本地构建脚本 (Windows)
echo ==========================================

echo.
echo [1/2] 构建后端...
cd /d "%~dp0..\server"
call npm run build
if %errorlevel% neq 0 (
    echo 后端构建失败!
    pause
    exit /b %errorlevel%
)
echo   后端构建完成 → server\dist\

echo.
echo [2/2] 构建前端...
cd /d "%~dp0..\client"
call npm run build
if %errorlevel% neq 0 (
    echo 前端构建失败!
    pause
    exit /b %errorlevel%
)
echo   前端构建完成 → client\dist\

echo.
echo ==========================================
echo   构建完成！接下来:
echo   1. 宝塔面板 → 文件 → 上传 server\dist\ (覆盖)
echo   2. 宝塔面板 → 文件 → 上传 client\dist\ (覆盖)
echo   3. 宝塔面板 → PM2管理器 → 重启 agenthub
echo   4. 浏览器 Ctrl+Shift+R 强制刷新
echo ==========================================
pause
