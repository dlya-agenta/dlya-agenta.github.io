// Клиенты и задачи (ТЗ v2, шаг 3.4): экран «👥 Клиенты» в окне сайта — задачи на сегодня сверху, клиенты с фильтром по статусу и поиском,
// карточка клиента (телефон, статус, заметка, объекты, задачи, подборка PDF или ссылкой одним нажатием), задача со сроком (МСК) и напоминанием
// в Telegram-бот, push и окно на сайте; «Клиенту…» на карточке объекта (главная и архив). Всё считает и проверяет сервер (web: crm_*).
// В режиме «С клиентом» пункт меню и кнопки скрыты (agent-only). После первой задачи — «Добавить на главный экран» (NOTIFY.offerInstall('task')).
// v5.39 (Алексей 06.11): просрочка в днях у имени клиента и счётчик «Просрочено», фильтры (покупатели/продавцы, просроченные, на сегодня, без задач) и сортировка;
// покупатель/продавец, бюджет и пожелания; журнал касаний (звонок, встреча, сообщение, показ, заметка); задачи друг другу («Кому», «от …», «📌 Поручил другим»);
// «👥 Команда» — общая CRM по логину или коду партнёра (приглашение → принять); «📅 Календарь на телефоне» (hub cal_get — Apple/Google); «⬇️ Excel» (crm_export → CSV).
window.CRM = (() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ST = { new: 'Новый', work: 'В работе', show: 'Показ', deposit: 'Задаток', deal: 'Сделка', later: 'Отложили', lost: 'Отказ' };   // v5.31c: «Отложили» — в «Все» не входит, только во вкладке
  const SRC = { call: 'Звонок', avito: 'Авито', site: 'Сайт', ref: 'Рекомендация', other: 'Другое' };
  const VIA = [['tg', 'Telegram-бот'], ['push', 'Push'], ['site', 'Окно на сайте']];
  let ui = null, meta = null, L = null, C = null, F = { status: '', q: '', kind: '', only: '', sort: 'upd' }, view = 'home', T = null, NK = 'call';
  const KIND = { buyer: 'Покупатель', seller: 'Продавец', renter: 'Арендатор', landlord: 'Арендодатель', other: 'Другое' };
  const NOTE = { call: '📞 Звонок', meet: '🤝 Встреча', msg: '💬 Сообщение', show: '🏠 Показ', note: '📝 Заметка' };
  const SORT = { upd: 'Недавно изменённые', late: 'Сначала просроченные', next: 'По ближайшей задаче', touch: 'Давно не касались', name: 'По имени' };
  const ago = t => { if (!t) return ''; const n = Math.round((Date.parse(today() + 'T00:00:00+03:00') - Date.parse(mskParts(t).d + 'T00:00:00+03:00')) / 864e5); return n <= 0 ? 'сегодня' : n === 1 ? 'вчера' : `${n} дн. назад`; };
  const lateTxt = n => n == null ? '' : n === 0 ? 'сегодня' : `${n} дн.`;
  const lateBadge = n => n == null ? '' : `<span class="crm-lb" title="Задача просрочена${n ? ` на ${n} дн.` : ' сегодня'}">⏰ ${lateTxt(n)}</span>`;
  const mln = v => v ? String(+(v / 1e6).toFixed(2)).replace('.', ',') : '';
  const budget = c => c.budget_from || c.budget_to ? `${c.budget_from ? `от ${mln(c.budget_from)}` : ''}${c.budget_from && c.budget_to ? ' ' : ''}${c.budget_to ? `до ${mln(c.budget_to)}` : ''} млн` : '';
  const teamName = () => L?.team || 'Main';
  let tab = 'my', M = null, MC = null, FM = { status: '', q: '', owner: '' };   // v5.37: вкладка «Main · общие» — клиенты всех участников группы, чужие только посмотреть
  const body = () => $('#sheet-body');
  // время — МСК, как у сервера: «31.10, 15:00», для полей — ГГГГ-ММ-ДД и ЧЧ:ММ
  const mskParts = t => { const s = new Date(t).toLocaleString('sv-SE', { timeZone: 'Europe/Moscow' }); return { d: s.slice(0, 10), t: s.slice(11, 16) }; };
  const today = () => mskParts(Date.now()).d;
  const when = t => { if (!t) return 'без срока'; const p = mskParts(t), d = p.d === today() ? 'сегодня' : p.d === mskParts(Date.now() + 864e5).d ? 'завтра' : `${p.d.slice(8)}.${p.d.slice(5, 7)}`; return `${d}, ${p.t}`; };
  const iso = (d, t) => d ? `${d}T${t || '10:00'}:00+03:00` : null;
  const digits = p => { const d = String(p ?? '').replace(/\D/g, ''); return /^8\d{10}$/.test(d) ? '7' + d.slice(1) : /^\d{10}$/.test(d) ? '7' + d : d; };
  const money = v => v ? `${Number(v).toLocaleString('ru-RU')} ₽` : '';
  const pill = s => `<span class="crm-st crm-st-${esc(s)}">${esc(ST[s] ?? s)}</span>`;
  const err = (m, el = body()) => { const p = el?.querySelector('.crm-err'); if (p) { p.textContent = m; p.hidden = !m; } else ui.toast(m, 5000); };

  function use(deps, m) { ui = deps; meta = m; badge(m?.crm?.due ?? 0); }
  function badge(n) { const b = $('#crm-badge'); if (b) { b.textContent = n > 99 ? '99+' : String(n); b.hidden = !n; } }
  function bind(onclick) {   // у #sheet-body один обработчик: прежние окна (подборки, районы) не должны срабатывать здесь
    const b = body(); b.onclick = onclick; b.onchange = null; b.oninput = null; b.onsubmit = null;
  }

  // ---------- главный экран ----------
  async function open(hash) {
    view = 'home'; tab = 'my';
    ui.sheet('👥 Клиенты и задачи', '<p class="muted">Загрузка…</p>', true);
    try { [L, T] = await Promise.all([ui.call('crm_list', F), ui.call('crm_team', {}).catch(() => null)]); } catch (e) { body().innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    badge(L.today.filter(t => !t.done_at).length);
    const m = /^#task=(\d+)/.exec(hash ?? '');
    if (m) { const t = [...L.today, ...L.later, ...(L.given ?? [])].find(x => x.id === +m[1]); if (t) return taskForm(t); }
    home();
  }
  const taskRow = (t, withClient = true) => `<div class="crm-task${t.overdue ? ' over' : ''}${t.done_at ? ' done' : ''}" data-task="${t.id}">
    <button type="button" class="crm-check" data-tact="${t.done_at ? 'undo' : 'done'}" aria-label="${t.done_at ? 'Вернуть' : 'Выполнено'}">${t.done_at ? '✓' : ''}</button>
    <div class="crm-tbody" data-tedit><b>${esc(t.text)}</b><small>${t.done_at ? 'выполнено' : esc(when(t.due_at))}${t.overdue ? ` · <span class="crm-late">просрочено${t.late_days ? ` ${t.late_days} дн.` : ' сегодня'}</span>` : ''}${withClient && t.client ? ` · ${esc(t.client)}` : ''}${t.num ? ` · № ${t.num}` : ''}${t.by ? ` · поставил ${esc(t.by.name || t.by.login)}` : ''}${t.by_name ? ` · <span class="crm-from">от ${esc(t.by_name)}</span>` : ''}${t.to_name ? ` · <span class="crm-from">→ ${esc(t.to_name)}</span>` : ''}${t.remind && !t.done_at ? ' · 🔔' : ''}</small>
      ${t.deal_id ? `<a class="crm-deal" href="hub.html#deal=${t.deal_id}">📑 Сделка</a>` : ''}</div>
    ${t.done_at ? '' : '<div class="crm-tact"><button type="button" class="chip" data-tact="h">+1 час</button><button type="button" class="chip" data-tact="d">Завтра</button></div>'}</div>`;
  function home() {
    view = 'home';
    const shown = L.clients;
    const given = L.given ?? [], fchip = (k, v, label) => `<button type="button" class="chip${F[k] === v ? ' on' : ''}" data-f="${k}" data-v="${v}">${label}</button>`;
    body().innerHTML = `<div class="crm">${tabs()}${inviteBanner()}
      <div class="crm-tools"><button type="button" class="btn ghost" data-team>👥 ${T?.team ? esc(T.team.name) : 'Команда'}</button><button type="button" class="btn ghost" data-cal>📅 Календарь на телефоне</button><button type="button" class="btn ghost" data-export>⬇️ Выгрузить в Excel</button></div>
      <section class="crm-sec"><div class="crm-h"><b>Задачи на сегодня</b><span class="muted">${L.today.length ? `${L.today.length}` : ''}</span></div>
        ${L.today.length ? L.today.map(t => taskRow(t)).join('') : '<p class="muted crm-empty">На сегодня задач нет.</p>'}
        ${L.later.length ? `<details class="crm-later"><summary>Позже — ${L.later.length}</summary>${L.later.map(t => taskRow(t)).join('')}</details>` : ''}
        ${given.length ? `<details class="crm-later crm-given"><summary>📌 Поручил другим — ${given.length}</summary>${given.map(t => taskRow(t)).join('')}</details>` : ''}</section>
      <section class="crm-sec"><div class="crm-h"><b>Клиенты</b><span class="crm-hr">${L.late ? `<button type="button" class="crm-latebtn${F.only === 'late' ? ' on' : ''}" data-f="only" data-v="${F.only === 'late' ? '' : 'late'}">⏰ Просрочено: ${L.late}</button>` : ''}<span class="muted">${L.total}</span></span></div>
        <div class="crm-search"><input type="search" id="crm-q" placeholder="Имя, телефон, заметка или пожелания" value="${esc(F.q)}" autocomplete="off"></div>
        <div class="crm-filt" role="group" aria-label="Фильтры">${fchip('kind', '', 'Все')}${fchip('kind', 'buyer', 'Покупатели')}${fchip('kind', 'seller', 'Продавцы')}<span class="crm-sep" aria-hidden="true"></span>
          ${fchip('only', 'late', '⏰ Просроченные')}${fchip('only', 'today', 'На сегодня')}${fchip('only', 'none', 'Без задач')}
          <select id="crm-sort" aria-label="Сортировка">${Object.entries(SORT).map(([k, v]) => `<option value="${k}"${F.sort === k ? ' selected' : ''}>↕ ${v}</option>`).join('')}</select></div>
        <div class="crm-chips crm-filt"><button type="button" class="chip${!F.status ? ' on' : ''}" data-st="">Все этапы · ${L.total}</button>${Object.entries(ST).map(([k, v]) =>
          `<button type="button" class="chip${F.status === k ? ' on' : ''}" data-st="${k}">${v} · ${L.counts[k] ?? 0}</button>`).join('')}</div>
        ${shown.length ? shown.map(c => `<button type="button" class="crm-client${c.late_days != null ? ' late' : ''}" data-client="${c.id}">
          <span class="crm-ctop"><span class="crm-nm"><b>${esc(c.name || c.phone || 'Без имени')}</b>${lateBadge(c.late_days)}</span>${pill(c.status)}</span>
          <small>${[c.kind ? esc(KIND[c.kind] ?? '') : '', c.phone && c.name ? esc(c.phone) : '', budget(c), c.objects ? `объектов: ${c.objects}` : '', c.source ? esc(SRC[c.source]) : ''].filter(Boolean).join(' · ')}</small>
          ${c.next ? `<small class="crm-next${c.late_days != null ? ' over' : ''}">⏰ ${esc(when(c.next.due_at))} — ${esc(c.next.text)}</small>` : ''}
          ${c.last_at ? `<small class="crm-touch">последнее касание — ${esc(ago(c.last_at))}</small>` : ''}</button>`).join('')
          : `<p class="muted crm-empty">${L.total ? 'Никого не нашлось — измените поиск, фильтр или этап.' : 'Клиентов пока нет. Добавьте первого — и привязывайте к нему объекты кнопкой «Клиенту» на карточке.'}</p>`}
      </section>
      <div class="crm-bar"><button type="button" class="btn soft" data-new-task>＋ Задача</button><button type="button" class="btn primary" data-new-client>＋ Клиент</button></div></div>`;
    bind(onHome);
    const q = $('#crm-q');
    q.oninput = () => { clearTimeout(q.t); q.t = setTimeout(async () => { F.q = q.value.trim(); await reload(); }, 350); };
    $('#crm-sort').onchange = e => { F.sort = e.target.value; reload(); };
  }
  // v5.39: входящее приглашение в команду CRM — баннер над списком
  const inviteBanner = () => (T?.invites ?? []).map(i => `<div class="crm-inv"><span>👥 <b>${esc(i.from)}</b> приглашает вас в общую CRM «${esc(i.name)}» — будете видеть и вести клиентов друг друга и ставить друг другу задачи.</span>
    <span class="crm-inv-b"><button type="button" class="btn primary" data-tm="crm_team_accept" data-team="${i.team_id}">Принять</button><button type="button" class="btn ghost" data-tm="crm_team_decline">Отклонить</button></span></div>`).join('');
  async function teamAct(a, b = {}, after) {
    try { const r = await ui.call(a, b); T = r; ui.toast(a === 'crm_team_accept' ? 'Вы в команде — общие клиенты во вкладке рядом с «Мои клиенты»' : a === 'crm_team_invite' ? `Приглашение отправлено: ${r.invited?.name ?? ''}` : 'Готово', 4000); return after ? after() : open(); }
    catch (er) { ui.toast(er.message, 5000); }
  }
  async function reload() {
    try { L = await ui.call('crm_list', F); } catch (e) { return ui.toast(e.message, 5000); }
    const pos = body().scrollTop, focus = document.activeElement?.id === 'crm-q', v = $('#crm-q')?.value;
    home(); body().scrollTop = pos;
    if (focus) { const q = $('#crm-q'); q.value = v; q.focus(); q.setSelectionRange(v.length, v.length); }
  }
  async function onHome(e) {
    const t = e.target;
    if (t.closest('[data-ctab]')) return t.closest('[data-ctab]').dataset.ctab === 'main' ? mainOpen() : open();
    if (t.closest('[data-st]')) { F.status = t.closest('[data-st]').dataset.st; return reload(); }
    const fl = t.closest('[data-f]'); if (fl) { F[fl.dataset.f] = F[fl.dataset.f] === fl.dataset.v ? '' : fl.dataset.v; return reload(); }
    const tm = t.closest('[data-tm]'); if (tm) { if (tm.dataset.tm === 'crm_team_decline' && !confirm('Отклонить приглашение?')) return; return teamAct(tm.dataset.tm, tm.dataset.team ? { team_id: +tm.dataset.team } : {}); }
    if (t.closest('[data-team]')) return teamView();
    if (t.closest('[data-cal]')) return calView();
    if (t.closest('[data-export]')) return exportCsv(t.closest('[data-export]'));
    if (t.closest('[data-client]')) return client(+t.closest('[data-client]').dataset.client);
    if (t.closest('[data-new-client]')) return clientForm();
    if (t.closest('[data-new-task]')) return taskForm(null, {});
    if (await taskClick(e)) return reload();
  }
  // кнопки задачи: выполнено, вернуть, +1 час, завтра; нажатие на текст — изменить
  async function taskClick(e) {
    const row = e.target.closest('[data-task]');
    if (!row) return false;
    const id = +row.dataset.task, all = [...(L?.today ?? []), ...(L?.later ?? []), ...(L?.given ?? []), ...(C?.tasks ?? [])], t = all.find(x => x.id === id);
    if (e.target.closest('.crm-deal')) return false;   // ссылка на сделку — обычный переход
    if (e.target.closest('[data-tedit]')) { if (t) taskForm(t); return false; }
    const b = e.target.closest('[data-tact]');
    if (!b) return false;
    b.disabled = true;
    try { const r = await ui.call('crm_task_act', { id, act: b.dataset.tact }); ui.toast(r.message); return true; }
    catch (err2) { ui.toast(err2.message, 5000); b.disabled = false; return false; }
  }

  // ---------- клиент ----------
  async function client(id) {
    view = 'client';
    body().innerHTML = '<p class="muted">Загрузка…</p>';
    try { C = await ui.call('crm_client', { id }); } catch (e) { body().innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    drawClient();
  }
  function drawClient() {
    const c = C.client, d = digits(c.phone), n = C.items.length, open = C.tasks.filter(t => !t.done_at), done = C.tasks.filter(t => t.done_at);
    body().innerHTML = `<div class="crm">
      <button type="button" class="btn ghost crm-back" data-back>‹ ${tab === 'main' ? `${esc(teamName())} · общие` : 'Клиенты'}</button>
      <section class="crm-sec crm-card">
        ${C.mine === false ? `<p class="crm-robar">👥 Общий клиент (${esc(teamName())}) · аккаунт: <b>${esc(C.owner?.name || C.owner?.login)}</b> (${esc(C.owner?.login)})</p>` : ''}
        <div class="crm-ctop"><h3>${esc(c.name || c.phone || 'Без имени')}</h3><button type="button" class="btn ghost" data-edit>Изменить</button></div>
        <div class="crm-chips">${Object.entries(ST).map(([k, v]) => `<button type="button" class="chip${c.status === k ? ' on' : ''}" data-set-st="${k}">${v}</button>`).join('')}</div>
        ${c.phone ? `<div class="crm-phone"><b>${esc(c.phone)}</b><span><a class="btn soft" href="tel:+${esc(d)}">📞 Позвонить</a>
          <a class="btn ghost" href="https://wa.me/${esc(d)}" target="_blank" rel="noopener">WhatsApp</a><a class="btn ghost" href="https://t.me/+${esc(d)}" target="_blank" rel="noopener">Telegram</a>
          <a class="btn ghost" href="${innerWidth <= 760 ? 'max://' : 'https://web.max.ru/'}" target="_blank" rel="noopener" data-max="${esc(d)}" title="MAX: номер скопируется — найдите контакт">MAX</a><button type="button" class="btn ghost" data-copy-phone>Копировать</button></span></div>` : ''}
        ${c.kind || budget(c) || c.wish ? `<p class="crm-want">${[c.kind ? `<b>${esc(KIND[c.kind] ?? '')}</b>` : '', budget(c) ? `бюджет ${esc(budget(c))}` : '', c.wish ? esc(c.wish) : ''].filter(Boolean).join(' · ')}</p>` : ''}
        <p class="muted crm-meta">${[c.source ? `Источник: ${esc(SRC[c.source])}` : '', `изменён ${esc(when(c.updated_at))}`].filter(Boolean).join(' · ')}</p>
        ${c.note ? `<p class="crm-note">${esc(c.note)}</p>` : ''}
      </section>
      <section class="crm-sec crm-journal"><div class="crm-h"><b>Журнал касаний</b><span class="muted">${(C.notes ?? []).length || ''}</span></div>
        <div class="crm-nk" role="radiogroup" aria-label="Что было">${Object.entries(C.note_kinds ?? NOTE).map(([k, v]) => `<button type="button" class="chip${NK === k ? ' on' : ''}" data-nk="${k}" role="radio" aria-checked="${NK === k}">${esc(v)}</button>`).join('')}</div>
        <div class="crm-nadd"><textarea id="crm-nt" rows="2" maxlength="2000" placeholder="О чём договорились: перезвонит в пятницу, ищет 2к до 15 млн…"></textarea><button type="button" class="btn primary" data-note-add>Записать</button></div>
        ${(C.notes ?? []).length ? `<div class="crm-notes">${C.notes.map(n => `<div class="crm-n" data-note="${n.id}"><span class="crm-nh"><b>${esc((C.note_kinds ?? NOTE)[n.kind] ?? n.kind)}</b><small>${esc(when(n.at))}${n.who ? ` · ${esc(n.who)}` : ''}</small>${n.mine ? '<button type="button" class="x" data-note-del aria-label="Удалить запись">✕</button>' : ''}</span><span class="crm-nt">${esc(n.text)}</span></div>`).join('')}</div>` : '<p class="muted crm-empty">Записей нет — отмечайте звонки и встречи, чтобы видеть, с кем давно не говорили.</p>'}</section>
      ${C.mine === false || !window.LAWREQ ? '' : '<section class="crm-sec" data-lq-cl></section>'}
      <section class="crm-sec"><div class="crm-h"><b>Задачи</b><button type="button" class="btn ghost" data-new-task>＋ Задача</button></div>
        ${open.length ? open.map(t => taskRow(t, false)).join('') : '<p class="muted crm-empty">Открытых задач нет.</p>'}
        ${done.length ? `<details class="crm-later"><summary>Выполненные — ${done.length}</summary>${done.map(t => taskRow(t, false)).join('')}</details>` : ''}</section>
      <section class="crm-sec"><div class="crm-h"><b>Объекты · ${n}</b><span><button type="button" class="btn ghost" data-from-sel>📄 Из подборки</button><button type="button" class="btn ghost" data-favs>⭐ Из избранного</button></span></div>
        ${n ? `<div class="crm-sel"><button type="button" class="btn primary" data-sel="pdf">📄 Подборка PDF</button><button type="button" class="btn soft" data-sel="link">🔗 Подборка ссылкой</button></div>
          ${n > 10 ? `<p class="hint">В PDF войдут 10 последних объектов, ссылкой — ${n > 20 ? '20 последних' : `все ${n}`}.</p>` : ''}` : '<p class="muted crm-empty">Объектов нет. На карточке объекта нажмите «👥 Клиенту» — он появится здесь.</p>'}
        <div class="crm-objs">${C.items.map(x => `<div class="crm-obj" data-num="${x.num}">
          ${(x.web_photos || x.pics?.length) && ui.photo ? `<img src="${esc(ui.photo(x))}" alt="" loading="lazy">` : '<span class="crm-noph">🏠</span>'}
          <div data-open-obj><b>${esc(money(x.price))}</b><small>${esc(what(x))}</small><small class="muted">${x.excl ? '💎 эксклюзив · ' : ''}№ ${x.num}${x.gone ? ' · снято' : ''}</small></div>
          ${window.LAWREQ ? '<button type="button" class="btn ghost sm" data-lq-obj title="Проверка юриста: документы для задатка и сделки, запрос собственнику">⚖️</button>' : ''}<button type="button" class="x" data-del-obj aria-label="Убрать у клиента">✕</button></div>`).join('')}</div></section>
      ${C.can_del === false ? '' : '<p class="crm-danger"><button type="button" class="btn ghost bad" data-del-client>Удалить клиента</button></p>'}</div>`;
    bind(onClient);
    links(c);
    window.LAWREQ?.clientLine?.(body().querySelector('[data-lq-cl]'), c);   // v5.38r: «⚖️ Документы и проверка» клиента
  }
  // «📄 Из подборки» (v5.15): объекты подборки — клиенту; живую ссылку подборки — клиенту в WhatsApp, Telegram, MAX или скопировать
  async function fromSel(c) {
    body().innerHTML = '<p class="muted">Загрузка подборок…</p>';
    let r; try { r = await ui.call('sel_list', {}); } catch (e) { body().innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    const d = digits(c.phone), items = (r.items ?? []).filter(s => s.nums?.length);
    const msg = s => `Подборка объектов${s.title ? ` «${s.title}»` : ''}: ${s.link}`;
    body().innerHTML = `<div class="crm">
      <button type="button" class="btn ghost crm-back" data-back>‹ ${esc(c.name || c.phone || 'Клиент')}</button>
      <section class="crm-sec"><div class="crm-h"><b>Подборки</b><span class="muted">${items.length}</span></div>
        ${items.length ? items.map(s => `<div class="crm-selrow" data-sid="${s.id}"><b>${esc(s.title || 'Подборка')}</b>
          <small class="muted">${esc(when(s.created_at))} · объектов: ${s.nums.length}${s.query ? ` · ${esc(s.query)}` : ''}</small>
          <span class="crm-sel"><button type="button" class="btn primary" data-sel-add>＋ Объекты клиенту</button>
          ${s.link && s.live ? `${d ? `<a class="btn soft" href="https://wa.me/${esc(d)}?text=${encodeURIComponent(msg(s))}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
            <a class="btn soft" href="https://t.me/share/url?url=${encodeURIComponent(s.link)}&text=${encodeURIComponent(s.title || 'Подборка объектов')}" target="_blank" rel="noopener">Telegram</a>
            <button type="button" class="btn ghost" data-sel-copy="${esc(msg(s))}">MAX · скопировать</button>` : '<small class="muted">ссылки нет — соберите подборку «Ссылкой» или «Оба»</small>'}</span></div>`).join('')
          : '<p class="muted crm-empty">Подборок пока нет. Отметьте объекты галочкой «Выбрать» и нажмите внизу «В подборку».</p>'}</section></div>`;
    bind(async e => {
      const t = e.target;
      if (t.closest('[data-back]')) return client(c.id);
      const cp = t.closest('[data-sel-copy]');
      if (cp) { try { await navigator.clipboard.writeText(cp.dataset.selCopy); ui.toast('Скопировано — вставьте в чат клиента в MAX'); } catch { ui.toast(cp.dataset.selCopy, 8000); } return; }
      const add = t.closest('[data-sel-add]');
      if (add) {
        const s = items.find(x => x.id === +add.closest('[data-sid]').dataset.sid);
        add.disabled = true;
        try { const x = await ui.call('crm_obj_nums', { client_id: c.id, nums: s.nums }); ui.toast(x.added ? `Добавлено клиенту: ${x.added}${x.skipped ? ` (не поместилось: ${x.skipped})` : ''}` : 'Все объекты подборки уже есть у клиента'); return client(c.id); }
        catch (er) { ui.toast(er.message, 5000); add.disabled = false; }
      }
    });
  }
  const what = x => [x.type_name || (x.rooms ? `${x.rooms}-комн.` : ''), x.area ? `${x.area} м²` : '', x.floor ? `${x.floor}${x.floors ? '/' + x.floors : ''} эт.` : '',
    x.zk || x.complex || x.sub || x.district || ''].filter(Boolean).join(' · ');
  async function onClient(e) {
    const t = e.target, c = C.client;
    if (t.closest('[data-back]')) return tab === 'main' ? mainOpen() : open();
    if (t.closest('[data-edit]')) return clientForm(c);
    if (t.closest('[data-new-task]')) return taskForm(null, { client_id: c.id });
    const nk = t.closest('[data-nk]'); if (nk) { NK = nk.dataset.nk; body().querySelectorAll('[data-nk]').forEach(b => { b.classList.toggle('on', b === nk); b.setAttribute('aria-checked', b === nk); }); return; }
    if (t.closest('[data-note-add]')) {
      const ta = $('#crm-nt'), text = ta.value.trim(), b = t.closest('[data-note-add]');
      if (!text) { ui.toast('Напишите, о чём договорились'); return ta.focus(); }
      b.disabled = true;
      try { const r = await ui.call('crm_note_add', { client_id: c.id, kind: NK, text }); C.notes = [r.note, ...(C.notes ?? [])]; drawClient(); ui.toast('Записано в журнал'); } catch (er) { ui.toast(er.message, 5000); b.disabled = false; }
      return;
    }
    if (t.closest('[data-note-del]')) {
      const id = +t.closest('[data-note]').dataset.note;
      if (!confirm('Удалить запись из журнала?')) return;
      try { await ui.call('crm_note_del', { id }); C.notes = C.notes.filter(n => n.id !== id); drawClient(); } catch (er) { ui.toast(er.message, 5000); }
      return;
    }
    if (t.closest('[data-copy-phone]')) { try { await navigator.clipboard.writeText(c.phone); ui.toast('Телефон скопирован'); } catch { ui.toast(c.phone, 6000); } return; }
    if (t.closest('[data-set-st]')) {
      const st = t.closest('[data-set-st]').dataset.setSt;
      if (st === c.status) return;
      try { await ui.call('crm_client_save', { ...c, status: st }); C.client.status = st; if (st === 'later') return laterAsk(C.client, () => client(c.id)); drawClient(); ui.toast(`Статус: ${ST[st]}`); } catch (er) { ui.toast(er.message, 5000); }
      return;
    }
    if (t.closest('[data-from-sel]')) return fromSel(c);
    if (t.closest('[data-favs]')) {
      try { const r = await ui.call('crm_obj_favs', { client_id: c.id }); ui.toast(r.added ? `Добавлено из избранного: ${r.added}` : 'Новых объектов в избранном нет'); if (r.added) client(c.id); } catch (er) { ui.toast(er.message, 5000); }
      return;
    }
    if (t.closest('[data-sel]')) {   // v5.23e: ссылкой — до 20 объектов, PDF — до 10 (SHARE.MAX)
      const f = t.closest('[data-sel]').dataset.sel, k = window.SHARE?.MAX?.[f] ?? (f === 'link' ? 20 : 10);
      return ui.selStart?.(C.items.slice(0, k).map(x => x.num), `Для: ${c.name || c.phone || 'клиента'}`.slice(0, 80), f);
    }
    const obj = t.closest('[data-num]');
    if (obj && t.closest('[data-lq-obj]')) return window.LAWREQ?.obj({ num: +obj.dataset.num });   // v5.38r
    if (t.closest('[data-lq-cl]')) return;   // своя кнопка блока проверки — sec/lawreq.js
    if (obj && t.closest('[data-del-obj]')) {
      try { await ui.call('crm_obj_del', { client_id: c.id, num: +obj.dataset.num }); C.items = C.items.filter(x => x.num !== +obj.dataset.num); drawClient(); ui.toast('Объект убран у клиента'); } catch (er) { ui.toast(er.message, 5000); }
      return;
    }
    if (obj && t.closest('[data-show-obj]')) { const x = C.items.find(i => i.num === +obj.dataset.num); return show(+obj.dataset.num, { client_id: c.id, what: x ? what(x) : '' }); }
    if (t.closest('[data-lk-sels]')) { e.preventDefault(); ui.closeSheet?.(); return document.querySelector('.top [data-go="sels"][data-tab="fb"]')?.click(); }
    if (obj && t.closest('[data-open-obj], img')) return +obj.dataset.num >= 900001 ? location.assign(`excl.html#o=${obj.dataset.num}`) : ui.openItem?.(+obj.dataset.num);   // v5.25b: эксклюзив — на его странице
    if (t.closest('[data-del-client]')) {
      if (!confirm(`Удалить клиента «${c.name || c.phone}»? Объекты у него пропадут, задачи останутся без клиента.`)) return;
      try { await ui.call('crm_client_del', { id: c.id }); ui.toast('Клиент удалён'); return open(); } catch (er) { ui.toast(er.message, 5000); }
      return;
    }
    if (await taskClick(e)) client(c.id);
  }
  function clientForm(c = null, after = null, onBack = null) {
    view = 'form';
    body().innerHTML = `<form class="crm crm-form" id="crm-cf" novalidate>
      <button type="button" class="btn ghost crm-back" data-back>‹ ${c ? 'Клиент' : 'Клиенты'}</button>
      <h3>${c ? 'Изменить клиента' : 'Новый клиент'}</h3>
      <label class="field">Имя<input name="name" maxlength="80" value="${esc(c?.name)}" autocomplete="off" placeholder="Иван Петров"></label>
      <label class="field">Телефон<input name="phone" type="tel" maxlength="30" value="${esc(c?.phone)}" autocomplete="off" placeholder="+7 900 000-00-00"></label>
      <label class="field">Источник<select name="source"><option value="">—</option>${Object.entries(SRC).map(([k, v]) => `<option value="${k}"${c?.source === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="field">Статус<select name="status">${Object.entries(ST).map(([k, v]) => `<option value="${k}"${(c?.status ?? 'new') === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="field">Кто клиент<select name="kind"><option value="">—</option>${Object.entries(KIND).map(([k, v]) => `<option value="${k}"${c?.kind === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      <div class="field"><span>Бюджет, млн ₽</span><div class="crm-due"><input name="bf" inputmode="decimal" maxlength="8" value="${esc(mln(c?.budget_from))}" placeholder="от"><input name="bt" inputmode="decimal" maxlength="8" value="${esc(mln(c?.budget_to))}" placeholder="до"></div></div>
      <label class="field">Пожелания<textarea name="wish" rows="2" maxlength="1000" placeholder="2к у моря, Центр или Мамайка, не первый этаж, с ремонтом">${esc(c?.wish)}</textarea></label>
      <label class="field">Заметки<textarea name="note" rows="4" maxlength="2000" placeholder="Что ищет, бюджет, районы, когда удобно звонить">${esc(c?.note)}</textarea></label>
      <p class="err crm-err" hidden></p>
      <div class="crm-bar"><button type="button" class="btn ghost" data-back>Отмена</button><button class="btn primary">Сохранить</button></div></form>`;
    bind(e => { if (e.target.closest('[data-back]')) return onBack ? onBack() : c ? client(c.id) : open(); });
    $('#crm-cf').onsubmit = async e => {
      e.preventDefault();
      const f = e.target, b = f.querySelector('.btn.primary'); b.disabled = true; err('');
      try {
        const rub = v => { const n = parseFloat(String(v).replace(',', '.').replace(/[^\d.]/g, '')); return n > 0 ? Math.round(n < 1000 ? n * 1e6 : n) : null; };   // млн → рубли
        const r = await ui.call('crm_client_save', { id: c?.id, name: f.name.value, phone: f.phone.value, source: f.source.value, status: f.status.value, note: f.note.value,
          kind: f.kind.value, budget_from: rub(f.bf.value), budget_to: rub(f.bt.value), wish: f.wish.value });
        ui.toast(r.dup ? `Сохранено. Этот телефон уже есть у клиента «${r.dup.name || '—'}»` : 'Клиент сохранён', r.dup ? 6000 : 2600);
        const go = () => after ? after(r.client) : client(r.client.id);
        if (r.client?.status === 'later' && c?.status !== 'later') return laterAsk(r.client, go);   // v5.31c: отложили — когда вернуться
        return go();
      } catch (er) { err(er.message); b.disabled = false; }
    };
  }

  // ---------- v5.31c: «Отложили» — когда вернуться к клиенту (задача с напоминанием) ----------
  const LATER = [['7', 'Через неделю'], ['30', 'Через месяц'], ['91', 'Через 3 месяца'], ['', 'Без напоминания']];
  function laterAsk(c, done) {
    const nm = c.name || c.phone || 'клиент';
    body().innerHTML = `<div class="crm crm-later-ask">
      <h3>Когда вернуться к клиенту?</h3>
      <p class="muted">${esc(nm)} — в «Отложили». Поставлю задачу «Вернуться к клиенту» и напомню в бот, push и на сайте.</p>
      <div class="crm-lgrid">${LATER.map(([k, v]) => `<button type="button" class="btn ${k ? 'soft' : 'ghost'}" data-later="${k}">${v}</button>`).join('')}</div>
      <p class="err crm-err" hidden></p></div>`;
    bind(async e => {
      const b = e.target.closest('[data-later]');
      if (!b) return;
      const n = +b.dataset.later;
      if (!n) { ui.toast('Клиент в «Отложили», без напоминания'); return done(); }
      body().querySelectorAll('[data-later]').forEach(x => { x.disabled = true; });
      try {
        const r = await ui.call('crm_task_save', { text: `Вернуться к клиенту: ${nm}`.slice(0, 500), due: iso(mskParts(Date.now() + n * 864e5).d, '10:00'), client_id: c.id, via: VIA.map(x => x[0]) });
        ui.toast(`Клиент в «Отложили». Напомню ${when(r.task.due_at)}`, 3500);
        return done();
      } catch (er) { err(er.message); body().querySelectorAll('[data-later]').forEach(x => { x.disabled = false; }); }
    });
  }

  // ---------- задача ----------
  function taskForm(t = null, pre = {}) {
    view = 'task';
    const p = t?.due_at ? mskParts(t.due_at) : mskParts(Date.now() + 3600e3), via = t ? t.via : ['tg', 'push', 'site'];
    const clients = L?.clients ?? [], cid = t?.client_id ?? pre.client_id ?? '', num = t?.num ?? pre.num ?? '';
    const peers = (C?.client && (pre.client_id || t?.client_id) === C.client.id ? C.peers : null) ?? L?.peers ?? [];
    const to = t?.to && peers.some(x => x.login === t.to) ? t.to : '';
    if (t?.to && t.by_login && !peers.some(x => x.login === t.to)) peers.push({ login: t.to, name: t.to_name || t.to });   // ревью v5.39: исполнитель вышел из команды — не возвращать задачу себе молча
    body().innerHTML = `<form class="crm crm-form" id="crm-tf" novalidate>
      <button type="button" class="btn ghost crm-back" data-back>‹ Назад</button>
      <h3>${t ? 'Задача' : 'Новая задача'}</h3>
      <label class="field">Что сделать<textarea name="text" rows="2" maxlength="500" placeholder="Позвонить, показать квартиру, отправить подборку">${esc(t?.text)}</textarea></label>
      <div class="field"><span>Срок (по Москве)</span><div class="crm-due"><input type="date" name="d" value="${t && !t.due_at ? '' : p.d}"><input type="time" name="t" value="${t && !t.due_at ? '' : p.t}"></div>
        <div class="crm-chips"><button type="button" class="chip" data-q="60">Через час</button><button type="button" class="chip" data-q="today18">Сегодня 18:00</button>
          <button type="button" class="chip" data-q="tom10">Завтра 10:00</button><button type="button" class="chip" data-q="none">Без срока</button></div></div>
      <label class="field">Клиент<select name="client"><option value="">— без клиента —</option>${clients.map(c => `<option value="${c.id}"${+cid === c.id ? ' selected' : ''}>${esc(c.name || c.phone)}</option>`).join('')}
        ${cid && !clients.some(c => c.id === +cid) ? `<option value="${esc(cid)}" selected>${esc(C?.client?.name ?? 'Клиент')}</option>` : ''}</select></label>
      <label class="field">Объект, № объявления<input name="num" inputmode="numeric" value="${esc(num)}" placeholder="по желанию"></label>
      ${peers.length ? `<label class="field">Кому<select name="to"><option value="me">Мне</option>${peers.map(x => `<option value="${esc(x.login)}"${to === x.login ? ' selected' : ''}>${esc(x.name || x.login)}</option>`).join('')}</select>
        <small class="hint">Исполнитель получит напоминание; у вас задача будет в «📌 Поручил другим».</small></label>` : ''}
      <div class="field"><span>Напомнить</span><div class="crm-via">${VIA.map(([k, v]) => `<label class="chk"><input type="checkbox" name="via" value="${k}"${via.includes(k) ? ' checked' : ''}> <span>${v}</span></label>`).join('')}</div>
        ${L && !L.tg ? '<p class="hint">Telegram не привязан — привяжите бота в профиле, чтобы напоминания приходили туда.</p>' : ''}</div>
      <p class="err crm-err" hidden></p>
      <div class="crm-bar">${t ? `<button type="button" class="btn ghost bad" data-tdel>Удалить</button>` : '<button type="button" class="btn ghost" data-back>Отмена</button>'}<button class="btn primary">Сохранить</button></div></form>`;
    const f = $('#crm-tf'), back = () => pre.client_id || (t?.client_id && view !== 'home' && C?.client?.id === t.client_id) ? client(pre.client_id || t.client_id) : open();
    bind(async e => {
      if (e.target.closest('[data-back]')) return back();
      const q = e.target.closest('[data-q]')?.dataset.q;
      if (q) {
        const set = (ms, hh) => { const x = mskParts(ms); f.d.value = x.d; f.t.value = hh ?? x.t; };
        if (q === '60') set(Date.now() + 3600e3); else if (q === 'today18') set(Date.now(), '18:00'); else if (q === 'tom10') set(Date.now() + 864e5, '10:00'); else { f.d.value = ''; f.t.value = ''; }
      }
      if (e.target.closest('[data-tdel]') && confirm('Удалить задачу?')) {
        try { await ui.call('crm_task_act', { id: t.id, act: 'del' }); ui.toast('Задача удалена'); return back(); } catch (er) { err(er.message); }
      }
    });
    f.onsubmit = async e => {
      e.preventDefault();
      const b = f.querySelector('.btn.primary'); b.disabled = true; err('');
      try {
        const r = await ui.call('crm_task_save', { id: t?.id, text: f.text.value, due: iso(f.d.value, f.t.value), client_id: +f.client.value || null,
          num: +String(f.num.value).replace(/\D/g, '') || null, via: [...f.querySelectorAll('[name=via]:checked')].map(x => x.value), ...(f.to ? { to: f.to.value || 'me' } : {}) });
        ui.toast(r.task.remind ? `Задача сохранена, напомню ${when(r.task.due_at)}` : 'Задача сохранена', 3500);
        await back();
        if (r.first) setTimeout(() => window.NOTIFY?.offerInstall?.('task'), 800);   // первая задача — «Добавить на главный экран» (один раз)
      } catch (er) { err(er.message); b.disabled = false; }
    };
  }

  // ---------- «Клиенту…» на карточке объекта ----------
  async function pick(num) {
    ui.sheet(`Клиенту · № ${num}`, '<p class="muted">Загрузка…</p>');
    let r;
    try { r = await ui.call('crm_pick', { num }); } catch (e) { body().innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    const has = new Set(r.has);
    body().innerHTML = `<div class="crm">
      ${r.clients.length ? `<p class="hint">Выберите клиента — объект появится в его карточке.</p><div class="crm-pick">${r.clients.map(c =>
        `<button type="button" class="crm-client${has.has(c.id) ? ' on' : ''}" data-add="${c.id}"><span class="crm-ctop"><b>${esc(c.name || c.phone || 'Без имени')}</b>${has.has(c.id) ? '<span class="crm-st crm-st-deal">✓ уже есть</span>' : pill(c.status ?? 'new')}</span>${c.name && c.phone ? `<small>${esc(c.phone)}</small>` : ''}</button>`).join('')}</div>`
        : '<p class="muted">Клиентов пока нет — создайте первого.</p>'}
      <div class="crm-bar"><button type="button" class="btn soft" data-task-obj>＋ Задача по объекту</button><button type="button" class="btn primary" data-new>＋ Новый клиент</button></div>
      ${ui.openItem ? '' : '<p class="hint"><a href="./#crm">Все клиенты и задачи →</a></p>'}</div>`;
    bind(async e => {
      const a = e.target.closest('[data-add]');
      if (a) {
        a.disabled = true;
        try { const x = await ui.call('crm_obj_add', { client_id: +a.dataset.add, num }); ui.toast(x.already ? `Уже есть у клиента «${x.client.name || '—'}»` : `Добавлено клиенту «${x.client.name || '—'}»`); ui.closeSheet?.(); }
        catch (er) { ui.toast(er.message, 5000); a.disabled = false; }
        return;
      }
      if (e.target.closest('[data-new]')) return clientForm(null, async c => {
        try { await ui.call('crm_obj_add', { client_id: c.id, num }); ui.toast(`Клиент создан, объект № ${num} добавлен`); ui.closeSheet?.(); } catch (er) { ui.toast(er.message, 5000); }
      }, () => pick(num));
      if (e.target.closest('[data-task-obj]')) {
        if (!L) try { L = await ui.call('crm_list', {}); } catch { /* список клиентов для выбора — не обязателен */ }
        return taskForm(null, { num });
      }
    });
  }

  // ---------- v5.23c «📅 Записать на показ» (связи, п. 12): из отклика клиента «✓ подходит», из ответа собственника «актуально», с карточки объекта и у клиента ----------
  // Одно окно: клиент (из CRM или новый — сразу создаётся), дата и время показа → объект клиенту, статус клиента «Показ», задача с напоминанием (бот, push, окно).
  async function show(num, o = {}) {
    view = 'show';
    ui.sheet(`📅 Показ · № ${num}`, '<p class="muted">Загрузка…</p>');
    let r; try { r = await ui.call('crm_pick', { num }); } catch (e) { body().innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    const has = new Set(r.has), cl = r.clients ?? [];
    const pre = o.client_id ?? cl.find(c => has.has(c.id))?.id ?? '';
    const p = mskParts(Date.now() + 864e5);
    body().innerHTML = `<form class="crm crm-form lk-show" id="crm-sf" novalidate>
      ${o.why ? `<p class="hint">${esc(o.why)}</p>` : ''}
      <label class="field">Клиент<select name="client"><option value="">＋ Новый клиент</option>${cl.map(c => `<option value="${c.id}"${+pre === c.id ? ' selected' : ''}>${esc(c.name || c.phone || 'Без имени')}${has.has(c.id) ? ' · объект уже у него' : ''}</option>`).join('')}</select></label>
      <div class="lk-new"${pre ? ' hidden' : ''}><label class="field">Имя<input name="name" maxlength="80" autocomplete="off" placeholder="Иван Петров"></label>
        <label class="field">Телефон<input name="phone" type="tel" maxlength="30" autocomplete="off" placeholder="+7 900 000-00-00"></label></div>
      <div class="field"><span>Когда показ (по Москве)</span><div class="crm-due"><input type="date" name="d" value="${p.d}"><input type="time" name="t" value="12:00"></div>
        <div class="crm-chips"><button type="button" class="chip" data-q="today18">Сегодня 18:00</button><button type="button" class="chip" data-q="tom12">Завтра 12:00</button><button type="button" class="chip" data-q="sat11">Суббота 11:00</button></div></div>
      <label class="field">Что сделать<textarea name="text" rows="2" maxlength="500">${esc(`Показ № ${num}${o.what ? ` — ${o.what.replace(/\.+$/, '')}` : ''}. Договориться с собственником о времени.`)}</textarea></label>
      <p class="hint">Напомню за час в Telegram-бот, push и окном на сайте. Клиенту — статус «Показ», объект — в его карточку.</p>
      <p class="err crm-err" hidden></p>
      <div class="crm-bar"><button type="button" class="btn ghost" data-close>Отмена</button><button class="btn primary">📅 Записать</button></div></form>`;
    const f = $('#crm-sf');
    f.client.onchange = () => f.querySelector('.lk-new').hidden = !!f.client.value;
    bind(e => {
      const q = e.target.closest('[data-q]')?.dataset.q;
      if (!q) return;
      const sat = (6 - new Date(Date.now() + 3 * 3600e3).getUTCDay() + 7) % 7 || 7;
      const x = mskParts(Date.now() + (q === 'today18' ? 0 : q === 'tom12' ? 864e5 : sat * 864e5));
      f.d.value = x.d; f.t.value = q === 'today18' ? '18:00' : q === 'tom12' ? '12:00' : '11:00';
    });
    f.onsubmit = async e => {
      e.preventDefault();
      const b = f.querySelector('button.primary'); b.disabled = true; b.textContent = 'Записываю…'; err('', f);
      try {
        let id = +f.client.value, name = cl.find(c => c.id === id)?.name;
        if (!id) {
          if (!f.name.value.trim() && !f.phone.value.trim()) throw new Error('Укажите имя или телефон клиента');
          const c = await ui.call('crm_client_save', { name: f.name.value, phone: f.phone.value, status: 'show', source: 'other', note: o.why ? o.why.slice(0, 300) : '' });
          if (c.error) throw new Error(c.message); id = c.client?.id ?? c.id; name = c.client?.name ?? f.name.value;
        } else {
          const x = (await ui.call('crm_client', { id })).client;
          if (['new', 'work'].includes(x.status)) await ui.call('crm_client_save', { ...x, status: 'show' });
        }
        await ui.call('crm_obj_add', { client_id: id, num });
        const due = f.d.value ? `${f.d.value}T${f.t.value || '12:00'}:00+03:00` : null;
        const t = await ui.call('crm_task_save', { text: f.text.value, due, client_id: id, num, via: ['tg', 'push', 'site'] });
        if (t.error) throw new Error(t.message);
        ui.toast(`📅 Показ записан${name ? ` — ${name}` : ''}, ${when(due)}. Напомню заранее`, 5000);
        ui.closeSheet?.(); window.LINKS?.refresh?.([num]);
      } catch (er) { err(er.message, f); b.disabled = false; b.textContent = '📅 Записать'; }
    };
  }
  // v5.23c: у клиента — что по его объектам ответили собственники и он сам (по подборкам), и сами подборки с его объектами (hub lnk_cards)
  async function links(c) {
    const box = body().querySelector('.crm-objs'), nums = C.items.map(x => x.num);
    if (!box || !nums.length || !window.HUB) return;
    let r; try { r = await HUB.call('lnk_cards', { nums: nums.slice(0, 60) }); } catch { return; }
    if (C?.client?.id !== c.id) return;
    const sels = new Map();
    for (const [n, v] of Object.entries(r.by ?? {})) {
      const el = box.querySelector(`.crm-obj[data-num="${n}"] [data-open-obj]`);
      const own = window.LINKS?.ownChip?.(v.own) ?? '';
      const fb = v.sels.find(s => s.fb === 'yes') ? '<span class="lk-c ok">👍 подходит</span>' : v.sels.find(s => s.fb === 'no') ? '<span class="lk-c bad">👎 не подошёл</span>' : '';
      if (el) el.insertAdjacentHTML('beforeend', `<span class="lk lk-mini">${own}${fb}<button type="button" class="lk-c lnk" data-show-obj title="Записать на показ">📅 На показ</button></span>`);
      for (const s of v.sels) { const a = sels.get(s.id) ?? { ...s, n: 0, yes: 0, no: 0 }; a.n++; if (s.fb === 'yes') a.yes++; if (s.fb === 'no') a.no++; sels.set(s.id, a); }
    }
    if (sels.size) box.closest('.crm-sec').insertAdjacentHTML('afterend', `<section class="crm-sec lk-sels"><div class="crm-h"><b>📄 Подборки с его объектами · ${sels.size}</b><a class="btn ghost" href="./#sels=fb" data-lk-sels>Отклики клиентов</a></div>
      ${[...sels.values()].map(s => `<div class="crm-selrow"><b>${esc(s.title)}</b><small class="muted">${esc(when(s.at))} · его объектов: ${s.n}${s.yes ? ` · 👍 ${s.yes}` : ''}${s.no ? ` · 👎 ${s.no}` : ''}</small></div>`).join('')}</section>`);
  }

  // ---------- v5.37: «Main · общие» — клиенты всех участников группы Main ----------
  // Видят и получают только участники (сервер: crm_main_* → 403 not_main). v5.37a: клиент любого участника — обычная карточка с правкой (crm_client); удалить — только автор или админ.
  const tabs = () => L?.main || M ? `<div class="crm-tabs" role="tablist"><button type="button" role="tab" class="${tab === 'my' ? 'on' : ''}" data-ctab="my">Мои клиенты</button>
    <button type="button" role="tab" class="${tab === 'main' ? 'on' : ''}" data-ctab="main">👥 ${esc(teamName())} · общие</button></div>` : '';
  const acc = o => `аккаунт: ${esc(o.name || o.login)} (${esc(o.login)})`;
  async function mainOpen() {
    tab = 'main'; view = 'main';
    if (!M) body().innerHTML = `<div class="crm">${tabs()}<p class="muted">Загрузка…</p></div>`;
    try { M = await ui.call('crm_main_list', FM); } catch (e) { tab = 'my'; body().innerHTML = `<div class="crm">${L ? tabs() : ''}<p class="err">${esc(e.message)}</p></div>`; bind(onMain); return; }
    mainHome();
  }
  function mainHome() {
    view = 'main';
    const total = FM.owner ? M.members.find(m => m.login === FM.owner)?.n ?? M.total : M.total;
    body().innerHTML = `<div class="crm crm-main">${tabs()}
      <p class="hint crm-main-hint">Клиенты всех участников (${esc(teamName())}) — общие: открывайте, меняйте этап, заметки, объекты и задачи, ставьте задачи друг другу. Удалить клиента может только тот, кто его завёл.</p>
      <div class="crm-search"><input type="search" id="crm-mq" placeholder="Имя, телефон, заметка или участник" value="${esc(FM.q)}" autocomplete="off"></div>
      <div class="crm-chips crm-owners"><button type="button" class="chip${!FM.owner ? ' on' : ''}" data-owner="">Все участники</button>${M.members.map(m =>
        `<button type="button" class="chip${FM.owner === m.login ? ' on' : ''}" data-owner="${esc(m.login)}">${esc(m.name || m.login)}${m.me ? ' (вы)' : ''} · ${m.n}</button>`).join('')}</div>
      <div class="crm-chips"><button type="button" class="chip${!FM.status ? ' on' : ''}" data-mst="">Все · ${total}</button>${Object.entries(ST).map(([k, v]) =>
        `<button type="button" class="chip${FM.status === k ? ' on' : ''}" data-mst="${k}">${v} · ${M.counts[k] ?? 0}</button>`).join('')}</div>
      <section class="crm-sec">${M.clients.length ? M.clients.map(c => `<button type="button" class="crm-client crm-mc${c.mine ? ' mine' : ''}" data-mclient="${c.id}" data-mine="${c.mine ? 1 : ''}">
          <span class="crm-ctop"><span class="crm-nm"><b>${esc(c.name || c.phone || 'Без имени')}</b>${lateBadge(c.late_days)}</span>${pill(c.status)}</span>
          <small class="crm-owner">👤 ${acc(c.owner)}${c.mine ? ' · ваш' : ''}</small>
          <small>${[c.phone && c.name ? esc(c.phone) : '', `объектов: ${c.objects}`, c.source ? esc(SRC[c.source]) : ''].filter(Boolean).join(' · ')}</small>
          ${c.next ? `<small class="crm-next${c.next.overdue ? ' over' : ''}">⏰ ${esc(when(c.next.due_at))}${c.next.overdue ? ` · просрочено${c.late_days ? ` ${c.late_days} дн.` : ' сегодня'}` : ''} — ${esc(c.next.text)}</small>` : '<small class="muted">Задач со сроком нет</small>'}
          ${c.note ? `<small class="crm-mnote">📝 ${esc(c.note)}</small>` : ''}</button>`).join('')
        : `<p class="muted crm-empty">${M.total ? 'Никого не нашлось — измените поиск, участника или этап.' : 'У участников группы пока нет клиентов.'}</p>`}</section></div>`;
    bind(onMain);
    const q = $('#crm-mq');
    q.oninput = () => { clearTimeout(q.t); q.t = setTimeout(async () => { FM.q = q.value.trim(); await mainReload(); }, 350); };
  }
  async function mainReload() {
    try { M = await ui.call('crm_main_list', FM); } catch (e) { return ui.toast(e.message, 5000); }
    const pos = body().scrollTop, focus = document.activeElement?.id === 'crm-mq', v = $('#crm-mq')?.value;
    mainHome(); body().scrollTop = pos;
    if (focus) { const q = $('#crm-mq'); q.value = v; q.focus(); q.setSelectionRange(v.length, v.length); }
  }
  async function onMain(e) {
    const t = e.target;
    const ct = t.closest('[data-ctab]');
    if (ct) { if (ct.dataset.ctab === 'my') return open(); return; }
    if (t.closest('[data-owner]')) { FM.owner = t.closest('[data-owner]').dataset.owner; return mainReload(); }
    if (t.closest('[data-mst]')) { FM.status = t.closest('[data-mst]').dataset.mst; return mainReload(); }
    const c = t.closest('[data-mclient]');
    if (c) return client(+c.dataset.mclient);
  }

  // ---------- v5.39: «👥 Команда» — общая CRM по логину или коду партнёра ----------
  async function teamView() {
    view = 'team';
    body().innerHTML = '<div class="crm"><p class="muted">Загрузка…</p></div>';
    try { T = await ui.call('crm_team', {}); } catch (e) { body().innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    const t = T.team, owner = t?.me_owner;
    body().innerHTML = `<div class="crm crm-team">
      <button type="button" class="btn ghost crm-back" data-back>‹ Клиенты</button>
      <h3>👥 ${t ? esc(t.name) : 'Команда — общая CRM'}</h3>
      <p class="hint">Участники команды видят и ведут клиентов друг друга (вкладка «общие» рядом с «Мои клиенты»), ставят друг другу задачи с напоминанием. В группу Main и в админы они не входят, тарифы и лимиты у каждого свои. Удалить клиента может только тот, кто его завёл.${T.main ? ' Вы в группе Main — её клиенты тоже останутся общими.' : ''}</p>
      ${inviteBanner()}
      ${t ? `<section class="crm-sec"><div class="crm-h"><b>Участники · ${t.members.length}</b></div>
        ${t.members.map(m => `<div class="crm-mem"><span><b>${esc(m.name)}</b><small class="muted">${esc(m.login)}${m.company ? ` · ${esc(m.company)}` : ''}${m.owner ? ' · создатель' : ''}${m.me ? ' · вы' : ''}</small></span>
          ${m.status === 'invite' ? '<span class="crm-st crm-st-later">ждём ответа</span>' : '<span class="crm-st crm-st-deal">в команде</span>'}
          ${owner && !m.me ? `<button type="button" class="btn ghost bad" data-tm-rm="${esc(m.login)}">Убрать</button>` : ''}</div>`).join('')}</section>` : ''}
      ${!t || owner ? `<form class="crm-sec crm-form" id="crm-inv" novalidate><div class="crm-h"><b>Пригласить агента</b></div>
        ${t ? '' : '<label class="field">Название команды<input name="name" maxlength="60" placeholder="Например: Агентство «Эксперт»" autocomplete="off"></label>'}
        <label class="field">Логин или код партнёра<input name="who" maxlength="60" autocomplete="off" placeholder="olga или код из «Партнёрской программы»"></label>
        <p class="hint">Агенту придёт приглашение в бот и на сайт — команда объединится, когда он нажмёт «Принять».</p>
        <p class="err crm-err" hidden></p><button class="btn primary">Пригласить</button></form>` : ''}
      ${t ? `<div class="crm-bar">${owner ? '<button type="button" class="btn ghost" data-tm-ren>Переименовать</button><button type="button" class="btn ghost bad" data-tm-leave>Распустить команду</button>' : '<button type="button" class="btn ghost bad" data-tm-leave>Выйти из команды</button>'}</div>` : ''}</div>`;
    bind(async e => {
      const x = e.target;
      if (x.closest('[data-back]')) return open();
      const tm = x.closest('[data-tm]'); if (tm) { if (tm.dataset.tm === 'crm_team_decline' && !confirm('Отклонить приглашение?')) return; return teamAct(tm.dataset.tm, tm.dataset.team ? { team_id: +tm.dataset.team } : {}, teamView); }
      const rm = x.closest('[data-tm-rm]'); if (rm) { if (!confirm(`Убрать ${rm.dataset.tmRm} из команды? Его клиенты перестанут быть общими.`)) return; return teamAct('crm_team_remove', { login: rm.dataset.tmRm }, teamView); }
      if (x.closest('[data-tm-ren]')) { const n = prompt('Название команды', t?.name ?? ''); if (n && n.trim()) return teamAct('crm_team_rename', { name: n.trim() }, teamView); return; }
      if (x.closest('[data-tm-leave]')) {
        if (!confirm(owner ? 'Распустить команду? Клиенты останутся у своих агентов, но перестанут быть общими.' : 'Выйти из команды? Клиенты останутся у своих агентов.')) return;
        tab = 'my'; return teamAct('crm_team_leave', {}, teamView);
      }
    });
    const f = $('#crm-inv');
    if (f) f.onsubmit = async e => {
      e.preventDefault(); err('', f);
      if (f.who.value.trim().length < 2) return err('Напишите логин или код партнёра', f);
      const b = f.querySelector('.btn.primary'); b.disabled = true;
      try { T = await ui.call('crm_team_invite', { who: f.who.value.trim(), name: f.elements.namedItem('name')?.value?.trim() || undefined }); ui.toast(`Приглашение отправлено: ${T.invited?.name ?? ''}`, 4000); teamView(); }
      catch (er) { err(er.message, f); b.disabled = false; }
    };
  }
  // ---------- v5.39: «📅 Календарь на телефоне» — подписка Apple / Google (hub cal_get) ----------
  async function calView() {
    view = 'cal';
    body().innerHTML = '<div class="crm"><p class="muted">Загрузка…</p></div>';
    let r; try { r = await window.HUB.call('cal_get'); } catch (e) { body().innerHTML = `<div class="crm"><button type="button" class="btn ghost crm-back" data-back>‹ Клиенты</button><p class="err">${esc(e.message)}</p></div>`; bind(x => { if (x.target.closest('[data-back]')) open(); }); return; }
    const ios = /iPhone|iPad|Macintosh/.test(navigator.userAgent);
    body().innerHTML = `<div class="crm crm-cal">
      <button type="button" class="btn ghost crm-back" data-back>‹ Клиенты</button>
      <h3>📅 Задачи — в календаре телефона</h3>
      <p class="hint">Все задачи со сроком (и напоминания по сделкам) появятся в календаре телефона — с напоминанием в срок. В событии есть ссылка «Отметить выполненной» — задача закроется и здесь.</p>
      <section class="crm-sec crm-calbox${ios ? ' first' : ''}"><b>🍏 iPhone, iPad, Mac — Apple Календарь</b>
        <a class="btn primary" href="${esc(r.webcal)}">Подписаться в Календаре</a>
        <small class="muted">Откроется Календарь → «Подписаться» → «Добавить». Частоту обновления можно выбрать в Настройки → Календарь → Учётные записи → Подписные календари.</small></section>
      <section class="crm-sec crm-calbox"><b>🤖 Android и Google Календарь</b>
        <a class="btn primary" href="${esc(r.google)}" target="_blank" rel="noopener">Добавить в Google Календарь</a>
        <small class="muted">Откроется Google Календарь → «Добавить». Если не открылось: calendar.google.com → «Другие календари» → «＋» → «Добавить по URL» → вставьте ссылку ниже. Google обновляет подписку сам раз в несколько часов; напоминание ставит по своим настройкам календаря.</small></section>
      <section class="crm-sec crm-calbox"><b>🔗 Ссылка календаря</b>
        <input readonly value="${esc(r.https)}" aria-label="Ссылка календаря" data-cal-url>
        <span class="crm-calb"><button type="button" class="btn soft" data-cal-copy>Скопировать ссылку</button><button type="button" class="btn ghost bad" data-cal-reset>Сбросить ссылку</button></span>
        <small class="muted">Ссылка личная — не пересылайте её. Сбросить — старая перестанет работать, подпишитесь заново.</small></section></div>`;
    bind(async e => {
      const x = e.target;
      if (x.closest('[data-back]')) return open();
      if (x.matches('[data-cal-url]')) return x.select();
      if (x.closest('[data-cal-copy]')) { try { await navigator.clipboard.writeText(r.https); ui.toast('Ссылка скопирована'); } catch { ui.toast(r.https, 8000); } return; }
      if (x.closest('[data-cal-reset]')) {
        if (!confirm('Сбросить ссылку? Календари, подписанные по старой, перестанут обновляться.')) return;
        try { await window.HUB.call('cal_reset'); ui.toast('Новая ссылка готова — подпишитесь заново'); calView(); } catch (er) { ui.toast(er.message, 5000); }
      }
    });
  }
  // ---------- v5.39: «⬇️ Выгрузить в Excel» — CSV (UTF-8 с BOM, «;») ----------
  async function exportCsv(btn) {
    btn.disabled = true;
    try {
      const r = await ui.call('crm_export', {});
      const H = [['name', 'Имя'], ['phone', 'Телефон'], ['kind', 'Кто'], ['status', 'Этап'], ['source', 'Источник'], ['budget_from', 'Бюджет от, ₽'], ['budget_to', 'Бюджет до, ₽'],
        ['wish', 'Пожелания'], ['note', 'Заметки'], ['next_task', 'Ближайшая задача'], ['next_due', 'Срок задачи'], ['last_touch', 'Последнее касание'], ['created', 'Создан'], ['updated', 'Изменён']];
      const cell = (k, v) => { let x = String(v ?? ''); if (!(k === 'phone' && /^\+?[\d\s()-]+$/.test(x)) && /^[=+\-@\t\r]/.test(x)) x = `'${x}`; /* ревью v5.39: не формула Excel */ if (/^(next_due|last_touch|created|updated)$/.test(k) && x) { const p = mskParts(x); x = `${p.d.slice(8)}.${p.d.slice(5, 7)}.${p.d.slice(0, 4)} ${p.t}`; } return /[;"\n\r]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x; };
      const csv = '\ufeff' + [H.map(h => h[1]).join(';'), ...(r.rows ?? []).map(row => H.map(([k]) => cell(k, row[k])).join(';'))].join('\r\n');
      const d = today(), a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `crm-${d.slice(8)}.${d.slice(5, 7)}.${d.slice(0, 4)}.csv`;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      ui.toast(`Выгружено клиентов: ${(r.rows ?? []).length}`);
    } catch (er) { ui.toast(er.message, 5000); }
    btn.disabled = false;
  }

  async function openClient(id) { await open(); return client(id); }   // v5.23c: «👥 Иван» на карточке объекта — сразу карточка клиента

  return { use, open, pick, badge, show, openClient, main: mainOpen };
})();
