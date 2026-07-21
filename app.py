# -*- coding: utf-8 -*-
"""
小红书笔记ID转链接 — 网页版（部署就绪）
核心 API 调用使用 httpx，无需 Playwright/Chromium。
Playwright 仅作为可选依赖，用于自动登录功能。
"""
import os
import asyncio
import httpx
from flask import Flask, render_template, request, jsonify
import pymysql

app = Flask(__name__)

# CORS 支持（允许 GitHub Pages 跨域调用）
@app.after_request
def add_cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response

# ========== 配置（优先读取环境变量，fallback 用默认值） ==========
DB_CONFIG = {
    "host":     os.getenv("DB_HOST", "47.112.119.104"),
    "port":     int(os.getenv("DB_PORT", "3306")),
    "user":     os.getenv("DB_USER", "szcrm"),
    "password": os.getenv("DB_PASS", "sq3685#&^73"),
    "database": os.getenv("DB_NAME", "hz_crm"),
    "charset":  "utf8mb4",
}

# 小红书广告平台 API
XHS_API_URL = "https://ad.xiaohongshu.com/api/light/note/token"
XHS_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/125.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9",
    "Origin": "https://ad.xiaohongshu.com",
    "Referer": "https://ad.xiaohongshu.com/",
}

PORT = int(os.getenv("PORT", "5001"))
DEBUG = os.getenv("DEBUG", "false").lower() == "true"

# ========== Playwright（可选，仅用于自动登录） ==========
_PLAYWRIGHT_AVAILABLE = False
try:
    from playwright.async_api import async_playwright
    _PLAYWRIGHT_AVAILABLE = True
except ImportError:
    pass

# ========== 数据库 ==========
def get_cookie_from_db():
    """从数据库获取最新 cookie"""
    try:
        conn = pymysql.connect(**DB_CONFIG)
        with conn.cursor() as cur:
            cur.execute("SELECT cookies FROM new_xhs_cookies ORDER BY id DESC LIMIT 1")
            row = cur.fetchone()
        conn.close()
        return row[0] if row else None
    except Exception as e:
        print(f"⚠️ 数据库读取失败：{e}")
        return None


def save_cookie_to_db(cookie_str):
    """将 cookie 存入数据库（覆盖旧记录）"""
    try:
        conn = pymysql.connect(**DB_CONFIG)
        with conn.cursor() as cur:
            cur.execute("DELETE FROM new_xhs_cookies")
            cur.execute(
                "INSERT INTO new_xhs_cookies (cookies) VALUES (%s)", (cookie_str,)
            )
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"⚠️ 保存 cookie 失败：{e}")
        return False


def parse_cookie_string(cookie_str):
    """解析 'k1=v1; k2=v2' 格式为 dict"""
    cookies = {}
    for item in cookie_str.split(";"):
        item = item.strip()
        if "=" in item:
            key, val = item.split("=", 1)
            cookies[key.strip()] = val.strip()
    return cookies


# ========== 核心：用 httpx 调用小红书 API ==========
def get_links_via_httpx(note_ids, cookie_str):
    """
    通过 httpx 直接请求小红书广告平台 API 获取笔记 token 链接。
    返回 (api_data_dict | None, error_message | None)
    """
    cookie_dict = parse_cookie_string(cookie_str)
    cookie_header = "; ".join(f"{k}={v}" for k, v in cookie_dict.items())

    headers = {**XHS_HEADERS, "Cookie": cookie_header}
    payload = {"noteIds": note_ids, "source": "pc_ad"}

    try:
        with httpx.Client(timeout=30, follow_redirects=True) as client:
            resp = client.post(XHS_API_URL, json=payload, headers=headers)
            print(f"🔍 XHS API 状态码: {resp.status_code}")
            print(f"🔍 XHS API 响应: {resp.text[:500]}")

            resp.raise_for_status()
            result = resp.json()

            if result.get("code", -1) != 0:
                return None, result.get("msg", "API 返回错误")

            return result.get("data", {}), None

    except httpx.HTTPStatusError as e:
        print(f"❌ HTTP 错误: {e.response.status_code}, 响应: {e.response.text[:300]}")
        return None, f"HTTP {e.response.status_code}"
    except httpx.RequestError as e:
        return None, f"请求失败: {str(e)}"
    except Exception as e:
        return None, f"未知错误: {str(e)}"


