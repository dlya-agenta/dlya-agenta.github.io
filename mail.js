// Рассылки в мессенджеры (ТЗ v2, шаг 4.2): страница mail.html — мастер «1. Вход → 2. Группы → 3. Проверка Избранного → 4. Расписание → 5. Тестовая отправка»,
// журнал (#log) и настройки админа (#admin). Правила считает только сервер (функция auto: mail_*), отправляет сервер рассылок. v5.18: Telegram, WhatsApp и MAX (вход живым браузером), группы галочками, источник — Избранное сайта или «Избранное» Telegram.
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
  let M = ['tg', 'wa', 'max'].includes(localStorage.getItem('mail_m')) ? localStorage.getItem('mail_m') : 'tg';   // v5.18: Telegram, WhatsApp, MAX
  const MN = { tg: 'Telegram', wa: 'WhatsApp', max: 'MAX' }, MI = { tg: '✈️', wa: '🟢', max: '💬' };
  async function call(action, extra = {}) {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, auth: { token: tokenOf() }, m: M, ...extra }) });
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
    src: ['Откуда берём объявления', 'Вариант 1 — своя группа-витрина (или «Избранное»): складывайте туда предложения, сервер перешлёт их во все ваши группы как есть, пачками до 30 с паузой. Вариант 2 — «Список рассылки» с сайта: галочка «Выбрать» на карточках и кнопка «В рассылку» внизу, список — справа на этой странице.',
      scr('Мои Вторички', [['🏠 2-комн., 56 м², 8,4 млн ₽', 1], ['🏠 Студия у моря, 5,9 млн ₽', 1], ['Переслать → 5 групп']])],
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
  const STEPS = ['Вход', 'Группы', 'Что рассылаем', 'Расписание', 'Тестовая отправка'];
  // v5.19: источник — «chat» (своя группа или «Избранное» мессенджера) или «site» («Список рассылки» — колонка справа, кнопка «✉️ В рассылку» на сайте)
  const isChat = () => S?.acc.src === 'chat' || S?.acc.src === 'saved';
  const srcName = () => S?.acc.src === 'sel' ? `подборки № ${S.acc.src_sel}` : isChat() ? `«${S.acc.src_title || 'Избранное'}»` : '«Списка рассылки»';
  const picked = () => (S?.list ?? []).filter(x => x.pick && !x.gone);
  const money = v => `${Math.round(v).toLocaleString('ru-RU')} ₽`;
  // колонка «Список рассылки»: отметить, убрать, добавить по номеру или из Избранного
  function side() {
    const L = S.list ?? [], k = picked().length;
    return `<aside class="ml-side${isChat() ? ' dim' : ''}" aria-label="Список рассылки"><div class="ml-side-h"><b>✉️ Список рассылки</b><small>${k} из ${L.length} отмечено</small></div>
      ${isChat() ? `<p class="hint">Сейчас рассылаем из ${esc(srcName())}. Чтобы рассылать объявления с сайта — выберите «С сайта» в шаге 3.</p>` : ''}
      <p class="hint">Отметьте объявления на сайте галочкой <b>«Выбрать»</b> и нажмите внизу <b>«В рассылку»</b> — они появятся здесь.</p>
      <div class="ml-side-add"><input id="ml-num" inputmode="numeric" placeholder="№ объявления" autocomplete="off"><button class="btn soft" id="ml-num-go">Добавить</button></div>
      <div class="ml-row ml-side-acts"><button class="chip" id="ml-favs">★ Из Избранного</button>${L.length ? `<button class="chip" data-lall="1">Отметить все</button><button class="chip" data-lall="0">Снять все</button>` : ''}${L.some(x => x.gone) ? '<button class="chip" id="ml-lgone">Убрать снятые</button>' : ''}</div>
      <div class="ml-items">${L.length ? L.map(x => `<div class="ml-it${x.pick ? ' on' : ''}${x.gone ? ' gone' : ''}">
          <label class="ml-it-pick"><input type="checkbox" data-lpick="${x.id}" ${x.pick ? 'checked' : ''} ${x.gone ? 'disabled' : ''} aria-label="Отправлять"></label>
          ${x.photo ? `<img src="${esc(x.photo)}" alt="" loading="lazy">` : '<span class="ml-it-ph"></span>'}
          <a class="ml-it-t" href="./#o=${x.num}" target="_blank"><b>${esc(x.what)}</b><small>${x.gone ? 'снято с продажи' : money(x.price)}${x.where ? ` · ${esc(x.where)}` : ''}</small><small class="${x.ai ? 'ok' : 'muted'}">${x.ai ? '✨ текст переписан ИИ' : '✨ текст перепишет ИИ перед отправкой'}</small></a>
          <button class="ml-it-x" data-ldel="${x.id}" aria-label="Убрать из списка" title="Убрать">✕</button></div>`).join('')
        : '<p class="muted ml-empty">Список пуст. Отметьте объявления на сайте галочкой «Выбрать» и нажмите внизу «В рассылку» — или добавьте по номеру.</p>'}</div>
      <a class="btn ghost" href="./">Открыть объявления</a></aside>`;
  }
  const okAcc = () => S?.acc.status === 'ok';
  const okGroups = () => (S?.groups ?? []).filter(g => g.status === 'ok');

  async function start() {
    if (!tokenOf()) return gate('<h2>Рассылки</h2><p>Войдите на сайте — страница откроется после входа.</p><a class="btn primary" href="./">Войти</a>');
    try { S = await call('mail_init'); }
    catch (e) {
      const d = e.data ?? {};
      if (d.error === 'need_pro') return gate('<h2>✉️ Рассылки в мессенджеры</h2><p>Объявления из вашей группы-витрины или «Списка рассылки» уходят в ваши группы Telegram, WhatsApp и MAX по расписанию — не чаще раза в 3 часа в группу.</p><p>Рассылки — в тарифах PRO и MAX.</p><a class="btn primary" href="./#pro">Оформить PRO</a>');
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
      <div class="ml-msg" role="tablist">${[['tg', 'Telegram'], ['wa', 'WhatsApp'], ['max', 'MAX']].map(([k, t]) => S.messengers.includes(k) ? `<button class="chip${k === M ? ' on' : ''}" role="tab" aria-selected="${k === M}" data-m="${k}">${MI[k]} ${t}</button>`
        : `<span class="chip dis" title="Включает администратор">${t} · скоро</span>`).join('')}</div>
      ${S.worker.online ? '' : '<p class="ml-off">Сервер рассылок пока не на связи — вход и отправка временно недоступны. Группы и расписание сохранятся.</p>'}
      ${a.stopped_at ? `<p class="ml-stop">⛔ Рассылки остановлены ${msk(a.stopped_at)}: ${esc(a.message ?? 'мессенджер ограничил отправку')}. Подождите, проверьте аккаунт и включите расписание снова.</p>` : ''}
      <ol class="ml-steps">${STEPS.map((t, i) => `<li><button class="${step === i + 1 ? 'on' : ''}${i + 1 < 2 || okAcc() ? '' : ' dis'}" data-step="${i + 1}" ${i + 1 < 2 || okAcc() ? '' : 'disabled'}>
        <span>${i + 1}</span>${esc(t)}${i === 0 && okAcc() ? ' ✓' : i === 1 && okGroups().length ? ' ✓' : ''}</button></li>`).join('')}</ol>
      <div class="ml-grid"><section class="ml-card" id="ml-step">${[s1, s2, s3, s4, s5][step - 1]()}</section>${okAcc() ? side() : ''}</div></div>`;
    if (step === 1 && a.qr) loadQr().then(() => { const el = $('#ml-qr'); if (el && !el.dataset.v) { el.dataset.v = a.qr; new window.QRCode(el, { text: a.qr, width: 220, height: 220, correctLevel: window.QRCode.CorrectLevel.M }); } }).catch(() => null);
    if (step === 3 && !isChat()) preview();
    document.querySelectorAll('[data-ml-wy]').forEach(el => window.WAYS?.box(el, M, { mass: true, action: 'рассылки' }));
    if (busy || (S.groups ?? []).some(g => g.status === 'search')) poll = setTimeout(refresh, 2500);
  }
  async function refresh() {
    try { const r = await call('mail_state'); const was = S.acc.status; S.acc = r.acc; S.groups = r.groups.map(g => ({ ...g, can: S.groups.find(x => x.id === g.id)?.can ?? null }));
      if (was !== 'ok' && S.acc.status === 'ok') { S = await call('mail_init'); step = 2; toast('Вход выполнен'); } } catch { /* следующая попытка */ }
    if (!location.hash) wizard();
  }
  // v5.69: «сначала свой компьютер» — блок WAYS (ways.js) у входа; перед рассылкой — WAYS.pick: компьютер выключен и сервер не разрешён → окно, молча не шлём
  const warn = () => `<p class="ml-warn">⚠️ ${esc(S.warn)}.</p><div class="ml-wy" data-ml-wy></div>`;
  const wyOk = async () => true;   // v5.69: эту работу пока делает только сервер/Mac (расширение не умеет) — не блокируем; через компьютер — вторая волна v5.70
  function s1() {
    const a = S.acc;
    if (M !== 'tg') return a.status === 'ok' ? `<h3>1. Вход в ${MN[M]}</h3><p class="ml-ok">✓ Вход выполнен${a.name ? `: <b>${esc(a.name)}</b>` : ''}</p>${warn()}
        <div class="ml-row"><button class="btn primary" data-step="2">Дальше: группы</button><button class="btn ghost" id="ml-out">Выйти и удалить сессию</button></div>`
      : `<h3>1. Вход в ${MN[M]}</h3>${warn()}${a.message && a.status !== 'none' ? `<p class="${a.status === 'error' || a.status === 'need' ? 'err' : 'hint'}">${esc(a.message)}</p>` : ''}
        <div class="ml-row"><button class="btn primary" id="ml-live">Войти в ${MN[M]}</button></div>
        <p class="hint">${M === 'wa' ? 'Откроется WhatsApp Web на нашем сервере: WhatsApp на телефоне → Настройки → Связанные устройства → Привязка устройства → наведите камеру на QR-код. Один раз — дальше работает само.' : 'Откроется веб-версия MAX на нашем сервере: войдите по QR-коду из приложения MAX или по номеру и коду. Один раз — дальше работает само.'}</p>
        <p class="hint">⚠ Это неофициальное подключение: лучше рабочий номер. Сессия хранится на нашем сервере в зашифрованном виде.</p>`;
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
      : `<div class="ml-row"><button class="btn primary" id="ml-live">Войти в Telegram</button></div>
         <p class="hint">Откроется окно с настоящим Telegram Web на нашем сервере: отсканируйте QR-код телефоном или войдите по номеру и коду — как в обычном браузере. Ключ API не нужен.</p>`}
      <p class="hint">Номер телефона, коды и облачный пароль не сохраняются — используются один раз для входа. Сессия хранится в зашифрованном виде и используется только для ваших рассылок.</p>`;
  }
  function s2() {
    const all = (S.groups ?? []).find(g => g.title === '*'), gs = (S.groups ?? []).filter(g => g.title !== '*'), room = S.max_groups - gs.filter(g => g.status !== 'none').length;
    const list = !all ? '' : all.status === 'search' ? `<div class="ml-g"><b>Загружаем ваши группы из ${MN[M]}…</b><small class="ml-wait">20–60 секунд</small></div>`
      : all.status === 'found' ? `<div class="ml-g found ml-all"><b>Ваши группы в ${MN[M]} — отметьте, куда рассылать (можно ещё ${room}):</b>
          <input class="ml-filter" id="ml-flt" placeholder="Найти в списке" autocomplete="off">
          <div class="ml-list">${all.cands.map((c, i) => `<label class="ml-cand"><input type="checkbox" name="gall" value="${i}"><span>${esc(c.title)}</span></label>`).join('')}</div>
          <label class="ml-allow"><input type="checkbox" id="ga-all"> Я администратор этих групп или реклама в них разрешена ${help('admin')}</label>
          <div class="ml-row"><button class="btn primary" data-gpick="${all.id}">Добавить отмеченные</button><button class="chip" data-gdel="${all.id}">Скрыть список</button></div></div>`
      : `<div class="ml-g bad"><b>Список групп</b><small class="err">${esc(all.error ?? 'Не загрузился')}</small><button class="chip" data-gdel="${all.id}">Убрать</button></div>`;
    return `<h3>2. Группы ${help('group')}</h3><p>До ${S.max_groups} групп. Только группы — в личные сообщения ничего не отправляем.</p>
      ${room > 0 && !all ? `<div class="ml-row"><button class="btn primary" id="ml-gall">Загрузить мои группы из ${MN[M]}</button></div><p class="hint">Покажем все ваши группы — отметите галочками нужные. Или найдите одну по названию ниже.</p>` : ''}${list}
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
    const chats = S.acc.chats ?? [], chat = isChat();
    const own = chats.filter(c => c.own && c.kind !== 'saved'), rest = chats.filter(c => !c.own && c.kind !== 'saved' && c.kind !== 'chat');
    const saved = chats.find(c => c.kind === 'saved') || (M !== 'wa' ? { peer: 'saved', title: 'Избранное' } : null);
    // по умолчанию — своя созданная группа (для WhatsApp — всегда), иначе «Избранное»
    const cur = S.acc.src_peer || own[0]?.peer || (saved ? 'saved' : rest[0]?.peer) || '';
    const opt = c => `<option value="${esc(c.peer)}" ${c.peer === cur ? 'selected' : ''}>${esc(c.title)}</option>`;
    const sel = `<select id="ml-sp">${saved ? `<option value="saved" ${cur === 'saved' ? 'selected' : ''}>⭐ Избранное (сообщения для себя)</option>` : ''}
      ${own.length ? `<optgroup label="Ваши группы и каналы">${own.map(opt).join('')}</optgroup>` : ''}${rest.length ? `<optgroup label="Другие группы">${rest.map(opt).join('')}</optgroup>` : ''}</select>`;
    return `<h3>3. Что рассылаем ${help('src')}</h3>
      <div class="ml-src"><label class="opt big"><input type="radio" name="ml-src" value="sel" ${S.acc.src === 'sel' ? 'checked' : ''}><span><b>Из моей подборки — с правками цены и описания</b><input id="ml-selection" type="number" min="1" placeholder="Номер подборки" value="${S.acc.src_sel || new URLSearchParams(location.search).get('selection') || ''}"></span></label>
        <label class="opt big"><input type="radio" name="ml-src" value="chat" ${chat ? 'checked' : ''}><span><b>Пересылать из группы ${MN[M]}</b> — ваша группа-витрина или «Избранное». Складывайте туда объявления, а мы перешлём их во все группы как есть.</span></label>
        <div class="ml-src-pick" ${chat ? '' : 'hidden'}>${chats.length ? `<label class="field">Откуда пересылать${sel}</label>
            <p class="hint">Свои группы — первыми. ${M === 'wa' ? 'Удобно: создайте в WhatsApp свою группу (например, «Мои Вторички»), складывайте туда предложения — отсюда они разойдутся по остальным.' : 'Пересылаем объявления (текст от 40 знаков, альбом — одним объявлением), одинаковые — один раз.'}</p>`
          : `<p class="hint">Список ваших чатов ещё не загружен.</p><div class="ml-row"><button class="btn soft" id="ml-gall">Загрузить мои чаты из ${MN[M]}</button></div>`}</div>
        <label class="opt big"><input type="radio" name="ml-src" value="site" ${!chat && S.acc.src !== 'sel' ? 'checked' : ''}><span><b>С сайта — «Список рассылки»</b> (колонка справа): текст и фото соберём сами, с вашими контактами; описание перепишет ИИ.</span></label>
        <div class="ml-src-site" ${chat ? 'hidden' : ''}>
          <p class="ml-big">${picked().length ? `Отмечено ${picked().length} объявлений — за одну рассылку в группу уйдёт до ${S.limit}.` : 'В списке рассылки пока ничего не отмечено.'}</p>
          <label class="field">Комиссия сверху цены, %<input id="ml-mk" type="number" min="0" max="10" step="0.5" value="${S.acc.markup}"></label>
          <p class="hint">В сообщении: тип, площадь, этаж, цена, район и микрорайон, ЖК, до моря, описание и <b>ваши</b> контакты из профиля. Без улицы и номера дома, без телефона собственника и источника.</p>
          <div id="ml-prev" class="ml-prev"><p class="muted">Пример сообщения…</p></div></div>
      </div>
      <div class="ml-row"><button class="btn primary" id="ml-mk-save" data-next="4">Сохранить и дальше: расписание</button></div>`;
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
    return `<h3>5. Тестовая отправка в одну группу</h3><p>Отправим 3 ${isChat() ? `последних объявления из ${esc(srcName())}` : 'первых отмеченных объявления из «Списка рассылки»'} в выбранную группу — проверите, как они выглядят. Это тоже рассылка: следующая в эту группу — через ${S.rules.gap_h} часа.</p>
      <label class="field">Группа<select id="ml-tg">${gs.filter(g => !isSrc(g)).map(g => `<option value="${g.id}">${esc(g.title)}</option>`).join('')}</select></label>
      ${warn()}
      <div class="ml-row"><button class="btn primary" id="ml-test" ${gs.length ? '' : 'disabled'}>Отправить 3 объявления</button><button class="btn soft" id="ml-now" ${gs.length ? '' : 'disabled'}>Запустить рассылку сейчас</button></div>
      ${runs()}`;
  }
  const isSrc = g => { if (!isChat() || !g.peer) return false; try { const h = String(JSON.parse(g.peer).h ?? ''); return h === S.acc.src_peer || h.replace(/^#/, '').replace(/^-100(\d{9,})$/, '-$1') === S.acc.src_peer; } catch { return false; } };
  const RST = { queued: 'в очереди', run: 'идёт', done: 'готово', stopped: 'остановлена', error: 'ошибка' };
  const runs = () => S.runs?.length ? `<div class="ml-runs"><b>Последние рассылки</b>${S.runs.slice(0, 6).map(r => `<div class="ml-run ${r.status}"><span>${msk(r.created_at)} · ${esc((S.groups.find(g => g.id === r.group_id) ?? {}).title ?? 'группа')}${r.kind === 'test' ? ' · тест' : ''}</span>
    <span>${RST[r.status] ?? r.status} · ${r.status === 'done' || r.status === 'stopped' || r.status === 'error' || !isChat() ? `${r.sent} из ${r.planned}` : `отправлено ${r.sent}`}${r.failed ? `, ошибок ${r.failed}` : ''}</span>${r.error ? `<small class="err">${esc(r.error)}</small>` : ''}</div>`).join('')}<a href="#log">Весь журнал</a></div>` : '';
  // экран перед запуском (ТЗ): сколько уйдёт, предупреждение — и только потом отправка
  function confirmRun(title, n, go) {
    const d = document.createElement('div');
    d.className = 'ml-pop'; d.innerHTML = `<div class="ml-pop-box" role="dialog"><b>${esc(title)}</b>${isChat() ? `<p class="ml-big">Перешлём объявления из ${esc(srcName())} (до ${n}). Проверьте, что там только предложения — ничего личного.</p>`
        : `<p class="ml-big">Уйдут ${Math.min(n, picked().length)} из ${picked().length} отмеченных объявлений «Списка рассылки».</p>`}${warn()}<div class="ml-row"><button class="btn primary" data-go>Отправить</button><button class="btn ghost" data-x>Отмена</button></div></div>`;
    d.onclick = e => { if (e.target === d || e.target.closest('[data-x]')) d.remove(); if (e.target.closest('[data-go]')) { d.remove(); go(); } };
    document.body.append(d);
  }
  const runText = r => r.runs.map(x => x.ok ? `«${(S.groups.find(g => g.id === x.group_id) ?? {}).title}» — в очереди` : `«${(S.groups.find(g => g.id === x.group_id) ?? {}).title}» — нельзя: ${x.why}`).join('; ');

  $('#mail').addEventListener('click', async e => {
    const hp = e.target.closest('[data-help]'); if (hp) { e.preventDefault(); return showHelp(hp.dataset.help); }
    const st = e.target.closest('[data-step]'); if (st && !st.disabled) { step = +st.dataset.step; return wizard(); }
    const mt = e.target.closest('[data-m]');
    if (mt && mt.dataset.m !== M) { M = mt.dataset.m; localStorage.setItem('mail_m', M); S = await call('mail_init').catch(er => (toast(er.message), S)); step = S.acc.status === 'ok' ? (okGroups().length ? 3 : 2) : 1; return wizard(); }
    const id = e.target.closest('button')?.id;
    try {
      if (id === 'ml-live' && M !== 'tg') { CONN.open(M, { title: `${MI[M]} Вход в ${MN[M]}`, onOk: async () => { S = await call('mail_init'); step = S.acc.status === 'ok' ? 2 : 1; wizard(); } }); return; }
      if (id === 'ml-gall') { S.groups = (await call('mail_group_add', { all: true })).groups; wizard(); }
      const gp = e.target.closest('[data-gpick]');
      if (gp) { const picks = [...document.querySelectorAll('input[name="gall"]:checked')].map(i => +i.value);
        S.groups = (await call('mail_group_pick', { id: +gp.dataset.gpick, picks, allowed: !!$('#ga-all')?.checked })).groups; S = await call('mail_init'); toast(`Добавлено групп: ${picks.length}`); wizard(); }
      if (id === 'ml-live') { CONN.open('tg', { title: '✈️ Вход в Telegram', onOk: async () => { S = await call('mail_init'); step = S.acc.status === 'ok' ? 2 : 1; wizard(); } }); return; }
      if (id === 'ml-qr-go') { S.acc = (await call('mail_login', { how: 'qr' })).acc; wizard(); }
      if (id === 'ml-ph-show') { $('#ml-ph').hidden = false; $('#ml-phone').focus(); }
      if (id === 'ml-ph-go') { S.acc = (await call('mail_login', { how: 'phone', phone: $('#ml-phone').value })).acc; wizard(); }
      if (id === 'ml-code-go') { S.acc = (await call('mail_code', { code: $('#ml-code').value })).acc; wizard(); }
      if (id === 'ml-pass-go') { S.acc = (await call('mail_pass', { password: $('#ml-pass').value })).acc; wizard(); }
      if (id === 'ml-cancel' || (id === 'ml-out' && confirm('Выйти из Telegram на сервере рассылок и удалить сессию? Расписание остановится.'))) {
        if (id === 'ml-out') await CONN.call('conn_logout', { svc: M }).catch(() => null);   // вход через живой браузер (v5.16) — удалить и его
        const r = await call('mail_logout'); S.acc = r.acc; if (r.note) toast(r.note, 9000); else if (r.gone) toast('Сессия удалена'); wizard();
      }
      if (id === 'ml-gadd') { S.groups = (await call('mail_group_add', { title: $('#ml-gt').value })).groups; wizard(); }
      const ok = e.target.closest('[data-gok]');
      if (ok) { const g = ok.dataset.gok, pick = document.querySelector(`input[name="gc${g}"]:checked`)?.value ?? 0;
        S.groups = (await call('mail_group_ok', { id: +g, pick: +pick, allowed: !!$('#ga' + g)?.checked })).groups; S = await call('mail_init'); wizard(); }
      const del = e.target.closest('[data-gdel]');
      if (del) { S.groups = (await call('mail_group_del', { id: +del.dataset.gdel })).groups; wizard(); }
      if (id === 'ml-mk-save') { const src = document.querySelector('input[name="ml-src"]:checked')?.value ?? S.acc.src;
        S.acc = (await call('mail_sched', { hours: S.acc.hours, auto: S.acc.auto, markup: +($('#ml-mk')?.value ?? S.acc.markup), src, ...(src==='sel'?{src_sel:Number($('#ml-selection')?.value)}:{}), ...(src === 'chat' && $('#ml-sp') ? { src_peer: $('#ml-sp').value } : {}) })).acc;
        toast(isChat() ? `Рассылаем из ${srcName()}` : 'Рассылаем «Список рассылки»'); step = 4; wizard(); }
      // список рассылки
      const lp = e.target.closest('[data-lpick]');
      if (lp) { S.list = (await call('mail_list_pick', { id: +lp.dataset.lpick, pick: lp.checked })).list; return wizard(); }
      const ld = e.target.closest('[data-ldel]');
      if (ld) { S.list = (await call('mail_list_del', { id: +ld.dataset.ldel })).list; return wizard(); }
      const la = e.target.closest('[data-lall]');
      if (la) { S.list = (await call('mail_list_pick', { all: true, pick: la.dataset.lall === '1' })).list; return wizard(); }
      if (id === 'ml-lgone') { S.list = (await call('mail_list_del', { gone: true })).list; return wizard(); }
      if (id === 'ml-favs') { const r = await call('mail_list_add', { from: 'favs' }); S.list = r.list; toast(`Из Избранного добавлено: ${r.added}`); return wizard(); }
      if (id === 'ml-num-go') { const v = $('#ml-num').value.replace(/\D/g, ''); if (!v) return; const r = await call('mail_list_add', { num: +v }); S.list = r.list; toast('Добавлено в список рассылки'); return wizard(); }
      if (id === 'ml-sched') {
        const hours = [...document.querySelectorAll('.ml-hours input:checked')].map(i => +i.value);
        S.acc = (await call('mail_sched', { hours, auto: $('#ml-auto').checked, markup: S.acc.markup, src: S.acc.src })).acc; toast(S.acc.auto ? 'Расписание включено' : 'Расписание сохранено, автоматическая рассылка выключена'); wizard();
      }
      if ((id === 'ml-test' || id === 'ml-now') && !(await wyOk())) return;
      if (id === 'ml-test') confirmRun('Тестовая отправка: 3 объявления', 3, async () => {
        try { const r = await call('mail_test', { group_id: +$('#ml-tg').value }); toast(runText(r), 7000); S = await call('mail_init'); step = 5; wizard(); } catch (er) { toast(er.message, 6000); } });
      if (id === 'ml-now') confirmRun('Рассылка во все группы сейчас', S.limit, async () => {
        try { const r = await call('mail_run', {}); toast(runText(r), 8000); S = await call('mail_init'); step = 5; wizard(); } catch (er) { toast(er.message, 6000); } });
    } catch (er) { toast(er.message, 6000); }
  });
  $('#mail').addEventListener('input', e => { if (e.target.id !== 'ml-flt') return; const q = e.target.value.toLowerCase().replace(/ё/g, 'е');
    document.querySelectorAll('.ml-list .ml-cand').forEach(l => l.hidden = !!q && !l.textContent.toLowerCase().replace(/ё/g, 'е').includes(q)); });
  $('#mail').addEventListener('change', e => { const c = e.target.closest('.ml-hours input'); if (c) c.closest('label').classList.toggle('on', c.checked);
    if (e.target.name === 'ml-src') { const chat = e.target.value === 'chat'; $('.ml-src-pick').hidden = !chat; $('.ml-src-site').hidden = chat; if (!chat) preview(); } });

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
      <p>Ключ Telegram API: ${r.tg_set ? '<b class="ml-ok">сохранён ••••</b>' : '<b class="err">не задан</b> — без него вход в Telegram не работает'}</p>
      <details${r.tg_set ? '' : ' open'}><summary>${r.tg_set ? 'Заменить ключ' : 'Вставить ключ'}</summary>
        <p class="hint">my.telegram.org → войти по номеру → API development tools → создать приложение (название «Для Агента», платформа Other) → скопировать api_id и api_hash сюда. В чат их не присылайте.</p>
        <label class="field">api_id<input id="ma-id" inputmode="numeric" autocomplete="off"></label><label class="field">api_hash<input id="ma-hash" autocomplete="off" spellcheck="false"></label>
        <button class="btn soft" id="ma-tg">Сохранить ключ</button></details>
      <details${r.proxy?.wa || r.proxy?.all ? '' : ' open'}><summary>🛡 VPN (прокси) сервера для WhatsApp и Instagram${r.proxy && Object.keys(r.proxy).length ? ' — задан' : ' — не задан'}</summary>
        <p class="hint">Сервер рассылок стоит в России: WhatsApp Web с него не соединяется, Instagram закрыт. Нужен один прокси за пределами России (свой сервер или платный прокси; бесплатным — не доверяйте вход в аккаунты).
          Вид: <code>http://адрес:порт</code>, <code>socks5://адрес:порт</code> или <code>http://логин:пароль@адрес:порт</code>. Пустое поле — без прокси. Сейчас: ${Object.entries(r.proxy ?? {}).map(([k, v]) => `${k} → ${esc(v)}`).join(', ') || 'нет'}.</p>
        ${[['wa', 'WhatsApp'], ['ig', 'Instagram'], ['max', 'MAX — российский'], ['dc', 'ДомКлик — российский'], ['av', 'Авито — российский'], ['cian', 'Циан — российский'], ['all', 'Все остальные (если нужно)']].map(([k, t]) => `<label class="field">${t}<input id="mx-${k}" placeholder="${r.proxy?.[k] ? 'задан — оставьте пустым, чтобы не менять' : 'например socks5://1.2.3.4:1080'}" autocomplete="off" spellcheck="false"></label>`).join('')}
        <div class="ml-row"><button class="btn soft" id="ma-px">Сохранить прокси</button><button class="btn ghost" id="ma-px0">Убрать все</button></div></details>
      <p class="hint">Правила ТЗ не меняются: не чаще раза в ${m.gap_h} часа в группу, ${m.from_h}:00–${m.to_h}:00 МСК, 50 / 150 объявлений.</p>
      <div class="ml-row"><button class="btn primary" id="ma-save">Сохранить</button></div></section>
      <section class="ml-card"><h3>Последние рассылки всех участников</h3><div class="ascroll"><table class="atable"><thead><tr><th>№</th><th>Логин</th><th>Когда</th><th>Вид</th><th>Итог</th></tr></thead><tbody>
      ${r.runs.map(x => `<tr><td>${x.id}</td><td>${esc(x.login)}</td><td>${msk(x.created_at)}</td><td>${x.kind}</td><td>${RST[x.status] ?? x.status} · ${x.sent}/${x.planned}${x.error ? ` · ${esc(x.error)}` : ''}</td></tr>`).join('')}</tbody></table></div>
      <h3>Журнал сообщений</h3><div class="ascroll"><table class="atable"><thead><tr><th>Когда</th><th>Логин</th><th>Группа</th><th>№</th><th>Итог</th></tr></thead><tbody>
      ${r.log.slice(0, 100).map(x => `<tr><td>${msk(x.at)}</td><td>${esc(x.login)}</td><td>${esc(x.group)}</td><td>${x.num ?? ''}</td><td>${x.ok ? '✓' : `✗ ${esc(x.error ?? '')}`}</td></tr>`).join('')}</tbody></table></div></section></div>`;
    $('#ma-tg').onclick = async () => {
      try { await call('mail_adm_tg', { api_id: $('#ma-id').value, api_hash: $('#ma-hash').value }); toast('Ключ сохранён'); admin(); } catch (e) { toast(e.message, 6000); }
    };
    $('#ma-px').onclick = async () => { const b = {}; for (const k of ['wa', 'ig', 'max', 'dc', 'av', 'cian', 'all']) { const v = $('#mx-' + k).value.trim(); if (v) b[k] = v; }
      try { await call('mail_adm_proxy', b); toast('Прокси сохранён — сервер применит его в течение минуты'); admin(); } catch (e) { toast(e.message, 6000); } };
    $('#ma-px0').onclick = async () => { if (!confirm('Убрать все прокси?')) return; try { await call('mail_adm_proxy', { all: '', wa: '', ig: '', tg: '', max: '', yt: '', vk: '', dc: '', av: '', cian: '' }); toast('Прокси убраны'); admin(); } catch (e) { toast(e.message, 6000); } };
    $('#ma-save').onclick = async () => {
      try { await call('mail_adm_set', { enabled: $('#ma-on').checked, mail: { testers: $('#ma-t').value.split(/[\s,]+/).filter(Boolean), pause: [+$('#ma-p0').value, +$('#ma-p1').value], photos: +$('#ma-ph').value } });
        toast('Сохранено'); admin(); } catch (e) { toast(e.message, 5000); }
    };
  }

  start();
})();
