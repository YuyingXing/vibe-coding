/* Admin — upload / edit / reorder / delete works & inspiration */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const TOKEN_KEY = 'hm-admin-token';
  const LABELS = { works: '个人作品', inspiration: '灵感图集' };
  const HINTS = {
    works: '作品将以 3:4 竖幅展示在首页的横向画廊中。支持 JPG / PNG / WEBP / GIF / AVIF，单张不超过 30MB，可一次选择多张。',
    inspiration: '灵感图片保持原始比例，以错落的方式展示；点击会放大并推开周围图片。支持一次选择多张。',
  };

  let token = null;
  try { token = sessionStorage.getItem(TOKEN_KEY); } catch {}
  let tab = 'works';
  let items = [];
  let pending = []; // { file, url }
  let orderDirty = false;

  /* ---------- helpers ---------- */
  let toastTimer;
  function toast(msg, error = false) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('is-error', error);
    t.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-show'), 2600);
  }

  async function api(method, url, body) {
    const opts = { method, headers: { Authorization: `Bearer ${token}` } };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const r = await fetch(url, opts);
    const data = await r.json().catch(() => ({}));
    if (r.status === 401) { logout(); throw new Error('登录已过期，请重新登录'); }
    if (!r.ok) throw new Error(data.error || `请求失败 (${r.status})`);
    return data;
  }

  /* ---------- auth ---------- */
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#loginError').textContent = '';
    const password = e.target.password.value;
    const r = await fetch('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { $('#loginError').textContent = data.error || '登录失败'; return; }
    token = data.token;
    try { sessionStorage.setItem(TOKEN_KEY, token); } catch {}
    showApp();
  });

  function logout() {
    token = null;
    try { sessionStorage.removeItem(TOKEN_KEY); } catch {}
    $('#app').hidden = true;
    $('#login').hidden = false;
  }
  $('#logout').addEventListener('click', logout);

  function showApp() {
    $('#login').hidden = true;
    $('#app').hidden = false;
    switchTab(tab);
    refreshCounts();
  }

  /* ---------- tabs ---------- */
  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));

  function switchTab(next) {
    if (orderDirty && !confirm('顺序还未保存，确定切换吗？')) return;
    tab = next;
    orderDirty = false;
    $('#saveOrder').disabled = true;
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === tab));
    $('.tab-name').textContent = LABELS[tab];
    $('#uploadHint').textContent = HINTS[tab];
    document.querySelectorAll('.f-works').forEach((el) => (el.hidden = tab !== 'works'));
    document.querySelectorAll('.f-inspo').forEach((el) => (el.hidden = tab !== 'inspiration'));
    $('#grid').className = `grid ${tab}`;
    clearPending();
    load();
  }

  async function refreshCounts() {
    for (const c of ['works', 'inspiration']) {
      const list = await fetch(`/api/${c}`).then((r) => r.json()).catch(() => []);
      $(`[data-count="${c}"]`).textContent = list.length;
    }
  }

  /* ---------- library ---------- */
  async function load() {
    items = await fetch(`/api/${tab}`).then((r) => r.json()).catch(() => []);
    render();
  }

  function render() {
    const grid = $('#grid');
    grid.innerHTML = '';
    $('#empty').hidden = items.length > 0;
    $(`[data-count="${tab}"]`).textContent = items.length;

    items.forEach((it, i) => {
      const card = document.createElement('article');
      card.className = 'card';
      card.draggable = true;
      card.dataset.id = it.id;
      const fields = tab === 'works'
        ? `<input data-k="title" placeholder="标题"><input data-k="location" placeholder="地点"><input data-k="year" placeholder="年份">`
        : `<input data-k="caption" placeholder="说明文字">`;
      card.innerHTML = `
        <div class="card-media">
          <img loading="lazy" alt="">
          <span class="badge">${String(i + 1).padStart(2, '0')}${i === 0 && tab === 'works' ? ' · 首页大图' : ''}</span>
          ${it.sample ? '<span class="badge sample">示例</span>' : ''}
        </div>
        <div class="card-body">${fields}</div>
        <div class="card-actions">
          <button class="btn sm" data-act="save">保存</button>
          <button class="btn sm danger" data-act="delete">删除</button>
        </div>`;
      card.querySelector('img').src = it.src;
      card.querySelectorAll('input').forEach((inp) => { inp.value = it[inp.dataset.k] || ''; });

      card.querySelector('[data-act="save"]').addEventListener('click', async () => {
        const body = {};
        card.querySelectorAll('input').forEach((inp) => { body[inp.dataset.k] = inp.value; });
        try {
          Object.assign(it, await api('PATCH', `/api/${tab}/${it.id}`, body));
          toast('已保存');
        } catch (err) { toast(err.message, true); }
      });
      card.querySelector('[data-act="delete"]').addEventListener('click', async () => {
        if (!confirm('确定删除这张图片吗？此操作不可撤销。')) return;
        try {
          await api('DELETE', `/api/${tab}/${it.id}`);
          items = items.filter((x) => x !== it);
          render();
          toast('已删除');
        } catch (err) { toast(err.message, true); }
      });
      // inputs shouldn't start a card drag
      card.querySelectorAll('input').forEach((inp) => {
        inp.addEventListener('mousedown', () => (card.draggable = false));
        inp.addEventListener('blur', () => (card.draggable = true));
      });
      grid.appendChild(card);
    });
    setupDnD();
  }

  /* ---------- reorder (HTML5 drag & drop) ---------- */
  function setupDnD() {
    const grid = $('#grid');
    let dragged = null;
    grid.querySelectorAll('.card').forEach((card) => {
      card.addEventListener('dragstart', (e) => {
        dragged = card;
        card.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('is-dragging');
        grid.querySelectorAll('.is-over').forEach((c) => c.classList.remove('is-over'));
      });
      card.addEventListener('dragover', (e) => {
        if (!dragged || dragged === card) return;
        e.preventDefault();
        card.classList.add('is-over');
      });
      card.addEventListener('dragleave', () => card.classList.remove('is-over'));
      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('is-over');
        if (!dragged || dragged === card) return;
        const from = items.findIndex((x) => x.id === dragged.dataset.id);
        const to = items.findIndex((x) => x.id === card.dataset.id);
        const [moved] = items.splice(from, 1);
        items.splice(to, 0, moved);
        orderDirty = true;
        $('#saveOrder').disabled = false;
        render();
      });
    });
  }

  $('#saveOrder').addEventListener('click', async () => {
    try {
      await api('PUT', `/api/${tab}/order`, { ids: items.map((x) => x.id) });
      orderDirty = false;
      $('#saveOrder').disabled = true;
      toast('顺序已保存');
    } catch (err) { toast(err.message, true); }
  });

  /* ---------- upload ---------- */
  const dz = $('#dropzone');
  const input = $('#fileInput');
  input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });
  ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => {
    if (![...e.dataTransfer.types].includes('Files')) return;
    e.preventDefault(); dz.classList.add('is-over');
  }));
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, () => dz.classList.remove('is-over')));
  dz.addEventListener('drop', (e) => { e.preventDefault(); addFiles(e.dataTransfer.files); });

  function addFiles(list) {
    const ok = [...list].filter((f) => /^image\/(jpeg|png|webp|gif|avif)$/.test(f.type));
    if (ok.length < list.length) toast('已忽略不支持的文件', true);
    ok.forEach((file) => pending.push({ file, url: URL.createObjectURL(file) }));
    renderPending();
  }

  function clearPending() {
    pending.forEach((p) => URL.revokeObjectURL(p.url));
    pending = [];
    renderPending();
    $('#metaForm').reset();
  }

  function renderPending() {
    const box = $('#previews');
    box.innerHTML = '';
    pending.forEach((p, i) => {
      const el = document.createElement('div');
      el.className = 'preview';
      el.innerHTML = '<img alt=""><button type="button" aria-label="移除">✕</button>';
      el.querySelector('img').src = p.url;
      el.querySelector('button').addEventListener('click', () => {
        URL.revokeObjectURL(p.url);
        pending.splice(i, 1);
        renderPending();
      });
      box.appendChild(el);
    });
    $('#uploadBtn').disabled = pending.length === 0;
    $('#uploadBtn').textContent = pending.length ? `上传 ${pending.length} 张` : '上传';
  }

  $('#metaForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!pending.length) return;
    const fd = new FormData();
    const form = e.target;
    const keys = tab === 'works' ? ['title', 'location', 'year'] : ['caption'];
    keys.forEach((k) => fd.append(k, form[k].value));
    pending.forEach((p) => fd.append('images', p.file));

    const xhr = new XMLHttpRequest();
    const bar = $('#progress');
    bar.classList.add('is-active');
    $('#uploadBtn').disabled = true;
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) bar.firstElementChild.style.width = (ev.loaded / ev.total) * 100 + '%';
    };
    xhr.onloadend = () => {
      bar.classList.remove('is-active');
      bar.firstElementChild.style.width = '0';
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status === 401) { logout(); toast('登录已过期，请重新登录', true); return; }
      if (xhr.status !== 201) {
        toast(data.error || '上传失败', true);
        $('#uploadBtn').disabled = false;
        return;
      }
      toast(`已上传 ${data.length} 张`);
      clearPending();
      load();
    };
    xhr.open('POST', `/api/${tab}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(fd);
  });

  /* ---------- boot ---------- */
  if (token) {
    // verify token is still valid (server restarts clear tokens)
    fetch('/api/session', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? showApp() : logout()))
      .catch(logout);
  }
})();
