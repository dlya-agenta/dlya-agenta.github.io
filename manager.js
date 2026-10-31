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
      <div class="mg-text">${rich(m.text)}</div></div>`).join('')
    : '<p class="muted">Напишите Менеджеру первую задачу: что улучшить на сайте, что проверить, что подготовить. Он сделает правки в отдельной ветке и пришлёт карточку — на живой сайт они попадут только после вашего «Одобрить».</p>'}</section>`;

  const composer = () => `<form class="pcard mg-send" id="mg-form">
      <textarea id="mg-text" rows="4" maxlength="20000" placeholder="Задача для Менеджера…"></textarea>
      <div class="mg-modes">${Object.entries(MODE).map(([k, [t, d]]) => `<button type="button" class="chip${mode === k ? ' on' : ''}" data-mode="${k}" title="${esc(d)}">${t}</button>`).join('')}</div>
      <small class="muted" id="mg-mode-note">${esc(MODE[mode][1])}</small>
      <button class="btn primary" id="mg-go">Отправить</button></form>`;

  function render() {
    const draft = $('#mg-text')?.value ?? '', atBottom = (() => { const c = $('#mg-chat'); return !c || c.scrollHeight - c.scrollTop - c.clientHeight < 60; })();
    $('#mg').innerHTML = head() + cards() + chat() + composer();
    $('#mg-text').value = draft;
    const c = $('#mg-chat'); if (atBottom) c.scrollTop = c.scrollHeight;
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
      const text = $('#mg-text').value.trim();
      if (!text || sending) return;
      if (mode === 'ultra' && !confirm('Ультракод — самый дорогой режим (много помощников параллельно). Запустить?')) return;
      sending = true; $('#mg-go').disabled = true;
      try { merge(await call('send', { text, mode, after: last() })); $('#mg-text').value = ''; mode = 'auto'; render(); schedule(); }
      catch (e) { toast(e.message); }
      finally { sending = false; const g = $('#mg-go'); if (g) g.disabled = false; }
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
