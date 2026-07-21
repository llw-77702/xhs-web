// ========== 全局变量 ==========
let allResults = [];

// ========== ID 计数 & 输入监听 ==========
document.addEventListener('DOMContentLoaded', () => {
    const textarea = document.getElementById('noteIds');
    if (textarea) {
        textarea.addEventListener('input', updateIdCount);
    }
});

function updateIdCount() {
    const text = document.getElementById('noteIds').value;
    const ids = text.split(/[,\n]+/).filter(n => n.trim());
    document.getElementById('idCount').textContent = `已输入 ${ids.length} 个 ID`;
}

function parseIds() {
    let text = document.getElementById('noteIds').value;
    let ids = text.split(/[,\n]+/).map(n => n.trim()).filter(Boolean);

    // 去重
    if (document.getElementById('dedupCheck').checked) {
        ids = [...new Set(ids)];
    }
    return ids;
}

// ========== 核心转换流程 ==========
async function startConvert() {
    const ids = parseIds();
    if (ids.length === 0) {
        showToast('请输入至少一个笔记ID', 'error');
        return;
    }

    const btn = document.getElementById('btnConvert');
    const btnText = btn.querySelector('.btn-text');
    const btnIcon = btn.querySelector('.btn-icon');

    // 禁用按钮 & 显示进度
    btn.disabled = true;
    btnIcon.textContent = '⏳';
    btnText.textContent = '转换中...';

    const progressCard = document.getElementById('progressCard');
    progressCard.style.display = 'block';
    updateProgress(0, ids.length);

    try {
        const response = await fetch('/api/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ noteIds: ids.join(',') }),
        });

        const result = await response.json();

        if (result.success) {
            // 渐进式显示结果
            allResults = result.results;
            await displayResultsAnimated(result.results);
            showStats(result.results);
            showToast(`完成！成功 ${result.results.filter(r => r.success).length} 个`, 'success');
        } else if (result.error === 'COOKIE_EXPIRED') {
            progressCard.style.display = 'none';
            showToast(result.message, 'error');
            openCookieModal();
        } else {
            progressCard.style.display = 'none';
            showToast(result.error || '转换失败', 'error');
        }
    } catch (err) {
        progressCard.style.display = 'none';
        showToast('网络错误，请检查连接', 'error');
        console.error(err);
    } finally {
        btn.disabled = false;
        btnIcon.textContent = '🔗';
        btnText.textContent = '转换链接';
    }
}

async function displayResultsAnimated(results) {
    const resultCard = document.getElementById('resultCard');
    const resultList = document.getElementById('resultList');

    resultCard.style.display = 'block';
    resultList.innerHTML = '';

    for (let i = 0; i < results.length; i++) {
        const r = results[i];
        updateProgress(i + 1, results.length);

        const item = document.createElement('div');
        item.className = 'result-item';
        item.style.animationDelay = `${i * 0.05}s`;

        if (r.success) {
            item.innerHTML = `
                <div class="result-icon">✅</div>
                <div class="result-content">
                    <div class="result-id">${r.id}</div>
                    <div class="result-url">
                        <a href="${r.url}" target="_blank" rel="noopener">${r.url}</a>
                    </div>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="copySingle('${r.url}', this)">
                    📋 复制
                </button>
            `;
        } else {
            item.innerHTML = `
                <div class="result-icon">❌</div>
                <div class="result-content">
                    <div class="result-id">${r.id}</div>
                    <div class="result-error">获取失败</div>
                </div>
            `;
        }

        resultList.appendChild(item);

        // 稍微延迟让动画可见
        if (results.length > 5) {
            await new Promise(resolve => setTimeout(resolve, 30));
        }
    }
}

function updateProgress(current, total) {
    const bar = document.getElementById('progressBar');
    const text = document.getElementById('progressText');
    const count = document.getElementById('progressCount');

    const pct = Math.round((current / total) * 100);
    bar.style.width = pct + '%';
    text.textContent = current >= total ? '完成！' : '处理中...';
    count.textContent = `${current}/${total}`;
}

// ========== 统计 ==========
function showStats(results) {
    const statsCard = document.getElementById('statsCard');
    statsCard.style.display = 'block';

    const success = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    // 数字动画
    animateNumber('statSuccess', success);
    animateNumber('statFailed', failed);
    animateNumber('statTotal', results.length);
}

function animateNumber(id, target) {
    const el = document.getElementById(id);
    let current = 0;
    const step = Math.max(1, Math.floor(target / 20));
    const interval = setInterval(() => {
        current = Math.min(current + step, target);
        el.textContent = current;
        if (current >= target) clearInterval(interval);
    }, 30);
}

