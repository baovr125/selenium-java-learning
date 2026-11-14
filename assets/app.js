/* Selenium Java — logic giao diện: điều hướng, tìm kiếm, tiến độ, quiz, copy, theme. Không phụ thuộc thư viện. */
(function () {
  'use strict';
  var NAV = window.SL_NAV || { groups: [], defaults: {}, titles: {}, lessons: [] };
  var B = document.body;
  var ROOT = B.dataset.root || '', ROUTE = B.dataset.route, ISLESSON = B.dataset.lesson === '1';
  var ICON = { n: '⬜', p: '🟡', c: '✅' }, LABEL = { n: 'Not Started', p: 'In Progress', c: 'Completed' };
  window.__slErrors = [];
  window.addEventListener('error', function (e) { window.__slErrors.push(String(e.message)); });

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, attrs, html) { var e = document.createElement(tag); for (var k in (attrs || {})) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function url(route, anchor) { return ROOT + (route === 'README' ? 'index' : route) + '.html' + (anchor ? '#' + anchor : ''); }

  /* ---------- lưu trữ (localStorage, có dự phòng bộ nhớ) ---------- */
  var KEY = 'sl.progress.v1', mem = null;
  function load() {
    try { var v = JSON.parse(localStorage.getItem(KEY)); if (v && typeof v === 'object') return v; } catch (e) { if (mem) return mem; }
    return mem || { status: {}, ex: {} };
  }
  var S = load(); S.status = S.status || {}; S.ex = S.ex || {};
  function save() { mem = S; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } }
  function getStatus(r) { return S.status[r] || NAV.defaults[r] || 'n'; }
  function setStatus(r, v) { S.status[r] = v; save(); refreshSidebarIcons(); }
  function exDone(r) { var o = S.ex[r] || {}; return [1, 2, 3].filter(function (i) { return o[i]; }).length; }

  /* ---------- theme ---------- */
  $('#theme-btn').addEventListener('click', function () {
    var t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('sl.theme', t); } catch (e) { }
  });

  /* ---------- sidebar ---------- */
  var sidebar = $('#sidebar');
  function buildSidebar() {
    var frag = document.createDocumentFragment();
    NAV.groups.forEach(function (g) {
      var has = g.items.some(function (i) { return i.r === ROUTE; });
      var lessons = g.items.filter(function (i) { return i.k === 'lesson'; });
      var d = el('details'); if (has) d.open = true;
      var cnt = lessons.length ? '<span class="cnt" data-g="' + g.id + '"></span>' : '';
      d.appendChild(el('summary', {}, '<span>' + esc(g.title) + '</span>' + cnt));
      var ul = el('ul');
      g.items.forEach(function (i) {
        var li = el('li');
        var a = el('a', { href: url(i.r), title: NAV.titles[i.r] || i.t, 'data-r': i.r });
        if (i.r === ROUTE) { a.className = 'cur'; a.setAttribute('aria-current', 'page'); }
        a.innerHTML = '<span class="st">' + (i.k === 'lesson' ? '' : '·') + '</span><span class="num">' + esc(i.n) + '</span><span class="tx">' + esc(i.t) + '</span>';
        li.appendChild(a); ul.appendChild(li);
      });
      d.appendChild(ul); frag.appendChild(d);
    });
    var foot = el('div', { class: 'side-foot' }, '<span>Tiến độ lưu trong trình duyệt này.</span>');
    var bx = el('button', { type: 'button' }, '⬇ Xuất tiến độ (JSON)'); bx.onclick = exportProgress;
    var bi = el('button', { type: 'button' }, '⬆ Nhập tiến độ'); bi.onclick = importProgress;
    foot.appendChild(bx); foot.appendChild(bi); frag.appendChild(foot);
    sidebar.innerHTML = ''; sidebar.appendChild(frag);
    refreshSidebarIcons();
    var cur = $('a.cur', sidebar); if (cur) { cur.scrollIntoView({ block: 'center' }); }
  }
  function refreshSidebarIcons() {
    $$('a[data-r]', sidebar).forEach(function (a) {
      var r = a.getAttribute('data-r');
      if (NAV.lessons.indexOf(r) >= 0) { var s = getStatus(r); a.firstChild.textContent = ICON[s]; a.firstChild.title = LABEL[s]; }
    });
    NAV.groups.forEach(function (g) {
      var ls = g.items.filter(function (i) { return i.k === 'lesson'; }), c = $('.cnt[data-g="' + g.id + '"]', sidebar);
      if (c && ls.length) c.textContent = ls.filter(function (i) { return getStatus(i.r) === 'c'; }).length + '/' + ls.length;
    });
  }
  function closeMenu() { B.classList.remove('menu-open'); $('#scrim').hidden = true; $('#menu-btn').setAttribute('aria-expanded', 'false'); }
  $('#menu-btn').addEventListener('click', function () {
    var open = B.classList.toggle('menu-open'); $('#scrim').hidden = !open; this.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  $('#scrim').addEventListener('click', closeMenu);

  /* ---------- export / import ---------- */
  function exportProgress() {
    var blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    var a = el('a', { href: URL.createObjectURL(blob), download: 'selenium-learning-progress.json' });
    document.body.appendChild(a); a.click(); a.remove();
  }
  function importProgress() {
    var inp = el('input', { type: 'file', accept: 'application/json' });
    inp.onchange = function () {
      var f = inp.files[0]; if (!f) return; var r = new FileReader();
      r.onload = function () {
        try { var v = JSON.parse(r.result); if (!v || typeof v !== 'object' || !v.status) throw 0; S = v; S.ex = S.ex || {}; save(); location.reload(); }
        catch (e) { toast('File không đúng định dạng tiến độ.'); }
      };
      r.readAsText(f);
    };
    inp.click();
  }
  function toast(msg) { var t = el('div', { class: 'toast', role: 'status' }, esc(msg)); document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3200); }

  /* ---------- tìm kiếm ---------- */
  var q = $('#q'), box = $('#results'), idx = null, loading = false, sel = -1, timer = null;
  function norm(s) {
    return s.toLowerCase().replace(/[^\u0000-\u007f]/g, function (c) {
      if (c === 'đ') return 'd';
      var d = c.normalize('NFD').charAt(0); return d || c;
    });
  }
  function loadIndex(cb) {
    if (idx) return cb(); if (loading) return; loading = true;
    var s = el('script', { src: ROOT + 'assets/search-index.js' });
    s.onload = function () {
      idx = (window.SL_SEARCH || []).map(function (e) { e.nx = norm(e.x); e.nh = norm(e.h); e.nt = norm(e.t); return e; });
      loading = false; cb();
    };
    s.onerror = function () { loading = false; box.hidden = false; box.innerHTML = '<div class="none">Không tải được chỉ mục tìm kiếm.</div>'; };
    document.head.appendChild(s);
  }
  function doSearch() {
    var raw = q.value.trim(); if (raw.length < 2) { box.hidden = true; return; }
    var toks = norm(raw).split(/\s+/).filter(Boolean), out = [];
    idx.forEach(function (e) {
      var sc = 0;
      for (var i = 0; i < toks.length; i++) {
        var t = toks[i], inT = e.nt.indexOf(t) >= 0, inH = e.nh.indexOf(t) >= 0, inX = e.nx.indexOf(t) >= 0;
        if (!inT && !inH && !inX) return;
        sc += (inT ? 6 : 0) + (inH ? 6 : 0) + (inX ? Math.min(e.nx.split(t).length - 1, 5) : 0);
      }
      if (/^(progress\/|LEARNING_PROGRESS|UPDATE_REPORT|00-project)/.test(e.r)) sc -= 3;   // ưu tiên nội dung bài học
      out.push({ e: e, s: sc });
    });
    out.sort(function (a, b) { return b.s - a.s; });
    out = out.slice(0, 25); sel = -1; box.hidden = false;
    if (!out.length) { box.innerHTML = '<div class="none">Không có kết quả cho “' + esc(raw) + '”.</div>'; return; }
    box.innerHTML = out.map(function (o) {
      var e = o.e, p = e.nx.indexOf(toks[0]); if (p < 0) p = 0;
      var from = Math.max(0, p - 40), snip = e.x.substr(from, 150);
      var h = esc(snip); toks.forEach(function (t) { /* tô đậm theo vị trí gần đúng */ });
      var m = norm(snip), parts = '', last = 0, pos = m.indexOf(toks[0]);
      if (pos >= 0) { parts = esc(snip.slice(0, pos)) + '<mark>' + esc(snip.substr(pos, toks[0].length)) + '</mark>' + esc(snip.slice(pos + toks[0].length)); h = parts; }
      return '<a href="' + url(e.r, e.i) + '" role="option"><div class="rt">' + esc(e.t) + '</div>' + (e.h ? '<div class="rh">' + esc(e.h) + '</div>' : '') +
        '<div class="rs">' + (from > 0 ? '… ' : '') + h + ' …</div></a>';
    }).join('');
  }
  q.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { loadIndex(doSearch); }, 120); });
  q.addEventListener('focus', function () { loadIndex(function () { if (q.value.trim().length >= 2) doSearch(); }); });
  q.addEventListener('keydown', function (ev) {
    var items = $$('a', box);
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault(); if (!items.length) return;
      sel = (sel + (ev.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach(function (a, i) { a.classList.toggle('sel', i === sel); }); items[sel].scrollIntoView({ block: 'nearest' });
    } else if (ev.key === 'Enter' && items.length) { location.href = items[Math.max(sel, 0)].href; }
    else if (ev.key === 'Escape') { box.hidden = true; q.blur(); }
  });
  document.addEventListener('click', function (ev) { if (!ev.target.closest('.search')) box.hidden = true; });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) { ev.preventDefault(); q.focus(); q.select(); }
  });

  /* ---------- TOC bên phải ---------- */
  function buildToc() {
    var hs = $$('#content h2, #content h3').filter(function (h) { return !h.closest('details') && h.id; });
    if (hs.length < 3) return;
    var toc = $('#toc'); toc.innerHTML = '<strong>Trong bài này</strong>';
    var links = hs.map(function (h) {
      var a = el('a', { href: '#' + h.id, class: h.tagName === 'H3' ? 'h3' : 'h2', title: h.textContent }); a.textContent = h.textContent.replace(/\s+/g, ' ');
      toc.appendChild(a); return a;
    });
    function spy() {
      var y = window.scrollY + 90, cur = 0;
      hs.forEach(function (h, i) { if (h.getBoundingClientRect().top + window.scrollY <= y) cur = i; });
      links.forEach(function (a, i) { a.classList.toggle('on', i === cur); });
    }
    window.addEventListener('scroll', spy, { passive: true }); spy();
  }

  /* ---------- widget của bài học ---------- */
  function lessonBar() {
    var h1 = $('#content h1'); if (!h1) return;
    var bar = el('div', { class: 'lesson-bar' });
    var s = getStatus(ROUTE);
    bar.innerHTML = '<label>Trạng thái: <select id="st-sel"><option value="n">⬜ Not Started</option><option value="p">🟡 In Progress</option><option value="c">✅ Completed</option></select></label>' +
      '<span id="ex-count"></span><span class="hint" id="ex-hint"></span>';
    h1.insertAdjacentElement('afterend', bar);
    var sel = $('#st-sel', bar); sel.value = s;
    sel.addEventListener('change', function () { setStatus(ROUTE, sel.value); hint(); });
    S.last = ROUTE; save();
    function hint() {
      var n = exDone(ROUTE); $('#ex-count', bar).textContent = 'Bài tập đã tick: ' + n + '/3';
      $('#ex-hint', bar).textContent = (n === 3 && getStatus(ROUTE) !== 'c') ? '✔ Đã tick đủ 3 bài tập — nếu đã kiểm tra kết quả, hãy đặt ✅ Completed.' : '';
    }
    window.__slHint = hint; hint();
  }
  function exerciseChecks() {
    $$('#content h3').forEach(function (h) {
      var m = /^Exercise\s+(\d)/.exec(h.textContent); if (!m) return;
      var n = +m[1], lab = el('label', { class: 'ex-check' }), cb = el('input', { type: 'checkbox' });
      cb.checked = !!(S.ex[ROUTE] || {})[n];
      cb.addEventListener('change', function () {
        S.ex[ROUTE] = S.ex[ROUTE] || {}; S.ex[ROUTE][n] = cb.checked; save();
        if (getStatus(ROUTE) === 'n' && cb.checked) setStatus(ROUTE, 'p');
        var sel = $('#st-sel'); if (sel) sel.value = getStatus(ROUTE); if (window.__slHint) window.__slHint();
      });
      lab.appendChild(cb); lab.appendChild(document.createTextNode(' Đã tự làm')); h.appendChild(lab);
    });
  }
  function quizzes() {
    var h2 = $$('#content h2').filter(function (h) { return /Knowledge Check/.test(h.textContent); })[0]; if (!h2) return;
    var qs = [], n = h2.nextElementSibling;
    while (n && n.tagName !== 'H2') {
      if (n.tagName === 'UL' && n.nextElementSibling && n.nextElementSibling.tagName === 'DETAILS') qs.push({ ul: n, det: n.nextElementSibling });
      n = n.nextElementSibling;
    }
    var score = el('div', { class: 'quiz-score' }, '<span id="qs-text">Bấm vào đáp án để kiểm tra (0/' + qs.length + ' đã trả lời)</span>');
    var reset = el('button', { type: 'button' }, 'Làm lại'); score.appendChild(reset);
    var done = 0, right = 0;
    function upd() { $('#qs-text').textContent = done < qs.length ? 'Đã trả lời ' + done + '/' + qs.length + ' — đúng ' + right : 'Kết quả: ' + right + '/' + qs.length + ' câu đúng'; }
    qs.forEach(function (q) {
      q.ul.classList.add('quiz'); var m = /Đáp án:\s*([A-D])/.exec(q.det.textContent); q.ans = m ? m[1] : null; q.answered = false;
      $$('li', q.ul).forEach(function (li) {
        li.classList.add('opt'); var L = (/^([A-D])\./.exec(li.textContent) || [])[1];
        li.addEventListener('click', function () {
          if (q.answered || !q.ans) return; q.answered = true; q.ul.classList.add('done'); done++;
          if (L === q.ans) { li.classList.add('ok'); right++; } else { li.classList.add('bad'); }
          $$('li', q.ul).forEach(function (o) { if ((/^([A-D])\./.exec(o.textContent) || [])[1] === q.ans) o.classList.add('ok'); });
          q.det.open = true; upd();
        });
      });
    });
    reset.onclick = function () {
      qs.forEach(function (q) { q.answered = false; q.ul.classList.remove('done'); q.det.open = false; $$('li', q.ul).forEach(function (o) { o.classList.remove('ok', 'bad'); }); });
      done = right = 0; upd();
    };
    var last = qs.length ? qs[qs.length - 1].det : h2; last.insertAdjacentElement('afterend', score); upd();
  }
  function solutionsControls() {
    var h2 = $$('#content h2').filter(function (h) { return /Reference Solutions/.test(h.textContent); })[0]; if (!h2) return;
    var ctl = el('div', { class: 'sol-ctl' }), a = el('button', { type: 'button' }, 'Mở tất cả lời giải'), b = el('button', { type: 'button' }, 'Đóng tất cả');
    function setAll(v) { var n = h2.nextElementSibling; while (n) { if (n.tagName === 'DETAILS') n.open = v; n = n.nextElementSibling; } }
    a.onclick = function () { setAll(true); }; b.onclick = function () { setAll(false); };
    ctl.appendChild(a); ctl.appendChild(b); h2.insertAdjacentElement('afterend', ctl);
  }

  /* ---------- copy ---------- */
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('.copy'); if (!b) return;
    var text = $('pre', b.closest('.code')).textContent;
    function ok() { b.textContent = 'Đã chép ✓'; setTimeout(function () { b.textContent = 'Copy'; }, 1400); }
    function fallback() {
      var ta = el('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); ok(); } catch (e) { b.textContent = 'Không chép được'; } ta.remove();
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(ok, fallback); else fallback();
  });

  /* ---------- dashboard (trang chủ + trang tiến độ) ---------- */
  function counts(items) {
    var c = { n: 0, p: 0, c: 0 }; items.forEach(function (r) { c[getStatus(r)]++; }); return c;
  }
  function renderDashboard(host, full) {
    var all = NAV.lessons, t = counts(all), total = all.length, exTick = all.reduce(function (a, r) { return a + exDone(r); }, 0);
    var next = null;
    if (S.last && all.indexOf(S.last) >= 0 && getStatus(S.last) !== 'c') next = S.last;
    if (!next) next = all.filter(function (r) { return getStatus(r) !== 'c'; })[0] || all[0];
    var html = '<div class="dash-grid">' +
      '<div class="stat"><b>' + t.c + '/' + total + '</b><span>✅ Completed</span></div>' +
      '<div class="stat"><b>' + t.p + '</b><span>🟡 In Progress</span></div>' +
      '<div class="stat"><b>' + t.n + '</b><span>⬜ Not Started</span></div>' +
      '<div class="stat"><b>' + exTick + '/' + (total * 3) + '</b><span>Bài tập đã tick</span></div></div>';
    html += '<div class="bar" aria-label="Tiến độ tổng"><i class="c" style="width:' + (t.c / total * 100) + '%"></i><i class="p" style="width:' + (t.p / total * 100) + '%"></i></div>';
    html += '<p><a class="cta" href="' + url(next) + '">▶ ' + (S.last === next ? 'Tiếp tục: ' : 'Bắt đầu: ') + esc(NAV.titles[next]) + '</a>' +
      '<a class="cta alt" href="' + url('LEARNING_ROADMAP') + '">🗺 Lộ trình</a><a class="cta alt" href="' + url('LEARNING_PROGRESS') + '">📈 Chi tiết tiến độ</a></p>';
    NAV.groups.forEach(function (g) {
      var ls = g.items.filter(function (i) { return i.k === 'lesson'; }).map(function (i) { return i.r; });
      if (!ls.length) return; var c = counts(ls);
      html += '<div class="phase-row"><span>' + esc(g.title) + '</span><div class="bar"><i class="c" style="width:' + (c.c / ls.length * 100) + '%"></i><i class="p" style="width:' + (c.p / ls.length * 100) + '%"></i></div><span class="muted">' + c.c + '/' + ls.length + ' xong</span></div>';
    });
    if (full) {
      NAV.groups.forEach(function (g) {
        var ls = g.items.filter(function (i) { return i.k === 'lesson'; }); if (!ls.length) return;
        html += '<h3>' + esc(g.title) + '</h3><div class="table-wrap"><table class="prog-table"><thead><tr><th>Bài</th><th>Trạng thái</th><th>Bài tập</th></tr></thead><tbody>';
        ls.forEach(function (i) {
          html += '<tr><td><a href="' + url(i.r) + '">' + esc(i.t) + '</a></td><td><select data-r="' + i.r + '">' +
            ['n', 'p', 'c'].map(function (k) { return '<option value="' + k + '"' + (getStatus(i.r) === k ? ' selected' : '') + '>' + ICON[k] + ' ' + LABEL[k] + '</option>'; }).join('') +
            '</select></td><td>' + exDone(i.r) + '/3</td></tr>';
        });
        html += '</tbody></table></div>';
      });
      html += '<p class="muted">Quy tắc: chỉ đặt ✅ Completed khi đã chạy ví dụ, làm đủ 3 bài tập (kết quả khớp) và trả lời đúng Knowledge Check. Các mục 🟡 mặc định là bài có bằng chứng thực hành liên quan trong dự án <code>Selenium1</code>.</p>' +
        '<p><button class="cta alt" id="dx" type="button">⬇ Xuất JSON</button><button class="cta alt" id="di" type="button">⬆ Nhập JSON</button><button class="cta alt" id="dr" type="button">🗑 Xoá tiến độ</button></p>';
    }
    host.innerHTML = html;
    if (full) {
      $$('select[data-r]', host).forEach(function (s) { s.addEventListener('change', function () { setStatus(s.getAttribute('data-r'), s.value); renderDashboard(host, true); }); });
      $('#dx', host).onclick = exportProgress; $('#di', host).onclick = importProgress;
      $('#dr', host).onclick = function () { if (confirm('Xoá toàn bộ tiến độ đã lưu trong trình duyệt này?')) { S = { status: {}, ex: {} }; save(); location.reload(); } };
    }
  }

  /* ---------- mở <details> chứa mục tiêu của #hash ---------- */
  function openHash() {
    var id = decodeURIComponent(location.hash.slice(1)); if (!id) return;
    var t = document.getElementById(id); if (!t) return;
    for (var d = t.closest('details'); d; d = d.parentElement && d.parentElement.closest('details')) d.open = true;
    t.scrollIntoView();
  }
  window.addEventListener('hashchange', openHash);

  /* ---------- khởi tạo ---------- */
  buildSidebar();
  buildToc();
  if (ISLESSON) { lessonBar(); exerciseChecks(); quizzes(); solutionsControls(); }
  var dash = $('#dashboard'); if (dash) renderDashboard(dash, false);
  var pa = $('#progress-app'); if (pa) renderDashboard(pa, true);
  openHash();
})();
