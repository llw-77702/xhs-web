var allResults = [], cookieStr = '';

document.addEventListener('DOMContentLoaded', function() {
  // 检测登录状态 - 从ad.xiaohongshu.com获取Cookie
  detectLogin();

  $('convertBtn').addEventListener('click', batchConvert);
  $('extractBtn').addEventListener('click', extractInfo);
  $('idFile').addEventListener('change', function(e){ readFile(e, 'idInput', 'idCount'); });
  $('linkFile').addEventListener('change', function(e){ readFile(e, 'linkInput', 'linkCount'); });
  document.querySelectorAll('.tab').forEach(function(t){
    t.addEventListener('click', function(){
      document.querySelectorAll('.tab').forEach(function(x){x.classList.remove('active');});
      this.classList.add('active');
      var n = this.dataset.tab;
      $('tab1').className = n==='1' ? '' : 'hidden';
      $('tab2').className = n==='2' ? '' : 'hidden';
    });
  });
  $('idInput').addEventListener('input', function(){ $('idCount').textContent = '已输入'+this.value.split(/[,\n]+/).filter(function(x){return x.trim();}).length; });
  $('linkInput').addEventListener('input', function(){ $('linkCount').textContent = '已输入'+this.value.split(/[,\n]+/).filter(function(x){return x.trim();}).length; });
});

function $(id){return document.getElementById(id);}
function readFile(e, inputId, countId) {
  var f = e.target.files[0]; if(!f) return;
  var r = new FileReader();
  r.onload = function(ev) {
    var items = ev.target.result.split(/[,\n]+/).map(function(x){return x.trim();}).filter(Boolean);
    items = items.filter(function(v){var s=v.toString();return !(/[一-鿿]/.test(s)||s.length<6);});
    $(inputId).value = items.join('\n');
    $(countId).textContent = '已输入'+items.length;
  };
  r.readAsText(f);
}

function detectLogin() {
  var el = $('loginStatus');
  // 从 ad.xiaohongshu.com 获取 Cookie
  try {
    chrome.cookies.getAll({url: 'https://ad.xiaohongshu.com'}, function(cookies) {
      if (cookies && cookies.length > 0) {
        // 构建Cookie字符串
        var parts = [];
        cookies.forEach(function(c) { parts.push(c.name + '=' + c.value); });
        cookieStr = parts.join('; ');
        if (cookieStr.includes('ares.beaker.session.id')) {
          el.className = 'status ok';
          el.textContent = '✅ 已检测到 ad.xiaohongshu.com 登录状态';
          return;
        }
      }
      el.className = 'status err';
      el.textContent = '❌ 未登录 ad.xiaohongshu.com，请先登录';
    });
  } catch(e) {
    el.className = 'status err';
    el.textContent = '❌ 需要 cookies 权限';
  }
}

function parseUrl(s) {
  var m = s.match(/explore\/([a-f0-9]{24})/i) || s.match(/discovery\/item\/([a-f0-9]{24})/i);
  if (!m && /^[a-f0-9]{24}$/i.test(s.trim())) return { id: s.trim(), token: '', isShort: false };
  if (!m && /xhslink|s\.xiaohongshu|t\.cn/i.test(s)) return { id: null, token: null, isShort: true, raw: s };
  if (!m) return null;
  var id = m[1], token = '';
  var mt = s.match(/xsec_token=([^&]+)/);
  if (mt) try { token = decodeURIComponent(mt[1]); } catch(e) { token = mt[1]; }
  return { id: id, token: token, isShort: false };
}
function fmtTime(t) {
  if (!t) return '未知'; if (typeof t === 'string' && t.includes('-')) return t;
  var d = new Date(Number(t)); if (isNaN(d.getTime())) return String(t);
  return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()+' '+d.getHours()+':'+d.getMinutes();
}

async function makeApiCall(url, body) {
  var resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': cookieStr }, body: body });
  return await resp.json();
}

