# 🍠 小红书笔记ID转链接 — 5分钟部署到 Railway.app

> 不需要买服务器，免费使用，任何电脑都能访问

## 步骤一：注册 GitHub 账号（如果没有）

1. 打开 https://github.com/signup
2. 填写邮箱、密码、用户名 → 注册
3. 完成邮箱验证

## 步骤二：上传代码到 GitHub

1. 登录 GitHub
2. 点右上角 `+` → `New repository`
3. 仓库名填：`xhs-web`
4. 点 `Create repository`
5. 点 `uploading an existing file`
6. 把 `web_app` 文件夹里的所有文件拖进去
7. 点 `Commit changes`

## 步骤三：部署到 Railway

1. 打开 https://railway.app
2. 点 `Login` → 用 GitHub 登录
3. 点 `New Project` → `Deploy from GitHub repo`
4. 选择你刚上传的 `xhs-web` 仓库
5. Railway 会自动开始部署

## 步骤四：设置环境变量

在 Railway 项目页面：
1. 点 `Variables` 标签
2. 添加以下变量：

| Name | Value |
|------|-------|
| `DB_HOST` | `47.112.119.104` |
| `DB_PORT` | `3306` |
| `DB_USER` | `szcrm` |
| `DB_PASS` | `sq3685#&^73` |
| `DB_NAME` | `hz_crm` |
| `PORT` | `5001` |

## 步骤五：获取公网访问地址

1. Railway 部署完成后会显示一个 URL，类似：
   ```
   https://xxxx-xxxx.up.railway.app
   ```
2. 把这个 URL 发给别人，**任何电脑都能访问**！

## 使用方法

1. 打开 Railway 给的 URL
2. 点「🔑 Cookie 管理」→ 粘贴你的 Cookie
3. 输入笔记 ID → 转换

## ⚠️ 注意事项

- Cookie 有效期有限，过期后需要重新粘贴
- 免费版有使用限制（但个人用完全够）
- 数据库还是用你原来的 47.112.119.104