// ========== 复制 & 导出 ==========
async function copySingle(text, btn) {
    try {
        await navigator.clipboard.writeText(text);
        const origText = btn.innerHTML;
        btn.innerHTML = '✅ 已复制';
        btn.disabled = true;
        setTimeout(() => {
            btn.innerHTML = origText;
            btn.disabled = false;
        }, 1500);
    } catch {
        showToast('复制失败', 'error');
    }
}

async function copyAllUrls() {
    const urls = allResults.filter(r => r.success).map(r => r.url).join('\n');
    if (!urls) {
        showToast('没有可复制的链接', 'error');
        return;
    }
    try {
        await navigator.clipboard.writeText(urls);
        showToast('已复制全部链接', 'success');
    } catch {
        // fallback
        const ta = document.createElement('textarea');
        ta.value = urls;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('已复制全部链接', 'success');
    }
}

function exportTxt() {
    const urls = allResults.filter(r => r.success).map(r => r.url);
    if (!urls.length) {
        showToast('没有可导出的内容', 'error');
        return;
    }

    const content = urls.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `xhs_links_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('导出成功', 'success');
}

function clearResults() {
    document.getElementById('resultCard').style.display = 'none';
    document.getElementById('progressCard').style.display = 'none';
    document.getElementById('statsCard').style.display = 'none';
    document.getElementById('resultList').innerHTML = '';
    allResults = [];
}

// ========== Cookie 状态检测 ==========
async function checkCookieStatus() {
    try {
        const resp = await fetch('/api/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ noteIds: 'test_check_only' }),
        });
        const data = await resp.json();

        const statusEl = document.getElementById('cookieStatus');
        const dot = statusEl.querySelector('.dot');

        if (data.error === 'COOKIE_EXPIRED') {
            statusEl.innerHTML = '<span class="dot dot-invalid"></span> Cookie 已失效';
        } else if (data.success) {
            statusEl.innerHTML = '<span class="dot dot-valid"></span> Cookie 有效';
        } else {
            statusEl.innerHTML = '<span class="dot dot-invalid"></span> 连接异常';
        }
    } catch {
        const statusEl = document.getElementById('cookieStatus');
        statusEl.innerHTML = '<span class="dot dot-invalid"></span> 无法连接服务';
    }
}

// ========== Cookie 管理弹窗 ==========
function openCookieModal() {
    document.getElementById('cookieModal').style.display = 'flex';
    checkCookieStatus();
}

function closeCookieModal() {
    document.getElementById('cookieModal').style.display = 'none';
}

function closeModalOnOutside(e) {
    if (e.target === e.currentTarget) closeCookieModal();
}

function switchTab(tabId, btn) {
    // 切换 tab 按钮
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(tabId === 'login' ? 'tabLogin' : 'tabManual').classList.add('active');
}

// ========== 自动登录 ==========
async function startAutoLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    if (!email) {
        showToast('请输入登录邮箱', 'error');
        return;
    }

    const btn = event.target;
    const origText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> 登录中，请在弹出的浏览器窗口操作...';
    btn.disabled = true;

    try {
        const resp = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const result = await resp.json();

        if (result.success) {
            showToast('登录成功！Cookie 已保存', 'success');
            checkCookieStatus();
            closeCookieModal();
        } else {
            showToast(result.error || '登录失败', 'error');
        }
    } catch {
        showToast('网络错误', 'error');
    } finally {
        btn.innerHTML = origText;
        btn.disabled = false;
    }
}

// ========== 手动 Cookie ==========
async function submitManualCookie() {
    const cookie = document.getElementById('manualCookie').value.trim();
    if (!cookie) {
        showToast('请输入 Cookie', 'error');
        return;
    }

    const btn = event.target;
    const origText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> 验证中...';
    btn.disabled = true;

    try {
        const resp = await fetch('/api/manual_cookie', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cookie }),
        });
        const result = await resp.json();

        if (result.success) {
            showToast('Cookie 已保存并生效！', 'success');
            checkCookieStatus();
            closeCookieModal();
        } else {
            showToast(result.error || '保存失败', 'error');
        }
    } catch {
        showToast('网络错误', 'error');
    } finally {
        btn.innerHTML = origText;
        btn.disabled = false;
    }
}

// ========== Toast 通知 ==========
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    toast.innerHTML = `<span>${icons[type] || ''}</span> ${message}`;

    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ========== 键盘快捷键 ==========
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Enter: 开始转换
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        startConvert();
    }
    // Escape: 关闭弹窗
    if (e.key === 'Escape') {
        closeCookieModal();
    }
});
