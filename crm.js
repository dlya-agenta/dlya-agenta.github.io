// Клиенты и задачи (ТЗ v2, шаг 3.4): экран «👥 Клиенты» в окне сайта — задачи на сегодня сверху, клиенты с фильтром по статусу и поиском,
// карточка клиента (телефон, статус, заметка, объекты, задачи, подборка PDF или ссылкой одним нажатием), задача со сроком (МСК) и напоминанием
// в Telegram-бот, push и окно на сайте; «Клиенту…» на карточке объекта (главная и архив). Всё считает и проверяет сервер (web: crm_*).
// В режиме «С клиентом» пункт меню и кнопки скрыты (agent-only). После первой задачи — «Добавить на главный экран» (NOTIFY.offerInstall('task')).
window.CRM = (() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ST = { new: 'Новый', work: 'В работе', show: 'Показ', deposit: 'Задаток', deal: 'Сделка', lost: 'Отказ' };
  const SRC = { call: 'Звонок', avito: 'Авито', site: 'Сайт', ref: 'Рекомендация', other: 'Другое' };
  const VIA = [['tg', 'Telegram-бот'], ['push', 'Push'], ['site', 'Окно на сайте']];
  let ui = null, meta = null, L = null, C = null, F = { status: '', q: '' }, view = 'home';
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
    view = 'home';
    ui.sheet('👥 Клиенты и задачи', '<p class="muted">Загрузка…</p>', true);
    try { L = await ui.call('crm_list', {}); } catch (e) { body().innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    badge(L.today.filter(t => !t.done_at).length);
    const m = /^#task=(\d+)/.exec(hash ?? '');
    if (m) { const t = [...L.today, ...L.later].find(x => x.id === +m[1]); if (t) return taskForm(t); }
    home();
  }
  const taskRow = (t, withClient = true) => `<div class="crm-task${t.overdue ? ' over' : ''}${t.done_at ? ' done' : ''}" data-task="${t.id}">
    <button type="button" class="crm-check" data-tact="${t.done_at ? 'undo' : 'done'}" aria-label="${t.done_at ? 'Вернуть' : 'Выполнено'}">${t.done_at ? '✓' : ''}</button>
    <div class="crm-tbody" data-tedit><b>${esc(t.text)}</b><small>${t.done_at ? 'выполнено' : esc(when(t.due_at))}${t.overdue ? ' · просрочено' : ''}${withClient && t.client ? ` · ${esc(t.client)}` : ''}${t.num ? ` · № ${t.num}` : ''}${t.remind && !t.done_at ? ' · 🔔' : ''}</small></div>
    ${t.done_at ? '' : '<div class="crm-tact"><button type="button" class="chip" data-tact="h">+1 час</button><button type="button" class="chip" data-tact="d">Завтра</button></div>'}</div>`;
  function home() {
    view = 'home';
    const shown = L.clients;
    body().innerHTML = `<div class="crm">
      <section class="crm-sec"><div class="crm-h"><b>Задачи на сегодня</b><span class="muted">${L.today.length ? `${L.today.length}` : ''}</span></div>
        ${L.today.length ? L.today.map(t => taskRow(t)).join('') : '<p class="muted crm-empty">На сегодня задач нет.</p>'}
        ${L.later.length ? `<details class="crm-later"><summary>Позже — ${L.later.length}</summary>${L.later.map(t => taskRow(t)).join('')}</details>` : ''}</section>
      <section class="crm-sec"><div class="crm-h"><b>Клиенты</b><span class="muted">${L.total}</span></div>
        <div class="crm-search"><input type="search" id="crm-q" placeholder="Имя, телефон или заметка" value="${esc(F.q)}" autocomplete="off"></div>
        <div class="crm-chips"><button type="button" class="chip${!F.status ? ' on' : ''}" data-st="">Все · ${L.total}</button>${Object.entries(ST).map(([k, v]) =>
          `<button type="button" class="chip${F.status === k ? ' on' : ''}" data-st="${k}">${v} · ${L.counts[k] ?? 0}</button>`).join('')}</div>
        ${shown.length ? shown.map(c => `<button type="button" class="crm-client" data-client="${c.id}">
          <span class="crm-ctop"><b>${esc(c.name || c.phone || 'Без имени')}</b>${pill(c.status)}</span>
          <small>${[c.phone && c.name ? esc(c.phone) : '', c.objects ? `объектов: ${c.objects}` : '', c.source ? esc(SRC[c.source]) : ''].filter(Boolean).join(' · ')}</small>
          ${c.next ? `<small class="crm-next">⏰ ${esc(when(c.next.due_at))} — ${esc(c.next.text)}</small>` : ''}</button>`).join('')
          : `<p class="muted crm-empty">${L.total ? 'Никого не нашлось — измените поиск или статус.' : 'Клиентов пока нет. Добавьте первого — и привязывайте к нему объекты кнопкой «Клиенту» на карточке.'}</p>`}
      </section>
      <div class="crm-bar"><button type="button" class="btn soft" data-new-task>＋ Задача</button><button type="button" class="btn primary" data-new-client>＋ Клиент</button></div></div>`;
    bind(onHome);
    const q = $('#crm-q');
    q.oninput = () => { clearTimeout(q.t); q.t = setTimeout(async () => { F.q = q.value.trim(); await reload(); }, 350); };
  }
  async function reload() {
    try { L = await ui.call('crm_list', F); } catch (e) { return ui.toast(e.message, 5000); }
    const pos = body().scrollTop, focus = document.activeElement?.id === 'crm-q', v = $('#crm-q')?.value;
    home(); body().scrollTop = pos;
    if (focus) { const q = $('#crm-q'); q.value = v; q.focus(); q.setSelectionRange(v.length, v.length); }
  }
  async function onHome(e) {
    const t = e.target;
    if (t.closest('[data-st]')) { F.status = t.closest('[data-st]').dataset.st; return reload(); }
    if (t.closest('[data-client]')) return client(+t.closest('[data-client]').dataset.client);
    if (t.closest('[data-new-client]')) return clientForm();
    if (t.closest('[data-new-task]')) return taskForm(null, {});
    if (await taskClick(e)) return reload();
  }
  // кнопки задачи: выполнено, вернуть, +1 час, завтра; нажатие на текст — изменить
  async function taskClick(e) {
    const row = e.target.closest('[data-task]');
    if (!row) return false;
    const id = +row.dataset.task, all = [...(L?.today ?? []), ...(L?.later ?? []), ...(C?.tasks ?? [])], t = all.find(x => x.id === id);
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
      <button type="button" class="btn ghost crm-back" data-back>‹ Клиенты</button>
      <section class="crm-sec crm-card">
        <div class="crm-ctop"><h3>${esc(c.name || c.phone || 'Без имени')}</h3><button type="button" class="btn ghost" data-edit>Изменить</button></div>
        <div class="crm-chips">${Object.entries(ST).map(([k, v]) => `<button type="button" class="chip${c.status === k ? ' on' : ''}" data-set-st="${k}">${v}</button>`).join('')}</div>
        ${c.phone ? `<div class="crm-phone"><b>${esc(c.phone)}</b><span><a class="btn soft" href="tel:+${esc(d)}">📞 Позвонить</a>
          <a class="btn ghost" href="https://wa.me/${esc(d)}" target="_blank" rel="noopener">WhatsApp</a><a class="btn ghost" href="https://t.me/+${esc(d)}" target="_blank" rel="noopener">Telegram</a>
          <a class="btn ghost" href="${innerWidth <= 760 ? 'max://' : 'https://web.max.ru/'}" target="_blank" rel="noopener" data-max="${esc(d)}" title="MAX: номер скопируется — найдите контакт">MAX</a><button type="button" class="btn ghost" data-copy-phone>Копировать</button></span></div>` : ''}
        <p class="muted crm-meta">${[c.source ? `Источник: ${esc(SRC[c.source])}` : '', `изменён ${esc(when(c.updated_at))}`].filter(Boolean).join(' · ')}</p>
        ${c.note ? `<p class="crm-note">${esc(c.note)}</p>` : ''}
      </section>
      <section class="crm-sec"><div class="crm-h"><b>Задачи</b><button type="button" class="btn ghost" data-new-task>＋ Задача</button></div>
        ${open.length ? open.map(t => taskRow(t, false)).join('') : '<p class="muted crm-empty">Открытых задач нет.</p>'}
        ${done.length ? `<details class="crm-later"><summary>Выполненные — ${done.length}</summary>${done.map(t => taskRow(t, false)).join('')}</details>` : ''}</section>
      <section class="crm-sec"><div class="crm-h"><b>Объекты · ${n}</b><span><button type="button" class="btn ghost" data-from-sel>📄 Из подборки</button><button type="button" class="btn ghost" data-favs>⭐ Из избранного</button></span></div>
        ${n ? `<div class="crm-sel"><button type="button" class="btn primary" data-sel="pdf">📄 Подборка PDF</button><button type="button" class="btn soft" data-sel="link">🔗 Подборка ссылкой</button></div>
          ${n > 10 ? '<p class="hint">В подборку войдут 10 последних объектов.</p>' : ''}` : '<p class="muted crm-empty">Объектов нет. На карточке объекта нажмите «👥 Клиенту» — он появится здесь.</p>'}
        <div class="crm-objs">${C.items.map(x => `<div class="crm-obj" data-num="${x.num}">
          ${(x.web_photos || x.pics?.length) && ui.photo ? `<img src="${esc(ui.photo(x))}" alt="" loading="lazy">` : '<span class="crm-noph">🏠</span>'}
          <div data-open-obj><b>${esc(money(x.price))}</b><small>${esc(what(x))}</small><small class="muted">№ ${x.num}${x.gone ? ' · снято' : ''}</small></div>
          <button type="button" class="x" data-del-obj aria-label="Убрать у клиента">✕</button></div>`).join('')}</div></section>
      <p class="crm-danger"><button type="button" class="btn ghost bad" data-del-client>Удалить клиента</button></p></div>`;
    bind(onClient);
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
          : '<p class="muted crm-empty">Подборок пока нет. Отметьте объекты в выдаче и нажмите «Сформировать подборку».</p>'}</section></div>`;
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
    if (t.closest('[data-back]')) return open();
    if (t.closest('[data-edit]')) return clientForm(c);
    if (t.closest('[data-new-task]')) return taskForm(null, { client_id: c.id });
    if (t.closest('[data-copy-phone]')) { try { await navigator.clipboard.writeText(c.phone); ui.toast('Телефон скопирован'); } catch { ui.toast(c.phone, 6000); } return; }
    if (t.closest('[data-set-st]')) {
      const st = t.closest('[data-set-st]').dataset.setSt;
      if (st === c.status) return;
      try { await ui.call('crm_client_save', { ...c, status: st }); C.client.status = st; drawClient(); ui.toast(`Статус: ${ST[st]}`); } catch (er) { ui.toast(er.message, 5000); }
      return;
    }
    if (t.closest('[data-from-sel]')) return fromSel(c);
    if (t.closest('[data-favs]')) {
      try { const r = await ui.call('crm_obj_favs', { client_id: c.id }); ui.toast(r.added ? `Добавлено из избранного: ${r.added}` : 'Новых объектов в избранном нет'); if (r.added) client(c.id); } catch (er) { ui.toast(er.message, 5000); }
      return;
    }
    if (t.closest('[data-sel]')) return ui.selStart?.(C.items.slice(0, 10).map(x => x.num), `Для: ${c.name || c.phone || 'клиента'}`.slice(0, 80), t.closest('[data-sel]').dataset.sel);
    const obj = t.closest('[data-num]');
    if (obj && t.closest('[data-del-obj]')) {
      try { await ui.call('crm_obj_del', { client_id: c.id, num: +obj.dataset.num }); C.items = C.items.filter(x => x.num !== +obj.dataset.num); drawClient(); ui.toast('Объект убран у клиента'); } catch (er) { ui.toast(er.message, 5000); }
      return;
    }
    if (obj && t.closest('[data-open-obj], img')) return ui.openItem?.(+obj.dataset.num);
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
      <label class="field">Заметки<textarea name="note" rows="4" maxlength="2000" placeholder="Что ищет, бюджет, районы, когда удобно звонить">${esc(c?.note)}</textarea></label>
      <p class="err crm-err" hidden></p>
      <div class="crm-bar"><button type="button" class="btn ghost" data-back>Отмена</button><button class="btn primary">Сохранить</button></div></form>`;
    bind(e => { if (e.target.closest('[data-back]')) return onBack ? onBack() : c ? client(c.id) : open(); });
    $('#crm-cf').onsubmit = async e => {
      e.preventDefault();
      const f = e.target, b = f.querySelector('.btn.primary'); b.disabled = true; err('');
      try {
        const r = await ui.call('crm_client_save', { id: c?.id, name: f.name.value, phone: f.phone.value, source: f.source.value, status: f.status.value, note: f.note.value });
        ui.toast(r.dup ? `Сохранено. Этот телефон уже есть у клиента «${r.dup.name || '—'}»` : 'Клиент сохранён', r.dup ? 6000 : 2600);
        return after ? after(r.client) : client(r.client.id);
      } catch (er) { err(er.message); b.disabled = false; }
    };
  }

  // ---------- задача ----------
  function taskForm(t = null, pre = {}) {
    view = 'task';
    const p = t?.due_at ? mskParts(t.due_at) : mskParts(Date.now() + 3600e3), via = t ? t.via : ['tg', 'push', 'site'];
    const clients = L?.clients ?? [], cid = t?.client_id ?? pre.client_id ?? '', num = t?.num ?? pre.num ?? '';
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
          num: +String(f.num.value).replace(/\D/g, '') || null, via: [...f.querySelectorAll('[name=via]:checked')].map(x => x.value) });
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

  return { use, open, pick, badge };
})();
