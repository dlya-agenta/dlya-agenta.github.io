// «Для Агента» — поиск объектов от собственников Сочи. Вход — по логину и паролю (выдаёт администратор или регистрация
// с одобрением) или кнопкой «Сайт» в боте (Telegram Mini App). Данные — только из функции web; здесь нет ни ключей, ни данных.
const tg = window.Telegram?.WebApp;
// v5.47 E: страница в рамке (objpop.js на других страницах) — показываем только окно объявления; закрыли его — рамка закрывается
const EMBED = new URLSearchParams(location.search).has('embed') && window.parent !== window;
if (EMBED) {
  document.documentElement.classList.add('embed');
  document.addEventListener('click', e => { const a = e.target.closest('a[href]'); if (a && !a.getAttribute('href').startsWith('#') && !a.target) a.target = '_top'; }, true);
}
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// описание (v5.17.3): разделы **жирным** по шаблону; у старых описаний — «Заголовок:» жирным, строка «Коротко:» не показывается
const descrHtml = s => esc(String(s ?? '').replace(/^Коротко:.*(\n|$)/m, '').trim())
  .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/^([А-ЯЁ][а-яё ]{2,20}:)/gm, '<b>$1</b>');
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* приватный режим */ } },
};
const MSG = 'Здравствуйте! Ваше предложение по продаже в Сочи ещё актуально? Хотели уточнить несколько нюансов по просмотру.';
const KINDS = [['квартира', 'Квартиры'], ['апартаменты', 'Апартаменты'], ['дом', 'Дома и ТХ'], ['коммерция', 'Коммерция'], ['участок', 'Участки']];
const ROOMS = [[0, 'Студия'], [1, '1'], [2, '2'], [3, '3'], [4, '4+']];
// «С ремонтом» = дизайнерский + евроремонт + современный (одним видом); white box в фильтре нет, в данных — остаётся
// v5.20: «С ремонтом» из фильтра убран (просьба Алексея); сохранённый fin:'repair' отбрасывается при загрузке
const FIN = [['clean', 'Чистовая'], ['rough', 'Черновая']];
const FINL = { designer: 'С ремонтом', euro: 'С ремонтом', modern: 'С ремонтом', repair: 'С ремонтом', clean: 'Чистовая', whitebox: 'White box', rough: 'Черновая' };
const MAXSEL = 20, MAXPDF = 10;   // v5.23: подборка ссылкой — до 20 объектов, PDF и «PDF + ссылка» — до 10
const isNew = x => x.lite ? !!x.nw : x.created_at && Date.now() - Date.parse(x.created_at) < 30 * 864e5;   // «Новое» — за последний месяц (у точки карты — флаг nw)
// до моря по прямой (сервер считает по береговой линии): один выбор из списка
const SEA = [[300, 'до 300 м'], [500, 'до 500 м'], [1000, 'до 1 км'], [2000, 'до 2 км'], [3000, 'до 3 км']];
const seaTxt = m => m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} м` : `${(m / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} км`;
// районы прежних версий сайта → ключи дерева «район → микрорайон»
const OLD_AREAS = { c: 'd:Центральный', h: 'd:Хостинский', a: 'd:Адлерский', l: 'd:Лазаревский', s: 'd:Сириус', k: 'd:Красная Поляна', gt: 'z:gt', m1: 'z:center',
  m2: 's:Донская', m3: 's:Макаренко', m4: 's:Мамайка', m5: 's:Новый Сочи', m6: 's:Светлана', m7: 's:Завокзальный', m8: 's:Заречный', m9: 's:Бытха', m10: 's:Мацеста',
  m11: 's:Хоста', m12: 's:Кудепста', m13: 's:Курортный городок', m14: 's:Центр Адлера', m15: 's:Имеретинка', m16: 's:Дагомыс', m17: 's:Лазаревское', m18: 's:Лоо',
  'mkr:Сочи Центр': 'z:center' };
// «С клиентом»: цены с комиссией агента сверху (как в PDF клиенту — до 10 000 ₽), без источников, заметок, телефонов и «Контакт»
let client = store.get('client', { on: false, cm: 3 });
const cmOn = () => client.on ? +client.cm || 0 : 0;
const priceOf = v => cmOn() ? Math.round(v * (1 + cmOn() / 100) / 10000) * 10000 : v;

let token = store.get('token', null);
let auth = token ? { token } : null;   // Mini App: initData меняется на токен своей сессии (tg_login) — Telegram считается устройством
let me = null, meta = null;
let f = store.get('f2', {}), text = store.get('text', ''), sort = store.get('sort', 'new');
const mobile = () => innerWidth <= 760;
let lays = store.get('lay', {});   // вид выдачи — свой для телефона и компьютера
// фильтр на компьютере: колонкой слева (по умолчанию с v5.1) или сверху, открыт или закрыт; сохранённое до v5.1 (без fv = 5) сброшено один раз
const FV = 5, fvOk = store.get('fv', 0) === FV;
let fside = fvOk ? store.get('fside', true) : true, fclosed = fvOk ? store.get('fclosed', false) : false;
// вид 3 или 6 объектов на экране, по умолчанию 3 (прежний «1» и сохранённые до v4.3 значения — снова 3)
const fixLays = l => l && l.v === 3 ? l : { v: 3 };
lays = fixLays(lays);
const lay = () => ['3', '6'].includes(lays[mobile() ? 'm' : 'd']) ? lays[mobile() ? 'm' : 'd'] : '3';
let favMode = null, beforeFav = null;   // «Избранное» / «Контакт» не затирают сохранённые фильтры
let sheetGo = null;   // открыто окно из меню (подборки, реклама, админка, оплата) — подсвечен его пункт
let sel = new Set(store.get('sel', []));
let offset = 0, total = 0, busy = false, view = 'list', items = new Map();

// настройки — в браузере и на сервере (в Telegram браузерное хранилище бывает пустым при каждом запуске)
function savePrefs() {
  store.set('f2', f); store.set('text', text); store.set('sort', sort); store.set('lay', lays); store.set('fclosed', fclosed); store.set('fside', fside); store.set('fv', FV); store.set('client', client);
  clearTimeout(savePrefs.t);
  savePrefs.t = setTimeout(() => call('prefs', { prefs: { f, text, sort, lay: lays, fclosed, fside, fv: FV, client } }).catch(() => {}), 700);
}

// «Load failed» / «Failed to fetch» (v5.18): сеть или сервер на миг не ответили (холодный старт функции, смена Wi-Fi/LTE, 502–546 без заголовков CORS) —
// повторяем ещё 2 раза через 0,8 и 2 с; действия, которые нельзя повторять (код входа, регистрация, подборка, оплата), — без повтора
const NO_RETRY = new Set(['login_code', 'register', 'sel_create', 'pay', 'pw_reset', 'pw_reset_set', 'link_login']);   // link_login — код одноразовый, повтор дал бы «устарела»
const NET_MSG = 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.';
async function call(action, extra = {}, signal) {   // signal — отменить устаревший запрос (новый поиск вместо прежнего)
  const body = JSON.stringify({ action, auth, ...extra });
  const trace = { a: action, t0: Date.now(), st: 'sent' }; (window.__calls ??= []).push(trace); if (window.__calls.length > 12) window.__calls.shift();   // v5.26e: для диагностики «зависаний»
  let r = null;
  for (let i = 0; ; i++) {
    try {
      // v5.26: без ответа 45 с (поиск с внешними источниками бывает до ~30 с) — считаем, что связи нет (раньше запрос мог висеть бесконечно — «вечная загрузка» в приложении с экрана «Домой»)
      const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 45_000), off = () => ctl.abort();
      signal?.addEventListener('abort', off, { once: true });
      try { r = await fetch(window.API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: ctl.signal }); }
      catch (e) { if (!signal?.aborted && ctl.signal.aborted) throw Object.assign(new Error('timeout'), { name: 'TimeoutError' }); throw e; }
      finally { clearTimeout(tm); signal?.removeEventListener('abort', off); }
      if (![502, 503, 504, 546].includes(r.status) || i >= 2 || NO_RETRY.has(action)) break;   // v5.20: «база занята» (busy) сервер уже повторил — приходит 500, не повторяем
    } catch (e) {
      trace.st = `err ${e.name || ''} ${i}`;
      if (signal?.aborted || e.name === 'AbortError') throw e;
      if (e.name === 'TimeoutError') throw Object.assign(new Error(NET_MSG), { net: true });   // уже ждали 45 с — не повторяем, сразу «Нет связи · Повторить»
      if (i >= 2 || NO_RETRY.has(action)) throw Object.assign(new Error(NET_MSG), { net: true });
    }
    await new Promise(ok => setTimeout(ok, i ? 2000 : 800));
  }
  trace.st = r.status; trace.ms = Date.now() - trace.t0;
  const data = await r.json().catch(() => ({ error: 'server', message: `Ошибка сервера (HTTP ${r.status})` }));
  if (['no_auth', 'no_access', 'expired', 'kicked', 'off'].includes(data.error)) throw Object.assign(new Error(data.message), { gate: data.error, data });
  if (data.error === 'need_pro') PLANS.pro(data.message);   // Архив, Реклама, Рассылки — в PRO и MAX
  if (!r.ok || data.error) throw Object.assign(new Error(data.message || data.error || `HTTP ${r.status}`), { data });
  return data;
}
function toast(t, ms = 2600) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, ms); }

// ---------- вход и регистрация ----------
function gate(html) { $('#gate').innerHTML = html; $('#gate').hidden = false; $('#app').hidden = true; }
const docs = '<a href="oferta.html" target="_blank">оферты</a>, <a href="rules.html" target="_blank">правил</a> и <a href="privacy.html" target="_blank">политики конфиденциальности</a>';

function showLogin(reason, tab = 'login') {
  token = null; store.set('token', null); auth = null;
  if (tg?.initData && reason === 'kicked') {   // Mini App: вошли на другом устройстве — здесь вышли; войти снова можно без пароля
    gate(`<p class="muted">Выполнен вход на другом устройстве — здесь вы вышли.</p><button class="btn primary" id="tg-again">Войти снова</button>`);
    $('#tg-again').onclick = async () => { if (await tgLogin()) start(); };
    return;
  }
  const why = { expired: 'Доступ закончился. Войдите снова: если оплата открыта, продлите доступ сразу, иначе обратитесь к администратору.', no_access: 'Ваш Telegram не одобрен в боте. Войдите по логину и паролю.', kicked: 'Выполнен вход на другом устройстве — войдите снова.',
    off: 'Доступ закрыт — обратитесь к администратору.', no_auth: '' }[reason] ?? reason ?? '';   // не код из списка — готовый текст (второй шаг входа, вход админа в Mini App)
  gate(`<div data-brand></div>
    <div class="tabs2"><button class="seg ${tab === 'login' ? 'on' : ''}" data-tab="login">Вход</button><button class="seg ${tab === 'reg' ? 'on' : ''}" data-tab="reg">Регистрация</button></div>
    ${why ? `<p class="muted">${esc(why)}</p>` : ''}
    ${tab === 'login' ? `<form id="login" class="form">
      <input name="login" placeholder="Логин" autocomplete="username" autocapitalize="none" required>
      <input name="password" type="password" placeholder="Пароль" autocomplete="current-password" required>
      <button class="btn primary" type="submit">Войти</button>
      <p class="err" id="gerr"></p></form>
      <p><a href="#" id="pw-forgot">Забыли пароль? Восстановить через Telegram</a></p>
      <p class="hint">Сайт для риелторов: проверенные объекты от собственников Сочи.<br>Нет логина — зарегистрируйтесь по коду партнёра.</p>`
    : `<form id="reg" class="form">
      <input name="code" placeholder="Код партнёра" value="${esc(new URLSearchParams(location.search).get('r') ?? '')}" autocomplete="off" autocapitalize="characters">
      <p class="hint">Регистрация — только по коду партнёра. Попросите код у друга, который порекомендовал сервис: на сайте ему нужно нажать на своё имя вверху страницы → «Профиль» → блок «Код партнёра». Код есть у тех, кто оплатил подписку.</p>
      <input name="name" placeholder="Имя и фамилия" required>
      <input name="phone" type="tel" placeholder="Телефон" required>
      <input name="telegram" placeholder="Telegram: @имя_пользователя" autocapitalize="none" autocomplete="off" required>
      <details class="tip"><summary>Зачем и где посмотреть свой @ник?</summary><p class="hint">К вашему Telegram подключится бот «Для Агента»: туда придут уведомления о рассылках, ответах собственников и откликах клиентов на подборки, а ещё через него восстанавливается пароль.<br><b>Где посмотреть:</b> Telegram → «Настройки» → строка «Имя пользователя» (начинается с @). Если там пусто — нажмите и придумайте, это минута.<br>Нет Telegram, но есть код партнёра? Установите Telegram и зарегистрируйтесь или <a href="support.html" target="_blank">напишите в поддержку</a> — поможем.</p></details>
      <input name="email" type="email" placeholder="E-mail (необязательно)">
      <input name="company" placeholder="Агентство (необязательно)">
      <input name="login" placeholder="Придумайте логин (латиница)" autocapitalize="none" required>
      <input name="password" type="password" placeholder="Придумайте пароль (от 6 символов)" autocomplete="new-password" required>
      <label class="chk"><input type="checkbox" name="agree" required> <span>Принимаю условия ${docs}</span></label>
      <button class="btn primary" type="submit">Зарегистрироваться</button>
      <p class="err" id="gerr"></p></form>`}`);
  $('#gate').querySelectorAll('.tabs2 [data-tab]').forEach(b => b.onclick = () => showLogin(reason, b.dataset.tab));   // v5.23e: только вкладки окна входа — у меню «Мои подборки» свои [data-tab]
  $('#login')?.addEventListener('submit', async e => {
    e.preventDefault();
    const fm = e.target, btn = fm.querySelector('button');
    btn.disabled = true; $('#gerr').textContent = '';
    try {
      const r = await call('login', { login: fm.login.value, password: fm.password.value, fp: await fp() });
      if (r.need_code) return MFA.ask(r, { call, gate, fp, done: t => { token = t; store.set('token', token); auth = { token }; start(); }, back: m => showLogin(m) });   // админ со вторым шагом (site/mfa.js)
      token = r.token; store.set('token', token); auth = { token }; start();
    } catch (err) {
      if (err.data?.pay) return payGate(err.data.pay, err.message);   // доступ истёк или заявка не одобрена — можно оплатить сразу
      $('#gerr').textContent = err.message; btn.disabled = false;
    }
  });
  $('#pw-forgot')?.addEventListener('click', e => { e.preventDefault(); pwForgot(); });
  $('#reg')?.addEventListener('submit', async e => {
    e.preventDefault();
    const fm = e.target, btn = fm.querySelector('button');
    btn.disabled = true; $('#gerr').textContent = '';
    try {
      const r = await call('register', Object.fromEntries(['code', 'name', 'phone', 'telegram', 'email', 'company', 'login', 'password'].map(k => [k, fm[k].value]).concat([['agree', fm.agree.checked]])));
      if (r.token) { token = r.token; store.set('token', token); auth = { token }; return botStep(); }   // по коду партнёра — сразу вход, затем бот
      gate(`<h2>Заявка отправлена</h2><p>${esc(r.message)}</p><p class="hint">После одобрения подключите бот: имя вверху → «Профиль» → «Привязать Telegram».</p><button class="btn ghost" id="back">Ко входу</button>`);
      $('#back').onclick = () => showLogin();
    } catch (err) { $('#gerr').textContent = err.message; btn.disabled = false; }
  });
}
function logout(reason) { token = null; auth = null; store.set('token', null); showLogin(typeof reason === 'string' ? reason : undefined); }   // v5.46a: текст на экране входа («Профиль удалён»)
// Mini App (кнопка «Сайт» в боте): initData → токен своей сессии, как вход по паролю
async function tgLogin() {
  try { const r = await call('tg_login', { auth: tg.initData, fp: await fp() }); token = r.token; store.set('token', token); auth = { token }; return true; }
  catch (e) {
    if (e.data?.error === 'no_reg') { botReg(e.data.bot, e.message); return false; }   // v5.46a: Telegram без учётки — регистрация в боте, учётка сама не заводится
    if (e.data?.pay) payGate(e.data.pay, e.message); else showLogin(e.gate || (e.data ? e.message : 'no_auth')); return false;
  }   // текст сервера: админу Mini App закрыт, «Слишком часто…»
}
// v5.46a: Mini App без учётки — кнопка в бот с кодом партнёра (из ?r= или из ссылки бота), там регистрация одной кнопкой
function botReg(bot, msg) {
  const code = (new URLSearchParams(location.search).get('r') || tg?.initDataUnsafe?.start_param || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 12);
  const url = bot ? `https://t.me/${encodeURIComponent(bot)}?start=${code ? 'r_' + code : 'reg'}` : '';
  gate(`<div data-brand></div><h2>Регистрация</h2><p class="muted">${esc(msg)}</p>
    ${url ? `<p><a class="btn primary" id="bot-reg" href="${esc(url)}" target="_blank" rel="noopener">✈️ Зарегистрироваться в боте</a></p>` : ''}
    <p><button class="btn ghost" id="to-login">У меня есть логин и пароль</button></p>`);
  $('#bot-reg')?.addEventListener('click', e => { if (tg?.openTelegramLink) { e.preventDefault(); tg.openTelegramLink(url); tg.close?.(); } });
  $('#to-login').onclick = () => showLogin();
}
// v5.46a: одноразовая ссылка входа из бота (?k=<код>, 10 минут): код убирается из адреса сразу, чтобы не остался в истории и закладках
async function linkLogin(k) {
  const u = new URL(location.href); u.searchParams.delete('k'); history.replaceState(null, '', u);
  try { const r = await call('link_login', { k, fp: await fp() }); token = r.token; store.set('token', token); auth = { token }; return true; }
  catch (e) { if (e.data?.pay) payGate(e.data.pay, e.message); else showLogin(e.message); return false; }
}
// v5.26: после регистрации — подключить бот одним нажатием (ссылка t.me/<бот>?start=l_<код> привязывает Telegram к учётке)
async function botStep() {
  let link = null; try { link = await call('tg_link'); } catch { /* бот выключен — пропускаем шаг */ }
  if (!link?.url) return start();
  gate(`<div data-brand></div><h2>Последний шаг — подключите бот</h2>
    <p>Нажмите кнопку — откроется Telegram, нажмите там «Запустить» (Start). Бот пришлёт уведомления о рассылках, ответах собственников и откликах клиентов на подборки, через него же восстанавливается пароль.</p>
    <p><a class="btn primary" id="bot-go" href="${esc(link.url)}" target="_blank" rel="noopener">✈️ Подключить бот @${esc(link.bot)}</a></p>
    <p><button class="btn ghost" id="bot-skip">Позже — в «Профиле»</button></p><p class="hint">Ссылка действует 10 минут.</p>`);
  $('#bot-go').onclick = () => setTimeout(() => { $('#bot-skip').textContent = 'Готово — на сайт'; }, 800);
  $('#bot-skip').onclick = () => start();
}
// v5.26: «Забыли пароль?» — код из Telegram-бота (на привязанный Telegram), затем новый пароль и сразу вход
function pwForgot(who = '') {
  gate(`<div data-brand></div><h2>Восстановление пароля</h2>
    <form id="pw1" class="form"><input name="who" placeholder="Логин или @ник в Telegram" value="${esc(who)}" autocapitalize="none" required>
      <button class="btn primary" type="submit">Прислать код в Telegram</button><p class="err" id="gerr"></p></form>
    <p class="hint">Код придёт в бот «Для Агента», если ваш Telegram к нему привязан. Не привязан — <a href="support.html" target="_blank">напишите в поддержку</a>.</p>
    <p><a href="#" id="pw-back">← Ко входу</a></p>`);
  $('#pw-back').onclick = e => { e.preventDefault(); showLogin(); };
  $('#pw1').onsubmit = async e => {
    e.preventDefault(); const w = e.target.who.value.trim(), btn = e.target.querySelector('button'); btn.disabled = true;
    try {
      const r = await call('pw_reset', { who: w });
      gate(`<div data-brand></div><h2>Введите код из Telegram</h2><p class="muted">${esc(r.message)}</p>
        ${r.bot ? `<p><a class="btn soft" href="https://t.me/${esc(r.bot)}" target="_blank" rel="noopener">Открыть бот @${esc(r.bot)}</a></p>` : ''}
        <form id="pw2" class="form"><input name="code" placeholder="Код из 6 цифр" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required>
          <input name="password" type="password" placeholder="Новый пароль (от 6 символов)" autocomplete="new-password" minlength="6" required>
          <button class="btn primary" type="submit">Сменить пароль и войти</button><p class="err" id="gerr"></p></form>
        <p><a href="#" id="pw-again">Прислать код ещё раз</a> · <a href="#" id="pw-back">Ко входу</a></p>`);
      $('#pw-back').onclick = ev => { ev.preventDefault(); showLogin(); };
      $('#pw-again').onclick = ev => { ev.preventDefault(); pwForgot(w); };
      $('#pw2').onsubmit = async ev => {
        ev.preventDefault(); const fm = ev.target, b2 = fm.querySelector('button'); b2.disabled = true; $('#gerr').textContent = '';
        try {
          const x = await call('pw_reset_set', { who: w, code: fm.code.value, password: fm.password.value, fp: await fp() });
          if (x.token) { token = x.token; store.set('token', token); auth = { token }; toast('Пароль изменён'); return start(); }
          showLogin(x.message || 'Пароль изменён — войдите с новым паролем');
        } catch (er) { $('#gerr').textContent = er.message; b2.disabled = false; }
      };
    } catch (er) { $('#gerr').textContent = er.message; btn.disabled = false; }
  };
}
// отпечаток браузера для «Активных устройств» и защиты партнёрки: хеш общих свойств браузера, не личные данные
async function fp() {
  const s = [navigator.userAgent, navigator.language, Intl.DateTimeFormat().resolvedOptions().timeZone, `${screen.width}x${screen.height}x${screen.colorDepth}`, navigator.hardwareConcurrency, navigator.platform, window.PARTNER?.cv?.() ?? ''].join('|');   // + хеш canvas (partner.js, защита партнёрки)
  try { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join(''); } catch { return ''; }
}

