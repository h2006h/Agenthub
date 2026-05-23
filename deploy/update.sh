#!/bin/bash
# ===========================================
# AgentHub 更新脚本 (仅构建 + 重启)
# 使用: bash update.sh
# ===========================================
set -e

PROJECT_DIR="/www/wwwroot/agenthub"

echo "=========================================="
echo "  AgentHub 更新部署"
echo "=========================================="

# 后端
echo "[1/3] 构建后端..."
cd $PROJECT_DIR/server
npm run build
echo "  ✓ 后端构建完成"

# 前端
echo "[2/3] 构建前端..."
cd $PROJECT_DIR/client
npm run build
echo "  ✓ 前端构建完成"

# 重启服务
echo "[3/3] 重启 PM2..."
pm2 restart agenthub
echo "  ✓ 服务已重启"

echo ""
echo "=========================================="
echo "  更新完成！"
echo "  请强制刷新浏览器 (Ctrl+Shift+R)"
echo "=========================================="
