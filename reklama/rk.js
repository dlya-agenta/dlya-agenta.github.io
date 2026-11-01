// «Реклама» (ТЗ v2, шаг 4.1): черновики на площадках — окно сайта (#sheet, .rk). Всё считает сервер (функция auto: rk_*): квоты по тарифу,
// «один объект — один агент» (у коллеги — замены), готовые черновики дня. Черновики делает сервер рекламы; публикует агент сам в своём кабинете.
// Вход в кабинет: телефон и код из СМС вводит агент; сайт отдаёт их серверу, сервер шифрует открытым ключом сервера рекламы — в базе их нет.
// Название площадки в публичном коде не пишется: «рекламный кабинет». В режиме «С клиентом» пункт меню скрыт (agent-only).
window.RK = (() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const API = String(window.API || 'https://arojogajdamsyrrpcmso.supabase.co/functions/v1/web').replace(/\/web$/, '/auto');
  const ST = { new: 'в очереди', work: 'делается', done: 'черновик готов', dup: 'уже есть в вашем кабинете', error: 'ошибка' };
  const STEP = { addr: 'адрес', create: 'создаю черновик', fields: 'параметры', photos: 'фото', price: 'цена', descr: 'описание', check: 'проверка' };
  const SRC = { market: 'оценка кабинета', manual: 'вручную ₽/м²', base_house: 'наша база: дом', base_zk: 'наша база: ЖК', base_sub: 'наша база: микрорайон', none: 'оценки нет: 310–330 тыс. ₽/м²' };
  const srcName = s => { const [a, min] = String(s ?? '').split('+'); return (SRC[a] ?? a) + (min ? ', поднято до порога' : ''); };
  const money = v => v ? `${Math.round(v).toLocaleString('ru-RU')} ₽` : '—';
  const day = t => t ? new Date(t).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit' }) : '';
  let ui = null, I = null, view = 'list', poll = null;
  const body = () => $('#sheet-body');
  const bind = fn => { const b = body(); b.onclick = fn; b.onchange = null; b.oninput = null; b.onsubmit = null; };

  async function call(action, extra = {}) {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, auth: ui.auth(), ...extra }) });
    const d = await r.json().catch(() => ({ error: 'server', message: `Ошибка сервера (HTTP ${r.status})` }));
    if (d.error === 'need_pro') { ui.closeSheet(); PLANS.locked('rk'); }
    if (d.error === 'soon') { ui.closeSheet(); PLANS.soon('rk'); }
    if (!r.ok || d.error) throw Object.assign(new Error(d.message || d.error), { data: d });
    return d;
  }
  function use(deps) { ui = deps; }
  const left = q => q.month_lim == null ? 'без ограничения' : `осталось ${Math.max(0, q.month_lim - q.month)} из ${q.month_lim}`;
  const leftDay = q => q.day_lim == null ? 'без ограничения' : `осталось ${Math.max(0, q.day_lim - q.day)} из ${q.day_lim}`;
  const thumb = x => x.photo ? `<img src="${esc(x.photo)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<span class="rk-noph">нет фото</span>';
  const line = x => `<b>${esc(x.what)}</b><small>№${x.num}${x.price ? ` · ${money(x.price)}` : ''} · ${esc([x.district, x.sub, x.complex].filter(Boolean).join(' · '))}${x.unique ? ' · <span class="rk-uniq">Уникальна</span>' : ''}</small>`;

  // ---------- окно ----------
  async function open(hash = '') {
    view = /daily/.test(hash) ? 'daily' : /login/.test(hash) ? 'login' : 'list';
    ui.sheet('📣 Реклама', '<p class="muted">Загрузка…</p>', true);
    await render();
  }
  function head() {
    const q = I.quota, a = I.acc;
    const acc = a.status === 'ok' ? `<span class="rk-ok">✓ Кабинет подключён${a.phone ? ` · ${esc(a.phone)}` : ''}</span>`
      : a.status === 'need' ? '<span class="rk-warn">Вход в кабинет закончился</span>' : '<span class="rk-warn">Кабинет не подключён</span>';
    return `<div class="rk-head">
      <p>Объекты из базы переносятся в <b>черновики</b> вашего рекламного кабинета: адрес, параметры, фото, цена и описание. Публикуете вы сами — после проверки.</p>
      <p class="hint">По нашему опыту, в среднем — 1–2 звонка в день и 90–150 клиентов в месяц. Это наблюдение, а не обещание.</p>
      <div class="rk-quota"><span>Черновики в месяц: <b>${left(q)}</b>${q.month_end && q.month_lim != null ? ` <small>(до ${day(q.month_end)})</small>` : ''}</span>
        <span>Готовые черновики сегодня: <b>${leftDay(q)}</b></span><span>${acc}</span></div>
      ${I.worker.online ? '' : '<p class="rk-off">Сервер рекламы пока не на связи — объекты ждут в очереди и начнут переноситься, как только он подключится.</p>'}
      <div class="rk-tabs" role="tablist">${[['list', `Мои объекты (${(I.counts.new || 0) + (I.counts.work || 0) + (I.counts.done || 0) + (I.counts.error || 0) + (I.counts.dup || 0)})`], ['daily', '🎁 Готовые черновики'], ['login', 'Вход в кабинет']].concat(I.admin ? [['adm', '⚙ Настройки']] : [])
        .map(([k, t]) => `<button class="chip${view === k ? ' on' : ''}" data-view="${k}" role="tab" aria-selected="${view === k}">${t}</button>`).join('')}</div></div>`;
  }
  async function render() {
    clearTimeout(poll);
    try { I = await call('rk_init'); } catch (e) { if (body()) body().innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    if (view === 'list') return list();
    if (view === 'daily') return daily();
    if (view === 'adm' && I.admin) return adm();
    return login();
  }
  function tabs(e) { const v = e.target.closest('[data-view]'); if (v) { view = v.dataset.view; render(); return true; } return false; }

  // ---------- мои объекты, отчёт, CSV ----------
  let items = [];
  async function list() {
    let r;
    try { r = await call('rk_list'); } catch (e) { body().innerHTML = head() + `<p class="err">${esc(e.message)}</p>`; return; }
    items = r.items;
    const done = items.filter(x => x.status === 'done' || x.report?.offer);
    body().innerHTML = `<div class="rk">${head()}
      ${items.length ? `<div class="rk-list">${items.map(row).join('')}</div>` : `<p class="muted">Пока пусто. Отметьте объекты галочкой в списке и нажмите «📣 Отправить в рекламу» внизу экрана — рядом с «Сформировать подборку». Или выберите готовые черновики дня.</p>`}
      ${done.length ? `<div class="rk-rep"><div class="crm-h"><b>Отчёт: ${done.length}</b><button class="btn soft" data-csv>Скачать CSV</button></div>
        <div class="ascroll"><table class="atable"><thead><tr><th>№</th><th>Черновик</th><th>Адрес</th><th>м²</th><th>Этаж</th><th>Цена</th><th>Источник цены</th><th>Фото</th><th>Примечания</th></tr></thead><tbody>
        ${done.map(x => { const p = x.report; return `<tr><td>${x.num}</td><td>${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.offer)}</a>` : esc(p.offer ?? '')}</td><td>${esc(p.addr ?? '')}</td>
          <td>${p.area ?? ''}</td><td>${p.floor ?? ''}${p.floors ? '/' + p.floors : ''}</td><td>${money(p.price)}${p.m2 ? `<br><small>${money(p.m2)}/м²</small>` : ''}</td><td>${esc(p.price_src ? srcName(p.price_src) : '')}</td>
          <td>${p.photos ?? ''}</td><td>${esc((p.notes ?? []).join('; '))}</td></tr>`; }).join('')}</tbody></table></div></div>` : ''}
      <div class="rk-soon"><b>Скоро</b><span>Авито и ЦИАН — по 25 черновиков в PRO</span><span>Продающие ролики из фото — в MAX</span></div></div>`;
    bind(async e => {
      if (tabs(e)) return;
      if (e.target.closest('[data-csv]')) return csv(done);
      const d = e.target.closest('[data-del]');
      if (d) { try { await call('rk_del', { num: +d.dataset.del }); render(); } catch (er) { ui.toast(er.message); } return; }
      const a = e.target.closest('[data-again]');
      if (a) { try { const x = await call('rk_add', { nums: [+a.dataset.again] }); ui.toast(x.added ? 'Снова в очереди' : stText(x.items[0]?.st)); render(); } catch (er) { ui.toast(er.message); } }
    });
    if (items.some(x => x.status === 'new' || x.status === 'work')) poll = setTimeout(() => { if (!$('#sheet').hidden && view === 'list' && $('.rk')) render(); }, 8000);
  }
  function row(x) {
    const st = x.status === 'work' && x.step ? `делается: ${STEP[x.step] ?? x.step}` : ST[x.status] ?? x.status;
    const p = x.report;
    return `<div class="rk-row rk-${esc(x.status)}"><div class="rk-ph">${thumb(x)}</div><div class="rk-txt">${line(x)}
      <div class="rk-st"><span class="rk-pill">${esc(st)}</span>${x.kind === 'daily' ? ' <small>🎁 готовый</small>' : ''}${p?.price ? ` <small>${money(p.price)} · фото ${p.photos ?? 0}</small>` : ''}</div>
      ${x.error ? `<small class="err">${esc(x.error)}</small>` : ''}
      <div class="rk-act">${p?.url ? `<a class="btn soft" href="${esc(p.url)}" target="_blank" rel="noopener">Открыть в кабинете</a>` : ''}
        ${x.status === 'error' ? `<button class="chip" data-again="${x.num}">Ещё раз</button>` : ''}
        ${['new', 'error', 'dup'].includes(x.status) ? `<button class="chip" data-del="${x.num}">Убрать</button>` : ''}</div></div></div>`;
  }
  function csv(done) {
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['№ объекта', 'ID черновика', 'Адрес', 'Площадь, м²', 'Этаж', 'Этажей', 'Цена, ₽', '₽/м²', 'Источник цены', 'Фото', 'Статус', 'Примечания', 'Ссылка'].map(q).join(';')]
      .concat(done.map(x => { const p = x.report; return [x.num, p.offer, p.addr, p.area, p.floor, p.floors, p.price, p.m2, p.price_src ? srcName(p.price_src) : '', p.photos, ST[x.status] ?? x.status, (p.notes ?? []).join('; '), p.url].map(q).join(';'); }));
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + rows.join('\r\n'));
    a.download = `reklama-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(a); a.click(); a.remove();
  }

  // ---------- готовые черновики дня ----------
  async function daily() {
    let r;
    try { r = await call('rk_daily'); } catch (e) { body().innerHTML = head() + `<p class="err">${esc(e.message)}</p>`; return; }
    const room = r.quota.day_lim == null ? 99 : Math.max(0, r.quota.day_lim - r.quota.day);
    const picked = new Set();
    body().innerHTML = `<div class="rk">${head()}
      <p>Новые квартиры за ${r.rule.days} дн.${r.rule.uniq ? ', которых нет в рекламе («Уникальна»)' : ''}, с хорошими фото. Отметьте — черновики сделаем сами, вам останется нажать «Опубликовать» в кабинете.</p>
      ${r.items.length ? `<div class="rk-grid">${r.items.map(x => `<label class="rk-cand"><input type="checkbox" value="${x.num}" ${room ? '' : 'disabled'}>
        <span class="rk-ph">${thumb(x)}</span><span class="rk-txt">${line(x)}<small>размещено ${day(x.created_at)}</small></span></label>`).join('')}</div>`
        : '<p class="muted">Сегодня подходящих новых квартир нет — загляните завтра.</p>'}
      <div class="sheet-foot rk-foot"><span class="muted" id="rk-n">${room ? `Можно выбрать: ${room}` : 'На сегодня готовые черновики закончились — новые завтра с 00:00 МСК'}</span>
        <button class="btn primary" id="rk-daily-go" disabled>Сделать черновики</button></div></div>`;
    const go = $('#rk-daily-go');
    body().onchange = e => {
      const c = e.target.closest('input[type=checkbox]'); if (!c) return;
      if (c.checked && picked.size >= room) { c.checked = false; ui.toast(`Сегодня можно выбрать ${room}`); return; }
      c.checked ? picked.add(+c.value) : picked.delete(+c.value);
      c.closest('.rk-cand').classList.toggle('on', c.checked);
      go.disabled = !picked.size; go.textContent = picked.size ? `Сделать черновики (${picked.size})` : 'Сделать черновики';
    };
    go.onclick = async () => {
      go.disabled = true;
      try { const x = await call('rk_add', { nums: [...picked], kind: 'daily' }); report(x); view = 'list'; render(); } catch (e) { ui.toast(e.message, 5000); go.disabled = false; }
    };
    body().onclick = e => tabs(e);
  }

  // ---------- вход в кабинет ----------
  function login() {
    const a = I.acc;
    const wait = a.status === 'phone' || a.status === 'wait';
    const form = a.status === 'code'
      ? `<label class="field">Код из СМС<input id="rk-code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="1234"></label>
         <div class="sheet-foot"><button class="btn ghost" id="rk-other">Другой номер</button><button class="btn primary" id="rk-code-go">Войти</button></div>`
      : `<label class="field">Телефон, на который зарегистрирован ваш рекламный кабинет<input id="rk-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 900 123-45-67"></label>
         <div class="sheet-foot"><button class="btn primary" id="rk-phone-go">Получить код</button></div>`;
    body().innerHTML = `<div class="rk">${head()}<div class="rk-login">
      ${a.status === 'ok' ? `<p class="rk-ok">✓ Кабинет подключён${a.phone ? ` · ${esc(a.phone)}` : ''}${a.ok_at ? ` · с ${day(a.ok_at)}` : ''}</p>${a.message && a.message !== 'Вход выполнен' ? `<p class="hint">${esc(a.message)}</p>` : ''}
        <div class="sheet-foot"><button class="btn ghost" id="rk-out">Выйти и удалить сессию</button></div>`
      : wait ? `<p class="muted rk-wait">${esc(a.message || 'Подождите…')}</p>`
      : `${a.message ? `<p class="${a.status === 'error' || a.status === 'need' ? 'err' : 'hint'}">${esc(a.message)}</p>` : ''}${form}`}
      <p class="hint">Телефон и код из СМС нужны только для входа и не сохраняются. Сессия кабинета хранится в зашифрованном виде и используется только для ваших черновиков. Ничего не публикуется без вас.</p></div></div>`;
    bind(async e => {
      if (tabs(e)) return;
      const id = e.target.closest('button')?.id;
      try {
        if (id === 'rk-phone-go') { I.acc = (await call('rk_login', { phone: $('#rk-phone').value })).acc; login(); }
        if (id === 'rk-code-go') { I.acc = (await call('rk_code', { code: $('#rk-code').value })).acc; login(); }
        if (id === 'rk-other') { I.acc = (await call('rk_logout')).acc; login(); }
        if (id === 'rk-out' && confirm('Выйти из рекламного кабинета? Сессия будет удалена, черновики в кабинете останутся.')) { I.acc = (await call('rk_logout')).acc; login(); }
      } catch (er) { ui.toast(er.message, 6000); }
    });
    if (wait) poll = setTimeout(async () => {
      if ($('#sheet').hidden || view !== 'login' || !$('.rk')) return;
      try { I.acc = (await call('rk_state')).acc; } catch { /* следующая попытка */ }
      login();
    }, 2500);
  }

  // ---------- настройки (только админ): включение для всех, тестеры, темп, цена, готовые черновики ----------
  async function adm() {
    let r;
    try { r = await call('rk_adm'); } catch (e) { body().innerHTML = head() + `<p class="err">${esc(e.message)}</p>`; return; }
    const s = r.rk, w = r.worker, num = (id, v, lbl, min = 0, max = 5e6) => `<label class="field">${lbl}<input id="${id}" type="number" inputmode="numeric" min="${min}" max="${max}" value="${v}"></label>`;
    body().innerHTML = `<div class="rk">${head()}
      <p>Сервер рекламы: ${w.online ? '<b class="rk-ok">на связи</b>' : '<b class="rk-warn">не на связи</b>'}${w.at ? ` · последний раз ${new Date(w.at).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} МСК` : ''}</p>
      <p class="hint">За 30 дней: в очереди ${r.stats.new}, делается ${r.stats.work}, готово ${r.stats.done}, ошибок ${r.stats.error}, дублей ${r.stats.dup}; агентов с входом в кабинет: ${r.stats.accounts}.</p>
      <label class="opt"><input type="checkbox" id="ra-on" ${r.enabled ? 'checked' : ''}><span>Раздел открыт всем участникам PRO и MAX</span></label>
      <label class="field">Тестеры до включения для всех (логины через запятую)<input id="ra-test" value="${esc(s.testers.join(', '))}"></label>
      <label class="field">Черновиков одновременно<select id="ra-conc"><option value="1"${s.conc === 1 ? ' selected' : ''}>1</option><option value="2"${s.conc === 2 ? ' selected' : ''}>2</option></select></label>
      <label class="field">Цена<select id="ra-mode">${[['market', 'Оценка кабинета без скидки'], ['base', 'По нашей базе: дом → ЖК → микрорайон'], ['manual', 'Вручную: ₽/м²']]
        .map(([k, t]) => `<option value="${k}"${s.price.mode === k ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
      ${num('ra-m2', s.price.manual_m2, 'Вручную, ₽/м²')}${num('ra-min', s.price.min_m2, 'Не ниже, ₽/м²')}${num('ra-mineu', s.price.min_m2_euro, 'Евро и дизайн — не ниже, ₽/м²')}${num('ra-mk', s.price.markup, 'Наценка, %', 0, 30)}
      <b>Готовые черновики дня</b>
      ${num('ra-days', s.daily.days, 'Новые за дней', 1, 30)}${num('ra-ph', s.daily.min_photos, 'Фото не меньше', 1, 30)}
      <label class="opt"><input type="checkbox" id="ra-uniq" ${s.daily.uniq ? 'checked' : ''}><span>Только «Уникальна» (нет в рекламе)</span></label>
      <label class="opt"><input type="checkbox" id="ra-ntf" ${s.daily.notify ? 'checked' : ''}><span>Сообщение агентам в 09:00 МСК</span></label>
      <div class="sheet-foot rk-foot"><button class="btn primary" id="ra-save">Сохранить</button></div></div>`;
    bind(async e => {
      if (tabs(e)) return;
      if (e.target.id !== 'ra-save') return;
      const v = id => $(id).value;
      try {
        await call('rk_adm_set', { enabled: $('#ra-on').checked, rk: { testers: v('#ra-test').split(/[\s,]+/).filter(Boolean), conc: +v('#ra-conc'),
          price: { mode: v('#ra-mode'), manual_m2: +v('#ra-m2'), min_m2: +v('#ra-min'), min_m2_euro: +v('#ra-mineu'), markup: +v('#ra-mk') },
          daily: { days: +v('#ra-days'), min_photos: +v('#ra-ph'), uniq: $('#ra-uniq').checked, notify: $('#ra-ntf').checked } } });
        ui.toast('Сохранено'); adm();
      } catch (er) { ui.toast(er.message, 5000); }
    });
  }

  // ---------- «📣 Отправить в рекламу» (выбранные галочками, избранное, подборка) ----------
  function stText(st) { return { ok: 'в очереди', repeat: 'уже в вашей рекламе', mine: 'уже в вашей рекламе', busy: 'уже в рекламе у коллеги', limit: 'черновики на этот месяц закончились', gone: 'снят с продажи', dup: 'уже был в вашем кабинете' }[st] ?? st; }
  function report(x) {
    const n = x.items.length, bad = x.items.filter(i => i.st !== 'ok');
    ui.toast(`В рекламу отправлено: ${x.added} из ${n}${bad.length ? ` · ${bad.map(i => `№${i.num} — ${stText(i.st)}`).slice(0, 3).join('; ')}` : ''}`, bad.length ? 7000 : 3500);
  }
  async function send(nums) {
    if (!nums.length) return ui.toast('Отметьте объекты галочкой');
    ui.sheet('📣 Отправить в рекламу', '<p class="muted">Проверяю объекты…</p>', true);
    let r;
    try { r = await call('rk_check', { nums }); } catch (e) { body().innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    const q = r.quota, room = q.month_lim == null ? 999 : Math.max(0, q.month_lim - q.month);
    const pick = new Set(r.items.filter(x => x.st === 'ok').map(x => x.num));
    const draw = () => {
      body().innerHTML = `<div class="rk">
        <p>Отмеченные объекты станут черновиками в вашем рекламном кабинете. Черновики в этом месяце: <b>${left(q)}</b>.</p>
        <div class="rk-list">${r.items.map(x => `<div class="rk-row rk-c-${x.st}${pick.has(x.num) ? ' on' : ''}">
          <div class="rk-ph">${thumb(x)}</div><div class="rk-txt">${line(x)}
          <div class="rk-st">${x.st === 'ok' ? `<label class="rk-tick"><input type="checkbox" data-pick="${x.num}" ${pick.has(x.num) ? 'checked' : ''}> В рекламу</label>` : `<span class="rk-pill">${esc(stText(x.st))}</span>`}</div>
          ${x.alt?.length ? `<div class="rk-alt"><small>Похожие свободные — тот же тип и район, цена ±15 %, площадь ±10 м²:</small>${x.alt.map(y => `<label class="rk-altrow${pick.has(y.num) ? ' on' : ''}">
            <input type="checkbox" data-pick="${y.num}" ${pick.has(y.num) ? 'checked' : ''}><span class="rk-ph">${thumb(y)}</span><span class="rk-txt">${line(y)}</span></label>`).join('')}</div>`
            : x.st === 'busy' ? '<small class="muted">Похожих свободных объектов нет.</small>' : ''}</div></div>`).join('')}</div>
        <div class="sheet-foot rk-foot"><span class="muted">${pick.size > room ? `<span class="err">Выбрано ${pick.size}, а осталось ${room}</span>` : `Выбрано: ${pick.size}`}</span>
          <button class="btn primary" id="rk-send" ${pick.size && pick.size <= room ? '' : 'disabled'}>Отправить в рекламу${pick.size ? ` (${pick.size})` : ''}</button></div></div>`;
    };
    draw();
    body().onchange = e => { const c = e.target.closest('[data-pick]'); if (!c) return; c.checked ? pick.add(+c.dataset.pick) : pick.delete(+c.dataset.pick); draw(); };
    body().onclick = async e => {
      if (e.target.id !== 'rk-send') return;
      e.target.disabled = true;
      try { const x = await call('rk_add', { nums: [...pick] }); report(x); ui.done?.(); await open('list'); } catch (er) { ui.toast(er.message, 5000); e.target.disabled = false; }
    };
  }
  return { use, open, send };
})();
