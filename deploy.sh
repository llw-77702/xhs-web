#!/bin/bash
# ========== 一键部署到服务器 ==========
# 用法：在服务器上执行这个脚本
# 或者在你本机执行：scp -r web_app/ root@47.112.119.104:/opt/xhs-web && ssh root@47.112.119.104 "bash /opt/xhs-web/deploy.sh"

set -e

echo "============================================"
echo "  🍠 小红书笔记ID转链接 - 服务器部署脚本"
echo "============================================"

# 1. 安装 Python 依赖
echo ""
echo "📦 安装依赖..."
pip3 install flask httpx pymysql gunicorn -q

# 2. 检查 MySQL 连接
echo ""
echo "🔍 检查数据库连接..."
python3 -c "
import pymysql
try:
    conn = pymysql.connect(
        host='47.112.119.104', port=3306,
        user='szcrm', password='sq3685#&^73',
        database='hz_crm', charset='utf8mb4'
    )
    print('✅ 数据库连接成功')
    conn.close()
except Exception as e:
    print(f'❌ 数据库连接失败: {e}')
"

# 3. 启动服务
echo ""
echo "🚀 启动服务..."
pkill -f "gunicorn.*xhs" 2>/dev/null || true
nohup gunicorn -w 2 -b 0.0.0.0:5001 app:app > /tmp/xhs-web.log 2>&1 &
sleep 2

# 4. 验证
echo ""
echo "🔍 验证服务..."
curl -s -o /dev/null -w "HTTP状态码: %{http_code}\n" http://localhost:5001/

echo ""
echo "✅ 部署完成！"
echo "   访问地址: http://47.112.119.104:5001"
echo "   日志: tail -f /tmp/xhs-web.log"
echo "============================================"
