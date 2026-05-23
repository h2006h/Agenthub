#!/bin/bash
# ===========================================
# AgentHub 宝塔部署脚本
# 在服务器上执行: bash deploy.sh
# ===========================================
set -e

PROJECT_DIR="/www/wwwroot/agenthub"
echo "=========================================="
echo "  AgentHub 一键部署脚本"
echo "=========================================="

# 1. 创建项目目录
echo "[1/6] 创建项目目录..."
mkdir -p $PROJECT_DIR
cd $PROJECT_DIR

# 2. 上传代码 (通过 Git 或 FTP 将代码放到此目录)
echo "[2/6] 检查代码文件..."
if [ ! -f "server/package.json" ]; then
    echo "错误: 未找到 server/package.json"
    echo "请先将项目代码上传到 $PROJECT_DIR"
    exit 1
fi

# 3. 安装后端依赖并构建
echo "[3/6] 安装后端依赖..."
cd $PROJECT_DIR/server
npm install --production=false

echo "[4/6] 构建后端..."
npm run build

# 创建必要目录
mkdir -p database logs uploads

# 配置生产环境变量
if [ ! -f ".env" ]; then
    cp .env.production .env
    echo "请编辑 server/.env 填入真实的 JWT_SECRET 和 API_KEY"
fi

# 4. 安装前端依赖并构建
echo "[5/6] 构建前端..."
cd $PROJECT_DIR/client
npm install
npm run build

# 5. 配置 PM2
echo "[6/6] 启动 PM2 服务..."
cd $PROJECT_DIR/server
if command -v pm2 &> /dev/null; then
    pm2 delete agenthub 2>/dev/null || true
    pm2 start ecosystem.config.js
    pm2 save
    pm2 startup
    echo ""
    echo "PM2 进程已启动，使用以下命令管理："
    echo "  pm2 status          # 查看状态"
    echo "  pm2 logs agenthub   # 查看日志"
    echo "  pm2 restart agenthub # 重启"
else
    echo ""
    echo "⚠ 未安装 PM2，请在宝塔面板 → 软件商店 → 安装 PM2 管理器"
    echo "安装后执行: cd $PROJECT_DIR/server && pm2 start ecosystem.config.js"
fi

echo ""
echo "=========================================="
echo "  部署完成！"
echo "=========================================="
echo ""
echo "后续步骤:"
echo "  1. 编辑 $PROJECT_DIR/server/.env 配置文件"
echo "  2. 宝塔面板 → 网站 → 添加站点"
echo "  3. 网站设置 → 配置文件 → 粘贴 deploy/agenthub.conf 内容"
echo "  4. 重载 Nginx"
echo "  5. 访问 http://your-domain.com"