async function batchConvert() {
  var ids = $('idInput').value.split(/[,\n]+/).map(function(x){return x.trim();}).filter(Boolean);
  if (!ids.length) return alert('请输入笔记ID');
  if (!cookieStr || !cookieStr.includes('ares.beaker.session.id')) return alert('❌ 请先登录 ad.xiaohongshu.com');
  var el = $('idResult'); el.className = 'card'; el.innerHTML = '转换中...'; allResults = [];

  try {
    var data = await makeApiCall('https://ad.xiaohongshu.com/api/light/note/token', JSON.stringify({noteIds: ids, source: 'pc_ad'}));
    el.innerHTML = '';
    if (data.code === 0 && data.data) {
      ids.forEach(function(id) {
        var info = data.data[id]; var token = (typeof info === 'string') ? info : (info && info.xsec_token || '');
        if (token) {
          var url = 'https://www.xiaohongshu.com/explore/'+id+'?xsec_token='+token;
          allResults.push({id:id,url:url});
          el.innerHTML += '<div class="result ok">✅ '+id+'<br><span style="color:#fe2c55;font-size:11px;word-break:break-all">'+url+'</span></div>';
        } else el.innerHTML += '<div class="result err">❌ '+id+' 获取失败</div>';
      });
      var btnDiv = document.createElement('div'); btnDiv.style.cssText = 'margin-top:4px;display:flex;gap:4px';
      var btn1 = document.createElement('button'); btn1.className = 'btn btn-gray'; btn1.textContent = '📋复制全部'; btn1.style.cssText = 'margin:0;padding:4px 8px;font-size:10px';
      btn1.onclick = function(){ navigator.clipboard.writeText(allResults.map(function(r){return r.url;}).join('\n')); alert('✅已复制'); };
      var btn2 = document.createElement('button'); btn2.className = 'btn btn-gray'; btn2.textContent = '📥导出CSV'; btn2.style.cssText = 'margin:0;padding:4px 8px;font-size:10px';
      btn2.onclick = function(){ exportCSV([['笔记ID','链接']].concat(allResults.map(function(r){return[r.id,r.url];})), 'xhs_links'); };
      btnDiv.appendChild(btn1); btnDiv.appendChild(btn2); el.appendChild(btnDiv);
    } else {
      el.innerHTML = '<div class="result err">❌ '+(data.msg||'失败')+'<br><span style="font-size:10px">可能未登录或Cookie过期</span></div>';
    }
  } catch(e) { el.innerHTML = '<div class="result err">❌ '+e.message+'</div>'; }
}

async function extractInfo() {
  var items = $('linkInput').value.split(/[,\n]+/).map(function(x){return x.trim();}).filter(Boolean);
  if (!items.length) return alert('请输入链接');
  var el = $('linkResult'); el.className = 'card'; el.innerHTML = ''; allResults = [];

  for (var i = 0; i < items.length; i++) {
    var s = items[i], p = parseUrl(s);
    if (p && p.isShort) {
      try { var resp = await fetch(s); p = parseUrl(resp.url); if(p&&p.id) { el.innerHTML += '<div class="result ok">✅ '+p.id+'<br><span style="font-size:10px;color:#6e6e73">短链解析成功</span></div>'; allResults.push({id:p.id,nickname:'',time:'',src:s}); } else el.innerHTML += '<div class="result err">❌ 短链解析失败</div>'; }
      catch(e) { el.innerHTML += '<div class="result err">❌ '+e.message+'</div>'; }
      continue;
    }
    if (!p) { el.innerHTML += '<div class="result err">❌ 无法识别</div>'; continue; }
    var html = '<div class="result ok">✅ '+p.id;
    allResults.push({id:p.id,nickname:'',time:'',src:s});
    if (p.token) {
      try {
        var nr = await fetch('https://www.xiaohongshu.com/explore/'+p.id+'?xsec_token='+p.token, {headers:{'Cookie':'xsecappid=aurora-shell'}});
        var h = await nr.text(); var m = h.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
        if (m) { var d = JSON.parse(m[1].replace(/undefined/g,'null')); var nm=(d.note||{}).noteDetailMap||{}; for(var k in nm){var n=nm[k].note||{},u=n.user||{};if(u.nickname){allResults[allResults.length-1].nickname=u.nickname;allResults[allResults.length-1].time=fmtTime(n.time);html+='<br><span style="font-size:11px">👤 '+u.nickname+'　🕐 '+fmtTime(n.time)+'</span>';}break;} }
      } catch(e) {}
    } else html += '<br><span style="font-size:10px;color:#e89e00">⚠️ 无token</span>';
    html += '</div>'; el.innerHTML += html;
  }
  if (allResults.length) {
    var btnDiv = document.createElement('div'); btnDiv.style.cssText = 'margin-top:4px;display:flex;gap:4px';
    var b1 = document.createElement('button'); b1.className = 'btn btn-gray'; b1.textContent = '📋复制全部ID'; b1.style.cssText = 'margin:0;padding:4px 8px;font-size:10px';
    b1.onclick = function() { navigator.clipboard.writeText(allResults.map(function(r){return r.id;}).join('\n')); alert('✅已复制'); };
    var b2 = document.createElement('button'); b2.className = 'btn btn-gray'; b2.textContent = '📥导出CSV'; b2.style.cssText = 'margin:0;padding:4px 8px;font-size:10px';
    b2.onclick = function() { exportCSV([['笔记ID','达人','时间','来源']].concat(allResults.map(function(r){return[r.id,r.nickname||'',r.time||'',r.src||''];})), 'xhs_results'); };
    btnDiv.appendChild(b1); btnDiv.appendChild(b2); el.appendChild(btnDiv);
  }
}

function exportCSV(data, fn) {
  var csv = data.map(function(r){return r.map(function(v){return \'"\'+String(v||\'\').replace(/"/g,\'""\')+\'"\';}).join(\',\');}).join(\'\\n\');
  var u = URL.createObjectURL(new Blob([\'﻿\'+csv],{type:\'text/csv;charset=utf-8\'}));
  chrome.downloads ? chrome.downloads.download({url:u,filename:fn+\'_\'+Date.now()+\'.csv\'}) : window.open(u);
}