async function start() {
  window.__stage = 'start';   // v5.26d: этап запуска — виден на «Загрузка…» через 15 с (tg.js)
  tg?.ready(); tg?.expand(); try { tg?.disableVerticalSwipes?.(); } catch { /* старый Telegram */ }
  const lk = new URLSearchParams(location.search).get('k');
  if (lk && !(await linkLogin(lk))) return;   // v5.46a: вход по ссылке из бота — и поверх старого входа (другая учётка в этом браузере)
  if (!auth && tg?.initData && !(await tgLogin())) return;
  if (!auth) return showLogin(undefined, location.search.includes('r=') ? 'reg' : 'login');   // ссылка партнёра ?r=код — сразу регистрация
  window.__stage = 'init'; try { meta = await call('init'); window.__stage = 'init ok'; }
  catch (e) {
    if (e.gate) return showLogin(e.gate);
    gate(`<h2>${e.net ? 'Нет связи' : 'Ошибка'}</h2><p>${esc(e.message)}</p><button class="btn primary" id="again">Повторить</button>`);
    return $('#again').onclick = () => start();
  }
  me = meta.me;
  if (me.exonly) { location.replace('excl.html#exonly'); return; }   // v5.48 G: доступ кончился, вход через Telegram — открыт только раздел «Эксклюзивы»
  // v5.26f (iPhone, приложение с экрана «Домой»: «этап: init ok», а сайт не открывался — один из модулей падал, и запуск обрывался):
  // каждый модуль подключается отдельно — сбой одного не держит сайт на «Загрузка…», ошибка уходит в отчёт (tg.js → window.__diag)
  const safe = (name, fn) => { window.__stage = name; try { fn(); } catch (e) { (window.__errs ??= []).push(`${name}: ${e?.message ?? e}`); console.error(name, e); } };
  safe('GUEST', () => { if (me.guest) GUEST.use(me); });   // гостевой доступ: только посмотреть (site/guest.js)
  safe('PLANS', () => { PLANS.use({ call, sheet, toast }, meta); });
  const avatar = url => { $('#go-prof .who-ph')?.remove(); if (url) $('#go-prof').insertAdjacentHTML('afterbegin', `<img class="who-ph" src="${esc(url)}" alt="" width="28" height="28">`); };   // v5.46a: фото профиля в шапке
  safe('AVATAR', () => avatar(me.photo));
  safe('PROFILE', () => { PROFILE.use({ call, sheet, toast, logout, photo: avatar, saved: name => { me.name = name; $('#who').textContent = name || me.login; } }); });
  safe('NOTIFY', () => { NOTIFY.start({ call, sheet, toast }, meta); });   // окно уведомлений, Telegram и push в профиле, «На экран Домой» (site/notify.js)
  safe('CRM', () => { CRM.use({ call, sheet, closeSheet, toast, openItem, selStart, pickSheet, photo: x => photoUrl(x, 0) }, meta); });   // клиенты и задачи (site/crm.js, шаг 3.4)
  safe('LINKS', () => { window.LINKS?.use({ call, sheet, closeSheet, toast, me: () => me, agent: () => !!me && !me.guest }); });   // v5.23c: связи под карточкой — собственник, подборки, клиенты (site/links.js)
  safe('RK', () => { window.RK?.use({ sheet, closeSheet, toast, auth: () => auth }); });   // «Реклама»: черновики на площадках (site/reklama/rk.js, шаг 4.1)
  safe('ADMIN', () => { ADMIN.use({ call, sheet, toast, setToken: t => { token = t; store.set('token', t); auth = { token: t }; }, saved: x => { if (x?.features) { meta.features = x.features; renderFilters(); } } }); });
  window.__stage = 'prefs';
  try {   // v5.26f: сохранённые настройки с ошибкой — не повод не открыть сайт
  const p = me.prefs;
  if (p && typeof p === 'object') {
    if (p.f && typeof p.f === 'object') f = p.f;
    if (typeof p.text === 'string') text = p.text;
    if (typeof p.sort === 'string') sort = p.sort;
    if (p.lay && typeof p.lay === 'object') lays = fixLays(p.lay);
    if (p.fv === FV && typeof p.fclosed === 'boolean') fclosed = p.fclosed;
    if (p.fv === FV && typeof p.fside === 'boolean') fside = p.fside;
    if (p.client && typeof p.client === 'object') client = { on: !!p.client.on, cm: +p.client.cm || 0 };
  }
  if (Array.isArray(f.fin)) {   // старые сохранённые «дизайнерский / евро / современный» → «С ремонтом»
    f.fin = [...new Set(f.fin.map(x => ['designer', 'euro', 'modern'].includes(x) ? 'repair' : x))].filter(x => FIN.some(([k]) => k === x));
    if (!f.fin.length) delete f.fin;
  }
  if (Array.isArray(f.d)) {   // районы прежних версий («c», «m4», «mkr:Сочи Мамайка мкр») → ключи нового дерева; неизвестные убираем
    const known = new Set((meta.regions ?? []).flatMap(r => [r.k, ...r.subs.map(s => s[0])]));
    const subOf = m => { const s = String(m).replace(/^mkr:\S+\s+/, '').replace(/\s+мкр$/, '').replace(/\s+(Целинная|Теневой)$/, ''); return known.has('s:' + s) ? 's:' + s : null; };
    f.d = [...new Set(f.d.map(k => OLD_AREAS[k] ?? (String(k).startsWith('mkr:') ? subOf(k) : k)).filter(k => k && known.has(k)))];
    if (!f.d.length) delete f.d;
  }
  } catch (e) { (window.__errs ??= []).push(`prefs: ${e?.message ?? e}`); console.error('prefs', e); }
  window.__stage = 'show'; document.title = 'Для Агента — объекты от собственников Сочи';
  $('#gate').hidden = true; $('#app').hidden = false;
  $('#who').textContent = me.name || me.login;
  if (me.role === 'admin') { $('#until').textContent = me.login === 'admin' ? 'главный администратор' : 'администратор'; $('#go-admin').hidden = false; $('#go-hidden').hidden = false; }
  else if (me.main) $('#until').textContent = 'группа Main · без лимитов';   // v5.37a
  if (me.main) { $('#go-hidden').hidden = false; $('#go-mod').hidden = false; }   // v5.37a: группа Main — модерация объявлений и жалоб (админка — только у админа)
  else if (me.expires_at) {
    const d = new Date(me.expires_at), left = Math.ceil((d - Date.now()) / 864e5);
    $('#until').textContent = `${me.plan_name} · до ${d.toLocaleDateString('ru-RU')}${left <= 5 ? ` · осталось ${left} дн.` : ''}`;
    $('#until').classList.toggle('warn', left <= 5);
  }
  PLANS.counter(me.used);   // «Сегодня 7 из 20 · В месяц 43 из 100»
  $('#logout').hidden = !!me.tg;
  $('#go-pay').hidden = !meta.pay?.enabled;
  $('#go-map').hidden = !meta.features.map;
  document.querySelectorAll('[data-go="favs"]').forEach(b => b.hidden = !meta.features.favorites);
  document.querySelectorAll('[data-go="deals"]').forEach(b => b.hidden = !meta.features.deals);
  document.querySelectorAll('[data-go="sels"]').forEach(b => b.hidden = !meta.features.selections);
  document.querySelectorAll('[data-go="crm"]').forEach(b => b.hidden = !meta.features.crm || me.guest);
  document.querySelectorAll('[data-go="pick"]').forEach(b => b.hidden = meta.features.pick === false || me.guest);   // v5.48 H9: «🔗 Клиент выбирает сам» (features.pick)
  mgSync();
  // «Реклама», «Рассылки» и «Архив 2 года» видны всем: без PRO/MAX вместо содержимого — описание и «Оформить PRO» (PLANS.locked)
  clientUi();
  // ссылки из новых разделов (v5.15): ./?q=<запрос> — сразу этот поиск; #o=<номер> — сразу объявление
  const qp = new URLSearchParams(location.search).get('q');
  if (qp) { text = qp.slice(0, 300); history.replaceState(null, '', location.pathname + location.hash); }
  $('#q').value = text; $('#sort').value = sort;
  openF(!mobile() && !fclosed); sideUi();
  FUI.help(); renderFilters(); selbar(); applyLay();
  if (!EMBED) search();
  if (location.hash === '#admin' && me.role === 'admin') { sheetGo = 'admin'; admin(); }   // прямая ссылка на админ-панель: …/#admin
  if (/^#client=\d+$/.test(location.hash) && meta.features.crm && !me.guest) { sheetGo = 'crm'; CRM.openClient(+location.hash.slice(8)); history.replaceState(null, '', location.pathname + location.search); }   // v5.48 H9: «Клиент: Имя» со страницы ссылки
  if (/^#(crm|task=\d+)$/.test(location.hash) && meta.features.crm && !me.guest) { sheetGo = 'crm'; CRM.open(location.hash); }   // напоминание о задаче: …/#task=<id>
  if (/^#rk(=\w+)?$/.test(location.hash) && me.can_rk && !me.guest && window.RK) { sheetGo = 'rk'; RK.open(location.hash); }
  // «📄 Сформировать подборку» из «Моего помощника» (v5.16): объекты уже в store 'sel', комиссия — 'sel_cm'
  if (location.hash === '#selmake' && sel.size && !me.guest) {
    history.replaceState(null, '', location.pathname + location.search);
    selStart([...sel], '', null);
    const cm = store.get('sel_cm', null); store.set('sel_cm', null);
    if (cm != null && $('#s-mk')) { $('#s-mk').value = cm; $('#s-mk').dispatchEvent(new Event('input', { bubbles: true })); }
  }   // «Реклама»: …/#rk, #rk=daily
  if (/^#sels=(all|own|fb|ex|pick|main)$/.test(location.hash) && !me.guest) showSelections(location.hash.slice(6));   // v5.23: «Мои подборки» с вкладкой из меню других страниц
  if (/^#o=\d{6,7}$/.test(location.hash)) openItem(+location.hash.slice(3));
  HUB.rate(); HUB.ping();   // курс ЦБ для цен в рублях; «на сайте» раз в минуту — для сводки админки (онлайн, устройства)
  PLANS.seatNote();   // в очереди на место в PRO/MAX и место освободилось
}

// ---------- фильтры ----------
const arr = k => Array.isArray(f[k]) ? f[k] : [];
function toggleIn(k, v) { const s = new Set(arr(k)); s.has(v) ? s.delete(v) : s.add(v); f[k] = [...s]; if (!f[k].length) delete f[k]; }
function chipRow(el, list, key, off = () => '') {   // off(v) — почему вариант сейчас неактивен (несовместим с выбранным)
  el.innerHTML = list.map(([v, t]) => { const why = off(v);
    return `<button type="button" class="chip${arr(key).includes(v) ? ' on' : ''}" data-v="${esc(v)}"${why ? ` disabled title="${esc(why)}"` : ''}>${esc(t)}</button>`; }).join('');
  el.onclick = e => { const b = e.target.closest('[data-v]'); if (!b || b.disabled) return; toggleIn(key, typeof list[0][0] === 'number' ? +b.dataset.v : b.dataset.v); fchg(); };
}
const REPAIR_MSG = 'Функция экспериментальная: отсеивает около 2/3 объявлений со старым ремонтом, но может убрать и хорошие варианты';
// несовместимое уже выбранное снимаем с пояснением: у участков нет комнат, этажа, отделки и ФЗ-214; студии — только у квартир и апартаментов
function compatFix() {
  const c = FUI.compat(f), gone = ['r', 'fmin', 'fmax', 'nf', 'nl', 'fin', 'fz', 'm'].filter(k => c.land && f[k] !== undefined);
  gone.forEach(k => delete f[k]);
  if (gone.length) toast('У участков нет комнат, этажа и отделки — эти фильтры сняты', 4000);
  const fgone = ['fmin', 'fmax', 'nf', 'nl'].filter(k => c.nofloor && f[k] !== undefined);   // v5.46 D: дома без этажа
  fgone.forEach(k => delete f[k]);
  if (fgone.length && !gone.length) toast('У домов и таунхаусов нет этажа — фильтр этажа снят', 4000);
  if (!c.studio && arr('r').includes(0)) { toggleIn('r', 0); toast('«Студия» снята: студии бывают только у квартир и апартаментов', 4000); }
  if (!c.nf && f.nf) { delete f.nf; if (!c.nofloor) toast('«Не первый» снят: этаж «до 1» — это только первый этаж', 4000); }
  return c;
}
function renderFilters() {
  window.FILTER_PRESETS?.mount($('#qform').parentElement,'search',()=>({f,text,sort}),v=>{f=v.f||{};text=String(v.text||'');sort=v.sort||'new';$('#q').value=text;renderFilters();changed();});
  const c = compatFix(), land = c.land ? 'У участков этого нет' : '';
  chipRow($('#f-kind'), KINDS, 'k');
  chipRow($('#f-rooms'), ROOMS, 'r', v => land || (v === 0 && !c.studio ? 'Студии бывают только у квартир и апартаментов' : ''));
  chipRow($('#f-fin'), FIN, 'fin', () => land);
  $('#f-fin [data-v="repair"]')?.classList.add('yel');   // включённый «С ремонтом» — жёлтый: функция пробная
  // «Дизайнерский» — по фото (пока «скоро»: включается в админке, когда база проверена)
  const modernOn = meta.features.modern_filter;
  $('#f-fin').insertAdjacentHTML('beforeend', `<button type="button" class="chip${f.m ? ' on' : ''}" data-k="m" ${modernOn && !land ? '' : `disabled title="${modernOn ? land : 'Скоро: дизайнерский ремонт будет определяться по фото'}"`}>Дизайнерский${modernOn ? '' : '<small>скоро</small>'}</button>`);
  const finClick = $('#f-fin').onclick;
  $('#f-fin').onclick = e => {
    const b = e.target.closest('[data-k]');
    if (!b) { const was = arr('fin').includes('repair'); finClick(e); if (!was && arr('fin').includes('repair')) toast(REPAIR_MSG, 7000); return; }
    if (!b.disabled) { f.m = !f.m || undefined; fchg(); }
  };
  const flags = [['pool', 'Бассейн'], ['fz', 'ФЗ-214'], ['uniq', 'Только уникальные'], ['unseen', 'Непросмотренные'], ['fav', '★ Избранное'], ['deal', '🤝 Контакт']]
    .filter(([k]) => (k !== 'fav' || meta.features.favorites) && (k !== 'deal' || (meta.features.deals && !client.on)));
  $('#f-flags').innerHTML = flags.map(([k, t]) => `<button type="button" class="chip${f[k] ? ' on' : ''}" data-k="${k}"${k === 'fz' && land ? ` disabled title="${land}"` : ''}>${t}</button>`).join('');
  $('#f-flags').onclick = e => { const b = e.target.closest('[data-k]'); if (!b || b.disabled) return; f[b.dataset.k] = !f[b.dataset.k] || undefined; fchg(); };
  // объявления собственников, взятые напрямую с площадок: галочка снята — таких не показывать (база собственников — всегда)
  // «Дополнительный поиск с рекламных источников»: одна галочка, по умолчанию снята (названия площадок не показываем)
  $('#f-ext').checked = !!f.ext;
  if ($('#f-ex')) { $('#f-ex').checked = !!f.ex; $('#f-ex').onchange = () => { f.ex = $('#f-ex').checked || undefined; fchg(); }; }   // v5.48 G: эксклюзивы коллег в выдаче и на карте
  $('#f-ext').onchange = () => { f.ext = $('#f-ext').checked || undefined; fchg(); };
  // поле, в котором сейчас печатают, не трогаем: иначе цена «12» на полуслове превращалась в «12.000.000»
  const put = (k, v) => { const el = $('#' + k); if (el !== document.activeElement) el.value = v; };
  for (const k of ['amin', 'amax', 'fmin', 'fmax']) put(k, f[k] ?? '');
  $('#nf').checked = !!f.nf; $('#nl').checked = !!f.nl; $('#nold').checked = !!f.nold;
  for (const k of ['pmin', 'pmax']) put(k, f[k] ? mlnTxt(f[k]) : '');
  for (const k of ['fmin', 'fmax', 'nl']) $('#' + k).disabled = c.nofloor;
  $('#nf').disabled = !c.nf;
  $('#fmin').closest('.fcell').classList.toggle('off', c.nofloor);
  FUI.pairs(f);
  $('#sea').value = f.sea ?? '';
  const nd = arr('d').length, nz = arr('zk').length;
  $('#open-areas').textContent = nd ? `${arr('d').map(areaName).slice(0, 2).join(', ')}${nd > 2 ? ` +${nd - 2}` : ''}` : 'Район';
  $('#open-areas').classList.toggle('on', !!nd);
  $('#open-zk').textContent = nz === 1 ? `ЖК ${zkById(arr('zk')[0])?.name ?? ''}`.trim() : nz ? `ЖК: ${nz}` : 'ЖК';
  $('#open-zk').classList.toggle('on', !!nz);
  { let h = $('#pick-hint'); if (!h) { h = document.createElement('p'); h.id = 'pick-hint'; h.className = 'zk-hint small'; $('#open-zk').parentElement.after(h); }
    const t = zkHint(); h.hidden = !t; h.textContent = t; }   // v5.41: «ЖК сужает свой район» — видно без инструкции
  // v5.42B: каждое выбранное место и ЖК — значком с ✕ прямо в фильтре, снять без захода в список
  { let pk = $('#f-picked'); if (!pk) { pk = document.createElement('div'); pk.id = 'f-picked'; pk.className = 'f-picked'; $('#pick-hint').before(pk);
      pk.onclick = e => { const b = e.target.closest('[data-un]'); if (!b) return; const [key, v] = [b.dataset.un, b.dataset.v];
        f[key] = arr(key).filter(x => String(x) !== v); if (!f[key].length) delete f[key]; fchg(); }; }
    pk.innerHTML = [...arr('d').map(k => [`d`, k, `📍 ${areaName(k)}`]), ...arr('zk').map(id => ['zk', id, `🏢 ЖК ${zkById(id)?.name ?? id}`])]
      .map(([key, v, l]) => `<button type="button" class="chip on" data-un="${key}" data-v="${esc(String(v))}" title="Убрать">${esc(l)} <b aria-hidden="true">✕</b></button>`).join('');
    pk.hidden = !pk.innerHTML; }
  const n = Object.keys(f).filter(k => k !== 'al' && f[k] !== undefined && !(Array.isArray(f[k]) && !f[k].length)).length;
  // улица или дом из подсказки строки поиска — значок под строкой, ✕ снимает
  $('#q-place').innerHTML = f.a ? `<button type="button" class="chip on" data-x="a">📍 ${esc(f.al || 'улица')} ✕</button>` : '';
  $('#fcount').textContent = n ? `(${n})` : '';
  // v5.16: счётчики «Ещё фильтры» и кнопки «⚙ Фильтр» (когда фильтр скрыт)
  const nm = ['fin', 'm', 'pool', 'fz', 'uniq', 'unseen', 'fav', 'deal', 'ext'].filter(k => f[k] !== undefined && !(Array.isArray(f[k]) && !f[k].length)).length;
  $('#f-more-n').textContent = nm; $('#f-more-n').hidden = !nm;
  if (nm && !renderFilters.opened) { $('#f-more').open = true; renderFilters.opened = true; }
  $('#bar-fn').textContent = n; $('#bar-fn').hidden = !n;
  $('#f-reset').hidden = !n && !text;   // v5.24a: маленькая «Сброс» между «Фильтры» и «Сверху» — когда что-то выбрано
  fitF();
}
// цена в рублях с точками: 12.000.000; число меньше 1000 — миллионы («12» → 12.000.000). В фильтре цена хранится в миллионах.
const dots = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const rubOf = s => { const v = +String(s).replace(/\D/g, ''); return v > 0 && v < 1000 ? v * 1e6 : v; };
// v5.22: цена в фильтрах — в миллионах рублей: «5», «12,5» (больше 1000 — значит, ввели рубли)
const mlnOf = s => { const v = parseFloat(String(s ?? '').replace(/\s/g, '').replace(',', '.')); return !(v > 0) ? 0 : v >= 1000 ? v / 1e6 : Math.round(v * 1000) / 1000; };
const mlnTxt = v => String(Math.round(v * 1000) / 1000).replace('.', ',');
const mlnIn = e => { e.target.value = e.target.value.replace(/[^\d.,]/g, '').replace('.', ','); };
function readInputs() {
  for (const k of ['amin', 'amax', 'fmin', 'fmax']) { const v = +$('#' + k).value; if (v > 0) f[k] = v; else delete f[k]; }
  for (const k of ['pmin', 'pmax']) { const v = mlnOf($('#' + k).value); if (v > 0) f[k] = v; else delete f[k]; }
  f.nf = $('#nf').checked || undefined; f.nl = $('#nl').checked || undefined; f.nold = $('#nold').checked || undefined;   // «не старый фонд» — без домов до 1990
  f.sea = +$('#sea').value || undefined;
}
for (const k of ['pmin', 'pmax']) {
  $('#' + k).addEventListener('input', mlnIn);
  $('#' + k).addEventListener('blur', e => { const v = mlnOf(e.target.value); e.target.value = v ? mlnTxt(v) : ''; readInputs(); });
}
// поля сразу попадают в фильтр (иначе нажатие на кнопку фильтра стирало набранное), поиск — через 0,5 с после последней цифры
for (const k of ['amin', 'amax', 'fmin', 'fmax', 'pmin', 'pmax']) $('#' + k).addEventListener('input', () => { readInputs(); later(); });
for (const k of ['nf', 'nl', 'nold', 'sea']) $('#' + k).addEventListener('change', () => { readInputs(); fchg(); });
// 🎤 в строке поиска (v5.15, v5.16): голос → «Мой помощник». Слушает, пока человек говорит (паузы до 4 с не обрывают; HUB.voice), стоп — повторное нажатие
// v5.48 F: голос в строке поиска — сразу в окно ИИ-Агента на этой же странице (без перехода); нет окна — как раньше, в раздел Помощника
if (window.VOICE?.ok) {
  $('#q-mic').hidden = false;
  $('#q-mic').onclick = e => window.VOICE.start($('#q'), e.currentTarget, { onDone: t => { if (window.AGENT) { $('#q').value = ''; window.AGENT.ask(t); } else { store.set('helper_q', t); location.href = 'hub.html#helper'; } } });
}
$('#sea').innerHTML = '<option value="">Любое расстояние</option>' + SEA.map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
// на телефоне фильтры — окно на весь экран (страница под ним не прокручивается)
// v5.16: на компьютере фильтр слева уезжает влево плавно; карта подстраивает размер после раскладки
function openF(on) {
  const el = $('#filters');
  const apply = () => {
    el.classList.remove('fout');
    el.classList.toggle('closed', !on); document.body.classList.toggle('fopen', on && mobile());
    document.body.classList.toggle('fshown', on); fitF();
    [0, 300, 700].forEach(ms => setTimeout(() => map?.invalidateSize(), ms));
  };
  clearTimeout(openF.t);
  if (!on && !mobile() && fside && !el.classList.contains('closed') && !matchMedia('(prefers-reduced-motion: reduce)').matches) { el.classList.add('fout'); openF.t = setTimeout(apply, 200); }
  else apply();
}
// фильтр слева помещается в окно — прилипает при прокрутке; не помещается — листается вместе со страницей (своей полосы прокрутки нет)
function fitF() {
  const el = $('#filters');
  if (!el) return;
  el.classList.remove('fit');
  if (!mobile() && fside && !el.classList.contains('closed') && el.offsetHeight <= innerHeight - 86) el.classList.add('fit');
}
addEventListener('resize', () => { clearTimeout(fitF.t); fitF.t = setTimeout(fitF, 150); });
$('#f-more').addEventListener('toggle', () => { store.set('fmore', $('#f-more').open); fitF(); });
if (store.get('fmore', false)) $('#f-more').open = true;
$('#bar-f').onclick = () => { openF(true); fclosed = false; if (!mobile()) savePrefs(); };
$('#bar-reset').onclick = () => $('#reset').click();
$('#f-reset').onclick = () => $('#reset').click();
$('#f-tab').onclick = () => $('#bar-f').click();   // v5.24a: фильтр спрятан влево — полоска «›» на его месте достаёт его обратно
$('#toggle-f').onclick = () => { const on = $('#filters').classList.contains('closed'); openF(on); fclosed = !on; if (!mobile()) savePrefs(); };
// фильтр колонкой слева или блоком сверху (на компьютере; на телефоне — всегда окно на весь экран)
function sideUi() {
  document.body.classList.toggle('fside', fside);
  $('#f-close').textContent = mobile() || !fside ? '✕' : '⟨';
  $('#f-close').title = fside ? 'Скрыть фильтр влево' : 'Скрыть фильтр';
  $('#f-side').textContent = fside ? '⇧ Сверху' : '⇦ Слева';
  $('#f-side').title = fside ? 'Показывать фильтр блоком над объявлениями' : 'Показывать фильтр колонкой слева';
  fitF();
  setTimeout(() => map?.invalidateSize(), 50);
}
$('#f-side').onclick = () => { fside = !fside; sideUi(); savePrefs(); };
// любое изменение фильтра применяется само — через 0,5 с после последнего (кнопки «Применить» нет);
// на телефоне кнопка «Показать N» внизу окна только закрывает его: выдача к этому времени уже обновлена
function later(ms = 500) { clearTimeout(later.t); later.t = setTimeout(changed, ms); $('#apply').textContent = 'Показать …'; }
function fchg() { renderFilters(); later(); }
const flush = () => { if (later.t) changed(); };
$('#f-close').onclick = () => { readInputs(); flush(); openF(false); if (!mobile()) { fclosed = true; savePrefs(); } };   // «⟨» на компьютере — скрыть влево и запомнить
$('#apply').onclick = () => { readInputs(); flush(); openF(false); };
$('#reset').onclick = () => { if (favMode === 'deals') f = { deal: true }; else { f = {}; leaveFav(); } text = ''; $('#q').value = ''; renderFilters(); changed(); };   // v5.48 G: в «Контакте» сброс — фильтров внутри него
// «Ничего не нашлось»: «Сбросить его» — фильтр, который больше всего мешает; «Сбросить все» — все фильтры (текст запроса остаётся)
document.addEventListener('click', e => {
  const one = e.target.closest('[data-drop]'), all = e.target.closest('[data-drop-all]');
  if (!one && !all) return;
  if (one) one.dataset.drop.split(',').forEach(k => delete f[k]); else { f = {}; leaveFav(); }
  renderFilters(); changed();
});
$('#sort').onchange = () => { sort = $('#sort').value; savePrefs(); view === 'map' ? mapList() : search(); };
$('#qform').addEventListener('submit', e => { e.preventDefault(); readInputs(); $('#q').blur(); changed(); });
// поле запроса очистили (крестиком или стёрли) — сразу ищем без текста: раньше при пустом поле продолжал работать прошлый запрос
$('#q').addEventListener('input', () => { if (!$('#q').value.trim() && text) changed(); });
// подсказки: улица и дом — фильтр «a» (точная улица в любом написании), ЖК — фильтр ЖК, район — как в дереве районов; текст запроса очищается
SUGG.attach($('#q'), { load: (q, signal) => call('suggest', { q }, signal).then(r => r.items), pick: x => {
  if (favMode && favMode !== 'deals') { ({ f } = beforeFav); leaveFav(); }   // v5.48 G: в «Контакте» подсказка сужает сам «Контакт»
  delete f.a; delete f.al; delete f.zk; delete f.d;
  const i = x.key.indexOf(':'), kind = x.key.slice(0, i), v = x.key.slice(i + 1);
  if (kind === 'st' || kind === 'h') { f.a = x.key; f.al = x.name; }
  else if (kind === 'zk') f.zk = [+v];
  else f.d = [x.key];
  $('#q').value = ''; changed();
} });
$('#q-place').onclick = e => { if (e.target.closest('[data-x="a"]')) { delete f.a; delete f.al; changed(); } };
function changed() {
  clearTimeout(later.t); later.t = 0;
  text = $('#q').value.trim();   // запрос — всегда то, что сейчас в поле
  f = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && !(Array.isArray(v) && !v.length)));
  if (!favMode) savePrefs();
  renderFilters();
  view === 'map' ? loadMap() : search();
}
function leaveFav() { favMode = null; beforeFav = null; tabs(); }
function applyLay() {
  const l = lay();
  $('#list').classList.remove('l1', 'l3', 'l6'); $('#list').classList.add('l' + l);
  document.querySelectorAll('[data-lay]').forEach(b => b.classList.toggle('on', b.dataset.lay === l));
}
document.querySelectorAll('[data-lay]').forEach(b => b.onclick = () => { lays = { ...lays, v: 3, [mobile() ? 'm' : 'd']: b.dataset.lay }; applyLay(); savePrefs(); });

// окна: районы, ЖК
function sheet(title, html, wide = false) {
  $('#sheet-title').textContent = title; $('#sheet-body').innerHTML = html;
  $('#sheet').classList.toggle('wide', wide); $('#sheet').hidden = false; tg?.BackButton.show(); tabs();
  if (EMBED) parent.postMessage('objpop-ready', location.origin);   // своё «✕» окна объявления — у рамки своё прячем
}
function closeSheet() { if ($('#sheet').hidden) return; if (EMBED) parent.postMessage('objpop-close', location.origin); $('#sheet').hidden = true; sheetGo = null; tabs(); if ($('#viewer').hidden) tg?.BackButton.hide(); }
$('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet' || e.target.closest('[data-close]')) closeSheet(); });
tg?.BackButton.onClick(() => $('#viewer').hidden ? closeSheet() : closeViewer());
const opt = (name, value, label, checked, note = '', disabled = false) =>
  `<label class="opt${disabled ? ' dis' : ''}"><input type="checkbox" name="${name}" value="${esc(value)}"${checked ? ' checked' : ''}${disabled ? ' disabled' : ''}><span>${esc(label)}</span>${note !== '' ? `<em>${esc(note)}</em>` : ''}</label>`;
// названия районов и микрорайонов для кнопки «Район»
function areaName(k) {
  for (const r of meta.regions ?? []) { if (r.k === k) return r.name; const s = r.subs.find(x => x[0] === k); if (s) return s[1]; }
  return String(k).replace(/^(mkr|[dsz]):/, '');
}
// районы как в YGROUP: поиск, район раскрывается стрелкой, галочка на районе — весь район (его микрорайоны отмечены сами)
$('#open-areas').onclick = () => {
  const on = k => arr('d').includes(k), regs = meta.regions ?? [];
  const open = new Set(regs.filter(r => r.subs.some(s => on(s[0]))).map(r => r.k));
  sheet('Районы', `<input id="ar-find" type="search" placeholder="Поиск района" autocomplete="off"><div id="ar-tree" class="tree"></div>
    <div class="sheet-foot"><button class="btn ghost" id="s-clear">Сбросить</button><button class="btn primary" data-close>Применить</button></div>`);
  const draw = () => {
    const q = $('#ar-find').value.trim().toLowerCase().replace(/ё/g, 'е'), has = s => s.toLowerCase().replace(/ё/g, 'е').includes(q);
    $('#ar-tree').innerHTML = regs.map(r => {
      const subs = q && !has(r.name) ? r.subs.filter(s => has(s[1])) : r.subs;
      if (q && !subs.length && !has(r.name)) return '';
      const all = on(r.k);
      const zs = arr('zk').map(zkById).filter(Boolean), mark = l => l.length ? ` <b class="zk-mark" title="${esc(l.map(z => z.name).join(', '))}">ЖК: ${l.length}</b>` : '';
      const withMark = (html, k) => html.replace('</span>', mark(zs.filter(z => zkIn(z, [k]))) + '</span>');
      return `<div class="tr${q || open.has(r.k) ? ' open' : ''}" data-r="${esc(r.k)}"><div class="tr-h">
        ${r.subs.length ? '<button type="button" class="tr-t" data-t aria-label="Микрорайоны"></button>' : '<span class="tr-t none"></span>'}${withMark(opt('d', r.k, r.name, all, r.n || ''), r.k)}</div>
        ${subs.length ? `<div class="tr-subs">${subs.map(([k, name, n]) => withMark(opt('d', k, name, all || on(k), n ?? '', all), k)).join('')}</div>` : ''}</div>`;
    }).join('') || '<p class="muted">Не нашёл такой район</p>';
  };
  $('#ar-find').oninput = draw; draw();
  $('#sheet-body').onclick = e => {
    const t = e.target.closest('[data-t]'); if (!t) return;
    const k = t.closest('.tr').dataset.r; open.has(k) ? open.delete(k) : open.add(k); draw();
  };
  $('#sheet-body').onchange = e => {
    const i = e.target; if (i.name !== 'd') return;
    toggleIn('d', i.value);
    const r = regs.find(x => x.k === i.value);   // весь район отмечен — его микрорайоны отдельно не нужны
    if (r && on(r.k)) { f.d = arr('d').filter(k => !r.subs.some(s => s[0] === k)); if (!f.d.length) delete f.d; }
    fchg(); draw();
  };
  $('#s-clear').onclick = () => { delete f.d; fchg(); draw(); };
};
$('#open-zk').onclick = () => {
  // v5.47 E (Алексей, п. 8): «Готово» и сверху — рядом с поиском, полоса не уезжает при листании; ЖК, где меньше 7 предложений, — под «Показать остальные ЖК»
  sheet('ЖК', `<div class="zk-top"><input id="zk-find" type="search" placeholder="Найти ЖК"><button class="btn primary" data-close>Готово</button></div><p id="zk-hint" class="zk-hint" hidden></p><div id="zk-list"></div>
    <div class="sheet-foot"><button class="btn ghost" id="s-clear">Сбросить</button><button class="btn primary" data-close>Готово</button></div>`);
  // v5.41: выбраны районы — сверху ЖК этих районов, ниже свёрнуто «Другие ЖК»; поиск ищет везде; у каждого ЖК серым — где он
  let more = false, rest = false;
  const row = z => opt('zk', z.id, z.name, arr('zk').includes(z.id), z.n).replace('</span>', zkWhere(z) ? `<small class="zk-where">${esc(zkWhere(z))}</small></span>` : '</span>');
  const ZK_FEW = 7;   // меньше 7 предложений — свёрнуто (кроме отмеченных); при поиске видно всё
  const rows = (l, q) => { if (q) return l.map(row).join('');
    const big = l.filter(z => (z.n ?? 0) >= ZK_FEW || arr('zk').includes(z.id)), few = l.filter(z => !big.includes(z));
    if (!big.length) return l.map(row).join('');
    return big.map(row).join('') + (few.length ? `<details class="zk-rest"${rest ? ' open' : ''}><summary>Показать остальные ЖК (${few.length}) — меньше ${ZK_FEW} предложений</summary>${few.map(row).join('')}</details>` : ''); };
  const draw = () => {
    const q = $('#zk-find').value.trim().toLowerCase().replace(/ё/g, 'е');
    // v5.42B: больше предложений — выше (и в «ЖК в выбранных районах», и в «Других ЖК»)
    const list = meta.zk.filter(z => !q || z.name.toLowerCase().replace(/ё/g, 'е').includes(q)).sort((a, b) => (b.n ?? 0) - (a.n ?? 0) || a.name.localeCompare(b.name, 'ru'));
    const sel = arr('d'), split = sel.length && zkHasA();
    const hint = zkHint(); $('#zk-hint').hidden = !hint; $('#zk-hint').textContent = hint;
    if (!list.length) { $('#zk-list').innerHTML = '<p class="muted">Не нашёл такой ЖК</p>'; return; }
    const keep = () => $('#zk-list').querySelectorAll('.zk-rest').forEach(d => d.addEventListener('toggle', e => { rest = e.target.open; }));
    if (!split) { $('#zk-list').innerHTML = rows(list, q); keep(); return; }
    const inA = list.filter(z => zkIn(z, sel)), other = list.filter(z => !zkIn(z, sel));
    const open = more || !!q || !inA.length || other.some(z => arr('zk').includes(z.id));
    $('#zk-list').innerHTML = `<div class="zk-gh">ЖК в выбранных районах: ${esc(sel.map(areaName).join(', '))}</div>`
      + (rows(inA, q) || '<p class="muted">В выбранных районах ЖК не нашёл</p>')
      + (other.length ? `<details class="zk-other"${open ? ' open' : ''}><summary>Другие ЖК (${other.length})</summary>${other.map(row).join('')}</details>` : '');
    $('#zk-list').querySelector('.zk-other')?.addEventListener('toggle', e => { more = e.target.open; });
    keep();
  };
  $('#zk-find').oninput = draw; draw();
  bindChecks('zk', true);
  const ch = $('#sheet-body').onchange;   // подсказка сверху меняется сразу после галочки
  $('#sheet-body').onchange = e => { ch(e); const h = zkHint(); $('#zk-hint').hidden = !h; $('#zk-hint').textContent = h; };
};
// v5.41: где стоит ЖК (meta.zk[].a — ключи мест: d:район, s:микрорайон, z:зона). Пока сервер не прислал a — всё как раньше
const zkHasA = () => (meta?.zk ?? []).some(z => z.a?.length);
const zkById = id => (meta?.zk ?? []).find(z => z.id === id);
function parentOf(k) {
  for (const r of meta.regions ?? []) if (r.k === k || r.subs.some(s => s[0] === k)) return r.k;
  return null;
}
// ЖК подходит к выбранному месту: тот же ключ; к району — и ЖК в любом его микрорайоне
const zkIn = (z, keys) => keys.some(k => (z.a ?? []).includes(k) || (k.startsWith('d:') && (z.a ?? []).some(a => parentOf(a) === k)));
// подпись «Завокзальный · Центральный»: главный микрорайон и его район; ЖК на границе — «+1» (ещё район)
function zkWhere(z) {
  const a = z.a ?? [], s = a.find(k => k.startsWith('s:')), d = (s && parentOf(s)) || a.find(k => k.startsWith('d:'));
  const ds = new Set(a.filter(k => k.startsWith('d:'))); if (d) ds.delete(d);
  const l = [s, d].filter(Boolean).map(areaName);
  if (!l.length && a.length) l.push(areaName(a[0]));
  return l.join(' · ') + (ds.size ? ` +${ds.size}` : '');
}
// одна строка-подсказка, когда выбраны и районы, и ЖК: «Центральный → только Альпийский квартал · Хостинский — целиком»
function zkHint() {
  const sel = arr('d'), zs = arr('zk').map(zkById).filter(Boolean);
  if (!sel.length || !zs.length || !zkHasA()) return '';
  const names = l => l.slice(0, 2).map(z => z.name).join(', ') + (l.length > 2 ? ` и ещё ${l.length - 2}` : '');
  const parts = sel.map(k => { const l = zs.filter(z => zkIn(z, [k])); return l.length ? `${areaName(k)} → только ${names(l)}` : `${areaName(k)} — целиком`; });
  const out = zs.filter(z => !zkIn(z, sel));
  if (out.length) parts.push(`+ ${names(out)}`);
  return parts.join(' · ');
}
function bindChecks(key, num) {
  $('#sheet-body').onchange = e => { const i = e.target; if (i.name !== key) return; toggleIn(key, num ? +i.value : i.value); fchg(); };
  $('#s-clear').onclick = () => { delete f[key]; fchg(); $('#sheet-body').querySelectorAll('input[type=checkbox]').forEach(i => i.checked = false); };
}

// ---------- выдача ----------
const mln = v => (v / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
const rub = v => Math.round(v).toLocaleString('ru-RU') + ' ₽';
const zkName = c => c ? 'ЖК ' + String(c).replace(/(^|\s)ЖК(?=\s|$)/gi, ' ').replace(/\s+/g, ' ').trim() : '';
function what(x) {
  if (x.kind === 'участок') return `Участок${x.land ? ` ${x.land} сот.` : ''}${x.use_land ? ` · ${x.use_land}` : ''}`;
  if (x.kind === 'коммерция') return [x.type_name || 'Коммерция', x.area && `${x.area} м²`].filter(Boolean).join(' · ');
  if (x.kind === 'дом') return [x.type_name || 'Дом', x.area && `${x.area} м²`, x.land && `участок ${x.land} сот.`].filter(Boolean).join(' · ');
  const t = x.rooms === 0 ? 'Студия' : `${x.rooms ?? '?'}-комн. ${x.kind === 'апартаменты' ? 'апартаменты' : 'квартира'}`;
  return [t, x.area && `${x.area} м²`, x.floor && `${x.floor}/${x.floors ?? '?'} эт.`].filter(Boolean).join(' · ');
}
// фото 1–4 — JPEG в основном хранилище, 5–10 — WebP во втором (бесплатно по 1 ГБ)
// фото ещё не скачаны в своё хранилище — по ссылкам объявления (pics; на карте — ph строкой)
// схема 3 (web_photos_v = 3, на карте ph = 3): все фото — JPEG во втором проекте
const photoUrl = (x, k) => x.pics ? x.pics[k] : typeof x.ph === 'string' ? x.ph : x.web_photos_v === 3 || x.ph === 3 ? `${meta.media}/${x.num}/${k}.jpg`
  : k < 4 || !meta.media ? `${meta.photos}/${x.num}/${k}.jpg` : `${meta.media}/${x.num}/${k}.webp`;
const nPhotos = x => x.web_photos || x.pics?.length || 0;
// v5.48 G: «моя правка» — убранные агентом фото не показываем ему (all_pics — все, для окна правки)
function myNorm(x) {
  if (x?.my_hide?.length && !x.all_pics) { const all = Array.from({ length: nPhotos(x) }, (_, k) => photoUrl(x, k)); x.all_pics = all; x.pics = all.filter(u => !x.my_hide.includes(u)); x.web_photos = 0; }
  return x;
}

// новый поиск отменяет запрос в пути: выдача не мигает (прежняя видна бледной до ответа) и не подменяется устаревшим ответом
let sctl = null;
let oldShown = false;
async function search(more = false) {
  if (more && busy) return;
  sctl?.abort();
  const ctl = sctl = new AbortController();
  busy = true;
  if (!more) { $('#list').classList.add('stale'); $('#status').classList.add('wait'); if (!$('#status').textContent) $('#status').textContent = 'Ищу…'; $('#more').hidden = true; }
  $('#more').disabled = true;
  try {
    const r = await call('search', { f: FUI.clean(f), text, offset: more ? offset : 0, sort, cm: cmOn() }, ctl.signal);
    if (!more) { offset = 0; items.clear(); $('#list').innerHTML = ''; oldShown = false; }
    total = r.count;
    if (!more) window.AGENT?.searched({ text, f: FUI.clean(f), count: total, understood: r.understood || '' });   // v5.48 F: «ищет одно и то же» → подбор с ИИ
    r.items.forEach(x => items.set(x.num, myNorm(x)));
    // объявления старше 6 месяцев — после актуальных, перед первым из них разделитель (один на всю выдачу)
    $('#list').insertAdjacentHTML('beforeend', r.items.map(x => { const d = x.old && !oldShown; if (d) oldShown = true; return (d ? FUI.oldLine() : '') + card(x); }).join(''));
    offset += r.items.length;
    $('#status').textContent = (total ? `Найдено: ${total.toLocaleString('ru-RU')}` : 'Ничего не нашлось') + (r.understood ? ` · понял запрос так: ${r.understood}` : '') + (r.note ? ` · ${r.note}` : '');
    if (favMode === 'deals' && window.MINE) $('#status').insertAdjacentHTML('beforeend', ' · <button type="button" class="lnk" data-myrmlist>🗑 Убранные у меня</button>');   // v5.48 G
    if (favMode === 'hidden') $('#status').insertAdjacentHTML('afterbegin', `<span class="hidtg">${[['hide', '🙈 Скрытые'], ['del', '🗑 Удалённые']]
      .map(([k, t]) => `<button type="button" class="seg${f.hid === k ? ' on' : ''}" data-hid="${k}">${t}</button>`).join('')}</span> `);
    if (!more) noneBox(total ? null : r);
    if (r.old_pro && offset >= total) $('#list').insertAdjacentHTML('beforeend', PLANS.oldBanner(r.old_pro));
    $('#apply').textContent = `Показать ${total.toLocaleString('ru-RU')}`;
    $('#more').hidden = view === 'map' || offset >= total;
    $('#more').textContent = `Показать ещё ${Math.min(r.page, total - offset)} из ${(total - offset).toLocaleString('ru-RU')}`;
    if (!more) { const y = $('.bar').getBoundingClientRect().top + scrollY - 70; if (scrollY > y) scrollTo({ top: Math.max(0, y) }); }
  } catch (e) {
    if (ctl.signal.aborted) return;
    if (e.gate) return showLogin(e.gate);
    $('#status').textContent = `Ошибка поиска: ${e.message}`;
  } finally { if (sctl === ctl) { busy = false; $('#more').disabled = false; $('#list').classList.remove('stale'); $('#status').classList.remove('wait'); } }
}
// «Ничего не нашлось»: что мешает (сервер прислал drop) — в выдаче и в окне фильтра на телефоне; в пустом «Избранном» — как туда добавить
function noneBox(r) {
  const own = favMode && Object.keys(f).length === 1;
  const html = !r ? '' : own && favMode === 'hidden' ? `<p>${f.hid === 'del' ? 'Удалённых объявлений нет.' : 'Скрытых объявлений нет — откройте объявление и нажмите «🙈 Скрыть» в строке «Модерация».'}</p>`
    : own ? `<p>${favMode === 'favs' ? 'В «Избранном» пока ничего нет — нажмите ☆ на фото объявления.' : 'В разделе «Контакт» пока ничего нет — объект попадёт сюда сам, когда собственник ответит «актуально», или откройте объявление и нажмите «🤝 В контакт».'}</p>`
    : FUI.empty(r, Object.keys(f).some(k => !(favMode && k === LISTS[favMode][0])));
  if (r) $('#list').innerHTML = `<div class="empty">${html}</div>`;
  $('#f-drop').innerHTML = own ? '' : html; $('#f-drop').hidden = !html || own;
}
$('#more').addEventListener('click', () => search(true));
$('#status').addEventListener('click', e => { if (e.target.closest('[data-myrmlist]')) return window.MINE?.removed(call, () => search()); });
$('#status').addEventListener('click', e => { const b = e.target.closest('[data-hid]'); if (b && favMode === 'hidden') { f = { hid: b.dataset.hid }; search(); } });

function gallery(x) {
  const n = nPhotos(x);
  return `<div class="gal" data-n="${n}">${isNew(x) ? '<span class="newmark">Новое</span>' : ''}
    <div class="strip">${n ? Array.from({ length: n }, (_, k) => `<div class="ph"><img referrerpolicy="no-referrer" src="${esc(photoUrl(x, k))}" alt="" loading="lazy" data-k="${k}"></div>`).join('')
      : x.source === 'tg' ? '<div class="none closed"><b>Закрытая продажа</b><br>уточняйте детали у собственника</div>' : '<div class="none">Фото загружаются<br>(обновляются каждую ночь)</div>'}</div>
    ${n > 1 ? `<button class="nav l" data-nav="-1" aria-label="Назад">‹</button><button class="nav r" data-nav="1" aria-label="Вперёд">›</button>
      <div class="dots">${Array.from({ length: n }, (_, k) => `<i class="${k ? '' : 'on'}"></i>`).join('')}</div>` : ''}
    ${meta.features.selections ? pickHtml(x) : ''}
    ${meta.features.favorites && !x.excl ? `<button class="fav${x.fav ? ' on' : ''}" data-fav aria-label="В избранное">${x.fav ? '★' : '☆'}</button>` : ''}
    ${x.seen ? '<span class="seenmark">Просмотрено</span>' : ''}
    ${(me?.role === 'admin' || me?.main) && x.hidden_kind ? `<span class="hidmark">${x.hidden_kind === 'del' ? '🗑 Удалено' : '🙈 Скрыто'}</span>` : ''}
  </div>`;
}
// v5.24a: «Выбрать» — заметный квадрат с галочкой и подписью (как у Авито), выбранная карточка — рамкой (.card.picked).
// 🤝 «Контакт», ✉️ «В рассылку», 👁/🗑 админа — больше не на фото, а внутри объявления (ivTools)
const pickHtml = x => `<label class="pick" title="Выбрать для подборки, рекламы или рассылки"><input type="checkbox" data-sel ${sel.has(x.num) ? 'checked' : ''}><i class="pk-box" aria-hidden="true"></i><span class="pk-t">${sel.has(x.num) ? 'Выбрано' : 'Выбрать'}</span></label>`;
function pickSync(num) {   // галочка, подпись и рамка у всех копий карточки (выдача, карта, окно объявления)
  const on = sel.has(num);
  document.querySelectorAll(`.card[data-num="${num}"]`).forEach(el => {
    el.classList.toggle('picked', on);
    const c = el.querySelector('[data-sel]'); if (c) c.checked = on;
    const t = el.querySelector('.pick .pk-t'); if (t) t.textContent = on ? 'Выбрано' : 'Выбрать';
  });
}
// вертикальное фото — целиком на размытом фоне, горизонтальное — на всю рамку 4:3 (низ с водяными знаками обрезается)
document.addEventListener('load', e => {
  const im = e.target;
  if (im.tagName !== 'IMG' || !im.parentElement?.classList.contains('ph')) return;
  if (im.naturalHeight > im.naturalWidth * 1.05) { im.parentElement.classList.add('tall'); im.parentElement.style.setProperty('--bg', `url("${im.src}")`); }
}, true);
function tags(x) {
  return [...[...new Set((x.finish || []).map(t => FINL[t] ?? t))].map(t => `<span class="tag">${esc(t)}</span>`),
    x.fz214 ? '<span class="tag">ФЗ-214</span>' : '', x.pool ? '<span class="tag">Бассейн</span>' : '',
    x.sea_m != null && x.sea_m <= 5000 ? `<span class="tag sea" title="По прямой до берега">≈ ${seaTxt(x.sea_m)} до моря</span>` : '',
    x.ad_state === 'unique' ? '<span class="tag ok agent-only">Уникальна</span>' : ''].join('');   // v5.24a: «Есть в рекламе» не показываем никому — есть «Проверить в рекламе»
}
// микрорайон, а если его нет — район («Светлана», «Адлерский р-н»)
const placeOf = x => x.sub || (x.district ? (/ский$/.test(x.district) ? `${x.district} р-н` : x.district) : (x.mkr ? String(x.mkr).replace(/\s+мкр$/, '') : ''));
// mini — карточка на карте (окно точки и список под картой): та же, без описания, источника и заметки.
// У точки карты (lite) есть цена, площадь, этаж, ЖК с адресом и фото — дата, ★ и телефон приходят следом (действие items)
function card(x, mini = false) {
  const price = x.price ? priceOf(x.price) : 0;
  const ppm = price && x.area ? `${Math.round(price / x.area).toLocaleString('ru-RU')} ₽/м²` : '';
  const zk = x.zk ?? zkName(x.complex);   // заголовок — название ЖК, если известно (по объявлению или по адресу дома)
  const where = [x.street || x.address, placeOf(x)].filter(Boolean).join(' · ');
  const date = x.lite ? '…' : x.created_at ? new Date(x.created_at).toLocaleDateString('ru-RU') : '—';
  return `<article class="card${mini ? ' mc' : ''}${x.seen ? ' seen' : ''}${sel.has(x.num) ? ' picked' : ''}${x.excl ? ' xcard' : ''}" data-num="${x.num}">
    ${gallery(x)}
    <div class="body">
      <div class="price${x.ad_state === 'unique' && !client.on ? ' uniq' : ''}"><b>${price ? rub(price) : 'Цена не указана'}</b><small>${ppm}</small>${myMark(x)}${lockHtml(x)}</div>
      ${xLine(x)}
      ${zk ? `<div class="zk" data-open>${esc(zk)}</div>` : ''}
      <div class="title" data-open>${esc(what(x))}</div>
      <div class="addr">${esc(where)}</div>
      <div class="tags">${tags(x)}${ansTag(x)}</div>
      <div class="meta">Добавлено ${date} · № ${x.num}</div>
      ${!mini && x.descr ? `<div class="descr" data-d><p>${descrHtml(x.descr)}</p>${x.descr.length > 160 ? '<button type="button" class="more" data-more><span>Развернуть описание</span><i>▾</i></button>' : ''}</div>` : ''}
      ${mini ? '' : srcHtml(x)}
      ${!mini && x.note ? `<div class="note agent-only">📝 ${esc(x.note)}</div>` : ''}
      <div class="actions agent-only">${x.phone || x.tg ? phoneBox(x.phone, null, x.tg) : `<button class="btn soft ph-btn" data-phone>${PH_BTN} <i aria-hidden="true">▾</i></button>`}
        ${!mini && meta.features.notes ? '<button class="btn ghost" data-note>📝 Заметка</button>' : ''}
        ${!mini && meta.features.crm ? '<button class="btn ghost" data-client>👥 Клиенту</button>' : ''}
        ${!mini && !x.excl ? `<a class="btn ghost" href="hub.html#deal=new:${x.num}" title="Отправить объект в сделку">📑 В сделку</a>` : ''}
        ${x.video ? '<button class="btn ghost" data-video>🎬 Видео</button>' : ''}</div>
    </div>
  </article>`;
}
// v5.48 G: эксклюзив коллеги — пометка «💎 Коллега» (только агенту), комиссия коллеге; «моя правка» — ✏️ у цены; ответ собственника на рассылку
const xLine = x => x.excl ? `<div class="xline agent-only"><span class="xbadge">💎 Коллега</span>${x.agent ? ` ${esc([x.agent.name, x.agent.company].filter(Boolean).join(' · '))}` : ''}${x.comm_pct ? ` · комиссия ${String(x.comm_pct).replace('.', ',')}%` : x.comm_rub ? ` · комиссия ${rub(x.comm_rub)}` : ''}</div>` : '';
const myMark = x => x.my_edit ? `<span class="mymark agent-only" title="Ваша правка — видна только вам и вашим клиентам${x.price_src ? `. В объявлении: ${rub(priceOf(x.price_src))}` : ''}">✏️ отредактировано</span>` : '';
const ANS = { yes: ['ok', 'Собственник: актуально'], no: ['', 'Собственник: не продаёт'], sold: ['', 'Собственник: продано'] };
const ansTag = x => x.ans && ANS[x.ans] ? `<span class="tag ${ANS[x.ans][0]} agent-only">${ANS[x.ans][1]}</span>` : '';
// источник объявления ссылкой (Авито, Циан, ДомКлик…) — только агенту: в режиме «С клиентом» скрыт
// v5.23: без названий площадок — одна ссылка «Проверить в рекламе» (первый источник), остальные — «2», «3» мелко
const srcHtml = x => x.src?.length ? `<div class="src agent-only">${x.src.map((s, i) => `<a href="${esc(s.url)}" target="_blank" rel="noopener"${i ? ' class="src-n" title="Ещё одна ссылка на объявление"' : ''}>${i ? i + 1 : 'Проверить в рекламе'}</a>`).join('')}</div>` : '';
// tg (v5.21) — профиль Telegram собственника (объявления из чатов ЖК): если телефона нет, контакт — «Написать в Telegram»
// v5.47 E (Алексей, п. 14): номер не виден сразу — кнопка «📞 Связаться» раскрывает меню (номер, Позвонить, WhatsApp, MAX, Копировать);
// у открытого и неоткрытого номера кнопка одинаковая, разница — только маленький замок у цены (lockHtml). open — меню сразу раскрыто (номер только что открыли)
const PH_BTN = '📞 Связаться';
function phoneBox(p, owner, tg, open = false) {
  const tgA = tg ? `<a class="m-tg" href="https://t.me/${encodeURIComponent(tg)}" target="_blank" rel="noopener">Написать в Telegram</a>` : '';
  const dd = inner => `<div class="phone"><details class="ph-dd"${open ? ' open' : ''}><summary class="btn soft ph-btn">${PH_BTN} <i aria-hidden="true">▾</i></summary><div class="ph-menu">${inner}</div></details></div>`;
  if (!p) return dd(`<div>${owner ? esc(owner) + ' · ' : ''}<small>телефона в объявлении нет — напишите собственнику</small></div>${tgA ? `<div class="msgs">${tgA}</div>` : ''}`);
  const d = p.replace(/\D/g, ''), t = encodeURIComponent(MSG);
  return dd(`<div><a class="num" href="tel:${esc(p)}">${esc(p)}</a>${owner ? ` — ${esc(owner)}` : ''} <small>может быть подменный</small></div>
    <div class="msgs"><a class="m-call" href="tel:${esc(p)}">Позвонить</a>
      ${meta.features.messengers ? `<a class="m-wa" href="https://wa.me/${d}?text=${t}" target="_blank" rel="noopener">WhatsApp</a>
      <a class="m-max" href="${mobile() ? 'max://' : 'https://web.max.ru/'}" target="_blank" rel="noopener" data-max="${esc(d)}" title="MAX: номер скопируется — найдите контакт в MAX">MAX</a>` : ''}
      ${tgA}<button class="m-copy" data-copy="${esc(p)}">Копировать</button></div>`);
}
// замок у цены (только агенту): 🔓 — номер уже открыт, 🔒 — ещё нет
const lockHtml = x => `<i class="lk agent-only${x.phone || x.tg ? ' on' : ''}" title="${x.phone || x.tg ? 'Номер открыт' : 'Номер ещё не открыт'}" aria-label="${x.phone || x.tg ? 'Номер открыт' : 'Номер ещё не открыт'}">${x.phone || x.tg ? '🔓' : '🔒'}</i>`;
function lockSync(num) {
  const x = items.get(num); if (!x) return;
  document.querySelectorAll(`.card[data-num="${num}"] .lk`).forEach(el => { el.outerHTML = lockHtml(x); });
}

// v5.38r: «⚖️ Проверка» — списки документов юриста; телефон собственника — тем же «phone» (по тарифу), карточка обновляется как при «📞 Телефон»
function lawReq(num, x, cardEl) {
  window.LAWREQ?.obj({ num, phone: x?.phone, tg: x?.tg }, { phone: async () => {
    const p = await call('phone', { num });
    PLANS.counter(p.used);
    if (x) { x.phone = p.phone; if (p.tg) x.tg = p.tg; }
    const b = cardEl?.querySelector('[data-phone]'); if (b && (p.phone || p.tg)) { b.outerHTML = phoneBox(p.phone, p.owner, p.tg); lockSync(num); }
    return p;
  } });
}
// действия в карточке
$('#list').addEventListener('click', e => onCard(e, e.target.closest('.card')));
// фото как у Авито (v5.15): на компьютере ведёшь мышкой по фото — кадры меняются, внизу полоски; ушёл — первое фото
if (matchMedia('(hover: hover)').matches) {
  const scrub = e => {
    const g = e.target.closest('.gal'), st = g?.querySelector('.strip'); if (!st) return;
    const n = st.children.length; if (n < 2) return;
    const r = g.getBoundingClientRect(), k = Math.max(0, Math.min(n - 1, Math.floor((e.clientX - r.left) / r.width * n)));
    if (g.dataset.k == k) return;
    g.dataset.k = k; st.scrollTo({ left: k * st.clientWidth, behavior: 'instant' });
    g.querySelectorAll('.dots i').forEach((d, i) => d.classList.toggle('on', i === k));
  };
  for (const box of ['#list', '#ml-items', '#map', '#sheet-body']) {   // v5.20: и в окне точки на карте, и в «Похожих»
    $(box).addEventListener('mousemove', scrub);
    $(box).addEventListener('mouseout', e => { const g = e.target.closest('.gal'); if (g && !g.contains(e.relatedTarget)) { g.dataset.k = 0; g.querySelector('.strip')?.scrollTo({ left: 0, behavior: 'instant' }); g.querySelectorAll('.dots i').forEach((d, i) => d.classList.toggle('on', i === 0)); } });
  }
}
async function onCard(e, cardEl) {
  if (!cardEl) return;
  const num = +cardEl.dataset.num, x = items.get(num);
  const t = e.target;
  if (t.closest('[data-lawreq]')) { lawReq(num, x, cardEl); return; }   // v5.38r: «⚖️ Проверка» — sec/lawreq.js
  if (t.closest('[data-nav]')) { const g = t.closest('.gal'); const s = g.querySelector('.strip'); s.scrollBy({ left: s.clientWidth * +t.closest('[data-nav]').dataset.nav, behavior: 'smooth' }); return; }
  if (t.closest('[data-sel]')) {
    const c = t.closest('[data-sel]');
    if (c.checked && sel.size >= MAXSEL) { c.checked = false; toast(`В одной подборке до ${MAXSEL} объектов ссылкой (PDF — до ${MAXPDF}) — сформируйте её и начните новую`); return; }
    c.checked ? sel.add(num) : sel.delete(num); store.set('sel', [...sel]); selbar(); pickSync(num); return;
  }
  if (t.closest('[data-more]')) {
    const d = t.closest('.descr'), open = d.classList.toggle('open');
    t.closest('[data-more]').querySelector('span').textContent = open ? 'Свернуть' : 'Развернуть описание';
    if (open) markSeen(cardEl, num);
    return;
  }
  if (t.closest('.pick')) return;
  if (t.closest('[data-fav]')) {
    const b = t.closest('[data-fav]'), on = !b.classList.contains('on');
    b.classList.toggle('on', on); b.textContent = on ? '★' : '☆'; if (x) x.fav = on;
    call('fav', { num, on }).catch(err => toast(err.message));
    return;
  }
  if (t.closest('[data-deal]')) {   // «Контакт»: с собственником договорились — объект в своём разделе (v5.24a: кнопка внутри объявления; само — когда собственник ответил «актуально»)
    const b = t.closest('[data-deal]'), on = !b.classList.contains('on');
    b.classList.toggle('on', on); b.innerHTML = dealTxt(on); if (x) x.deal = on;
    call('deal', { num, on }).then(() => toast(on ? 'В разделе «Контакт»' : 'Убрано из «Контакта» — само больше не добавится')).catch(err => toast(err.message));
    return;
  }
  if (t.closest('[data-cmp]')) { complainForm(cardEl, num, t.closest('[data-cmp]')); return; }   // v5.24a: «⚠ Пожаловаться»
  if (t.closest('[data-video]')) { window.MINE?.video(x?.video); return; }   // v5.48 G: видео эксклюзива
  if (t.closest('[data-myedit]')) { window.MINE?.edit(num, x, call, async () => { items.delete(num); if (cardEl.classList.contains('itemv')) await openItem(num); search(); }); return; }
  if (t.closest('[data-myrm]')) {
    if (!confirm(`Убрать № ${num} у себя? Объявление пропадёт только у вас (поиск, карта, «Контакт»). Вернуть — «🗑 Убранные у меня» в разделе «Контакт».`)) return;
    call('my_edit', { num, do: 'remove' }).then(r => { toast(r.message, 5000); if (cardEl.classList.contains('itemv')) closeSheet();
      document.querySelectorAll(`#list .card[data-num="${num}"], #ml-items .card[data-num="${num}"]`).forEach(el => { el.classList.add('gone-out'); setTimeout(() => el.remove(), 250); }); }).catch(err => toast(err.message));
    return;
  }
  // фото в карточке — объявление целиком, как на Авито: большое фото, лента миниатюр, рядом цена и описание
  if (t.matches('.strip img')) { openItem(num, +t.dataset.k); markSeen(cardEl, num); return; }
  if (t.closest('[data-open]')) { openItem(num); return; }
  if (t.closest('summary')) { markSeen(cardEl, num); return; }
  if (t.closest('[data-copy]')) { copy(t.closest('[data-copy]').dataset.copy, 'Номер скопирован'); return; }
  if (t.closest('[data-note]')) { noteSheet(num, x); return; }
  if (t.closest('[data-client]')) { sheetGo = 'crm'; CRM.pick(num); return; }   // «Клиенту…» — объект в карточку клиента (шаг 3.4)
  // карточка на карте открывает объявление нажатием в любом месте, кроме кнопок и ссылок
  if (cardEl.classList.contains('mc') && !t.closest('button, a, input, label, .phone')) { openItem(num); return; }
  if (t.closest('[data-pwait]')) {   // v5.22: «🔔 Сообщить, когда номер появится» — в бот, push и окно на сайте
    const w = t.closest('[data-pwait]'); w.disabled = true;
    call('phone_wait', { num }).then(r => { w.outerHTML = r.ready ? '<b>Номер уже есть — нажмите «Телефон»</b>' : '<b>🔔 Сообщим, как только номер появится</b>'; }).catch(err => { w.disabled = false; toast(err.message); });
    return;
  }
  if (t.closest('[data-edit]')) { window.EDITMAIN?.open(num, () => openItem(num)); return; }   // v5.46 D: правка Main — цена, описание, фото
  if (t.closest('[data-adm]')) {   // v5.22: админ — 👁 скрыть, 🗑 удалить, ↩ вернуть
    const as = t.closest('[data-adm]').dataset.adm;
    if (as === 'del' && !confirm(`Удалить объявление № ${num}? Оно пропадёт у всех и не вернётся ночной загрузкой. Вернуть можно в «Скрытые» → «Удалённые».`)) return;
    call('admin_hide', { num, as }).then(() => {
      if (x) x.hidden_kind = as === 'back' ? null : as;
      if (cardEl.classList.contains('itemv')) closeSheet();   // v5.24a: кнопки — в окне объявления; карточку в выдаче убираем следом
      document.querySelectorAll(`#list .card[data-num="${num}"], #ml-items .card[data-num="${num}"]`).forEach(el => { el.classList.add('gone-out'); setTimeout(() => el.remove(), 250); });
      toast({ hide: `№ ${num} скрыт — он в разделе «🙈 Скрытые»`, del: `№ ${num} удалён — вернуть можно в «Скрытые» → «Удалённые»`, back: `№ ${num} снова в поиске` }[as]);
    }).catch(err => toast(err.message));
    return;
  }
  const b = t.closest('[data-phone]');
  if (!b) return;
  const box = b.parentElement;
  b.disabled = true; b.textContent = 'Узнаю номер…';
  try {
    const p = await call('phone', { num });
    PLANS.counter(p.used);
    if (!p.phone && !p.tg) throw Object.assign(new Error(p.error || 'номер не найден'), { pending: !!p.pending });
    b.outerHTML = phoneBox(p.phone, p.owner, p.tg, true);
    window.INVITE?.hit('phone');   // v5.25a: «Позвать коллегу» после удачного момента (invite.js)
    const y = x ?? items.get(num);   // карточка карты могла догрузиться, пока узнавали номер
    if (y) { y.phone = p.phone; if (p.tg) y.tg = p.tg; y.ad_state = p.ad_state ?? y.ad_state; if (p.src?.length) y.src = p.src; lockSync(num); }
    if (p.src?.length) { cardEl.querySelector('.src')?.remove(); box.insertAdjacentHTML('beforebegin', srcHtml({ src: p.src })); }
    markSeen(cardEl, num);
  } catch (err) {
    if (err.gate) return showLogin(err.gate);
    b.disabled = false; b.innerHTML = `${PH_BTN} <i aria-hidden="true">▾</i>`;
    if (err.data?.used) PLANS.counter(err.data.used);
    box.querySelectorAll('.err, .lim').forEach(e => e.remove());
    box.querySelectorAll('.pend').forEach(e => e.remove());
    // v5.22: временный номер площадки — не ошибка: номер появится, конвейер перепроверит сам; можно попросить сообщить
    box.insertAdjacentHTML('beforeend', err.data?.limit ? `<div class="lim">${PLANS.limitHtml(err.message, err.data.limit)}</div>`
      : err.pending ? `<div class="pend">⏳ Номер уточняется у площадки — проверяем сами несколько раз в сутки. <button type="button" class="lnk" data-pwait>🔔 Сообщить, когда появится</button></div>`
      : `<span class="err">${esc(err.message)}</span>`);
  }
}
document.addEventListener('scroll', e => {   // точки под фото: в выдаче, в окне точки на карте и в списке под картой
  const s = e.target; if (!s.classList?.contains('strip')) return;
  const k = Math.round(s.scrollLeft / s.clientWidth);
  s.parentElement.querySelectorAll('.dots i').forEach((d, i) => d.classList.toggle('on', i === k));
}, true);
function markSeen(cardEl, num) {
  const x = items.get(num);
  if (!x || x.seen) return;
  x.seen = true; cardEl?.classList.add('seen');
  cardEl?.querySelector('.gal')?.insertAdjacentHTML('beforeend', '<span class="seenmark">Просмотрено</span>');
  call('view', { num }).catch(() => {});
}
function copy(t, msg) { navigator.clipboard?.writeText(t).then(() => toast(msg), () => toast(t)); }
function noteSheet(num, x) {
  sheet(`Заметка к № ${num}`, `<textarea id="note-t" rows="5" placeholder="Видно только вам">${esc(x?.note ?? '')}</textarea>
    <div class="sheet-foot"><button class="btn ghost" data-close>Отмена</button><button class="btn primary" id="note-save">Сохранить</button></div>`);
  $('#note-save').onclick = async () => {
    const v = $('#note-t').value.trim();
    try { await call('note', { num, text: v }); if (x) x.note = v || null; closeSheet(); rerender(num); toast('Заметка сохранена'); }
    catch (e) { toast(e.message); }
  };
}
function rerender(num) {
  const el = document.querySelector(`.card[data-num="${num}"]`), x = items.get(num);
  if (el && x) el.outerHTML = card(x);
}

// объявление целиком — как на Авито: большое фото (не на весь экран) и лента миниатюр, рядом цена, адрес, телефон и описание
async function openItem(num, k = 0) {
  let x = items.get(num);
  if (!x?.descr) {   // с карты объявления может не быть в списке
    if (!x) sheet(`№ ${num}`, '<p class="muted">Загрузка…</p>', true);
    try { const r = await call('item', { num }); x = myNorm(r.item); items.set(num, x); } catch (e) { if (e.gate) return showLogin(e.gate); if (!x) return toast(e.message); }
  }
  sheet(`№ ${num}`, itemView(x, k), true);
  const el = $('#sheet-body .itemv');
  el.querySelectorAll('.iv-main img, .iv-th img').forEach(im => im.complete ? fitCrop(im) : im.addEventListener('load', () => fitCrop(im), { once: true }));
  el.addEventListener('click', e => {
    const t = e.target, n = nPhotos(x);
    const th = t.closest('[data-th]'), st = t.closest('[data-step]');
    if (th || st) { ivShow(el, x, th ? +th.dataset.th : (+el.dataset.k + +st.dataset.step + n) % n); return; }
    if (t.matches('[data-big]')) { openViewer(Array.from({ length: n }, (_, i) => photoUrl(x, i)), +el.dataset.k); return; }
    onCard(e, el);
  });
  // v5.20: листание фото пальцем в окне объявления (на компьютере — стрелки, миниатюры и ← →)
  const main = el.querySelector('.iv-main');
  if (main && nPhotos(x) > 1) {
    let sx = 0, sy = 0;
    main.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    main.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy, n = nPhotos(x);
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) ivShow(el, x, (+el.dataset.k + (dx < 0 ? 1 : -1) + n) % n);
    }, { passive: true });
  }
  $('#sheet-body').scrollTop = 0;
  window.LINKS?.full?.(num, el.querySelector('[data-ivlk]'));   // v5.24a: отметки целиком (собственник, подборки, клиенты) и «снять» — здесь, на карточке — только значки
  simLoad(num);
  const inList = document.querySelector(`#list .card[data-num="${num}"]`);
  if (inList) markSeen(inList, num);
}
// v5.20: под объявлением — «Ещё в этом ЖК» / «В этом доме» / «Похожие рядом» (до 10 мелких карточек в строку; сервер — действие similar).
// Грузится после открытия окна, окно не ждёт
const SIM_H = { zk: 'Ещё в этом ЖК', house: 'Ещё в этом доме', near: 'Похожие рядом — площадь и цена ±20–25 %' };
async function simLoad(num) {
  const body = $('#sheet-body');
  body.insertAdjacentHTML('beforeend', `<section class="sim" data-for="${num}"><div class="sim-h">Похожие объекты</div><div class="sim-row"><p class="muted">Подбираю похожие…</p></div></section>`);
  const box = body.querySelector(`.sim[data-for="${num}"]`);
  box.addEventListener('click', e => { const c = e.target.closest('.card'); if (c) onCard(e, c); });
  try {
    const r = await call('similar', { num });
    if (!box.isConnected) return;
    const list = (r.items ?? []).filter(y => y.num !== num).slice(0, 10);
    if (!list.length) { box.remove(); return; }
    list.forEach(y => { if (!items.has(y.num)) items.set(y.num, y); });
    box.querySelector('.sim-h').textContent = SIM_H[r.mode] ?? 'Похожие объекты';
    box.querySelector('.sim-row').innerHTML = list.map(y => card(items.get(y.num) ?? y, true)).join('');
  } catch (e) { if (box.isConnected) box.remove(); }
}
function itemView(x, k) {
  const n = nPhotos(x), price = x.price ? priceOf(x.price) : 0;
  const ppm = price && x.area ? `${Math.round(price / x.area).toLocaleString('ru-RU')} ₽/м²` : '';
  const zk = x.zk ?? zkName(x.complex);
  const where = [x.street || x.address, placeOf(x)].filter(Boolean).join(' · ');
  const date = x.created_at ? new Date(x.created_at).toLocaleDateString('ru-RU') : '—';
  k = Math.min(Math.max(0, k), Math.max(0, n - 1));
  return `<article class="card itemv" data-num="${x.num}" data-k="${k}">
    <div class="iv-media">
      <div class="iv-main">${n ? `<div class="vc"><img referrerpolicy="no-referrer" src="${esc(photoUrl(x, k))}" alt="" data-big title="Открыть на весь экран"></div>` : '<div class="none">Фото загружаются<br>(обновляются каждую ночь)</div>'}
        ${isNew(x) ? '<span class="newmark">Новое</span>' : ''}
        ${n > 1 ? '<button class="nav l" data-step="-1" aria-label="Предыдущее фото">‹</button><button class="nav r" data-step="1" aria-label="Следующее фото">›</button>' : ''}
        ${n ? `<span class="iv-count">${k + 1} / ${n}</span>` : ''}
        ${meta.features.selections ? pickHtml(x) : ''}
        ${meta.features.favorites && !x.excl ? `<button class="fav${x.fav ? ' on' : ''}" data-fav aria-label="В избранное">${x.fav ? '★' : '☆'}</button>` : ''}
      </div>
      ${n > 1 ? `<div class="iv-thumbs">${Array.from({ length: n }, (_, i) => `<button type="button" class="iv-th${i === k ? ' on' : ''}" data-th="${i}" aria-label="Фото ${i + 1}"><span class="vc"><img referrerpolicy="no-referrer" src="${esc(photoUrl(x, i))}" alt="" loading="lazy"></span></button>`).join('')}</div>` : ''}
    </div>
    <div class="iv-info">
      <div class="price${x.ad_state === 'unique' && !client.on ? ' uniq' : ''}"><b>${price ? rub(price) : 'Цена не указана'}</b><small>${ppm}</small>${myMark(x)}${lockHtml(x)}</div>
      ${xLine(x)}
      ${zk ? `<div class="zk">${esc(zk)}</div>` : ''}
      <div class="iv-title">${esc(what(x))}</div>
      <div class="iv-addr">${esc(where)}</div>
      <div class="tags">${tags(x)}${ansTag(x)}</div>
      <div class="meta">Добавлено ${date} · № ${x.num}</div>
      ${x.video ? `<video class="iv-video" src="${esc(x.video)}" controls playsinline preload="metadata"></video>` : ''}
      ${srcHtml(x)}
      ${x.note ? `<div class="note agent-only">📝 ${esc(x.note)}</div>` : ''}
      <div class="actions agent-only">${x.phone || x.tg ? phoneBox(x.phone, null, x.tg) : `<button class="btn soft ph-btn" data-phone>${PH_BTN} <i aria-hidden="true">▾</i></button>`}
        ${meta.features.notes ? '<button class="btn ghost" data-note>📝 Заметка</button>' : ''}
        ${meta.features.crm ? '<button class="btn ghost" data-client>👥 Клиенту</button>' : ''}
        ${x.excl ? '' : `<a class="btn ghost" href="hub.html#deal=new:${x.num}">📑 В сделку</a>`}</div>
      ${ivTools(x)}
      ${x.descr ? `<div class="iv-descr"><div class="iv-h">Описание</div><p>${descrHtml(x.descr)}</p></div>` : ''}
    </div>
  </article>`;
}
// v5.24a: внутри объявления — то, что раньше было значками на фото: «Контакт», «В рассылку», отметки (снять), «⚠ Пожаловаться», модерация админа
const dealTxt = on => on ? '✓ В «Контакте» · <u>убрать</u>' : '🤝 В контакт';
function ivTools(x) {
  const adm = me?.role === 'admin' || !!me?.main, agent = me && !me.guest;   // v5.37a: «Модерация» в объявлении — и группе Main
  const row = [meta.features.deals && agent && !x.excl ? `<button type="button" class="btn ghost sm ivdeal${x.deal ? ' on' : ''}" data-deal title="«Контакт» — договорились с собственником (ставится само, когда собственник ответил «актуально»)">${dealTxt(x.deal)}</button>` : '',
    meta.features.mail && agent && !x.mine ? `<button type="button" class="btn ghost sm" data-mail="${x.num}" title="Объявление появится в «Списке рассылки» (Продвижение → Рассылки)">✉️ В рассылку</button>` : '',
    agent && window.LAWREQ && !x.excl ? '<button type="button" class="btn ghost sm" data-lawreq title="Юрист подготовит списки документов для задатка и для сделки — отправите сами или запросите у собственника">⚖️ Проверка</button>' : '',   // v5.38r
    agent && !adm && !x.excl ? '<button type="button" class="btn ghost sm iv-cmp" data-cmp title="Объявление не снимется сразу — его проверит администратор">⚠ Пожаловаться</button>' : '',
    // v5.48 G: «моя правка» и «убрать у себя» — только этому агенту и его клиентам, объявление в базе не меняется
    agent && window.MINE && !x.mine ? `<button type="button" class="btn ghost sm" data-myedit title="Цена, описание, фото — только у вас и в ваших подборках клиентам">✏️ Моя правка${x.my_edit ? ' ✓' : ''}</button>` : '',
    agent && window.MINE && !x.mine ? '<button type="button" class="btn ghost sm" data-myrm title="Пропадёт только у вас: в поиске, на карте и в «Контакте»">🗑 Убрать у себя</button>' : ''].filter(Boolean).join('');
  const mod = adm ? `<div class="iv-mod"><b>Модерация</b>${window.EDITMAIN && !x.hidden_kind ? `<button type="button" class="btn ghost sm" data-edit title="Цена, описание, фото — правка видна всем">✏️ Править</button>${x.edited ? '<span class="muted">изменено Main</span>' : ''}` : ''}${x.hidden_kind ? `<span class="muted">${x.hidden_kind === 'del' ? 'удалено' : 'скрыто'} у всех</span><button type="button" class="btn ghost sm" data-adm="back">↩ Вернуть</button>`
    : '<button type="button" class="btn ghost sm" data-adm="hide" title="Пропадёт у всех, будет в «🙈 Скрытые»">🙈 Скрыть</button><button type="button" class="btn ghost sm bad" data-adm="del" title="Пропадёт у всех, ночная загрузка не вернёт">🗑 Удалить</button>'}</div>` : '';
  return row || mod ? `<div class="iv-tools agent-only">${row ? `<div class="iv-row">${row}</div>` : ''}<div class="iv-lk" data-ivlk="${x.num}"></div><div class="iv-cmpf" hidden></div>${mod}</div>` : '';
}
// «⚠ Пожаловаться»: причина кнопкой + текст (у «Другое» — обязательно) → web complain → очередь модерации админа; объявление само не снимается
const CMP = [['sold', 'Продано'], ['changed', 'Передумал продавать'], ['later', 'Отложил продажу'], ['agent', 'Это агент'], ['other', 'Другое']];
function complainForm(cardEl, num, btn) {
  const box = cardEl.querySelector('.iv-cmpf'); if (!box) return;
  if (!box.hidden) { box.hidden = true; return; }
  let why = '';
  box.innerHTML = `<div class="iv-h">Что не так с объявлением?</div><div class="chips">${CMP.map(([k, t]) => `<button type="button" class="chip" data-why="${k}">${t}</button>`).join('')}</div>
    <textarea rows="2" maxlength="1000" placeholder="Подробнее (необязательно)"></textarea>
    <div class="iv-row"><button type="button" class="btn primary sm" data-send disabled>Отправить</button><button type="button" class="btn ghost sm" data-cancel>Отмена</button></div>
    <p class="hint">Объявление не снимется сразу — его проверит администратор.</p>`;
  box.hidden = false;
  const ta = box.querySelector('textarea'), send = box.querySelector('[data-send]');
  const ok = () => { send.disabled = !why || (why === 'other' && ta.value.trim().length < 3); };
  ta.oninput = ok;
  box.onclick = async e => {
    e.stopPropagation();
    const w = e.target.closest('[data-why]');
    if (w) { why = w.dataset.why; box.querySelectorAll('[data-why]').forEach(b => b.classList.toggle('on', b === w)); ta.placeholder = why === 'other' ? 'Напишите, что не так (обязательно)' : 'Подробнее (необязательно)'; ok(); return; }
    if (e.target.closest('[data-cancel]')) { box.hidden = true; return; }
    if (!e.target.closest('[data-send]') || send.disabled) return;
    send.disabled = true;
    try {
      const r = await call('complain', { num, reason: why, text: ta.value.trim() });
      if (r.ok === false) throw new Error(r.error || 'Не получилось');
      box.innerHTML = `<p class="iv-thanks">✓ ${r.again ? 'Вы уже жаловались на это объявление — администратор проверит.' : 'Спасибо, проверим. Объявление пока остаётся в поиске.'}</p>`;
      btn.disabled = true;
    } catch (err) { send.disabled = false; toast(err.message); }
  };
}
// другое фото в окне объявления: большое фото, счётчик, выделенная миниатюра
function ivShow(el, x, k) {
  const n = nPhotos(x); if (!n) return;
  el.dataset.k = k;
  const im = el.querySelector('[data-big]');
  im.addEventListener('load', () => fitCrop(im), { once: true });
  im.src = photoUrl(x, k);
  el.querySelector('.iv-count').textContent = `${k + 1} / ${n}`;
  el.querySelectorAll('.iv-th').forEach((b, i) => b.classList.toggle('on', i === k));
  el.querySelector('.iv-th.on')?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
}

