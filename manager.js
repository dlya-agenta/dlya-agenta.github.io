// Окно «Управляющий» (manager.html): слева темы, в центре переписка выбранной темы, справа «На одобрение / Отчёты / Память».
// Доступ — только владелец (логин admin): решает сервер (функция manager), другим админам он отвечает 403.
// Обновление: при открытии — к последнему сообщению; дальше дописываем только новые, список целиком не перерисовываем.
// Если пролистали вверх — прокрутку не дёргаем, показываем «↓ новые».
(() => {
  const API = String(window.API || 'https://arojogajdamsyrrpcmso.supabase.co/functions/v1/web').replace(/\/web$/, '/manager');
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const when = s => s ? new Date(s).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  const tokenOf = () => { try { return JSON.parse(localStorage.getItem('token')); } catch { return null; } };
  const MODE = { auto: ['Обычный', 'высокое усилие; сам перейдёт выше, если задача серьёзная'], xhigh: ['Сверхвысокий', 'для серьёзных задач: думает глубже, дороже'],
    ultra: ['Ультракод', 'для крупных доработок кода: много помощников параллельно, самый дорогой'] };
  const RST = { queued: 'в очереди', running: 'работает', publishing: 'готовит карточку', done: 'готово', error: 'ошибка', stopped: 'остановлен' };
  const AST = { pending: ['ждёт решения', 'warn'], rejected: ['отклонено', 'grey'], applying: ['применяется…', ''], applied: ['применено', 'ok'], failed: ['не применилось', 'bad'] };
  const TST = { work: ['работает', 'warn'], wait: ['ждёт', ''], done: ['готово', 'ok'], error: ['ошибка', 'bad'] };
  const KIND = { code: 'Код', db: 'База', functions: 'Функции', site: 'Сайт', team: 'Команда', self: 'Сам Управляющий' };
  const MKD = { rule: 'Правило', decision: 'Решение', status: 'Статус', report: 'Отчёт', offer: 'Предложение' };
  const WHO = { owner: 'Вы', manager: '🤖 Управляющий', sys: 'Система' };
  let S = null, thread = 0, msgs = [], mode = 'auto', timer = null, sending = false, atBottom = true, unseen = 0;
  let pend = [], upBusy = 0, rightTab = 'approve';

  async function call(action, extra = {}) {
    const t = tokenOf();
    if (!t) { location.href = './'; throw new Error('Войдите на сайт'); }
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, auth: { token: t }, ...extra }) });
    const d = await r.json().catch(() => ({ error: 'server', message: `Ошибка сервера (HTTP ${r.status})` }));
    if (!r.ok || d.error) throw Object.assign(new Error(d.message || d.error || `HTTP ${r.status}`), { status: r.status });
    return d;
  }
  const toast = (t, ms = 3500) => { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, ms); };
  const rub = usd => `≈ ${Math.round((Number(usd) || 0) * (S?.rub ?? 58.5)).toLocaleString('ru-RU')} ₽`;
  // текст: сначала экранируем, потом простая разметка; ссылки — только http(s)
  const rich = s => esc(s).replace(/```([\s\S]*?)```/g, (_, c) => `<pre>${c}</pre>`)
    .replace(/^#{1,4}\s+(.+)$/gm, '<b>$1</b>').replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/^\s*[-•]\s+/gm, '• ')
    .replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  const mins = s => Math.max(0, Math.round((Date.now() - Date.parse(s)) / 60e3));
  const kbs = n => n >= 1048576 ? `${(n / 1048576).toFixed(1)} МБ` : `${Math.max(1, Math.round(n / 1024))} КБ`;
  const ICON = { img: '🖼', pdf: '📄', text: '📝' };
  const fileChip = f => f.kind === 'img' && f.url
    ? `<a class="mg-fimg" href="${esc(f.url)}" target="_blank" rel="noopener" title="${esc(f.name)}"><img src="${esc(f.url)}" alt="${esc(f.name)}" loading="lazy"></a>`
    : `<a class="mg-fchip" ${f.url ? `href="${esc(f.url)}" target="_blank" rel="noopener"` : ''} title="${esc(f.name)}">${ICON[f.kind] ?? '📎'} <span>${esc(f.name)}</span><small>${kbs(f.size)}</small></a>`;

  // ---------- приложенные файлы ----------
  function syncPend(server) {
    if (!Array.isArray(server)) return;
    for (const f of server) { const i = pend.findIndex(x => x.id === f.id); if (i >= 0) pend[i] = { ...pend[i], ...f }; else pend.push(f); }
    const ids = new Set(server.map(f => f.id));
    pend = pend.filter(f => ids.has(f.id));
  }
  const canAdd = () => Math.max(0, (S?.limits?.msg ?? 5) - pend.length - upBusy);
  async function addFiles(list) {
    const max = S?.limits?.max ?? 6291456, many = S?.limits?.msg ?? 5;
    let room = canAdd();
    for (const f of [...list]) {
      if (room <= 0) { toast(`К одной задаче можно приложить не больше ${many} файлов`); break; }
      if (f.size > max) { toast(`«${f.name}» больше ${Math.round(max / 1048576)} МБ — уменьшите файл`); continue; }
      room--; upBusy++; paintPend();
      try {
        const data = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = no; r.readAsDataURL(f); });
        const d = await call('upload', { file: { name: f.name, type: f.type, data } });
        pend.push({ ...d.file });
      } catch (e) { toast(e.message); }
      finally { upBusy--; paintPend(); }
    }
  }
  function paintPend() {
    const box = $('#mg-pend');
    if (box) box.innerHTML = pend.map(f => `<span class="mg-pendone">${ICON[f.kind] ?? '📎'}<span class="mg-pendname">${esc(f.name)}</span>
      <small>${kbs(f.size)}</small><button type="button" class="mg-pendx" data-del="${f.id}" title="Убрать">✕</button></span>`).join('')
      + (upBusy ? `<span class="mg-pendone muted">загружается… ${upBusy}</span>` : '');
    if (box) box.hidden = !pend.length && !upBusy;
    const go = $('#mg-go');
    if (go) go.disabled = sending || upBusy > 0 || (!pend.length && !$('#mg-text')?.value.trim());
    box?.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      const id = +b.dataset.del;
      pend = pend.filter(f => f.id !== id); paintPend();
      try { await call('file_del', { id }); } catch (e) { toast(e.message); }
    });
  }

  // ---------- данные ----------
  function merge(d) {
    S = d;
    if (d.thread && d.thread.id !== thread) { thread = d.thread.id; msgs = []; }
    const seen = new Set(msgs.map(m => m.id));
    msgs = msgs.concat((d.msgs ?? []).filter(m => !seen.has(m.id))).sort((a, b) => a.id - b.id);
    if (Array.isArray(d.files)) syncPend(d.files);
  }
  const busy = () => ['queued', 'running', 'publishing'].includes(S?.run?.status) || (S?.approvals ?? []).some(a => a.status === 'applying');
  const last = () => msgs.length ? msgs[msgs.length - 1].id : 0;

  // ---------- панели ----------
  function threadsPane() {
    const list = S?.threads ?? [], groups = { 'Сегодня': [], 'Вчера': [], 'Неделя': [], 'Раньше': [] };
    const now = Date.now();
    for (const t of list) {
      const age = (now - Date.parse(t.updated_at)) / 864e5;
      const g = age < 1 ? 'Сегодня' : age < 2 ? 'Вчера' : age < 7 ? 'Неделя' : 'Раньше';
      const [, cls] = TST[t.status] ?? ['', ''];
      groups[g].push(`<div class="mg-throw"><button type="button" class="mg-th${t.id === thread ? ' on' : ''}" data-th="${t.id}" title="${esc(t.title)}">
        <span class="mg-thdot ${cls}"></span><span class="mg-tht">${esc(t.title)}</span></button>
        <button type="button" class="mg-thx" data-ren="${t.id}" title="Переименовать">✎</button></div>`);
    }
    const body = Object.entries(groups).filter(([, v]) => v.length).map(([g, v]) => `<div class="mg-thgroup">${g}</div>${v.join('')}`).join('')
      || '<p class="muted">Тем пока нет.</p>';
    return `<aside class="mg-left" id="mg-left">
      <button type="button" class="btn primary mg-new" id="mg-newth">＋ Новая тема</button>
      <input class="mg-find" id="mg-find" placeholder="Поиск по темам…" autocomplete="off">
      <div class="mg-thlist" id="mg-thlist">${body}</div></aside>`;
  }

  function card(a) {
    const [st, cls] = AST[a.status] ?? [a.status, ''];
    const kinds = String(a.kind || '').split(',').filter(Boolean).map(k => `<span class="tag">${esc(KIND[k] ?? k)}</span>`).join('');
    const diff = a.base_sha && a.head_sha ? `https://github.com/${S.repo}/compare/${a.base_sha}...${a.head_sha}` : '';
    const what = [a.migrations?.length && `миграции: ${a.migrations.map(f => f.split('/').pop()).join(', ')}`, a.functions?.length && `функции: ${a.functions.join(', ')}`,
      a.site && 'сайт'].filter(Boolean).join(' · ');
    return `<article class="mg-card mg-${esc(a.status)}" data-id="${a.id}">
      <div class="mg-card-top"><b>№${a.id} · ${esc(a.title)}</b><span class="tag ${cls}">${st}</span></div>
      <div class="mg-kinds">${kinds}${what ? `<small class="muted">${esc(what)}</small>` : ''}</div>
      ${a.summary ? `<div class="mg-text">${rich(a.summary)}</div>` : ''}
      <details><summary>Файлы (${(a.files ?? []).length})</summary><div class="mg-files">${(a.files ?? []).map(f => `<code>${esc(f)}</code>`).join(' ')}</div></details>
      ${diff ? `<a href="${diff}" target="_blank" rel="noopener">Посмотреть правки в GitHub →</a>` : ''}
      ${a.note ? `<div class="muted">Ваш комментарий: ${esc(a.note)}</div>` : ''}${a.result ? `<div class="muted">Итог: ${esc(a.result)}</div>` : ''}
      ${a.status === 'pending' ? `<div class="mg-acts"><button type="button" class="btn primary" data-ok="${a.id}">✅ Одобрить</button>
        <button type="button" class="btn ghost" data-no="${a.id}">Отклонить</button></div>` : ''}
      <small class="muted">${when(a.created_at)}${a.decided_at ? ` · решено ${when(a.decided_at)}` : ''}</small></article>`;
  }

  function rightPane() {
    const a = S?.approvals ?? [], mem = S?.memory ?? [];
    const open = a.filter(x => ['pending', 'applying'].includes(x.status)), done = a.filter(x => !['pending', 'applying'].includes(x.status));
    const tab = (k, t) => `<button type="button" class="chip${rightTab === k ? ' on' : ''}" data-rt="${k}">${t}</button>`;
    let body = '';
    if (rightTab === 'approve') {
      body = (open.length ? open.map(card).join('') : '<p class="muted">Сейчас ничего не ждёт вашего решения.</p>')
        + (done.length ? `<details><summary>Решённые (${done.length})</summary>${done.slice(0, 10).map(card).join('')}</details>` : '');
    } else if (rightTab === 'log') {
      body = msgs.filter(m => m.role !== 'owner').slice(-30).reverse().map(m => `<div class="mg-log">
        <div class="muted">${WHO[m.role] ?? ''} · ${when(m.at)}${m.meta?.usd ? ` · ${rub(m.meta.usd)}` : ''}</div>
        <div class="mg-logt">${rich(String(m.text).slice(0, 900))}</div></div>`).join('') || '<p class="muted">Отчётов пока нет.</p>';
    } else {
      body = `<div class="mg-memadd"><textarea id="mg-memtext" rows="2" placeholder="Что запомнить: правило, решение, договорённость…"></textarea>
        <button type="button" class="btn soft" id="mg-memok">Добавить в память</button></div>`
        + (mem.length ? mem.slice().reverse().map(m => `<div class="mg-mem"><div class="muted">${MKD[m.kind] ?? m.kind} · ${when(m.at)}${m.source === 'owner' ? ' · ваше' : ''}
          <button type="button" class="mg-memx" data-mdel="${m.id}" title="Убрать">✕</button></div><div class="mg-logt">${rich(m.text)}</div></div>`).join('')
          : '<p class="muted">Память пуста. Записи отсюда попадают в каждую задачу.</p>');
    }
    return `<aside class="mg-right" id="mg-right">
      <div class="mg-rtabs">${tab('approve', `На одобрение${open.length ? ` (${open.length})` : ''}`)}${tab('log', 'Отчёты')}${tab('mem', 'Память')}</div>
      <div class="mg-rbody">${body}</div></aside>`;
  }

  function head() {
    const r = S.run, active = r && ['queued', 'running', 'publishing'].includes(r.status);
    const line = !r ? 'Ждёт задачу' : active
      ? `⏳ Запуск №${r.id}: ${RST[r.status]}${r.started_at ? `, ${mins(r.started_at)} мин` : ''}${r.progress ? ` — ${esc(r.progress)}` : ''}`
      : `Последний запуск №${r.id}: ${RST[r.status] ?? r.status}${r.error ? ` — ${esc(r.error)}` : ''}`;
    return `<header class="mg-top" id="mg-top">
      <button type="button" class="btn ghost mg-pane" id="mg-lbtn" title="Темы" aria-label="Темы">☰</button>
      <div class="mg-title"><b>Управляющий</b><small class="mg-status ${active ? 'on' : ''}">${line}</small></div>
      <div class="mg-spend muted">${rub(S.spend.today)} сегодня<br>${rub(S.spend.d30)} за 30 дней</div>
      <button type="button" class="btn ghost mg-pane" id="mg-rbtn" title="Одобрения и отчёты" aria-label="Одобрения">📋</button>
    </header>`;
  }

  const msgHtml = m => `<div class="mg-msg mg-${esc(m.role)}" data-id="${m.id}">
      <div class="mg-who">${WHO[m.role] ?? esc(m.role)} · ${when(m.at)}${m.role === 'owner' && m.meta?.mode && m.meta.mode !== 'auto' ? ` · ${esc(MODE[m.meta.mode]?.[0] ?? '')}` : ''}
        ${m.role === 'manager' && m.meta?.usd ? ` · ${rub(m.meta.usd)}` : ''}</div>
      <div class="mg-text">${rich(m.text)}</div>
      ${(m.files ?? []).length ? `<div class="mg-files">${m.files.map(fileChip).join('')}</div>` : ''}</div>`;

  const chat = () => `<section class="mg-chat" id="mg-chat">${msgs.length ? msgs.map(msgHtml).join('')
    : '<p class="muted mg-empty">Напишите первую задачу: что улучшить, что проверить, что подготовить. Правки придут карточкой — на живой сайт они попадут только после «Одобрить».</p>'}</section>`;

  const composer = () => `<form class="mg-send" id="mg-form">
      <div class="mg-pend" id="mg-pend" hidden></div>
      <textarea id="mg-text" rows="2" maxlength="20000" placeholder="Задача Управляющему… (Enter — отправить, Shift+Enter — новая строка)"></textarea>
      <div class="mg-modes"><label class="btn soft mg-attach" title="Приложить файлы (или перетащите их сюда, или вставьте скриншот)">📎<input type="file" id="mg-file" multiple hidden accept="image/*,.pdf,.txt,.md,.csv,.json,.sql,.html,.xml,.css,.js"></label>
        ${Object.entries(MODE).map(([k, [t, d]]) => `<button type="button" class="chip${mode === k ? ' on' : ''}" data-mode="${k}" title="${esc(d)}">${t}</button>`).join('')}
        <button class="btn primary" id="mg-go" type="submit">Отправить</button>
        <button type="button" class="btn ghost" id="mg-stop" hidden>⏹ Стоп</button></div></form>`;

  const autosize = ta => { if (!ta) return; ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'; };

  function render() {
    const draft = $('#mg-text')?.value ?? '';
    $('#mg').innerHTML = `<div class="mg-wrap">${threadsPane()}<main class="mg-mid">${head()}${chat()}${composer()}</main>${rightPane()}</div>
      <button type="button" class="mg-newmsg" id="mg-jump" hidden>↓ новые</button>`;
    const ta = $('#mg-text'); ta.value = draft;
    paintPend(); autosize(ta);
    bind();
    const c = $('#mg-chat'); if (c) c.scrollTop = c.scrollHeight;
    atBottom = true; unseen = 0;
  }

  function bind() {
    const c = $('#mg-chat');
    c?.addEventListener('scroll', () => {
      atBottom = c.scrollHeight - c.scrollTop - c.clientHeight < 60;
      if (atBottom) { unseen = 0; const j = $('#mg-jump'); if (j) j.hidden = true; }
    });
    $('#mg-jump')?.addEventListener('click', () => { const x = $('#mg-chat'); x.scrollTop = x.scrollHeight; atBottom = true; unseen = 0; $('#mg-jump').hidden = true; });
    $('#mg-newth')?.addEventListener('click', async () => {
      try { const d = await call('thread_new', {}); thread = d.thread.id; msgs = []; await reload(); render(); } catch (e) { toast(e.message); }
    });
    $('#mg-find')?.addEventListener('input', ev => {
      const q = ev.target.value.trim().toLowerCase();
      document.querySelectorAll('.mg-throw').forEach(r => { r.hidden = !!q && !r.textContent.toLowerCase().includes(q); });
    });
    document.querySelectorAll('[data-th]').forEach(b => b.addEventListener('click', async () => {
      thread = +b.dataset.th; msgs = []; await reload(); render();
      document.body.classList.remove('mg-lopen');
    }));
    document.querySelectorAll('[data-ren]').forEach(b => b.addEventListener('click', async ev => {
      ev.stopPropagation();
      const id = +b.dataset.ren, cur = (S.threads ?? []).find(t => t.id === id)?.title ?? '';
      const title = prompt('Название темы:', cur); if (!title) return;
      try { await call('thread_ren', { id, title }); await reload(); render(); } catch (e) { toast(e.message); }
    }));
    document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode; render(); }));
    bindRight();
    $('#mg-form')?.addEventListener('submit', onSend);
    $('#mg-file')?.addEventListener('change', ev => { const l = [...ev.target.files]; ev.target.value = ''; if (l.length) addFiles(l); });
    const f = $('#mg-form'), ta = $('#mg-text');
    ta?.addEventListener('input', () => { paintPend(); autosize(ta); });
    ta?.addEventListener('keydown', ev => { if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); f?.requestSubmit(); } });
    ta?.addEventListener('paste', ev => {
      const l = [...(ev.clipboardData?.items ?? [])].filter(i => i.kind === 'file').map(i => i.getAsFile()).filter(Boolean);
      if (l.length) { ev.preventDefault(); addFiles(l.map((x, i) => new File([x], x.name || `вставка-${i + 1}.${(x.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`, { type: x.type }))); }
    });
    f?.addEventListener('dragover', ev => { if (ev.dataTransfer?.types?.includes('Files')) { ev.preventDefault(); f.classList.add('drop'); } });
    f?.addEventListener('dragleave', () => f.classList.remove('drop'));
    f?.addEventListener('drop', ev => { f.classList.remove('drop'); const l = [...(ev.dataTransfer?.files ?? [])]; if (l.length) { ev.preventDefault(); addFiles(l); } });
    updateStop();
  }

  // кнопки шапки и правой колонки перерисовываются при обновлении — вешаем заново каждый раз
  function bindRight() {
    $('#mg-lbtn')?.addEventListener('click', () => document.body.classList.toggle('mg-lopen'));
    $('#mg-rbtn')?.addEventListener('click', () => document.body.classList.toggle('mg-ropen'));
    document.querySelectorAll('[data-rt]').forEach(b => b.onclick = () => { rightTab = b.dataset.rt; render(); });
    document.querySelectorAll('[data-ok]').forEach(b => b.onclick = async () => {
      const a = S.approvals.find(x => x.id === +b.dataset.ok);
      if (!confirm(`Одобрить «${a?.title}»?\nИзменения попадут в main${a?.migrations?.length ? ', в базу' : ''}${a?.functions?.length ? ', в функции' : ''}${a?.site ? ' и на живой сайт' : ''}.`)) return;
      b.disabled = true;
      try { merge(await call('approve', { id: a.id, after: last(), thread })); render(); schedule(); toast('Одобрено — применяю'); } catch (e) { b.disabled = false; toast(e.message); }
    });
    document.querySelectorAll('[data-no]').forEach(b => b.onclick = async () => {
      const note = prompt('Что не так? Комментарий получит Управляющий (можно пусто):', '');
      if (note === null) return;
      try { merge(await call('reject', { id: +b.dataset.no, note, after: last(), thread })); render(); } catch (e) { toast(e.message); }
    });
    document.querySelectorAll('[data-mdel]').forEach(b => b.onclick = async () => {
      try { await call('memory_del', { id: +b.dataset.mdel }); await reload(); render(); } catch (e) { toast(e.message); }
    });
    $('#mg-memok')?.addEventListener('click', async () => {
      const text = $('#mg-memtext')?.value.trim(); if (!text) return;
      try { await call('memory_add', { kind: 'decision', text }); await reload(); render(); toast('Записал в память'); } catch (e) { toast(e.message); }
    });
    $('#mg-stop')?.addEventListener('click', async () => {
      if (!confirm('Остановить Управляющего? Незаконченные правки не сохранятся.')) return;
      try { merge(await call('stop', { after: last(), thread })); render(); } catch (e) { toast(e.message); }
    });
    updateStop();
  }

  async function onSend(ev) {
    ev.preventDefault();
    const text = $('#mg-text').value.trim(), files = pend.map(x => x.id);
    if ((!text && !files.length) || sending || upBusy) return;
    if (mode === 'ultra' && !confirm('Ультракод — самый дорогой режим. Запустить?')) return;
    sending = true; $('#mg-go').disabled = true;
    try {
      merge(await call('send', { text, mode, files, thread, after: last() }));
      $('#mg-text').value = ''; pend = []; mode = 'auto'; render(); schedule();
    } catch (e) { toast(e.message); }
    finally { sending = false; const g = $('#mg-go'); if (g) g.disabled = false; paintPend(); }
  }

  function updateStop() { const s = $('#mg-stop'); if (s) s.hidden = !['queued', 'running'].includes(S?.run?.status); }

  // ---------- обновление ----------
  async function reload() { merge(await call('state', { after: 0, thread })); }

  function appendNew(fresh) {
    const c = $('#mg-chat');
    if (!c || !fresh.length) return;
    if (!c.querySelector('.mg-msg')) c.innerHTML = '';
    for (const m of fresh) c.insertAdjacentHTML('beforeend', msgHtml(m));
    if (atBottom) c.scrollTop = c.scrollHeight;
    else { unseen += fresh.length; const j = $('#mg-jump'); if (j) { j.hidden = false; j.textContent = `↓ ${unseen} новых`; } }
  }

  async function poll() {
    try {
      const d = await call('state', { after: last(), thread });
      if (d.thread && d.thread.id !== thread) { merge(d); render(); return schedule(); }
      const fresh = d.msgs ?? [];
      merge(d);
      appendNew(fresh);
      // шапка и правая колонка обновляются на месте — переписка и поле ввода не перерисовываются
      if ($('#mg-top')) $('#mg-top').outerHTML = head();
      if ($('#mg-right') && !document.activeElement?.closest?.('#mg-right')) {
        const sc = $('#mg-right .mg-rbody')?.scrollTop ?? 0;
        $('#mg-right').outerHTML = rightPane();
        const nb = $('#mg-right .mg-rbody'); if (nb) nb.scrollTop = sc;
      }
      bindRight();
      updateStop();
    } catch (e) { if (e.status === 401 || e.status === 403) return deny(e.message); }
    schedule();
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(poll, busy() ? 4000 : 20000); }
  function deny(text) {
    clearTimeout(timer);
    $('#mg').innerHTML = `<section class="pcard"><h2>Управляющий</h2><p>${esc(text)}</p><a class="btn soft" href="./">На главную</a></section>`;
  }

  (async () => {
    try {
      merge(await call('state', { after: 0 }));
      if (!S.thread) { const d = await call('thread_new', {}); thread = d.thread.id; await reload(); }
      render(); schedule();
    } catch (e) { deny(e.status === 403 ? 'Это окно доступно только владельцу сервиса.' : e.message); }
    $('#gate').hidden = true; $('#app').hidden = false;
    document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
  })();
})();