# ========== Playwright 自动登录（可选） ==========
async def auto_login_playwright(email, password):
    """用 Playwright 自动登录广告平台，返回 cookie 字符串或 None"""
    if not _PLAYWRIGHT_AVAILABLE:
        return None, "服务器未安装 Playwright，无法自动登录，请使用手动粘贴 Cookie"

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()

        await page.goto("https://ad.xiaohongshu.com/")

        try:
            await page.wait_for_selector(
                'input[type="text"], input[name="account"]', timeout=10000
            )
        except Exception:
            cookies = await context.cookies()
            await browser.close()
            cookie_str = "; ".join(
                f"{c['name']}={c['value']}"
                for c in cookies
                if c["name"] in ("ares.beaker.session.id", "acw_tc")
            )
            return (cookie_str or None), None

        if email and password:
            try:
                await page.fill('input[type="text"], input[name="account"]', email)
                await page.fill('input[type="password"]', password)
                await page.click('button[type="submit"], button:has-text("登录")')
                await page.wait_for_url("**/ad.xiaohongshu.com/**", timeout=15000)
            except Exception:
                pass
        else:
            # 等待用户手动操作 — 给 60 秒
            print("⏳ 请在弹出的浏览器窗口中手动登录...（最多等 60 秒）")
            await page.wait_for_timeout(60000)

        await page.wait_for_timeout(2000)
        cookies = await context.cookies()
        ares = next(
            (c["value"] for c in cookies if c["name"] == "ares.beaker.session.id"), None
        )
        acw_tc = next(
            (c["value"] for c in cookies if c["name"] == "acw_tc"), None
        )
        await browser.close()

        if ares:
            s = f"ares.beaker.session.id={ares}"
            if acw_tc:
                s += f"; acw_tc={acw_tc}"
            return s, None
        return None, "登录失败，未获取到有效 Cookie"


# ========== 工具函数 ==========
def build_results(ids, api_data):
    """将 API 返回数据组装为前端结果列表"""
    results = []
    for nid in ids:
        token_info = api_data.get(nid, {})

        # 小红书 API 可能返回两种格式：
        # 格式1: {"note_id": {"xsec_token": "xxx"}}
        # 格式2: {"note_id": "token_string"}  ✅ 新版
        if isinstance(token_info, str) and token_info:
            token = token_info
        elif isinstance(token_info, dict):
            token = token_info.get("xsec_token", token_info.get("token", ""))
        else:
            token = ""

        if token:
            url = f"https://www.xiaohongshu.com/explore/{nid}?xsec_token={token}"
            results.append({"id": nid, "url": url, "success": True})
        else:
            results.append({"id": nid, "url": "", "success": False})
    return results


def parse_ids(raw):
    """从用户输入解析出 ID 列表"""
    return [
        n.strip()
        for n in raw.replace("\n", ",").split(",")
        if n.strip()
    ]


def get_note_info_from_explore(note_id, xsec_token):
    """从小红书笔记页面提取笔记信息"""
    url = f"https://www.xiaohongshu.com/explore/{note_id}?xsec_token={xsec_token}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Cookie": "xsecappid=aurora-shell",
    }
    try:
        resp = httpx.get(url, headers=headers, timeout=15, follow_redirects=True)
        resp.raise_for_status()
        html = resp.text

        import re, json
        m = re.search(r'window\.__INITIAL_STATE__\s*=\s*({.*?})\s*</script>', html, re.DOTALL)
        if not m:
            return None, "未找到笔记数据"

        js = m.group(1).replace('undefined', 'null')
        data = json.loads(js)

        note_map = data.get('note', {}).get('noteDetailMap', {})
        for nid, info in note_map.items():
            n = info.get('note', {})
            user = n.get('user', {}) or {}
            ts = n.get('time', 0)
            from datetime import datetime
            if ts and ts > 1000000000000:  # 毫秒时间戳
                dt = datetime.fromtimestamp(ts / 1000)
                time_str = dt.strftime('%Y-%m-%d %H:%M:%S')
            else:
                time_str = "未知"

            return {
                "id": nid,
                "nickname": user.get('nickname', '未知'),
                "userId": user.get('userId', ''),
                "time": time_str,
                "title": n.get('title', ''),
                "desc": n.get('desc', '')[:100],
            }, None

        return None, "未找到笔记详情"
    except Exception as e:
        return None, str(e)


# ========== 页面路由 ==========
@app.route("/")
def index():
    return render_template("index.html")