// ---------- фото на весь экран (из окна объявления — по нажатию на большое фото) ----------
function openViewer(urls, i) {
  const v = $('#viewer'), s = v.querySelector('.viewer-strip');
  s.innerHTML = urls.map(u => `<div class="vs"><div class="vc"><img referrerpolicy="no-referrer" src="${esc(u)}" alt=""></div></div>`).join('');
  v.hidden = false;
  s.querySelectorAll('img').forEach(im => im.complete ? fitCrop(im) : im.addEventListener('load', () => fitCrop(im), { once: true }));
  s.scrollLeft = i * s.clientWidth;
  const count = () => {
    const k = Math.round(s.scrollLeft / s.clientWidth);
    v.querySelector('.viewer-count').textContent = `${k + 1} / ${urls.length}`;
    v.querySelector('.viewer-nav.l').hidden = k <= 0; v.querySelector('.viewer-nav.r').hidden = k >= urls.length - 1;
  };
  s.onscroll = count; count();
  tg?.BackButton.show();
}
// фото без нижней 1/20 (водяные знаки): рамка с пропорцией обрезанного фото, лишнее скрыто
function fitCrop(im) {
  const box = im.closest('.vs, .iv-main, .iv-th'), r = im.naturalWidth / (im.naturalHeight * 0.95);
  if (!box || !r || !box.clientWidth) return;
  const W = box.clientWidth, H = box.clientHeight;
  if (box.classList.contains('iv-th')) {   // миниатюра — заполняет квадрат целиком
    const w = W / H > r ? W : H * r;
    return Object.assign(im.parentElement.style, { width: `${w}px`, height: `${w / r}px` });
  }
  const w = W / H > r ? H * r : W;
  Object.assign(im.parentElement.style, { width: `${w}px`, height: `${w / r}px` });
}
addEventListener('resize', () => document.querySelectorAll($('#viewer').hidden ? '.iv-main img' : '.viewer-strip img').forEach(fitCrop));
function closeViewer() { $('#viewer').hidden = true; if ($('#sheet').hidden) tg?.BackButton.hide(); }
const viewerStep = d => { const s = $('.viewer-strip'); s.scrollBy({ left: s.clientWidth * d, behavior: 'smooth' }); };
$('#viewer').addEventListener('click', e => {
  const n = e.target.closest('[data-vnav]');
  if (n) return viewerStep(+n.dataset.vnav);
  if (e.target.closest('.viewer-close') || e.target.tagName !== 'IMG') closeViewer();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { $('#viewer').hidden ? closeSheet() : closeViewer(); }
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  if (!$('#viewer').hidden) return viewerStep(e.key === 'ArrowRight' ? 1 : -1);
  const iv = !$('#sheet').hidden && !e.target.closest?.('input, textarea, select') && $('#sheet-body .itemv [data-step]');
  if (iv) iv.parentElement.querySelector(`[data-step="${e.key === 'ArrowRight' ? 1 : -1}"]`).click();
});

