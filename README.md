# 🍠 小红书笔记ID转链接 - 网页版

将原始脚本转化为漂亮的 Web 应用，通过浏览器界面批量转换小红书笔记 ID 为可分享链接。

## 快速启动（macOS）

双击 `start.command` 即可自动启动，浏览器将自动打开。

或终端运行：
```bash
cd web_app
python3 app.py
```

访问 [http://localhost:5000](http://localhost:5000)

## 首次使用

1. 启动服务后，打开浏览器访问上述地址
2. 右上角点击「🔑 Cookie 管理」
3. 选择「自动登录」或「手动输入」来设置 Cookie
4. 在输入框中粘贴笔记 ID（多个用逗号或换行分隔）
5. 点击「转换链接」

## 功能

- **批量转换**：同时处理多个笔记 ID
- **去重**：自动过滤重复的 ID
- **一键复制**：复制单条或全部链接
- **导出 TXT**：将结果导出为文本文件
- **Cookie 管理**：支持自动登录和手动输入
- **状态检测**：实时显示 Cookie 有效状态
- **键盘快捷键**：`Ctrl+Enter` 快速转换

## Cookie 获取说明

### 方法一：自动登录（推荐）
在 Cookie 管理弹窗中填写账号密码，服务端 Playwright 会自动打开浏览器窗口完成登录。

### 方法二：手动输入
1. 浏览器打开 [小红书广告平台](https://ad.xiaohongshu.com/)
2. 按 F12 打开开发者工具
3. 进入 Application → Cookies → ad.xiaohongshu.com
4. 复制全部 Cookie 字符串粘贴到输入框

## 技术栈

- 后端：Quart (异步 Flask) + Playwright
- 前端：原生 HTML/CSS/JS
- 数据库：MySQL (保存 Cookie)
- 依赖：详见 `requirements.txt`
