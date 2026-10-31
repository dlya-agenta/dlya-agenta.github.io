// Окно «Менеджер проекта» (manager.html, миграция 050): переписка владельца с ИИ-менеджером, ход текущей работы с кнопкой «Остановить»,
// карточки на одобрение (что меняется, ссылка на правки в GitHub, «Одобрить» / «Отклонить» с комментарием), режим задачи и расходы.
// Доступ — только владелец (логин admin): решает сервер (функция manager), другим админам он отвечает 403.
// Опрос state: каждые 4 с, пока Менеджер работает или применяется карточка, иначе раз в 30 с.
(() => {
  const API = String(window.API || 'https://arojogajdamsyrrpcmso.supabase.co/functions/v1/web').replace(/\/web$/, '/manager');
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const when = s => s ? new Date(s).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  const tokenOf = () => { try { return JSON.parse(localStorage.getItem('token')); } catch { return null; } };
  const MODE = { auto: ['Обычный', 'высокое усилие; сам перейдёт выше, если задача серьёзная'], xhigh: ['Сверхвысокий', 'для серьёзных задач: думает глубже, дороже'],
    ultra: ['Ультракод', 'для крупных доработок кода: много помощников параллельно, самый дорогой'] };
  const RST = { queued: 'в очереди на GitHub', running: 'работает', publishing: 'готовит карточку', done: 'готово', error: 'ошибка', stopped: 'остановлен' };
  const AST = { pending: ['ждёт вашего решения', 'warn'], rejected: ['отклонено', 'grey'], applying: ['применяется…', ''], applied: ['применено', 'ok'], failed: ['не применилось', 'bad'] };
  const KIND = { code: 'Код', db: 'База', functions: 'Функции', site: 'Сайт', team: 'Команда', self: 'Сам Менеджер' };
  const WHO = { owner: 'Вы', manager: '🤖 Менеджер', sys: 'Система' };
  let S = null, msgs = [], mode = 'auto', timer = null, sending = false;
  let pend = [];            // файлы, приложенные к ещё не отправленной задаче [{id, name, size, kind, url}]
  let upBusy = 0;           // сколько файлов сейчас загружается

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
  // текст ИИ: абзацы, **жирный**, `код`, ссылки — после экранирования
  const rich = s => esc(s).replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  const mins = s => Math.max(0, Math.round((Date.now() - Date.parse(s)) / 60e3));
  const kbs = n => n >= 1048576 ? `${(n / 1048576).toFixed(1)} МБ` : `${Math.max(1, Math.round(n / 1024))} КБ`;
  const ICON = { img: '🖼', pdf: '📄', text: '📝' };
  // файл в переписке: картинка — миниатюрой (по нажатию открывается), остальные — строкой со ссылкой на 1 час
  const fileChip = f => f.kind === 'img' && f.url
    ? `<a class="mg-fimg" href="${esc(f.url)}" target="_blank" rel="noopener" title="${esc(f.name)}"><img src="${esc(f.url)}" alt="${esc(f.name)}" loading="lazy"></a>`
    : `<a class="mg-fchip" ${f.url ? `href="${esc(f.url)}" target="_blank" rel="noopener"` : ''} title="${esc(f.name)}">${ICON[f.kind] ?? '📎'} <span>${esc(f.name)}</span><small>${kbs(f.size)}</small></a>`;

  // приложенные, но не отправленные: список приходит с сервера (переживает перезагрузку окна и перезапуск Менеджера)
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
  // только список приложенных и кнопка «Отправить» — чтобы загрузка не перерисовывала поле с текстом
  function paintPend() {
    const box = $('#mg-pend');
    if (box) box.innerHTML = pend.map(f => `<span class="mg-pendone">${ICON[f.kind] ?? '📎'}<span class="mg-pendname">${esc(f.name)}</span>
      <small>${kbs(f.size)}</small><button type="button" class="mg-pendx" data-del="${f.id}" title="Убрать">✕</button></span>`).join('')
      + (upBusy ? `<span class="mg-pendone muted">загружается… ${upBusy}</span>` : '');
    if (box) box.hidden = !pend.length && !upBusy;
    const go = $('#mg-go');
    if (go) go.disabled = sending || upBusy > 0 || (!pend.length && !$('#mg-text')?.value.trim());
    document.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      const id = +b.dataset.del;
      pend = pend.filter(f => f.id !== id);
      paintPend();
      try { await call('file_del', { id }); } catch (e) { toast(e.message); }
    });
  }

  function merge(d) {
    S = d;
    const seen = new Set(msgs.map(m => m.id));
    msgs = msgs.concat((d.msgs ?? []).filter(m => !seen.has(m.id))).sort((a, b) => a.id - b.id);
  }
  const busy = () => ['queued', 'running', 'publishing'].includes(S?.run?.status) || (S?.approvals ?? []).some(a => a.status === 'applying');

  function head() {
    const r = S.run, active = busy() && r && ['queued', 'running', 'publishing'].includes(r.status);
    const line = !r ? 'Менеджер ждёт задачу' : active
      ? `⏳ Запуск №${r.id}: ${RST[r.status]}${r.started_at ? `, ${mins(r.started_at)} мин` : ''}${r.progress ? ` — ${esc(r.progress)}` : ''}`
      : `Последний запуск №${r.id}: ${RST[r.status] ?? r.status}${r.error ? ` — ${esc(r.error)}` : ''}`;
    return `<section class="pcard mg-head"><div class="mg-status${active ? ' on' : ''}">${line}</div>
      <div class="mg-spend muted">Расходы: сегодня ${rub(S.spend.today)}, за 30 дней ${rub(S.spend.d30)}${active ? '' : ''}</div>
      ${active ? '<button type="button" class="btn ghost" id="mg-stop">⏹ Остановить</button>' : ''}</section>`;
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

  function cards() {
    const all = S.approvals ?? [], open = all.filter(a => ['pending', 'applying'].includes(a.status)), old = all.filter(a => !open.includes(a));
    if (!all.length) return '';
    return `<section class="pcard mg-cards"><h2>На одобрение${open.length ? ` (${open.length})` : ''}</h2>
      ${open.length ? open.map(card).join('') : '<p class="muted">Сейчас ничего не ждёт вашего решения.</p>'}
      ${old.length ? `<details><summary>Решённые (${old.length})</summary>${old.map(card).join('')}</details>` : ''}</section>`;
  }

  const chat = () => `<section class="pcard mg-chat" id="mg-chat">${msgs.length ? msgs.map(m => `<div class="mg-msg mg-${esc(m.role)}">
      <div class="mg-who">${WHO[m.role] ?? esc(m.role)} · ${when(m.at)}${m.role === 'owner' && m.meta?.mode && m.meta.mode !== 'auto' ? ` · ${esc(MODE[m.meta.mode]?.[0] ?? '')}` : ''}
        ${m.role === 'manager' && m.meta?.usd ? ` · ${rub(m.meta.usd)}` : ''}</div>
      <div class="mg-text">${rich(m.text)}</div>
      ${(m.files ?? []).length ? `<div class="mg-files">${m.files.map(fileChip).join('')}</div>` : ''}</div>`).join('')
    : '<p class="muted">Напишите Менеджеру первую задачу: что улучшить на сайте, что проверить, что подготовить. Он сделает правки в отдельной ветке и пришлёт карточку — на живой сайт они попадут только после вашего «Одобрить».</p>'}</section>`;

  const composer = () => `<form class="pcard mg-send" id="mg-form">
      <textarea id="mg-text" rows="4" maxlength="20000" placeholder="Задача для Менеджера… (можно приложить скриншот, PDF или текстовый файл)"></textarea>
      <div class="mg-pend" id="mg-pend" hidden></div>
      <div class="mg-modes"><label class="btn soft mg-attach" title="Приложить файлы (или перетащите их в это поле, или вставьте скриншот из буфера)">
          📎 Приложить<input type="file" id="mg-file" multiple hidden accept="image/*,.pdf,.txt,.md,.csv,.json,.sql,.html,.xml,.css,.js"></label>
        ${Object.entries(MODE).map(([k, [t, d]]) => `<button type="button" class="chip${mode === k ? ' on' : ''}" data-mode="${k}" title="${esc(d)}">${t}</button>`).join('')}</div>
      <small class="muted" id="mg-mode-note">${esc(MODE[mode][1])} · файлы до ${Math.round((S?.limits?.max ?? 6291456) / 1048576)} МБ, не больше ${S?.limits?.msg ?? 5} к одной задаче</small>
      <button class="btn primary" id="mg-go">Отправить</button></form>`;

  function render() {
    const draft = $('#mg-text')?.value ?? '', atBottom = (() => { const c = $('#mg-chat'); return !c || c.scrollHeight - c.scrollTop - c.clientHeight < 60; })();
    $('#mg').innerHTML = head() + cards() + chat() + composer();
    $('#mg-text').value = draft;
    paintPend();
    const c = $('#mg-chat'); if (atBottom) c.scrollTop = c.scrollHeight;
    // файлы: кнопкой, перетаскиванием в поле задачи и вставкой скриншота из буфера (Ctrl+V / ⌘V)
    const ta = $('#mg-text');
    $('#mg-file').addEventListener('change', ev => { const l = [...ev.target.files]; ev.target.value = ''; if (l.length) addFiles(l); });
    ta.addEventListener('paste', ev => {
      const l = [...(ev.clipboardData?.items ?? [])].filter(i => i.kind === 'file').map(i => i.getAsFile()).filter(Boolean);
      if (l.length) { ev.preventDefault(); addFiles(l.map((f, i) => new File([f], f.name || `вставка-${i + 1}.${(f.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`, { type: f.type }))); }
    });
    const form = $('#mg-form');
    form.addEventListener('dragover', ev => { if (ev.dataTransfer?.types?.includes('Files')) { ev.preventDefault(); form.classList.add('drop'); } });
    form.addEventListener('dragleave', () => form.classList.remove('drop'));
    form.addEventListener('drop', ev => {
      form.classList.remove('drop');
      const l = [...(ev.dataTransfer?.files ?? [])];
      if (l.length) { ev.preventDefault(); addFiles(l); }
    });
    ta.addEventListener('input', paintPend);
    $('#mg-stop')?.addEventListener('click', async () => {
      if (!confirm('Остановить Менеджера? Незаконченные правки не сохранятся.')) return;
      try { merge(await call('stop', { after: last() })); render(); } catch (e) { toast(e.message); }
    });
    $('#mg').querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode; render(); }));
    $('#mg').querySelectorAll('[data-ok]').forEach(b => b.addEventListener('click', async () => {
      const a = S.approvals.find(x => x.id === +b.dataset.ok);
      if (!confirm(`Одобрить «${a?.title}»?\nИзменения попадут в main${a?.migrations?.length ? ', в базу' : ''}${a?.functions?.length ? ', в функции' : ''}${a?.site ? ' и на живой сайт' : ''}.`)) return;
      b.disabled = true;
      try { merge(await call('approve', { id: a.id, after: last() })); render(); schedule(); toast('Одобрено — применяю'); } catch (e) { b.disabled = false; toast(e.message); }
    }));
    $('#mg').querySelectorAll('[data-no]').forEach(b => b.addEventListener('click', async () => {
      const note = prompt('Что не так? Комментарий получит Менеджер (можно пусто):', '');
      if (note === null) return;
      try { merge(await call('reject', { id: +b.dataset.no, note, after: last() })); render(); } catch (e) { toast(e.message); }
    }));
    $('#mg-form').addEventListener('submit', async ev => {
      ev.preventDefault();
      const text = $('#mg-text').value.trim(), files = pend.map(f => f.id);
      if ((!text && !files.length) || sending || upBusy) return;
      if (mode === 'ultra' && !confirm('Ультракод — самый дорогой режим (много помощников параллельно). Запустить?')) return;
      sending = true; $('#mg-go').disabled = true;
      try { merge(await call('send', { text, mode, files, after: last() })); $('#mg-text').value = ''; pend = []; mode = 'auto'; render(); schedule(); }
      catch (e) { toast(e.message); }
      finally { sending = false; const g = $('#mg-go'); if (g) g.disabled = false; paintPend(); }
    });
  }
  const last = () => msgs.length ? msgs[msgs.length - 1].id : 0;

  async function poll() {
    try { merge(await call('state', { after: last() })); if (!document.activeElement?.closest?.('#mg-form, details')) render(); }
    catch (e) { if (e.status === 401 || e.status === 403) return deny(e.message); }
    schedule();
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(poll, busy() ? 4000 : 30000); }
  function deny(text) {
    clearTimeout(timer);
    $('#mg').innerHTML = `<section class="pcard"><h2>Менеджер проекта</h2><p>${esc(text)}</p><a class="btn soft" href="./">На главную</a></section>`;
  }

  (async () => {
    try { merge(await call('state')); render(); schedule(); }
    catch (e) { deny(e.status === 403 ? 'Окно Менеджера доступно только владельцу сервиса.' : e.message); }
    $('#gate').hidden = true; $('#app').hidden = false;
    document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
  })();
})();