// ---------- подборка ----------
function selbar() {
  $('#selbar').hidden = !sel.size || !meta?.features.selections;
  // v5.23: «Выбрано 12 (ссылкой до 20, PDF до 10)»; больше 10 — PDF уже нельзя, подсказка об этом
  $('#selcount').innerHTML = `Выбрано: ${sel.size} <small class="sel-lim${sel.size > MAXPDF ? ' over' : ''}">ссылкой до ${MAXSEL}, PDF до ${MAXPDF}</small>`;
  $('#selcount').title = sel.size > MAXPDF ? `Больше ${MAXPDF} объектов — PDF не собрать, только ссылкой` : '';
}
// v5.23e: кнопка «Помощь» (#sup-fab) — над полосой выбора по её фактической высоте (две строки на телефоне ~126 px; sels.css --selbar-top)
if (window.ResizeObserver) new ResizeObserver(() => { const b = $('#selbar'); if (b && !b.hidden && b.offsetHeight) document.documentElement.style.setProperty('--selbar-top', `${Math.ceil(innerHeight - b.getBoundingClientRect().top)}px`); }).observe($('#selbar'));
// подборка из объектов клиента одним нажатием (crm.js): объекты — в подборку, окно подборки с названием и выбранным видом (PDF или ссылка)
function selStart(nums, title, fmt) {
  sel = new Set(nums.slice(0, MAXSEL)); store.set('sel', [...sel]); selbar();
  document.querySelectorAll('.card[data-num]').forEach(el => pickSync(+el.dataset.num));
  $('#sel-make').onclick();
  if ($('#s-title')) $('#s-title').value = title ?? '';
  const r = fmt && document.querySelector(`[name="s-fmt"][value="${fmt}"]`);
  if (r) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
}
$('#sel-rk').onclick = () => me.can_rk ? RK.send([...sel]) : PLANS.locked('rk');   // «📣 В рекламу» рядом с «В подборку» (шаг 4.1)
// v5.24a: «✉️ В рассылку» — все выбранные сразу в «Список рассылки» (то же, что прежняя ✉️ на карточке, auto mail_list_add {nums})
$('#sel-mail').onclick = async () => {
  if (!me.can_mail) return PLANS.locked('mail');
  const b = $('#sel-mail'); b.disabled = true;
  try {
    const r = await fetch(String(window.API).replace(/\/web$/, '/auto'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'mail_list_add', auth: { token }, nums: [...sel] }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.message || j.error || 'Не получилось');
    toast(`В списке рассылки: ${(j.list ?? []).length}. Открыть — «Продвижение» → «Рассылки»`, 4500);
  } catch (err) { toast(err.message, 4500); } finally { b.disabled = false; }
};
$('#sel-video').onclick = () => { location.href = `hub.html#video=${[...sel].slice(0, 10).join(',')}`; };   // «🎬 Ролик» — видеообзор (hub.html, sec/video.js; замок MAX — там же)
$('#sel-clear').onclick = () => { const was = [...sel]; sel.clear(); store.set('sel', []); selbar(); was.forEach(pickSync); };
$('#sel-make').onclick = () => {
  // v5.48 G: эксклюзивы коллег — своя подборка (страница «Эксклюзивы»: ссылка клиенту, PDF, «Написать всем» агентам); смешанный выбор — разделить
  const xs = [...sel].filter(n => n >= 900001), os = [...sel].filter(n => n < 900001);
  if (xs.length && !os.length) { location.href = `excl.html#sel=${xs.join(',')}`; return; }
  if (xs.length && !$('#s-split-ok')) {
    sheet('Подборка', `<p>Выбраны эксклюзивы коллег (${xs.length}) и объявления собственников (${os.length}). Их собирают разными подборками: у эксклюзивов — контакты агентов и «Написать всем» агентам.</p>
      <div class="sheet-foot"><a class="btn ghost" href="excl.html#sel=${xs.join(',')}">💎 Подборка эксклюзивов</a><button class="btn primary" id="s-split-ok">Подборка собственников (${os.length})</button></div>`);
    $('#s-split-ok').onclick = () => { xs.forEach(n => sel.delete(n)); store.set('sel', [...sel]); selbar(); xs.forEach(pickSync); $('#sel-make').onclick(); };
    return;
  }
  let selectionDraft = {edits:{},intro:''};
  const prof = store.get('agent', { name: me.name || '', phone: '' });
  const n = Math.min(sel.size, MAXSEL);
  // v5.23e: раньше selPhones = true записывался при каждой подборке и с галочкой «по умолчанию вкл.» — один раз сбрасываем, дальше — выбор агента
  if (!store.get('selPh523e', false)) { store.set('selPhones', false); store.set('selPh523e', 1); }
  sheet('Подборка', `
    <p><button type="button" class="btn soft" id="s-preview">Объекты и правка подборки</button></p><label class="field">Название<input id="s-title" placeholder="Например: Для Ивана — 2к до 15 млн" maxlength="80"></label>
    <label class="field">Твёрдый бюджет клиента, до (млн ₽)<input id="s-budget" type="number" min="0.1" step="0.1" placeholder="Если клиент назвал предел" value="${client.on && Number(f.pmax) > 0 ? esc(f.pmax) : ''}"></label>
    <p class="hint">Помощник не предложит варианты дороже этого предела. Пустое поле — бюджет пока не задан.</p>
    ${SHARE.formatHtml(n)}
    <label class="field agent-only">Комиссия сверху цены (для клиента): <b id="s-mk-v">${client.on ? client.cm : 5}%</b><input id="s-mk" type="range" min="0" max="10" step="0.5" value="${client.on ? client.cm : 5}"></label>
    <div class="hint agent-only">Цены для клиента будут увеличены на этот процент (округление до 10 000 ₽). 0% — цены собственника.</div>
    <label class="field">Ваше имя для клиента<input id="s-name" value="${esc(prof.name)}"></label>
    <label class="field">Ваш телефон для клиента<input id="s-phone" type="tel" value="${esc(prof.phone)}"></label>
    <label class="chk"><input type="checkbox" id="s-hide" ${store.get('hideAddr', true) ? 'checked' : ''}> <span>Скрыть улицу и номер дома от клиента</span></label>
    <label class="chk agent-only"><input type="checkbox" id="s-ph" ${store.get('selPhones', false) ? 'checked' : ''}> <span>Сразу открыть телефоны собственников для ссылки агенту (в пределах тарифа, 10–15 секунд на объект)</span></label>
    <div class="hint agent-only" id="s-ph-n">Номера тратятся из лимита тарифа только с галочкой. Без неё телефоны можно открыть потом — на странице «Ссылка агенту» кнопкой «📞 Открыть телефоны».</div>
    <div class="hint">Объектов: ${n} (ссылкой до ${MAXSEL}, PDF до ${MAXPDF}).<span class="pdf-only"> Имя файла PDF будет латиницей (открывается на любом телефоне), PDF хранится 7 дней в «Моих подборках».</span></div>
    <p class="hint" id="s-prog"></p><div id="s-lim"></div><p class="err" id="s-err"></p>
    <div class="sheet-foot"><button class="btn ghost" data-close>Отмена</button><button class="btn primary" id="s-go">Сформировать</button></div>`);
  SHARE.mount();
  $('#s-mk').oninput = () => $('#s-mk-v').textContent = `${$('#s-mk').value}%`;
  // v5.23e: галочка телефонов по умолчанию выключена (раньше на каждую ссылку незаметно уходило до 20 номеров); рядом — сколько новых номеров уйдёт.
  // sel_check только считает (номер не открывает): по одному запросу на вид (ссылкой — 20 первых, PDF — 10)
  const phN = {};
  const phHint = () => {
    const el = $('#s-ph-n'); if (!el) return;
    const k = SHARE.format() === 'link' ? MAXSEL : MAXPDF, nums = [...sel].slice(0, k), c = phN[k];
    if (!c && !me.guest && nums.length) { phN[k] = 'wait'; call('sel_check', { nums }).then(r => { phN[k] = r?.need == null ? null : r; phHint(); }).catch(() => { phN[k] = null; }); }
    const need = c && c !== 'wait' ? c.need : null, room = c && c !== 'wait' ? c.room : null;
    const later = 'телефоны можно открыть потом — на странице «Ссылка агенту» кнопкой «📞 Открыть телефоны»';
    el.innerHTML = $('#s-ph').checked
      ? `С галочкой из лимита уйдёт новых номеров: <b>${need ?? `до ${nums.length}`}</b>${room != null ? ` (осталось ${({ hour: 'в этот час', day: 'на сегодня', month: 'в этом месяце' })[c.why] ?? ''} ${room})`.replace('  ', ' ') : ''}, уже открытые — бесплатно. Можно не тратить сейчас: ${later}.`
      : `Номера не тратятся${need != null ? ` (новых в подборке: ${need})` : ''}. ${later[0].toUpperCase()}${later.slice(1)}.`;
  };
  $('#s-preview').onclick=()=>window.SELECTION_EDITOR?.open(0,{nums:[...sel],markup:+$('#s-mk').value,title:$('#s-title').value,...selectionDraft,save:v=>{selectionDraft=v;sel=new Set(v.nums);store.set('sel',v.nums);$('#s-title').value=v.title;selbar();toast('Правки подготовлены. Нажмите «Сформировать».');}});
  $('#s-ph').addEventListener('change', () => { store.set('selPhones', $('#s-ph').checked); phHint(); });
  $('#s-fmt')?.addEventListener('change', phHint);
  phHint();
  let partial = false;   // новых номеров больше остатка — участник сам выбрал «Собрать без части телефонов»
  $('#s-go').onclick = async () => {
    const b = $('#s-go'); b.disabled = true; b.textContent = 'Готовлю…'; $('#s-err').textContent = ''; $('#s-lim').innerHTML = '';
    store.set('agent', { name: $('#s-name').value, phone: $('#s-phone').value }); store.set('hideAddr', $('#s-hide').checked); store.set('selPhones', $('#s-ph').checked);
    const prog = t => { const el = $('#s-prog'); if (el) el.textContent = t; };
    const done = (r, what) => {
      $('#sheet-body').innerHTML = `<p>Подборка готова — ${what}.</p>${r.url ? `<div class="sheet-foot"><a class="btn primary" href="${esc(r.url)}" target="_blank" rel="noopener" data-url="${esc(r.url)}">PDF клиенту</a></div>
        <p class="hint">Ссылка на PDF действует час; сам PDF хранится 7 дней в «Моих подборках».</p>` : ''}${SHARE.resultHtml(r)}
        ${r.phones != null && r.phones < r.total ? `<p class="hint">Телефоны собственников открыты: ${r.phones} из ${r.total}${limit ? ` (${esc(limit)})` : ''} — остальные можно открыть на странице «Ссылка агенту».</p>` : ''}
        ${r.photos_wait ? `<p class="hint"><b>Фото ${r.photos_wait} ${r.photos_wait % 10 === 1 && r.photos_wait % 100 !== 11 ? 'объекта' : 'объектов'} ещё загружаются (2–5 минут)${r.link ? ' — по ссылке клиент увидит их сам, как только загрузятся' : ''}${r.url ? ' — PDF лучше пересобрать чуть позже' : ''}.</b></p>` : ''}
        ${r.photos_none?.length ? `<p class="hint"><b>Без фото и в самом объявлении: № ${r.photos_none.map(n => esc(n)).join(', ')}</b> — клиент увидит заглушку «Фото нет». Можно убрать их и собрать подборку заново.</p>` : ''}
        <p><button type="button" class="btn soft agent-only" id="s-edit-ready">✎ Править подборку</button></p><p class="hint">Все подборки, ссылки и отклики клиентов — в разделе <a href="#sels=all" data-close>«Мои подборки»</a>.</p>`;
      SHARE.bind($('#sheet-body'), toast);
      if (r.id) setTimeout(() => window.AGENT?.rate(r.id), 1500);   // v5.48 F: оценить подборку 1–5 (не чаще 2 раз в неделю — решает сервер)
      // первая подборка ссылкой — предложить «На экран Домой» (один раз), но после того, как агент закроет окно: раньше оно сразу закрывало ссылку клиенту и агенту
      if (r.link) { const sh = $('#sheet'), mo = new MutationObserver(() => { if (sh.hidden) { mo.disconnect(); setTimeout(() => NOTIFY.offerInstall('sel'), 400); } }); mo.observe(sh, { attributes: true, attributeFilter: ['hidden'] }); }
      if (tg?.openLink) $('#sheet-body').onclick = ev => { const a = ev.target.closest('[data-url]'); if (a) { ev.preventDefault(); tg.openLink(a.dataset.url); } };
      $('#s-edit-ready')?.addEventListener('click', () => window.SELECTION_EDITOR?.open(r.id));
      selCache = null;   // «Мои подборки» перечитать
    };
    let limit = '';
    try {
      // телефоны и проверка рекламы — по одному объекту за запрос: сервис телефонов отвечает 7–15 с, один общий запрос упирался в предел времени сервера
      const fmt = SHARE.format(), phones = $('#s-ph').checked && !me.guest, nums = [...sel].slice(0, fmt === 'link' ? MAXSEL : MAXPDF);
      if (sel.size > nums.length) throw new Error(`В PDF до ${MAXPDF} объектов — уберите ${sel.size - MAXPDF} или выберите «Ссылка»`);
      const args = { nums, title: $('#s-title').value, markup: +$('#s-mk').value, agent: $('#s-name').value, agent_phone: $('#s-phone').value,
        hide_addr: $('#s-hide').checked, format: fmt, phones,
        search_constraints: { ...(Number($('#s-budget').value) > 0 ? { budget_max: Math.round(Number($('#s-budget').value) * 1e6) } : {}) } };
      if (phones) {
        // новых номеров больше, чем осталось, — не обрезаем молча: сколько не хватает; убрать объекты, докупить или собрать без части телефонов
        if (!partial) {
          const c = await call('sel_check', { nums });
          PLANS.counter(c.used);
          if (c.need > c.room) {
            const miss = c.need - c.room, when = { day: 'на сегодня', month: 'в этом месяце', hour: 'в этот час' }[c.why] ?? '';
            $('#s-lim').innerHTML = `<div class="lim"><p>В подборке новых номеров: ${c.need}, а ${when} осталось ${c.room}. Не хватает ${miss}. Уберите ${miss} ${miss === 1 ? 'объект' : miss < 5 ? 'объекта' : 'объектов'} из подборки или докупите номера.</p>
              <div class="sheet-foot"><button class="btn ghost" data-close>Убрать объекты</button>${c.why !== 'hour' && c.pack ? `<button class="btn soft" data-pack>Докупить ${c.pack.qty} номеров за ${c.pack.usd} $</button>` : ''}
              <button class="btn ghost" id="s-part">Собрать без ${miss} ${miss === 1 ? 'телефона' : 'телефонов'}</button></div></div>`;
            $('#s-part').onclick = () => { partial = true; $('#s-go').click(); };
            b.disabled = false; b.textContent = 'Сформировать'; return;
          }
        }
        for (const [i, n] of nums.entries()) {
          const x = items.get(n);
          if (x?.phone && x.ad_state) continue;
          prog(`Открываю телефоны собственников: ${i + 1} из ${nums.length}…`);
          for (let t = 0; t < 2; t++) {
            try { const p = await call('phone', { num: n, via: 'pdf' }); PLANS.counter(p.used); if (x) { x.phone = p.phone; x.ad_state = p.ad_state ?? x.ad_state; } break; }
            catch (err) { if (err.gate) throw err; if (err.data?.limit) { limit = err.message; break; } }
          }
          if (limit) break;
        }
      }
      prog(`${limit ? limit + ' ' : ''}${fmt === 'link' ? 'Создаю ссылку…' : 'Собираю PDF…'}`); b.textContent = fmt === 'link' ? 'Создаю ссылку…' : 'Собираю PDF…';
      const r = await call('sel_create', { ...args, edits:selectionDraft.edits,intro:selectionDraft.intro,arch_nums:store.get('sel_arch',[]).filter(n=>nums.includes(n)), partial: partial || !!limit });
      if (r.used) PLANS.counter(r.used);
      done(r, fmt === 'link' ? 'ссылка для клиента' : fmt === 'both' ? 'PDF и ссылка для клиента' : 'PDF для клиента');
      window.INVITE?.hit('sel');
    } catch (e) { if (e.gate) return showLogin(e.gate); $('#s-err').textContent = e.message; b.disabled = false; b.textContent = 'Сформировать'; }
  };
};
// ---------- «Мои подборки» — раздел на главной (v5.23): ./#sels, ./#sels=all | own | fb (меню — nav.js, вкладка C) ----------
// не шторка, а своя страница вместо выдачи: вкладки «Все», «Ответы собственников» (auto own_marks, вкладка A), «Отклики клиентов».
// Уйти — любой пункт меню, «Назад» браузера или другой адрес.
var selCache = null, selTab = null;   // var: tabs() зовётся и до этой строки
async function showSelections(tab) {
  tab = SHARE.TABS.includes(tab) ? tab : /^#sels=(\w+)$/.exec(location.hash)?.[1] ?? 'all';
  if (!SHARE.TABS.includes(tab)) tab = 'all';
  closeSheet(); sheetGo = null;   // раздел, а не окно: подсветка пункта меню — по selTab (tabs)
  let box = $('#selpage');
  if (!box) {
    $('main').insertAdjacentHTML('afterend', '<section id="selpage" aria-label="Мои подборки"></section>');
    box = $('#selpage');
    SHARE.bind(box, toast);
    box.addEventListener('click', onSelPage);
  }
  const was = selTab;
  selTab = tab; box.hidden = false; document.body.classList.add('selmode'); tabs();
  if (location.hash !== `#sels=${tab}`) history[was ? 'replaceState' : 'pushState'](null, '', `${location.pathname}${location.search}#sels=${tab}`);
  if (!was) scrollTo(0, 0);
  if (tab === 'main') return selMain(box);   // v5.37a: подборки группы Main
  if (selCache && Date.now() - selCache.at < 60e3) { box.innerHTML = SHARE.page(selCache, tab); return; }
  box.innerHTML = '<div class="sp-head"><h1>Мои подборки</h1></div><p class="muted">Загрузка…</p>';
  try {
    const r = await call('sel_list');
    selCache = { at: Date.now(), items: r.items, marks: null, pending: true, main: !!r.main };
    if (selTab) box.innerHTML = SHARE.page(selCache, selTab);
    // ответы собственников (вкладка A, auto own_marks) — следом, список уже на экране; действия нет или ошибка — молча без них
    const nums = [...new Set(r.items.flatMap(s => s.nums))].slice(0, 500), c = selCache;   // own_marks берёт до 500 номеров — свежие подборки первыми
    c.marks = nums.length ? await fetch(String(window.API).replace(/\/web$/, '/auto'), { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'own_marks', auth, nums }) }).then(x => x.json()).then(m => m?.marks ?? null, () => null) : null;   // call() ходит только в web
    c.pending = false;
    if (selTab && selCache === c) box.innerHTML = SHARE.page(c, selTab);
  } catch (e) { if (e.gate) return showLogin(e.gate); box.innerHTML = `<div class="sp-head"><h1>Мои подборки</h1></div><p class="err">${esc(e.message)}</p>`; }
}
async function selMain(box) {
  const d = { ...(selCache ?? { items: [], marks: null }), main: true, mainItems: null };
  box.innerHTML = SHARE.page(d, 'main');
  try { const r = await call('sel_list', { scope: 'main' }); d.mainItems = r.items; d.mainMembers = r.members; }
  catch (e) { if (e.gate) return showLogin(e.gate); d.mainErr = e.message; }
  if (selTab === 'main') box.innerHTML = SHARE.page(d, 'main');
}
function leaveSelections() {
  if (!selTab) return;
  selTab = null; $('#selpage').hidden = true; document.body.classList.remove('selmode');
  if (/^#sels/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
  tabs();
}
async function onSelPage(e) {
  const edit = e.target.closest('[data-edit-selection]'); if (edit) return window.SELECTION_EDITOR?.open(+edit.dataset.editSelection);
  const a = e.target.closest('[data-url]'); if (a && tg?.openLink) { e.preventDefault(); tg.openLink(a.dataset.url); return; }
  const t = e.target.closest('.sp-tab'); if (t) { e.preventDefault(); showSelections(t.getAttribute('href').slice(6)); return; }
  const k = e.target.closest('[data-rk]'); if (k) return me.can_rk ? RK.send(k.dataset.rk.split(',').map(Number)) : PLANS.locked('rk');
  const v = e.target.closest('[data-video]'); if (v) { location.href = `hub.html#video=${v.dataset.video}`; return; }
  const g = e.target.closest('[data-again]');
  if (g) {
    const add = g.dataset.again.split(',').map(Number).filter(n => !sel.has(n)), room = MAXSEL - sel.size;
    add.slice(0, room).forEach(n => sel.add(n)); store.set('sel', [...sel]); selbar();
    toast(add.length > room ? `Добавлено ${Math.max(0, room)} — в подборке до ${MAXSEL} объектов` : 'Объекты выбраны — внизу «📄 В подборку»');
    return;
  }
  const co = e.target.closest('[data-client-open]'); if (co && meta?.features.crm) { e.preventDefault(); CRM.openClient(+co.dataset.clientOpen); return; }
  if (window.PICK?.onCopy(e, toast)) return;   // v5.48 H9: «Скопировать» у ссылки «Клиент выбирает сам»
  const pe = e.target.closest('[data-pext]');
  if (pe) {
    pe.disabled = true;
    try { const r = await call('pick_extend', { id: +pe.dataset.pext }); toast(`Ссылка продлена до ${new Date(r.until).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`); selCache = null; showSelections(selTab); }
    catch (err) { pe.disabled = false; toast(err.message, 5000); }
    return;
  }
  const x = e.target.closest('[data-extend]');
  if (x) {
    x.disabled = true;
    try { const r = await call('sel_extend', { id: +x.dataset.extend }); toast(`Ссылка продлена до ${new Date(r.until).toLocaleDateString('ru-RU')}`); selCache = null; showSelections(selTab); }
    catch (err) { x.disabled = false; toast(err.message); }
    return;
  }
  // v5.31a: свёрнутые карточки — «Показать отклики ▾»; «⋯» — одно меню открыто; «🗑 Удалить подборку» (мягко) и «Вернуть» 8 с; «🤖 Позвать помощника ИИ» (вкладка B)
  const tg2 = e.target.closest('[data-sptg]'); if (tg2) { SHARE.toggle(tg2.dataset.sptg); return; }
  const dots = e.target.closest('.sp-dots'); $('#selpage').querySelectorAll('.sp-dots[open]').forEach(d => { if (d !== dots) d.open = false; });
  const del = e.target.closest('[data-del]'); if (del) { if (dots) dots.open = false; return selDelAsk(+del.dataset.del); }
  const ai = e.target.closest('[data-selai]');
  if (ai) {
    const arg = { sel_id: +ai.dataset.selai, t: ai.dataset.t || null, ...(ai.dataset.pick ? { pick: true } : {}) };
    if (!window.SELAI?.open) { toast('Помощник загружается…'); await new Promise(ok => { const el = document.createElement('script'); el.src = 'selai.js?v=5.48k4'; el.onload = el.onerror = ok; document.head.appendChild(el); }); }
    if (window.SELAI?.open) window.SELAI.open(arg); else toast('Помощник пока недоступен — обновите страницу через минуту', 5000);
  }
}
function selDelAsk(id) {
  const s = selCache?.items?.find(i => i.id === id);
  sheet('Удалить подборку?', `<p>${s ? `«${esc(s.title)}» — ` : ''}ссылка у клиента перестанет открываться. Отклики сохранятся 30 дней, потом удалятся.</p>
    <div class="sheet-foot"><button class="btn danger" id="sp-del-go">🗑 Удалить</button><button class="btn ghost" data-close>Отмена</button></div>`);
  $('#sp-del-go').onclick = async () => {
    const b = $('#sp-del-go'); b.disabled = true; b.textContent = 'Удаляю…';
    try {
      await call('sel_delete', { id });
      selUndo(id, s);   // ревью 05.11: «Вернуть» — сразу, до перерисовки
      closeSheet();
      if (selCache) { selCache.items = selCache.items.filter(i => i.id !== id); if (selTab) $('#selpage').innerHTML = SHARE.page(selCache, selTab); }
      else if (selTab) showSelections(selTab);
    } catch (err) { b.disabled = false; b.textContent = '🗑 Удалить'; toast(err.message, 5000); }
  };
}
function selUndo(id, s) {
  $('#sp-undo')?.remove();
  document.body.insertAdjacentHTML('beforeend', `<div class="sp-undo" id="sp-undo" role="status"><span>Подборка удалена</span><button type="button" class="btn soft">Вернуть</button></div>`);
  const el = $('#sp-undo'), t = setTimeout(() => el.remove(), 8000);
  el.querySelector('button').onclick = async () => {
    clearTimeout(t); el.remove();
    try { await call('sel_delete', { id, undo: true }); toast('Подборка возвращена'); selCache = null; if (selTab) showSelections(selTab); }
    catch (err) { toast(err.message, 5000); }
  };
}
// пункт меню «Мои подборки» открывает раздел (обработчик [data-go] выше); другой пункт меню — уйти из раздела
document.addEventListener('click', e => { const g = e.target.closest('.top [data-go]'); if (g && selTab && g.dataset.go !== 'sels' && g.dataset.go !== 'client') leaveSelections(); }, true);
addEventListener('hashchange', () => { const h = /^#sels(?:=(\w+))?$/.exec(location.hash); if (h && me && !me.guest) showSelections(h[1] ?? 'all'); else if (!h) leaveSelections(); });
addEventListener('popstate', () => { if (!/^#sels/.test(location.hash)) leaveSelections(); });
// режим «С клиентом» (экран показывают клиенту) — раздел агента закрыть: там ответы собственников, ссылка агенту, PDF агенту
// Подборки доступны в режиме клиента; служебные кнопки скрывает agent-only.

// ---------- карта ----------
// окно точки и список под картой — та же карточка, что в выдаче (card в компактном виде). Точка карты лёгкая (цена, площадь, этаж, ЖК, фото);
// дату, «★ Избранное» и телефон карточка получает следом — действием items пачкой до 60, без отметки «просмотрено»
let map = null, cluster = null, mctl = null, openPop = null;   // openPop — открытое окно на карте
const hoverOk = matchMedia('(hover: hover)').matches;   // компьютер с мышью: окна по наведению
let hoverT = null;
// v5.16: окно по наведению — через 0,2 с (мышь просто проехала — ничего не всплывает); ушла с метки и с окна — закрыть через 0,4 с
function hoverOpen(fn) { clearTimeout(hoverT); hoverT = setTimeout(fn, 200); }
// v5.18: окно точки компактное (264 px) и всегда целиком в поле карты. Карту не сдвигаем (autoPan выключен): окно встаёт над меткой,
// под ней (не помещается сверху) и прижимается к краям; не помещается ни там, ни там — список внутри прокручивается. Сторону, выбранную
// при открытии, держим (keep), пока окно там помещается, — окно не прыгает, когда догрузилась карточка или открылся телефон.
// Телефон — нижняя шторка внутри карты (#map-sheet), карта под ней не двигается.
const POPW = 340, POPM = 8, POPGAP = 14;   // v5.47 E: окно шире (было 264), фото крупнее — Алексей, п. 14
const popOpts = () => ({ minWidth: POPW, maxWidth: POPW, autoPan: false, className: 'mkpop' });
const popRO = window.ResizeObserver ? new ResizeObserver(() => { cancelAnimationFrame(popRO.f); popRO.f = requestAnimationFrame(() => { if (openPop) placePop(openPop, true); }); }) : null;
function placePop(p, keep = false) {
  const el = p?.getElement(), box = el?.querySelector('.mlist');
  if (!map || !el || !p._map) return;
  // Leaflet: низ окна = точка + offset.y − 20 (margin-bottom под хвостик), хвостик (20 px) в высоту окна не входит
  const sz = map.getSize(), pt = map.latLngToContainerPoint(p.getLatLng());
  // v5.47 E: окно — в пределах видимой части карты (карта могла уехать под шапку или за низ окна браузера)
  const vis = visBox(sz);
  const up = pt.y - 13 - vis.t, down = vis.b - pt.y - POPGAP;
  if (box) box.style.maxHeight = '';
  const h = el.offsetHeight;
  let side = h <= up ? 'up' : h <= down ? 'down' : up >= down ? 'up' : 'down';
  if (keep && p._side && p._side !== side && h <= (p._side === 'up' ? up : down)) side = p._side;
  // v5.47 E: окно крупнее и не помещается ни сверху, ни снизу — один раз сдвигаем карту (метка уходит вниз), чтобы окно встало целиком
  if (!keep && !p._panned && h > up && h > down && h < vis.b - vis.t - POPGAP - 13) {
    p._panned = true; map.panBy([0, -Math.round(Math.min(h - up + 6, vis.b - pt.y - 40))], { animate: false });
    return placePop(p, false);
  }
  p._side = side;
  el.classList.toggle('flip', side === 'down');
  const room = side === 'up' ? up : down;
  if (h > room && box) box.style.maxHeight = `${Math.max(110, box.offsetHeight - (h - room))}px`;
  const w = el.offsetWidth, left = pt.x - w / 2;
  const dx = left < vis.l ? vis.l - left : left + w > vis.r ? vis.r - (left + w) : 0;
  const tip = el.querySelector('.leaflet-popup-tip-container');   // хвостик — над меткой, даже если окно прижато к краю
  if (tip) tip.style.marginLeft = `${-20 - Math.max(-w / 2 + 24, Math.min(w / 2 - 24, Math.round(dx)))}px`;
  p.options.offset = L.point(Math.round(dx), side === 'up' ? 7 : el.offsetHeight + 20 + POPGAP);
  p._updatePosition();
}
// видимая часть карты в её координатах: без шапки сайта сверху и того, что за краями окна браузера
function visBox(sz) {
  const rc = map.getContainer().getBoundingClientRect(), hdr = Math.max(0, document.querySelector('.top')?.getBoundingClientRect().bottom ?? 0);
  return { t: Math.max(POPM, hdr - rc.top + POPM), b: Math.min(sz.y, innerHeight - rc.top) - POPM,
    l: Math.max(POPM, -rc.left + POPM), r: Math.min(sz.x, document.documentElement.clientWidth - rc.left) - POPM };
}
// открыть точку (одну или несколько в одном доме): компьютер — окно у метки, телефон — шторка снизу карты
function openPts(latlng, ps) {
  const key = ps.map(p => p.num).join(',');
  loadItems(ps.map(p => p.num));
  // v5.47 E (Алексей, п. 14): на телефоне объявления точки — крупными карточками сразу ПОД картой (не шторкой внутри неё):
  // список не обрезается, не прячется под кнопкой чата, листается вместе со страницей; карта остаётся видна сверху
  if (mobile()) {
    let s = $('#map-pt');
    if (!s) {
      s = document.createElement('section'); s.id = 'map-pt'; s.className = 'map-pt'; $('#map').after(s);
      s.addEventListener('click', e => { if (e.target.closest('.mp-x')) { s.hidden = true; return; } const c = e.target.closest('.card'); if (c) onCard(e, c); });
    }
    s.innerHTML = `<div class="mp-h"><b>${ps.length > 1 ? `${ps.length} объявл. здесь` : 'Объявление в этой точке'}</b><button type="button" class="mp-x" aria-label="Закрыть">×</button></div>
      <div class="mp-items">${ps.map(ptCard).join('')}</div>`;
    s.hidden = false; s.dataset.key = key;
    const top = s.getBoundingClientRect().top;   // начало списка — чуть ниже середины экрана: видно и низ карты, и первую карточку
    if (top > innerHeight * .62 || top < 60) scrollBy({ top: top - innerHeight * .42, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    return;
  }
  if (openPop?._key === key && openPop._map) return;
  const p = L.popup(popOpts()).setLatLng(latlng).setContent(popHtml(ps));
  p._key = key; p.openOn(map);
}
function hoverLeave() {
  clearTimeout(hoverT);
  hoverT = setTimeout(() => { const el = openPop?.getElement(); if (el && !el.matches(':hover')) map.closePopup(); }, 400);
}
const mlnShort = v => v >= 1e6 ? `${(v / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: v >= 1e8 ? 0 : 1 })} млн` : `${Math.round(v / 1e3)} тыс`;
// v5.24a: «Низкая цена» / «Низкая за м²» — плашка под ценой мини-карточки (окно точки и список под картой)
const lowBy = new Map();
const lowHtml = num => { const l = lowBy.get(num); if (!l) return '';
  const where = l.g.startsWith('z') ? 'в этом ЖК' : 'в этом доме', tip = t => `${t} среди ${l.n} таких же объектов ${where} на карте (тот же тип и комнатность)`;
  return `<div class="lowtags">${l.p ? `<span class="lowtag" title="${tip('Самая низкая цена')}">Низкая цена</span>` : ''}${l.m ? `<span class="lowtag m" title="${tip('Самая низкая цена за м²')}">Низкая за м²</span>` : ''}</div>`; };
const withLow = (h, num) => lowBy.has(num) ? h.replace(/(<div class="price[^"]*">[\s\S]*?<\/div>)/, `$1${lowHtml(num)}`) : h;
const ptCard = p => withLow(card(items.get(p.num) ?? p, true), p.num);
// самая низкая цена и цена за м² среди точек карты одного ЖК (или дома), того же типа и комнатности, если таких от 2
function lowMark(pts) {
  lowBy.clear();
  const G = new Map();
  for (const p of pts) {
    if (!(p.price > 0) || !p.g) continue;
    const k = `${p.g}|${p.kind ?? ''}|${p.rooms ?? ''}`;
    (G.get(k) ?? G.set(k, []).get(k)).push(p);
  }
  for (const [, ps] of G) {
    if (ps.length < 2) continue;
    const lo = ps.reduce((a, b) => b.price < a.price ? b : a);
    const wm = ps.filter(p => p.area > 0), lm = wm.length >= 2 ? wm.reduce((a, b) => b.price / b.area < a.price / a.area ? b : a) : null;
    if (ps.some(p => p !== lo && p.price === lo.price)) continue;   // одинаковая цена у нескольких — «самой низкой» нет
    for (const [p, key] of [[lo, 'p'], [lm, 'm']]) if (p) { const l = lowBy.get(p.num) ?? { g: p.g, n: ps.length }; l[key] = true; lowBy.set(p.num, l); p.low = true; }
  }
}
const popHtml = ps => `<div class="mlist${ps.length > 1 ? ' many' : ''}">${ps.length > 1 ? `<b class="ml-n">${ps.length} объявл. здесь</b>` : ''}${ps.map(ptCard).join('')}</div>`;
async function loadItems(nums) {
  const need = [...new Set(nums)].filter(n => !items.has(n)).slice(0, 60);
  if (!need.length) return;
  try {
    const r = await call('items', { nums: need });
    for (const x of r.items ?? []) {
      items.set(x.num, x);
      document.querySelectorAll(`.card.mc[data-num="${x.num}"]`).forEach(el => { el.outerHTML = withLow(card(x, true), x.num); });
    }
    // окно на карте выросло (дата, ЖК, отметки) — пересчитать размер и сдвинуть карту, чтобы окно было видно целиком
    if (openPop && r.items.some(x => openPop.getElement()?.querySelector(`.card.mc[data-num="${x.num}"]`))) placePop(openPop, true);
  } catch (e) { if (e.gate) showLogin(e.gate); }   // не ответил — карточка остаётся по данным точки
}
async function loadMap() {
  if (!window.L) return toast('Карта ещё загружается…');
  if (!map) {
    map = L.map('map', { zoomControl: true, attributionControl: false }).setView([43.585, 39.723], 11);
    // v5.20: вместо строки «Leaflet | © OpenStreetMap» — маленький «ⓘ»; нажатие показывает подпись (лицензия OpenStreetMap требует, чтобы она была доступна)
    const Info = L.Control.extend({ options: { position: 'bottomleft' }, onAdd() {
      const d = L.DomUtil.create('div', 'map-info');
      d.innerHTML = '<button type="button" aria-label="Источник карты" title="Источник карты">ⓘ</button><span hidden>© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a></span>';
      L.DomEvent.disableClickPropagation(d);
      d.querySelector('button').onclick = () => { const t = d.querySelector('span'); t.hidden = !t.hidden; };
      return d;
    } });
    new Info().addTo(map);
    // v5.16: список под картой обновляется через 3 с после остановки (пока двигают — не перерисовываем)
    map.on('movestart', () => { clearTimeout(mapList.wait); $('#ml-items').classList.add('wait'); })
      .on('moveend', () => { clearTimeout(mapList.wait); mapList.wait = setTimeout(() => mapList(), 3000); })
      .on('popupopen', e => { openPop = e.popup; const el = e.popup.getElement(); placePop(e.popup);
        if (el) popRO?.observe(el.querySelector('.leaflet-popup-content'));
        if (hoverOk && el && !el._hv) { el._hv = 1; el.addEventListener('mouseenter', () => clearTimeout(hoverT)); el.addEventListener('mouseleave', hoverLeave); } })
      .on('popupclose', e => { popRO?.disconnect(); if (openPop === e.popup) openPop = null; })
      .on('zoomend', () => { if (openPop) placePop(openPop, true); })
      .on('click', () => { const s = $('#map-pt'); if (s) s.hidden = true; });
    (window.MAPBASE ? MAPBASE.add(map) : L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map));   // v5.23: Яндекс по ключу из админки, иначе OpenStreetMap; источник — свёрнутым «ⓘ»
  }
  [50, 400, 1200].forEach(ms => setTimeout(() => map.invalidateSize(), ms));   // раскладка «список слева, карта справа» меняет размер после показа
  mctl?.abort();
  const ctl = mctl = new AbortController();
  $('#status').textContent = 'Загружаю точки…';
  try {
    const r = await call('map', { f: FUI.clean(f), text, cm: cmOn() }, ctl.signal);
    cluster?.remove();
    // несколько объявлений в одном доме (точки ближе 40 м) — открываются списком карточек, а не разлетаются по карте;
    // без анимации «разлёта» при увеличении: кружки просто пересобираются, карта не дёргается; точки добавляются частями
    // v5.15 (как у Авито): у метки — цена «от 12,5 млн», у группы — число и цена «от»; один адрес — одна метка со списком;
    // метки появляются плавно (CSS mfade), без «разлёта»; навёл мышку — всплывают все предложения этой точки
    cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: z => z >= 15 ? 40 : z >= 13 ? 60 : 80,   // v5.16: шире — метки с ценой не наезжают друг на друга spiderfyOnMaxZoom: false, zoomToBoundsOnClick: false,
      animate: false, chunkedLoading: true, chunkInterval: 120, removeOutsideVisibleBounds: true,
      // v5.24a: облачко-диалог как у Авито — «6 от 6,7 млн»; внутри есть «Низкая цена» — мягкая пульсация
      iconCreateFunction: c => { const ps = c.getAllChildMarkers().map(m => m.p), min = Math.min(...ps.map(p => p.price || Infinity));
        return L.divIcon({ className: `mk-c${ps.some(p => p.low) ? ' low' : ''}`, html: `<span><b>${ps.length}</b>${Number.isFinite(min) ? ` от ${mlnShort(priceOf(min))}` : ''}</span>`, iconSize: null }); } });
    // наведение на группу из одного дома — сразу список; на большую группу — подсказка «нажмите, чтобы приблизить»
    if (hoverOk) cluster.on('clustermouseover', e => {
      const b = e.layer.getBounds();
      if (map.distance(b.getNorthEast(), b.getSouthWest()) > 40) return;
      hoverOpen(() => {
        const ps = e.layer.getAllChildMarkers().map(m => m.p).sort((a, b2) => a.i - b2.i);
        openPts(e.layer.getLatLng(), ps);
      });
    }).on('clustermouseout', hoverLeave);
    cluster.on('clusterclick', e => {
      const b = e.layer.getBounds();
      if (map.distance(b.getNorthEast(), b.getSouthWest()) > 40 && map.getZoom() < map.getMaxZoom()) return e.layer.zoomToBounds({ padding: [30, 30] });
      const ps = e.layer.getAllChildMarkers().map(m => m.p).sort((a, b) => a.i - b.i);
      openPts(e.layer.getLatLng(), ps);
    });
    // цена точки — собственника; с комиссией («С клиентом») — при показе, как в выдаче
    mapPts = r.points.map(([num, lat, lng, price, rooms, kind, area, floor, floors, addr, ph, nw, old, g, xx], i) =>
      ({ i, num, lat, lng, price, rooms, kind, area, floor, floors, address: addr, ph, nw, old: old ? 1 : 0, web_photos: ph ? 1 : 0, lite: true, g: g ?? (addr ? `a${addr}` : ''), ...(xx === 'x' ? { excl: true, pics: ph ? [ph] : [] } : {}) }));   // v5.48 G: эксклюзив коллеги
    lowMark(mapPts);   // v5.24a: ключ ЖК/дома с сервера (g), из старого кэша — по адресу точки
    const marks = mapPts.map(p => {
      const m = L.marker([p.lat, p.lng], { icon: L.divIcon({ className: `mk-p${p.low ? ' low' : ''}${p.excl ? ' mk-x' : ''}`, html: `<span>${p.price ? mlnShort(priceOf(p.price)) : '•'}</span>`, iconSize: null }), zIndexOffset: p.low ? 500 : 0 });
      m.p = p;
      m.on('click', () => { clearTimeout(hoverT); openPts(m.getLatLng(), [p]); });
      if (hoverOk) m.on('mouseover', () => hoverOpen(() => openPts(m.getLatLng(), [p]))).on('mouseout', hoverLeave);
      return m;
    });
    map.addLayer(cluster);
    cluster.addLayers(marks);
    if (marks.length) map.fitBounds(L.latLngBounds(mapPts.map(p => [p.lat, p.lng])), { maxZoom: 15, padding: [20, 20], animate: false });
    $('#status').textContent = r.points.length ? `На карте: ${r.points.length.toLocaleString('ru-RU')}` : 'Ничего не нашлось — в «Списке» видно, какой фильтр мешает';
    $('#apply').textContent = `Показать ${r.points.length.toLocaleString('ru-RU')}`;
    clearTimeout(mapList.wait); mapList.key = ''; mapList();   // первый раз — сразу, без ожидания
  } catch (e) { if (ctl.signal.aborted) return; if (e.gate) return showLogin(e.gate); $('#status').textContent = `Ошибка карты: ${e.message}`; }
}
// список объявлений в видимой части карты (под картой): обновляется при сдвиге и масштабе, карточки догружаются следом
let mapPts = [], mlShown = 60;
function mapList(reset = true) {
  if (!map || view !== 'map') return;
  if (reset) mlShown = 60;
  const b = map.getBounds(), by = {
    new: (a, c) => a.i - c.i, price: (a, c) => (a.price || 9e15) - (c.price || 9e15),
    price_desc: (a, c) => (c.price || 0) - (a.price || 0), area_desc: (a, c) => (c.area || 0) - (a.area || 0) };
  const cmp = by[sort] ?? by.new, list = mapPts.filter(p => b.contains([p.lat, p.lng])).sort((a, c) => a.old - c.old || cmp(a, c)), shown = list.slice(0, mlShown);   // старше 6 месяцев — внизу
  $('#ml-items').classList.remove('wait');
  const key = `${sort}|${shown.map(p => p.num).join(',')}`;
  if (key === mapList.key) return;   // та же область — не перерисовываем (фото не мигают)
  mapList.key = key;
  $('#ml-count').textContent = `В области карты: ${list.length.toLocaleString('ru-RU')}`;
  $('#ml-sort').value = by[sort] ? sort : 'new';
  $('#ml-items').innerHTML = shown.map((p, i) => (p.old && !shown[i - 1]?.old ? FUI.oldLine() : '') + ptCard(p)).join('') || '<p class="muted">В этой части карты объявлений нет — отдалите карту.</p>';
  $('#ml-more').hidden = list.length <= mlShown;
  clearTimeout(mapList.t); mapList.t = setTimeout(() => loadItems(shown.map(p => p.num)), 300);
}
$('#ml-items').addEventListener('click', e => onCard(e, e.target.closest('.card')));
$('#ml-more').onclick = () => { mlShown += 60; mapList(false); };
$('#ml-sort').onchange = () => { sort = $('#ml-sort').value; $('#sort').value = sort; savePrefs(); mapList(); };
$('#map').addEventListener('click', e => { const c = e.target.closest('.card'); if (c) onCard(e, c); });
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => {
  view = b.dataset.view;
  document.querySelectorAll('[data-view]').forEach(x => { x.classList.toggle('on', x === b); x === b ? x.setAttribute('aria-current', 'true') : x.removeAttribute('aria-current'); });
  $('#list').hidden = view === 'map'; $('#map').hidden = view !== 'map'; $('#more').hidden = view === 'map' || offset >= total; $('#layouts').hidden = view === 'map';
  $('#maplist').hidden = view !== 'map';
  if ($('#map-pt')) $('#map-pt').hidden = true;
  document.body.classList.toggle('mapmode', view === 'map');   // v5.15: слева объявления области в 2 столбца, справа карта, фильтр свёрнут
  view === 'map' ? loadMap() : search();
});

// ---------- меню ----------
// «Избранное» и «Контакт» — свои списки поверх поиска; повторное нажатие возвращает прежние фильтры
const LISTS = { favs: ['fav', 'Показано избранное — к поиску вернёт «Все объявления» или повторное нажатие на «★ Избранное»'],
  deals: ['deal', '«Контакт»: собственники, ответившие на рассылку, и отмеченные вами. Фильтр слева работает внутри «Контакта»; к поиску вернёт «Все объявления»'],
  // v5.22: только админ — скрытые (👁) и удалённые (🗑) объявления; «Вернуть» на карточке, переключатель «Скрытые / Удалённые» над списком
  hidden: ['hid', 'Скрытые и удалённые объявления — видите только вы. «Вернуть» на карточке возвращает объявление в поиск'] };
document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
  const g = b.dataset.go;
  menuOpen(false); mgClose();   // на телефоне меню — панель под «☰ Меню»: выбрали раздел — закрыть
  if (g === 'all' && favMode) { ({ f, text } = beforeFav); $('#q').value = text; leaveFav(); changed(); }   // «Все объявления» — назад к поиску
  if (LISTS[g]) {
    const was = favMode;
    if (was) { ({ f, text } = beforeFav); $('#q').value = text; leaveFav(); if (was === g) { changed(); return; } }
    beforeFav = { f, text }; favMode = g; tabs();
    f = { [LISTS[g][0]]: g === 'hidden' ? 'hide' : true }; $('#q').value = ''; changed();
    toast(LISTS[g][1], 4000);
  }
  if (['sels', 'selhow', 'rk', 'mail', 'admin', 'pay', 'prof', 'crm'].includes(g) || (g === 'arch' && !me.can_arch)) sheetGo = g;   // окно меню открыто — подсвечен его пункт
  if (g === 'client') clientSheet();
  if (g === 'pick') pickSheet({ f });   // v5.48 H9: «🔗 Клиент выбирает сам» — текущий фильтр становится рамкой
  if (g === 'sels') showSelections(b.dataset.tab || 'all');   // v5.23c: «Мои подборки» — своя группа меню: все / ответы собственников / отклики клиентов
  if (g === 'selhow') selHow();
  if (g === 'crm') CRM.open();   // клиенты и задачи (site/crm.js)
  // Реклама, Рассылки, Архив — в PRO и MAX; без них — описание и «Оформить PRO»
  if (g === 'rk') { if (!window.RK) return toast('Раздел «Реклама» не загрузился — возможно, его режет блокировщик рекламы в браузере', 6000); if (me.can_rk) RK.open(); else PLANS.locked('rk'); }   // «Реклама» — site/plc/plc.js (шаг 4.1; v5.26f: папка была reklama/ — её вырезают блокировщики рекламы в Safari, сайт на iPhone не запускался)
  if (g === 'mail') { if (me.can_mail) location.href = 'mail.html'; else PLANS.locked('mail'); }   // рассылки — своя страница mail.html (шаг 4.2)
  if (g === 'arch') { if (me.can_arch) location.href = 'arch.html'; else PLANS.locked('arch'); }   // «Архив 2 года» — своя страница со своим фильтром и картой
  if (g === 'prof') PROFILE.open();   // профиль: тариф, номера, контакты, устройства
  if (g === 'admin') admin();
  if (g === 'mod') modSheet();   // v5.37a: группа Main — жалобы на объявления
  if (g === 'pay') location.href = 'pay.html';   // оплата — своя страница (ТЗ v2, шаг 2.2, окно Б)
});
$('#logout').onclick = () => { menuOpen(false); logout(); };
// телефон: шапка в одну строку — логотип, профиль со счётчиком номеров и «☰ Меню» (все разделы — в панели под шапкой)
function menuOpen(on) { $('.top').classList.toggle('open', on); $('#burger').setAttribute('aria-expanded', on); }
$('#burger').onclick = () => menuOpen(!$('.top').classList.contains('open'));
// v5.26 (п. 4 задачи 04.11): «Для Агента» в шапке — на домашнюю: закрыть окна и меню, «Все объявления» (из Избранного, Подборок), наверх
$('#brand-home')?.addEventListener('click', e => {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;   // в новой вкладке — как обычная ссылка
  e.preventDefault(); menuOpen(false); mgClose(); closeSheet(); if (!$('#viewer').hidden) closeViewer();
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  if (selTab) leaveSelections();
  if (favMode) document.querySelector('.top [data-go="all"]')?.click();
  requestAnimationFrame(() => scrollTo({ top: 0, behavior: 'smooth' }));
});
// группы меню («Объявления», «Моё», «Продвижение»…): поведение — общий nav.js (нажатие; на компьютере с мышью — и наведение)
function mgClose(except) { window.NAV?.close(except); }
// группа видна, если в ней есть видимый пункт; подсвечена, если открыт её пункт
function mgSync() {
  document.querySelectorAll('.menu .mg').forEach(g => {   // v5.20: меню «Профиля» (.whomg, nav.js) — не трогаем
    const items = [...g.querySelectorAll('.mg-p > [data-go], .mg-p > a')];
    g.hidden = !items.some(i => !i.hidden && !(document.body.classList.contains('client') && i.classList.contains('agent-only') && !i.classList.contains('client-ok')));
    g.querySelector('.mg-b').classList.toggle('on', items.some(i => i.classList.contains('on')));
  });
  // ссылки меню с других страниц: ./#favs, ./#sels, ./#selhow, ./#prof — открыть этот раздел (один раз, после загрузки)
  const h = /^#(favs|sels|selhow|prof|deals)$/.exec(location.hash);   // #sels=all|own|fb открывает start() (вкладка B)
  if (h && !mgSync.done && me) { mgSync.done = true; history.replaceState(null, '', location.pathname); setTimeout(() => document.querySelector(`.top [data-go="${h[1]}"]`)?.click(), 300); }
}
// активная вкладка: открытое окно меню, иначе то, что показано в выдаче («Все объявления», «Избранное» или «Контакт»)
function tabs() {
  const on = sheetGo && !$('#sheet').hidden ? sheetGo : selTab ? 'sels' : favMode || 'all';   // v5.23: раздел «Мои подборки» (вкладка B)
  document.querySelectorAll('.top [data-go]').forEach(b => {
    if (b.dataset.go === 'client') return;   // «С клиентом» — режим со своей отметкой
    const is = b.dataset.go === on && (!b.dataset.tab || b.dataset.tab === selTab);   // v5.23c: у «Моих подборок» подсвечена открытая вкладка
    b.classList.toggle('on', is);
    is ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current');
  });
  mgSync();
}

// v5.23c: «💡 Как собрать подборку» — коротко, по шагам, со ссылками на вкладки «Моих подборок»
function selHow() {
  sheet('💡 Как собрать подборку', `<ol class="lk-how">
    <li><b>Найдите объекты</b> — строкой поиска («2к до 15 млн Мамайка»), фильтром или голосом 🎤.</li>
    <li><b>Отметьте «Выбрать»</b> на карточках — ссылкой до 20 объектов, PDF до 10. Внизу появится «📄 В подборку».</li>
    <li><b>Сформируйте</b>: ссылка клиенту (с вашей комиссией в цене, без адреса дома) и <b>ссылка для вас</b> — с собственниками и их телефонами.</li>
    <li><b>Напишите собственникам</b> на своей ссылке — «Написать всем» в Telegram или WhatsApp. Ответы («актуально» / «продано») сайт проверит сам и покажет в «Ответах собственников» и на карточках.</li>
    <li><b>Отправьте клиенту</b> проверенную подборку — только актуальные объекты. Клиент отмечает ✓ «подходит» или ✗, пишет комментарий — это в «Откликах клиентов».</li>
    <li><b>«📅 На показ»</b> — у объекта, который подошёл: клиент в CRM, задача с напоминанием. Собственник согласен работать — «💎 Предложить эксклюзив».</li></ol>
    <div class="sheet-foot"><button class="btn ghost" data-close>Понятно</button><button class="btn soft" data-how="own">✉️ Ответы собственников</button><button class="btn primary" data-how="all">📄 Мои подборки</button></div>`);
  $('#sheet-body').onclick = e => { const t = e.target.closest('[data-how]')?.dataset.how; if (t) document.querySelector(`.top [data-go="sels"][data-tab="${t}"]`)?.click(); };
}

// ---------- режим «С клиентом» ----------
function clientUi() {
  document.body.classList.toggle('client', client.on);
  mgSync();
  const b = $('#go-client');
  b.classList.toggle('on', client.on);
  b.textContent = client.on ? '🖥️ С клиентом ✓' : '🖥️ С клиентом';
}
// ---------- v5.48 H9: «🔗 Клиент выбирает сам» — окно создания ссылки (из главной и из карточки клиента CRM) ----------
// Рамка — то, что берёт сервер: тип, районы/ЖК, комнаты, цена (млн ₽ собственника), площадь. Число объектов в рамке — обычным поиском (k=1, без комиссии):
// отдельного «только посчитать» нет. Больше 500 — создать нельзя (сервер скажет то же). Цены фильтра главной в режиме «С клиентом» — с комиссией: пересчитываем в цены собственника.
const PK_MAX = 500;
const pkFrame = (src, back = false) => {
  const o = {}, k = back && cmOn() ? 1 + cmOn() / 100 : 1;
  for (const key of ['k', 'd', 'zk', 'r']) if (Array.isArray(src?.[key]) && src[key].length) o[key] = [...src[key]];
  for (const key of ['pmin', 'pmax']) if (src?.[key] > 0) o[key] = Math.round(src[key] / k * 100) / 100;
  for (const key of ['amin', 'amax']) if (src?.[key] > 0) o[key] = +src[key];
  return o;
};
const pkWords = fr => {
  const mln = v => String(Math.round(v * 10) / 10).replace('.', ','), rn = n => n === 0 ? 'студия' : `${n}к`, parts = [];
  if (fr.k?.length) parts.push(fr.k.join('/'));
  if (fr.r?.length) parts.push([...new Set(fr.r)].sort((a, b) => a - b).map(rn).join('/'));
  const where = [...(fr.zk ?? []).map(id => `ЖК ${zkById(id)?.name ?? id}`), ...(fr.d ?? []).map(areaName)];
  if (where.length) parts.push(where.join(', '));
  if (fr.pmin && fr.pmax) parts.push(`${mln(fr.pmin)}–${mln(fr.pmax)} млн`); else if (fr.pmax) parts.push(`до ${mln(fr.pmax)} млн`); else if (fr.pmin) parts.push(`от ${mln(fr.pmin)} млн`);
  if (fr.amin && fr.amax) parts.push(`${fr.amin}–${fr.amax} м²`); else if (fr.amax) parts.push(`до ${fr.amax} м²`); else if (fr.amin) parts.push(`от ${fr.amin} м²`);
  return parts.join(' · ');
};
const pkObj = n => `${n.toLocaleString('ru-RU')} ${n % 10 === 1 && n % 100 !== 11 ? 'объект' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'объекта' : 'объектов'}`;
// pre: { f — фильтр главной | frame — готовая рамка (CRM), title, client_id, phone, hint, back — вернуться в карточку клиента }
function pickSheet(pre = {}) {
  if (me?.guest) return toast('Ссылки для клиента — с подпиской', 5000);
  // финальное ревью M8: из CRM — районы, ЖК и тип из текущего фильтра главной (если заданы), бюджет и комнаты — из карточки клиента
  const main = pkFrame(f, true), fr = pre.frame ? { ...Object.fromEntries(['k', 'd', 'zk'].filter(k => main[k]).map(k => [k, main[k]])), ...pre.frame } : pkFrame(pre.f, true), lock = !!pre.client_id;
  // районы — тот же список, что у кнопки «Район» на главной (meta.regions): районы верхнего уровня + уже выбранные микрорайоны
  const dKeys = [...new Set([...(meta.regions ?? []).map(r => r.k), ...(fr.d ?? [])])];
  let clients = [], tm = 0, seq = 0, count = null, ready = false;
  sheet('🔗 Клиент выбирает сам', `<div class="pk-win">
    <p class="hint">Клиент сам ищет в рамке вашего фильтра, отмечает ⭐ «Хочу посмотреть» и задаёт вопросы. Вы видите выбор в «Мои подборки → Клиент выбирает». Ссылка действует 24 часа и продлевается; телефоны, адреса и цены собственника клиенту не видны.</p>
    ${pre.hint ? `<p class="hint pk-wish">Пожелания клиента: ${esc(pre.hint)}</p>` : ''}
    <label class="field">Имя клиента или название<input id="pk-t" maxlength="80" autocomplete="off" placeholder="Например: Иван, 2к в Хосте" value="${esc(pre.title ?? '')}"></label>
    <label class="field">Комиссия сверху цены: <b id="pk-mv">${client.cm}%</b><input id="pk-m" type="range" min="0" max="10" step="0.5" value="${client.cm}"></label>
    <label class="field">Клиент CRM<select id="pk-c"><option value="">Без клиента</option>${pre.client_id ? `<option value="${pre.client_id}" selected>${esc(pre.title || 'Клиент')}</option>` : ''}</select></label>
    <div class="pk-frame"><b>Рамка — что клиент сможет искать</b>
      <p id="pk-words" class="pk-words"></p>
      <div class="pk-two"><label class="field">Цена от, млн ₽<input id="pk-pmin" inputmode="decimal" value="${fr.pmin ? mlnTxt(fr.pmin) : ''}"></label><label class="field">до, млн ₽<input id="pk-pmax" inputmode="decimal" value="${fr.pmax ? mlnTxt(fr.pmax) : ''}"></label></div>
      <div class="pk-two"><label class="field">Площадь от, м²<input id="pk-amin" inputmode="decimal" value="${fr.amin ?? ''}"></label><label class="field">до, м²<input id="pk-amax" inputmode="decimal" value="${fr.amax ?? ''}"></label></div>
      <div class="field"><span>Комнаты</span><div class="pk-chips">${[0, 1, 2, 3, 4].map(n => `<label class="chip-l"><input type="checkbox" name="pk-r" value="${n}"${(fr.r ?? []).includes(n) ? ' checked' : ''}><span>${n === 0 ? 'Студия' : n === 4 ? '4+' : n}</span></label>`).join('')}</div></div>
      ${dKeys.length ? `<div class="field"><span>Районы</span><div class="pk-chips">${dKeys.map(k => `<label class="chip-l"><input type="checkbox" name="pk-d" value="${esc(k)}"${(fr.d ?? []).includes(k) ? ' checked' : ''}><span>${esc(areaName(k))}</span></label>`).join('')}</div></div>` : ''}
      <p class="hint">ЖК и тип берутся из фильтра на главной${(fr.zk ?? []).length || (fr.k ?? []).length ? '' : ' (сейчас не заданы)'}. Районы не отмечены — любой район. Цены — собственника, без комиссии.</p>
      <p id="pk-count" class="pk-count" role="status" aria-live="polite">Считаю объекты…</p></div>
    <div class="sheet-foot"><button class="btn primary" id="pk-go" disabled>Создать ссылку</button><button class="btn ghost" data-close>Отмена</button></div></div>`);
  const sent = () => FUI.clean(fr);   // одна и та же очищенная рамка — и для подсчёта, и для pick_create
  const $$ = id => document.getElementById(id), read = () => {
    const num = id => { const v = parseFloat(String($$(id).value).replace(/\s/g, '').replace(',', '.')); return v > 0 ? v : undefined; };
    for (const key of ['pmin', 'pmax', 'amin', 'amax']) { const v = num('pk-' + key); if (v) fr[key] = v; else delete fr[key]; }
    const rr = [...document.querySelectorAll('#sheet-body [name="pk-r"]:checked')].map(i => +i.value); if (rr.length) fr.r = rr; else delete fr.r;
    if (dKeys.length) { const dd = [...document.querySelectorAll('#sheet-body [name="pk-d"]:checked')].map(i => i.value); if (dd.length) fr.d = dd; else delete fr.d; }
  };
  const stat = () => {
    $$('pk-words').textContent = pkWords(fr) || 'Рамка пустая — любые объекты';
    const c = $$('pk-count'), go = $$('pk-go');
    c.classList.toggle('bad', count != null && count > PK_MAX);
    c.textContent = count == null ? (ready ? 'Число объектов посчитаем при создании' : 'Считаю объекты…') : count < 0 ? 'Число объектов уточняется'
      : count > PK_MAX ? `Рамка слишком широкая: ${count.toLocaleString('ru-RU')} ${count % 10 === 1 && count % 100 !== 11 ? 'объект' : 'объектов'}. Сузьте район или бюджет`
      : count === 0 ? 'В рамке нет объектов — клиенту будет пусто. Расширьте цену или комнаты' : `В рамке ${pkObj(count)}`;
    go.disabled = count != null && count > PK_MAX;   // count < 0 — не блокируем: сервер проверит рамку сам
  };
  const recount = () => {
    read(); count = null; ready = false; stat(); clearTimeout(tm); const my = ++seq;
    tm = setTimeout(async () => {
      try { const r = await call('search', { f: sent(), text: '', offset: 0, sort: 'new', cm: 0 }); if (my === seq) { count = r.count; ready = true; stat(); } }
      catch { if (my === seq) { ready = true; stat(); $$('pk-go').disabled = false; } }
    }, 450);
  };
  $$('pk-m').oninput = () => { $$('pk-mv').textContent = `${$$('pk-m').value}%`; };
  document.querySelectorAll('#sheet-body .pk-frame input').forEach(i => i.addEventListener('input', recount));
  $$('pk-go').disabled = false; recount();
  // клиенты CRM — для выбора; нет списка (CRM выключена) — остаётся «Без клиента»
  call('crm_list', {}).then(r => {
    if (!$$('pk-c')) return;
    clients = r.clients ?? [];
    $$('pk-c').innerHTML = `<option value="">Без клиента</option>${clients.map(c => `<option value="${c.id}"${c.id === pre.client_id ? ' selected' : ''}>${esc(c.name || c.phone || `Клиент ${c.id}`)}</option>`).join('')}`;
    $$('pk-c').disabled = lock;
  }, () => {});
  $$('pk-c').onchange = () => { const c = clients.find(x => x.id === +$$('pk-c').value); if (c && !$$('pk-t').value.trim()) $$('pk-t').value = (c.name || '').slice(0, 80); };
  $$('pk-go').onclick = async () => {
    read(); const go = $$('pk-go'); go.disabled = true; go.textContent = 'Создаю…';
    try {
      const cid = +$$('pk-c').value || undefined, cl = clients.find(x => x.id === cid);
      const title = $$('pk-t').value.trim() || (cl?.name ? `Для: ${cl.name}`.slice(0, 80) : '');
      const r = await call('pick_create', { f: sent(), markup: +$$('pk-m').value, title, ...(cid ? { client_id: cid } : {}) });
      selCache = null;
      $('#sheet-body').innerHTML = `<div class="pk-win"><p class="pk-ok" role="status">Ссылка готова${(r.count ?? count) >= 0 ? ` · в рамке ${pkObj(r.count ?? count)}` : ''}</p>
        <p class="hint">Действует до ${new Date(r.until).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}. Отправьте клиенту:</p>
        <input class="pk-link" readonly value="${esc(r.link)}" aria-label="Ссылка клиенту">
        ${PICK.sendHtml(r.link, r.until, cl?.phone ?? pre.phone)}
        <div class="sheet-foot pk-foot"><a class="btn soft" href="${esc(r.link)}&a=1" target="_blank" rel="noopener">Страница ссылки</a><a class="btn ghost" href="./#sels=pick">Мои подборки</a>${pre.client_id && window.CRM ? '<button class="btn ghost" id="pk-back">К клиенту</button>' : ''}<button class="btn ghost" data-close>Готово</button></div></div>`;
      $$('pk-back')?.addEventListener('click', () => CRM.openClient(pre.client_id));
    } catch (e) {
      go.disabled = false; go.textContent = 'Создать ссылку';
      if (e.gate) return showLogin(e.gate);
      if (e.data?.error === 'wide') { const m = /(\d[\d\s]*)\s+объект/.exec(e.message); if (m) { count = +m[1].replace(/\s/g, ''); stat(); } }
      toast(e.message, 7000);
    }
  };
}
$('#sheet-body').addEventListener('click', e => { window.PICK?.onCopy(e, toast); });

function clientSheet() {
  sheet('Показ клиенту', `
    <p>Цены на сайте — с вашей комиссией сверху. Источники объявлений, заметки, телефоны собственников и «Контакт» скрыты: экран можно показывать клиенту. «Мой помощник», «Ипотечный брокер» и «Налоги при продаже» остаются в меню «Помощник» — посчитать ипотеку или налог при клиенте.</p>
    <label class="field">Комиссия сверху цены: <b id="c-cm-v">${client.cm}%</b><input id="c-cm" type="range" min="0" max="10" step="0.5" value="${client.cm}"></label>
    <div class="hint">Цена округляется до 10 000 ₽, как в PDF клиенту. Фильтр цены тоже с комиссией: «до 15 млн» — до 15 млн вместе с ней.</div>
    <div class="sheet-foot">${client.on ? '<button class="btn ghost" id="c-off">Выключить</button>' : '<button class="btn ghost" data-close>Отмена</button>'}
      <button class="btn primary" id="c-on">${client.on ? 'Сохранить' : 'Включить'}</button></div>`);
  $('#c-cm').oninput = () => $('#c-cm-v').textContent = `${$('#c-cm').value}%`;
  const set = on => {
    client = { on, cm: +$('#c-cm').value };
    if (on && favMode === 'deals') { ({ f, text } = beforeFav); $('#q').value = text; leaveFav(); }   // список «Контакт» клиенту не показываем
    savePrefs(); clientUi(); closeSheet(); renderFilters(); changed();
  };
  $('#c-on').onclick = () => set(true);
  $('#c-off')?.addEventListener('click', () => set(false));
}

// ---------- админ-панель — site/admin.js: участники и настройки на одной странице, одна кнопка «Сохранить» ----------
function admin() { location.href = 'admin.html'; }
// v5.37a: «🛡 Модерация» для группы Main — очередь жалоб (complaints.admin.js, тот же, что в админке) в окне сайта; скрытые и удалённые — «🙈 Скрытые»
function modSheet() {
  sheetGo = 'mod';
  sheet('🛡 Модерация · жалобы на объявления', `<p class="hint">Решение действует сразу у всех: «Скрыть» — объявление уйдёт в <button type="button" class="link" data-go2="hidden">🙈 Скрытые</button>, «Удалить» — не вернётся ночной загрузкой.
    Скрыть или удалить любое объявление можно и внутри него — строка «Модерация».</p><div id="cmp-box"><p class="muted">Загрузка…</p></div>`, true);
  $('#sheet-body').onclick = e => { if (e.target.closest('[data-go2]')) { closeSheet(); $('#go-hidden').click(); } };
  if (window.CMPADM) CMPADM.render($('#cmp-box')); else $('#cmp-box').innerHTML = '<p class="err">Не загрузилось — обновите страницу</p>';
}   // v5.15: админка — своя страница, первым экраном «Сводка»

// ---------- оплата — страница pay.html (шаг 2.2) ----------
// вход прошёл, но доступ истёк или заявка не одобрена — оплата сразу
function payGate(pay) {   // страница оплаты pay.html по pay-токену (шаг 2.2): продлить или перейти на PRO
  try { sessionStorage.setItem('pay_token', pay); } catch { /* приватный режим */ } location.href = 'pay.html';
}

start();

// v5.19: «✉️ В рассылку» — объявление в «Список рассылки» (страница «Рассылки», колонка справа); рассылки живут в функции auto
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-mail]');
  if (!b) return;
  e.preventDefault(); e.stopPropagation();
  if (!token) return toast('Войдите, чтобы добавлять объявления в рассылку');
  b.disabled = true;
  try {
    const r = await fetch(String(window.API).replace(/\/web$/, '/auto'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'mail_list_add', auth: { token }, num: +b.dataset.mail }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.message || j.error || 'Не получилось');
    b.classList.add('on'); toast(`В списке рассылки: ${(j.list ?? []).length}. Открыть — «Продвижение» → «Рассылки»`);
  } catch (err) { toast(err.message); } finally { b.disabled = false; }
}, true);
window.APPCARD = card; // v5.42A
window.APP_OPEN_ITEM = num => openItem(num);
// v5.48 F (п. 12 b): голосовая команда ИИ-Агента «добавь 150017 в подборку» — в ту же корзину подборки, что и галочка
window.APP_SEL_ADD = num => { num = +num; if (!num) return 0; if (sel.size >= MAXSEL && !sel.has(num)) return -1; sel.add(num); store.set('sel', [...sel]); selbar(); pickSync(num); return sel.size; };
window.APP_PHOTO_URLS = x => Array.from({ length: nPhotos(x) }, (_, k) => photoUrl(x, k));   // v5.47 E: фото объекта в правке подборки   // v5.47 E: «№ …» в текстах (objpop.js) — окно объявления здесь же

window.APP_CARD_ACTION = onCard;
