// Рассылки в мессенджеры (ТЗ v2, шаг 4.2): страница mail.html — мастер «1. Вход → 2. Группы → 3. Проверка Избранного → 4. Расписание → 5. Тестовая отправка»,
// журнал (#log) и настройки админа (#admin). Правила считает только сервер (функция auto: mail_*), отправляет сервер рассылок. Сначала Telegram; WhatsApp и MAX — «Скоро».
// Подсказки «?» — схемы экранов (не настоящие снимки). Номер, код и облачный пароль уходят на сервер один раз и не сохраняются.
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const API = String(window.API || 'https://arojogajdamsyrrpcmso.supabase.co/functions/v1/web').replace(/\/web$/, '/auto');
  const tokenOf = () => { try { return JSON.parse(localStorage.getItem('token')); } catch { return null; } };
  const toast = (t, ms = 3500) => { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, ms); };
  const gate = html => { $('#gate').innerHTML = html; $('#gate').hidden = false; $('#app').hidden = true; };
  const msk = t => t ? new Date(t).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  const hm = t => t ? new Date(t).toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' }) : '';
  async function call(action, extra = {}) {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, auth: { token: tokenOf() }, ...extra }) });
    const d = await r.json().catch(() => ({ error: 'server', message: `Ошибка сервера (HTTP ${r.status})` }));
    if (!r.ok || d.error) throw Object.assign(new Error(d.message || d.error), { data: d, status: r.status });
    return d;
  }
  let qrLib = null;
  const loadQr = () => qrLib ??= new Promise((ok, bad) => { const sc = document.createElement('script');
    sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'; sc.onload = ok; sc.onerror = bad; document.head.appendChild(sc); });

  // схемы экранов для подсказок «?»
  const scr = (title, rows) => `<div class="ml-scr"><div class="ml-scr-top">${esc(title)}</div>${rows.map(r => `<div class="ml-scr-row${r[1] ? ' on' : ''}">${esc(r[0])}</div>`).join('')}</div>`;
  const HELP = {
    qr: ['Вход по QR-коду', 'Telegram на телефоне → Настройки → Устройства → «Подключить устройство» → наведите камеру на QR-код на этой странице.',
      scr('Настройки', [['Уведомления и звуки'], ['Конфиденциальность'], ['Устройства', 1], ['Папки с чатами']]) + scr('Устройства', [['Это устройство'], ['Подключить устройство', 1], ['Активные сеансы']])],
    code: ['Где код', 'Код приходит не в СМС, а в сам Telegram — в чат «Telegram» с синей галочкой.', scr('Чаты', [['Telegram ✓ — Код для входа: 12345', 1], ['Рабочая группа'], ['Мама']])],
    pass: ['Облачный пароль', 'Если включена «Двухэтапная проверка» (Настройки → Конфиденциальность → Облачный пароль), Telegram попросит её пароль. Его мы тоже не сохраняем.',
      scr('Конфиденциальность', [['Код-пароль'], ['Облачный пароль: вкл.', 1], ['Активные сеансы']])],
    group: ['Название группы', 'Название — как в шапке группы в Telegram. Можно часть названия: сервер найдёт группы среди ваших чатов и покажет для подтверждения.',
      scr('Недвижимость Сочи — риелторы', [['👥 1 240 участников', 1], ['Закреплено: правила группы'], ['Сообщение…']])],
    admin: ['Где можно рекламу', 'Подходят группы, где вы администратор, или где правила разрешают объявления. Посмотреть: группа → нажмите на название → «Администраторы» или закреплённые правила.',
      scr('Управление группой', [['Тип группы'], ['Администраторы', 1], ['Участники'], ['Разрешения']])],
  };
  const help = k => `<button class="ml-help" type="button" data-help="${k}" aria-label="Подсказка">?</button>`;
  function showHelp(k) {
    const h = HELP[k]; if (!h) return;
    const d = document.createElement('div');
    d.className = 'ml-pop'; d.innerHTML = `<div class="ml-pop-box" role="dialog" aria-label="${esc(h[0])}"><b>${esc(h[0])}</b><p>${esc(h[1])}</p><div class="ml-scrs">${h[2]}</div>
      <p class="hint">Схема экрана — у вас Telegram может выглядеть чуть иначе.</p><button class="btn primary" type="button">Понятно</button></div>`;
    d.onclick = e => { if (e.target === d || e.target.closest('button')) d.remove(); };
    document.body.append(d);
  }

  let S = null, step = 1, poll = null;
  const STEPS = ['Вход', 'Группы', 'Проверка Избранного', 'Расписание', 'Тестовая отправка'];
  const okAcc = () => S?.acc.status === 'ok';
  const okGroups = () => (S?.groups ?? []).filter(g => g.status === 'ok');

  async function start() {
    if (!tokenOf()) return gate('<h2>Рассылки</h2><p>Войдите на сайте — страница откроется после входа.</p><a class="btn primary" href="./">Войти</a>');
    try { S = await call('mail_init'); }
    catch (e) {
      const d = e.data ?? {};
      if (d.error === 'need_pro') return gate('<h2>✉️ Рассылки в мессенджеры</h2><p>Объявления из «Избранного» уходят в ваши группы Telegram, WhatsApp и MAX по расписанию — не чаще раза в 3 часа в группу.</p><p>Рассылки — в тарифах PRO и MAX.</p><a class="btn primary" href="./#pro">Оформить PRO</a>');
      if (d.error === 'soon') return gate('<h2>✉️ Рассылки</h2><p>Раздел скоро откроется.</p><a class="btn ghost" href="./">На главную</a>');
      return gate(`<h2>Рассылки</h2><p>${esc(e.message)}</p><a class="btn primary" href="./">${e.status === 401 ? 'Войти' : 'На главную'}</a>`);
    }
    $('#gate').hidden = true; $('#app').hidden = false;
    $('#go-adm').hidden = !S.admin;
    step = okAcc() ? (okGroups().length ? 3 : 2) : 1;
    route();
  }
  function route() {
    clearTimeout(poll);
    document.querySelectorAll('.menu .link').forEach(a => { a.classList.remove('on'); a.removeAttribute('aria-current'); });
    const k = location.hash === '#log' ? 'go-log' : location.hash === '#admin' && S.admin ? 'go-adm' : 'go-mail';
    $('#' + k).classList.add('on'); $('#' + k).setAttribute('aria-current', 'page');
    if (k === 'go-log') return journal();
    if (k === 'go-adm') return admin();
    wizard();
  }
  window.addEventListener('hashchange', () => S && route());
  $('#go-mail').onclick = e => { e.preventDefault(); history.replaceState(null, '', location.pathname); route(); };

  // ---------- мастер ----------
  function wizard() {
    const a = S.acc;
    const busy = ['qr', 'phone', 'code', 'password', 'wait', 'logout'].includes(a.status);
    $('#mail').innerHTML = `<div class="ml">
      <div class="ml-msg" role="tablist">${[['tg', 'Telegram'], ['wa', 'WhatsApp'], ['max', 'MAX']].map(([k, t]) => S.messengers.includes(k) ? `<button class="chip on" role="tab" aria-selected="true">${t}</button>`
        : `<span class="chip dis" title="Сначала Telegram: WhatsApp и MAX — после двух недель без блокировок">${t} · скоро</span>`).join('')}</div>
      ${S.worker.online ? '' : '<p class="ml-off">Сервер рассылок пока не на связи — вход и отправка временно недоступны. Группы и расписание сохранятся.</p>'}
      ${a.stopped_at ? `<p class="ml-stop">⛔ Рассылки остановлены ${msk(a.stopped_at)}: ${esc(a.message ?? 'мессенджер ограничил отправку')}. Подождите, проверьте аккаунт и включите расписание снова.</p>` : ''}
      <ol class="ml-steps">${STEPS.map((t, i) => `<li><button class="${step === i + 1 ? 'on' : ''}${i + 1 < 2 || okAcc() ? '' : ' dis'}" data-step="${i + 1}" ${i + 1 < 2 || okAcc() ? '' : 'disabled'}>
        <span>${i + 1}</span>${esc(t)}${i === 0 && okAcc() ? ' ✓' : i === 1 && okGroups().length ? ' ✓' : ''}</button></li>`).join('')}</ol>
      <section class="ml-card" id="ml-step">${[s1, s2, s3, s4, s5][step - 1]()}</section></div>`;
    if (step === 1 && a.qr) loadQr().then(() => { const el = $('#ml-qr'); if (el && !el.dataset.v) { el.dataset.v = a.qr; new window.QRCode(el, { text: a.qr, width: 220, height: 220, correctLevel: window.QRCode.CorrectLevel.M }); } }).catch(() => null);
    if (step === 3) preview();
    if (busy || (S.groups ?? []).some(g => g.status === 'search')) poll = setTimeout(refresh, 2500);
  }
  async function refresh() {
    try { const r = await call('mail_state'); const was = S.acc.status; S.acc = r.acc; S.groups = r.groups.map(g => ({ ...g, can: S.groups.find(x => x.id === g.id)?.can ?? null }));
      if (was !== 'ok' && S.acc.status === 'ok') { S = await call('mail_init'); step = 2; toast('Вход выполнен'); } } catch { /* следующая попытка */ }
    if (!location.hash) wizard();
  }
  const warn = () => `<p class="ml-warn">⚠️ ${esc(S.warn)}.</p>`;
  function s1() {
    const a = S.acc;
    if (a.status === 'ok') return `<h3>1. Вход в Telegram</h3><p class="ml-ok">✓ Вход выполнен${a.name ? `: <b>${esc(a.name)}</b>` : ''}</p>
      <p class="hint">Сессия хранится в зашифрованном виде и используется только для ваших рассылок.</p>${warn()}
      <div class="ml-row"><button class="btn primary" data-step="2">Дальше: группы</button><button class="btn ghost" id="ml-out">Выйти и удалить сессию</button></div>`;
    const wait = a.status === 'phone' || a.status === 'wait' || a.status === 'logout';
    return `<h3>1. Вход в Telegram ${help(a.status === 'code' ? 'code' : a.status === 'password' ? 'pass' : 'qr')}</h3>${warn()}
      ${a.message && a.status !== 'qr' ? `<p class="${a.status === 'error' ? 'err' : 'hint'}">${esc(a.message)}</p>` : ''}
      ${a.status === 'qr' ? `<div class="ml-qrbox"><div id="ml-qr" aria-label="QR-код для входа в Telegram">${a.qr ? '' : '<div class="spinner"></div>'}</div>
          <p>${esc(a.message ?? 'Откройте Telegram на телефоне: Настройки → Устройства → Подключить устройство')}</p><button class="btn ghost" id="ml-cancel">Отмена</button></div>`
      : a.status === 'code' ? `<label class="field">Код из Telegram<input id="ml-code" inputmode="numeric" autocomplete="one-time-code" maxlength="8"></label>
          <div class="ml-row"><button class="btn primary" id="ml-code-go">Войти</button><button class="btn ghost" id="ml-cancel">Отмена</button></div>`
      : a.status === 'password' ? `<label class="field">Облачный пароль Telegram<input id="ml-pass" type="password" autocomplete="current-password"></label>
          <div class="ml-row"><button class="btn primary" id="ml-pass-go">Войти</button><button class="btn ghost" id="ml-cancel">Отмена</button></div>`
      : wait ? '<p class="muted ml-wait">Подождите…</p>'
      : `<div class="ml-row"><button class="btn primary" id="ml-qr-go">Войти по QR-коду</button><button class="btn ghost" id="ml-ph-show">По номеру и коду</button></div>
         <div id="ml-ph" hidden><label class="field">Номер телефона в Telegram<input id="ml-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 900 123-45-67"></label>
         <button class="btn primary" id="ml-ph-go">Получить код</button></div>`}
      <p class="hint">Номер телефона, коды и облачный пароль не сохраняются — используются один раз для входа. Сессия хранится в зашифрованном виде и используется только для ваших рассылок.</p>`;
  }
  function s2() {
    const gs = S.groups ?? [], room = S.max_groups - gs.filter(g => g.status !== 'none').length;
    return `<h3>2. Группы ${help('group')}</h3><p>До ${S.max_groups} групп. Только группы — в личные сообщения ничего не отправляем.</p>
      <div class="ml-groups">${gs.map(g => g.status === 'ok' ? `<div class="ml-g ok"><b>✓ ${esc(g.title)}</b><small>${g.members ? `${g.members.toLocaleString('ru-RU')} участников · ` : ''}${g.admin ? 'вы администратор' : 'реклама разрешена — по вашей отметке'}</small>
            ${g.can && !g.can.ok ? `<small class="muted">${g.can.why === 'gap' ? `следующая рассылка — с ${hm(g.can.next)} МСК` : g.can.why === 'hours' ? 'рассылки — с 10:00 до 20:00 МСК' : 'рассылка идёт'}</small>` : ''}
            <button class="chip" data-gdel="${g.id}">Убрать</button></div>`
        : g.status === 'search' ? `<div class="ml-g"><b>${esc(g.title)}</b><small class="ml-wait">ищем в ваших чатах…</small></div>`
        : g.status === 'found' ? `<div class="ml-g found"><b>Найдено по «${esc(g.title)}»:</b>${g.cands.map((c, i) => `<label class="ml-cand"><input type="radio" name="gc${g.id}" value="${i}" ${i ? '' : 'checked'}>
            <span>${esc(c.title)}<small>${c.members ? `${Number(c.members).toLocaleString('ru-RU')} участников` : ''}${c.admin ? ' · вы администратор' : ''}</small></span></label>`).join('')}
            <label class="ml-allow"><input type="checkbox" id="ga${g.id}"> Я администратор этой группы или реклама в ней разрешена ${help('admin')}</label>
            <div class="ml-row"><button class="btn primary" data-gok="${g.id}">Подтвердить</button><button class="chip" data-gdel="${g.id}">Не та</button></div></div>`
        : `<div class="ml-g bad"><b>${esc(g.title)}</b><small class="err">${esc(g.error ?? 'Не найдена')}</small><button class="chip" data-gdel="${g.id}">Убрать</button></div>`).join('')}</div>
      ${room > 0 ? `<div class="ml-add"><label class="field">Название группы<input id="ml-gt" maxlength="120" placeholder="Например: Недвижимость Сочи риелторы"></label><button class="btn soft" id="ml-gadd">Найти группу</button></div>` : ''}
      <div class="ml-row"><button class="btn primary" data-step="3" ${okGroups().length ? '' : 'disabled'}>Дальше: проверка Избранного</button></div>`;
  }
  function s3() {
    const n = S.favs, lim = S.limit;
    return `<h3>3. Проверка Избранного</h3>
      <p class="ml-big">В рассылку уйдут все ${n} объявлений из Избранного. Проверьте, что там нет лишнего.</p>
      ${n > lim ? `<p class="hint">За одну рассылку в группу — до ${lim} объявлений: уйдут первые ${lim} (сначала добавленные последними).</p>` : ''}
      ${n ? '' : '<p class="err">В «Избранном» нет объявлений на продажу — добавьте их звёздочкой ★ на карточках.</p>'}
      <div class="ml-row"><a class="btn soft" href="./">Открыть Избранное</a></div>
      <label class="field">Комиссия сверху цены, %<input id="ml-mk" type="number" min="0" max="10" step="0.5" value="${S.acc.markup}"></label>
      <p class="hint">В сообщении: тип, площадь, этаж, цена, район и микрорайон, ЖК, до моря, описание и <b>ваши</b> контакты из профиля. Без улицы и номера дома, без телефона собственника и источника.</p>
      <div id="ml-prev" class="ml-prev"><p class="muted">Пример сообщения…</p></div>
      <div class="ml-row"><button class="btn primary" id="ml-mk-save" data-next="4">Дальше: расписание</button></div>`;
  }
  async function preview() {
    try { const r = await call('mail_preview'); const el = $('#ml-prev'); if (!el) return;
      el.innerHTML = r.item ? `<div class="ml-bubble">${r.item.photos.length ? `<div class="ml-ph">${r.item.photos.map(u => `<img src="${esc(u)}" alt="" loading="lazy">`).join('')}</div>` : ''}<pre>${esc(r.item.text)}</pre></div>
        <small class="muted">Так будет выглядеть первое объявление (№${r.item.num}).</small>` : '<p class="muted">Пример появится, когда в «Избранном» будут объявления.</p>';
    } catch { /* пример не обязателен */ }
  }
  function s4() {
    const h = S.acc.hours ?? [], r = S.rules;
    return `<h3>4. Расписание</h3><p>Рассылка в каждую группу — не чаще раза в ${r.gap_h} часа и только с ${r.from_h}:00 до ${r.to_h}:00 МСК. Между сообщениями — случайная пауза ${r.pause[0]}–${r.pause[1]} секунд, чтобы снизить риск блокировки.</p>
      <div class="ml-hours">${Array.from({ length: r.to_h - r.from_h }, (_, i) => r.from_h + i).map(x => `<label class="chip${h.includes(x) ? ' on' : ''}"><input type="checkbox" value="${x}" ${h.includes(x) ? 'checked' : ''}>${x}:00</label>`).join('')}</div>
      <p class="hint">Не больше 4 рассылок в день, между ними — от ${r.gap_h} часов. Например: 10:00, 13:00, 16:00, 19:00.</p>
      <label class="opt"><input type="checkbox" id="ml-auto" ${S.acc.auto ? 'checked' : ''}><span>Рассылать по расписанию автоматически</span></label>
      ${warn()}
      <div class="ml-row"><button class="btn primary" id="ml-sched">Сохранить расписание</button><button class="btn ghost" data-step="5">Дальше: тест</button></div>`;
  }
  function s5() {
    const gs = okGroups();
    return `<h3>5. Тестовая отправка в одну группу</h3><p>Отправим 3 первых объявления из Избранного в выбранную группу — проверите, как они выглядят. Это тоже рассылка: следующая в эту группу — через ${S.rules.gap_h} часа.</p>
      <label class="field">Группа<select id="ml-tg">${gs.map(g => `<option value="${g.id}">${esc(g.title)}</option>`).join('')}</select></label>
      ${warn()}
      <div class="ml-row"><button class="btn primary" id="ml-test" ${gs.length ? '' : 'disabled'}>Отправить 3 объявления</button><button class="btn soft" id="ml-now" ${gs.length ? '' : 'disabled'}>Запустить рассылку сейчас</button></div>
      ${runs()}`;
  }
  const RST = { queued: 'в очереди', run: 'идёт', done: 'готово', stopped: 'остановлена', error: 'ошибка' };
  const runs = () => S.runs?.length ? `<div class="ml-runs"><b>Последние рассылки</b>${S.runs.slice(0, 6).map(r => `<div class="ml-run ${r.status}"><span>${msk(r.created_at)} · ${esc((S.groups.find(g => g.id === r.group_id) ?? {}).title ?? 'группа')}${r.kind === 'test' ? ' · тест' : ''}</span>
    <span>${RST[r.status] ?? r.status} · ${r.sent} из ${r.planned}${r.failed ? `, ошибок ${r.failed}` : ''}</span>${r.error ? `<small class="err">${esc(r.error)}</small>` : ''}</div>`).join('')}<a href="#log">Весь журнал</a></div>` : '';
  // экран перед запуском (ТЗ): сколько уйдёт, предупреждение — и только потом отправка
  function confirmRun(title, n, go) {
    const d = document.createElement('div');
    d.className = 'ml-pop'; d.innerHTML = `<div class="ml-pop-box" role="dialog"><b>${esc(title)}</b><p class="ml-big">В рассылку уйдут все ${S.favs} объявлений из Избранного. Проверьте, что там нет лишнего.</p>
      ${n < S.favs ? `<p class="hint">Сейчас уйдут первые ${n}.</p>` : ''}${warn()}<div class="ml-row"><button class="btn primary" data-go>Отправить</button><a class="btn ghost" href="./">Проверить Избранное</a><button class="btn ghost" data-x>Отмена</button></div></div>`;
    d.onclick = e => { if (e.target === d || e.target.closest('[data-x]')) d.remove(); if (e.target.closest('[data-go]')) { d.remove(); go(); } };
    document.body.append(d);
  }
  const runText = r => r.runs.map(x => x.ok ? `«${(S.groups.find(g => g.id === x.group_id) ?? {}).title}» — в очереди` : `«${(S.groups.find(g => g.id === x.group_id) ?? {}).title}» — нельзя: ${x.why}`).join('; ');

  $('#mail').addEventListener('click', async e => {
    const hp = e.target.closest('[data-help]'); if (hp) { e.preventDefault(); return showHelp(hp.dataset.help); }
    const st = e.target.closest('[data-step]'); if (st && !st.disabled) { step = +st.dataset.step; return wizard(); }
    const id = e.target.closest('button')?.id;
    try {
      if (id === 'ml-qr-go') { S.acc = (await call('mail_login', { how: 'qr' })).acc; wizard(); }
      if (id === 'ml-ph-show') { $('#ml-ph').hidden = false; $('#ml-phone').focus(); }
      if (id === 'ml-ph-go') { S.acc = (await call('mail_login', { how: 'phone', phone: $('#ml-phone').value })).acc; wizard(); }
      if (id === 'ml-code-go') { S.acc = (await call('mail_code', { code: $('#ml-code').value })).acc; wizard(); }
      if (id === 'ml-pass-go') { S.acc = (await call('mail_pass', { password: $('#ml-pass').value })).acc; wizard(); }
      if (id === 'ml-cancel' || (id === 'ml-out' && confirm('Выйти из Telegram на сервере рассылок и удалить сессию? Расписание остановится.'))) {
        const r = await call('mail_logout'); S.acc = r.acc; if (r.note) toast(r.note, 9000); else if (r.gone) toast('Сессия удалена'); wizard();
      }
      if (id === 'ml-gadd') { S.groups = (await call('mail_group_add', { title: $('#ml-gt').value })).groups; wizard(); }
      const ok = e.target.closest('[data-gok]');
      if (ok) { const g = ok.dataset.gok, pick = document.querySelector(`input[name="gc${g}"]:checked`)?.value ?? 0;
        S.groups = (await call('mail_group_ok', { id: +g, pick: +pick, allowed: !!$('#ga' + g)?.checked })).groups; S = await call('mail_init'); wizard(); }
      const del = e.target.closest('[data-gdel]');
      if (del) { S.groups = (await call('mail_group_del', { id: +del.dataset.gdel })).groups; wizard(); }
      if (id === 'ml-mk-save') { S.acc = (await call('mail_sched', { hours: S.acc.hours, auto: S.acc.auto, markup: +$('#ml-mk').value })).acc; step = 4; wizard(); }
      if (id === 'ml-sched') {
        const hours = [...document.querySelectorAll('.ml-hours input:checked')].map(i => +i.value);
        S.acc = (await call('mail_sched', { hours, auto: $('#ml-auto').checked, markup: S.acc.markup })).acc; toast(S.acc.auto ? 'Расписание включено' : 'Расписание сохранено, автоматическая рассылка выключена'); wizard();
      }
      if (id === 'ml-test') confirmRun('Тестовая отправка: 3 объявления', Math.min(3, S.favs), async () => {
        try { const r = await call('mail_test', { group_id: +$('#ml-tg').value }); toast(runText(r), 7000); S = await call('mail_init'); step = 5; wizard(); } catch (er) { toast(er.message, 6000); } });
      if (id === 'ml-now') confirmRun('Рассылка во все группы сейчас', Math.min(S.limit, S.favs), async () => {
        try { const r = await call('mail_run', {}); toast(runText(r), 8000); S = await call('mail_init'); step = 5; wizard(); } catch (er) { toast(er.message, 6000); } });
    } catch (er) { toast(er.message, 6000); }
  });
  $('#mail').addEventListener('change', e => { const c = e.target.closest('.ml-hours input'); if (c) c.closest('label').classList.toggle('on', c.checked); });

  // ---------- журнал ----------
  async function journal() {
    $('#mail').innerHTML = '<p class="muted">Загрузка…</p>';
    let r; try { r = await call('mail_log'); S = await call('mail_init'); } catch (e) { $('#mail').innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    $('#mail').innerHTML = `<div class="ml"><section class="ml-card"><h3>📒 Журнал рассылок</h3>${runs() || '<p class="muted">Рассылок пока не было.</p>'}
      ${r.items.length ? `<div class="ascroll"><table class="atable"><thead><tr><th>Когда, МСК</th><th>Группа</th><th>Объявление</th><th>Итог</th></tr></thead><tbody>
        ${r.items.map(x => `<tr><td>${msk(x.at)}</td><td>${esc(x.group)}</td><td>${x.num ? '№' + x.num : ''}</td><td>${x.ok ? '✓ отправлено' : `<span class="err">✗ ${esc(x.error ?? 'ошибка')}</span>`}</td></tr>`).join('')}</tbody></table></div>` : ''}</section></div>`;
  }

  // ---------- настройки админа ----------
  async function admin() {
    $('#mail').innerHTML = '<p class="muted">Загрузка…</p>';
    let r; try { r = await call('mail_adm'); } catch (e) { $('#mail').innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    const m = r.mail, num = (id, v, l, a, b) => `<label class="field">${l}<input id="${id}" type="number" min="${a}" max="${b}" value="${v}"></label>`;
    $('#mail').innerHTML = `<div class="ml"><section class="ml-card"><h3>⚙ Рассылки: настройки</h3>
      <p>Сервер рассылок: ${r.worker.online ? '<b class="ml-ok">на связи</b>' : '<b class="err">не на связи</b>'}${r.worker.at ? ` · ${msk(r.worker.at)}` : ''} · аккаунтов с входом: ${r.accounts}</p>
      <label class="opt"><input type="checkbox" id="ma-on" ${r.enabled ? 'checked' : ''}><span>Раздел открыт всем участникам PRO и MAX</span></label>
      <label class="field">Тестеры до включения для всех (логины через запятую)<input id="ma-t" value="${esc(m.testers.join(', '))}"></label>
      ${num('ma-p0', m.pause[0], 'Пауза от, с', 20, 600)}${num('ma-p1', m.pause[1], 'Пауза до, с', 20, 900)}${num('ma-ph', m.photos, 'Фото в сообщении', 1, 10)}
      <p class="hint">Правила ТЗ не меняются: не чаще раза в ${m.gap_h} часа в группу, ${m.from_h}:00–${m.to_h}:00 МСК, 50 / 150 объявлений.</p>
      <div class="ml-row"><button class="btn primary" id="ma-save">Сохранить</button></div></section>
      <section class="ml-card"><h3>Последние рассылки всех участников</h3><div class="ascroll"><table class="atable"><thead><tr><th>№</th><th>Логин</th><th>Когда</th><th>Вид</th><th>Итог</th></tr></thead><tbody>
      ${r.runs.map(x => `<tr><td>${x.id}</td><td>${esc(x.login)}</td><td>${msk(x.created_at)}</td><td>${x.kind}</td><td>${RST[x.status] ?? x.status} · ${x.sent}/${x.planned}${x.error ? ` · ${esc(x.error)}` : ''}</td></tr>`).join('')}</tbody></table></div>
      <h3>Журнал сообщений</h3><div class="ascroll"><table class="atable"><thead><tr><th>Когда</th><th>Логин</th><th>Группа</th><th>№</th><th>Итог</th></tr></thead><tbody>
      ${r.log.slice(0, 100).map(x => `<tr><td>${msk(x.at)}</td><td>${esc(x.login)}</td><td>${esc(x.group)}</td><td>${x.num ?? ''}</td><td>${x.ok ? '✓' : `✗ ${esc(x.error ?? '')}`}</td></tr>`).join('')}</tbody></table></div></section></div>`;
    $('#ma-save').onclick = async () => {
      try { await call('mail_adm_set', { enabled: $('#ma-on').checked, mail: { testers: $('#ma-t').value.split(/[\s,]+/).filter(Boolean), pause: [+$('#ma-p0').value, +$('#ma-p1').value], photos: +$('#ma-ph').value } });
        toast('Сохранено'); admin(); } catch (e) { toast(e.message, 5000); }
    };
  }

  start();
})();
