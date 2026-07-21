#!/bin/bash
# -*- coding: utf-8 -*-
# 小红书笔记ID转链接 - 网页版启动器 (macOS)
# 保存为 .command 文件，双击运行

# 获取脚本所在目录
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo ""
echo "============================================"
echo "  🍠 小红书笔记ID转链接 - 网页版"
echo "============================================"
echo ""

# ---- 自动安装依赖 ----
if ! command -v python3 &> /dev/null; then
    echo "❌ 未检测到 Python3，正在安装..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    brew install python@3.11
fi

echo "📦 检查依赖..."
python3 -m pip install --user -r requirements.txt -q 2>/dev/null || python3 -m pip install --user quart pymysql playwright -q

# 检查 Playwright 浏览器
python3 -c "from playwright.sync_api import sync_playwright" 2>/dev/null || python3 -m playwright install chromium

echo ""
echo "🚀 启动服务..."
echo "   访问地址: http://localhost:5001"
echo ""

# 打开浏览器
sleep 1
open http://localhost:5001

# 启动服务
cd "$DIR"
python3 app.py

# 如果服务退出，等待用户查看错误
echo ""
echo "⚠️  服务已停止"
read -p "按回车键关闭窗口..."