# ========== API 路由 ==========
@app.route("/api/convert", methods=["POST"])
def api_convert():
    """主接口：转换笔记 ID 为链接"""
    data = request.get_json()
    note_ids = parse_ids(data.get("noteIds", ""))

    if not note_ids:
        return jsonify({"success": False, "error": "请输入有效的笔记 ID"})

    # 1. 尝试从数据库获取 cookie
    cookie = get_cookie_from_db()
    if cookie:
        api_data, err = get_links_via_httpx(note_ids[:1], cookie)
        if err:
            # API 返回了错误（Cookie失效/子账号问题等）
            return jsonify({
                "success": False,
                "error": err,
                "message": f"小红书API返回: {err}",
            })
        # 检查是否获取到了 token
        first_id = note_ids[0]
        token_info = api_data.get(first_id, {}) if isinstance(api_data, dict) else {}
        token_ok = False
        if isinstance(token_info, str) and token_info:
            token_ok = True
        elif isinstance(token_info, dict):
            token_ok = bool(token_info.get("xsec_token") or token_info.get("token"))
        if token_ok:
            # Cookie 有效，获取全部
            api_data, _ = get_links_via_httpx(note_ids, cookie)
            results = build_results(note_ids, api_data) if isinstance(api_data, dict) else []
            return jsonify({"success": True, "results": results})

    return jsonify({
        "success": False,
        "error": "COOKIE_EXPIRED",
        "message": "Cookie 已失效，请在「Cookie 管理」中重新粘贴或登录",
    })


@app.route("/api/convert_with_cookie", methods=["POST"])
def api_convert_with_cookie():
    """使用指定 cookie 转换（临时使用，不存库）"""
    data = request.get_json()
    note_ids = parse_ids(data.get("noteIds", ""))
    cookie = data.get("cookie", "").strip()

    if not note_ids:
        return jsonify({"success": False, "error": "请输入有效的笔记 ID"})
    if not cookie:
        return jsonify({"success": False, "error": "请提供有效的 Cookie"})

    api_data, err = get_links_via_httpx(note_ids, cookie)
    if err:
        return jsonify({"success": False, "error": err})

    return jsonify({"success": True, "results": build_results(note_ids, api_data)})


@app.route("/api/login", methods=["POST"])
def api_login():
    """触发自动登录（需要服务器安装 Playwright + Chromium）"""
    data = request.get_json()
    email = data.get("email", "")
    password = data.get("password", "")

    cookie, err = asyncio.run(auto_login_playwright(email or None, password or None))
    if cookie:
        save_cookie_to_db(cookie)
        return jsonify({"success": True, "message": "登录成功"})
    return jsonify({"success": False, "error": err or "登录失败"})


@app.route("/api/manual_cookie", methods=["POST"])
def api_manual_cookie():
    """手动粘贴 cookie 并保存"""
    data = request.get_json()
    cookie = data.get("cookie", "").strip()

    if not cookie:
        return jsonify({"success": False, "error": "Cookie 不能为空"})

    cookie_dict = parse_cookie_string(cookie)
    if "ares.beaker.session.id" not in cookie_dict:
        return jsonify({
            "success": False,
            "error": "Cookie 格式不正确，需要包含 ares.beaker.session.id 字段",
        })

    if save_cookie_to_db(cookie):
        return jsonify({"success": True, "message": "Cookie 已保存"})
    return jsonify({"success": False, "error": "保存失败，请检查数据库连接"})


@app.route("/api/note_info", methods=["POST"])
def api_note_info():
    """获取笔记详情（达人名称、发布时间等）"""
    data = request.get_json()
    note_id = data.get("noteId", "").strip()
    xsec_token = data.get("xsecToken", "").strip()

    if not note_id:
        return jsonify({"success": False, "error": "缺少笔记ID"})
    if not xsec_token:
        return jsonify({"success": False, "error": "缺少 xsec_token，无法访问笔记页面"})

    info, err = get_note_info_from_explore(note_id, xsec_token)
    if err:
        return jsonify({"success": False, "error": err})
    return jsonify({"success": True, "data": info})


# ========== 启动 ==========
if __name__ == "__main__":
    print("\n" + "=" * 52)
    print("  🍠 小红书笔记ID转链接 — 网页版")
    print(f"  http://localhost:{PORT}")
    print("=" * 52 + "\n")
    app.run(host="0.0.0.0", port=PORT, debug=DEBUG)
