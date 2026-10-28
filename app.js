// «Для Агента» — поиск объектов от собственников Сочи. Вход — по логину и паролю (выдаёт администратор или регистрация
// с одобрением) или кнопкой «Сайт» в боте (Telegram Mini App). Данные — только из функции web; здесь нет ни ключей, ни данных.
const tg = window.Telegram?.WebApp;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* приватный режим */ } },
};
const MSG = 'Здравствуйте! Ваше предложение по продаже в Сочи ещё актуально? Хотели уточнить несколько нюансов по просмотру.';
const KINDS = [['квартира', 'Квартиры'], ['апартаменты', 'Апартаменты'], ['дом', 'Дома'], ['коммерция', 'Коммерция'], ['участок', 'Участки']];
const ROOMS = [[0, 'Студия'], [1, '1'], [2, '2'], [3, '3'], [4, '4+']];
// «С ремонтом» = дизайнерский + евроремонт + современный (одним видом); white box в фильтре нет, в данных — остаётся
const FIN = [['repair', 'С ремонтом'], ['clean', 'Чистовая'], ['rough', 'Черновая']];
const FINL = { designer: 'С ремонтом', euro: 'С ремонтом', modern: 'С ремонтом', repair: 'С ремонтом', clean: 'Чистовая', whitebox: 'White box', rough: 'Черновая' };
const MAXSEL = 10;   // объектов в одной подборке PDF
const EXT = [['avito', 'Авито'], ['cian', 'ЦИАН'], ['domclick', 'ДомКлик']];   // собственники напрямую с площадок (колонка source)
const isNew = x => x.created_at && Date.now() - Date.parse(x.created_at) < 30 * 864e5;   // «Новое» — за последний месяц
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
let auth = token ? { token } : tg?.initData || null;
let me = null, meta = null;
let f = store.get('f2', {}), text = store.get('text', ''), sort = store.get('sort', 'new');
const mobile = () => innerWidth <= 760;
let lays = store.get('lay', {}), fclosed = store.get('fclosed', false);   // вид выдачи — свой для телефона и компьютера
let fside = store.get('fside', false);   // фильтр слева колонкой (на компьютере) или сверху
// вид 3 или 6 объектов на экране, по умолчанию 3 (прежний «1» и сохранённые до v4.3 значения — снова 3)
const fixLays = l => l && l.v === 3 ? l : { v: 3 };
lays = fixLays(lays);
const lay = () => ['3', '6'].includes(lays[mobile() ? 'm' : 'd']) ? lays[mobile() ? 'm' : 'd'] : '3';
let favMode = null, beforeFav = null;   // «Избранное» / «Контакт» не затирают сохранённые фильтры
let sel = new Set(store.get('sel', []));
let offset = 0, total = 0, busy = false, view = 'list', items = new Map();

// настройки — в браузере и на сервере (в Telegram браузерное хранилище бывает пустым при каждом запуске)
function savePrefs() {
  store.set('f2', f); store.set('text', text); store.set('sort', sort); store.set('lay', lays); store.set('fclosed', fclosed); store.set('fside', fside); store.set('client', client);
  clearTimeout(savePrefs.t);
  savePrefs.t = setTimeout(() => call('prefs', { prefs: { f, text, sort, lay: lays, fclosed, fside, client } }).catch(() => {}), 700);
}

async function call(action, extra = {}) {
  const r = await fetch(window.API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, auth, ...extra }) });
  const data = await r.json().catch(() => ({ error: 'server', message: `Ошибка сервера (HTTP ${r.status})` }));
  if (['no_auth', 'no_access', 'expired', 'kicked', 'off'].includes(data.error)) throw Object.assign(new Error(data.message), { gate: data.error, data });
  if (!r.ok || data.error) throw Object.assign(new Error(data.message || data.error || `HTTP ${r.status}`), { data });
  return data;
}
function toast(t, ms = 2600) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, ms); }

// ---------- вход и регистрация ----------
function gate(html) { $('#gate').innerHTML = html; $('#gate').hidden = false; $('#app').hidden = true; }
const docs = '<a href="oferta.html" target="_blank">оферты</a>, <a href="rules.html" target="_blank">правил</a> и <a href="privacy.html" target="_blank">политики конфиденциальности</a>';

function showLogin(reason, tab = 'login') {
  token = null; store.set('token', null);
  const why = { expired: 'Доступ закончился. Войдите снова: если оплата открыта, продлите доступ сразу, иначе обратитесь к администратору.', no_access: 'Ваш Telegram не одобрен в боте. Войдите по логину и паролю.', kicked: 'Выполнен вход на другом устройстве — войдите снова.',
    off: 'Доступ закрыт — обратитесь к администратору.', no_auth: '' }[reason] ?? '';
  gate(`
    <div class="tabs2"><button class="seg ${tab === 'login' ? 'on' : ''}" data-tab="login">Вход</button><button class="seg ${tab === 'reg' ? 'on' : ''}" data-tab="reg">Регистрация</button></div>
    ${why ? `<p class="muted">${esc(why)}</p>` : ''}
    ${tab === 'login' ? `<form id="login" class="form">
      <input name="login" placeholder="Логин" autocomplete="username" autocapitalize="none" required>
      <input name="password" type="password" placeholder="Пароль" autocomplete="current-password" required>
      <button class="btn primary" type="submit">Войти</button>
      <p class="err" id="gerr"></p></form>
      <p class="hint">Сайт для риелторов: проверенные объекты от собственников Сочи.<br>Нет логина — зарегистрируйтесь, доступ откроет администратор.</p>`
    : `<form id="reg" class="form">
      <input name="name" placeholder="Имя и фамилия" required>
      <input name="phone" type="tel" placeholder="Телефон" required>
      <input name="email" type="email" placeholder="E-mail (необязательно)">
      <input name="company" placeholder="Агентство (необязательно)">
      <input name="login" placeholder="Придумайте логин (латиница)" autocapitalize="none" required>
      <input name="password" type="password" placeholder="Придумайте пароль (от 6 символов)" autocomplete="new-password" required>
      <label class="chk"><input type="checkbox" name="agree" required> <span>Принимаю условия ${docs}</span></label>
      <button class="btn primary" type="submit">Отправить заявку</button>
      <p class="err" id="gerr"></p></form>`}`);
  document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => showLogin(reason, b.dataset.tab));
  $('#login')?.addEventListener('submit', async e => {
    e.preventDefault();
    const fm = e.target, btn = fm.querySelector('button');
    btn.disabled = true; $('#gerr').textContent = '';
    try {
      const r = await call('login', { login: fm.login.value, password: fm.password.value });
      token = r.token; store.set('token', token); auth = { token }; start();
    } catch (err) {
      if (err.data?.pay) return payGate(err.data.pay, err.message);   // доступ истёк или заявка не одобрена — можно оплатить сразу
      $('#gerr').textContent = err.message; btn.disabled = false;
    }
  });
  $('#reg')?.addEventListener('submit', async e => {
    e.preventDefault();
    const fm = e.target, btn = fm.querySelector('button');
    btn.disabled = true; $('#gerr').textContent = '';
    try {
      const r = await call('register', Object.fromEntries(['name', 'phone', 'email', 'company', 'login', 'password'].map(k => [k, fm[k].value]).concat([['agree', fm.agree.checked]])));
      gate(`<h2>Заявка отправлена</h2><p>${esc(r.message)}</p><button class="btn ghost" id="back">Ко входу</button>`);
      $('#back').onclick = () => showLogin();
    } catch (err) { $('#gerr').textContent = err.message; btn.disabled = false; }
  });
}
function logout() { token = null; auth = null; store.set('token', null); showLogin(); }

async function start() {
  tg?.ready(); tg?.expand(); try { tg?.disableVerticalSwipes?.(); } catch { /* старый Telegram */ }
  if (!auth) return showLogin();
  try { meta = await call('init'); }
  catch (e) { return e.gate ? showLogin(e.gate) : gate(`<h2>Ошибка</h2><p>${esc(e.message)}</p>`); }
  me = meta.me;
  const p = me.prefs;
  if (p && typeof p === 'object') {
    if (p.f && typeof p.f === 'object') f = p.f;
    if (typeof p.text === 'string') text = p.text;
    if (typeof p.sort === 'string') sort = p.sort;
    if (p.lay && typeof p.lay === 'object') lays = fixLays(p.lay);
    if (typeof p.fclosed === 'boolean') fclosed = p.fclosed;
    if (typeof p.fside === 'boolean') fside = p.fside;
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
  document.title = 'Для Агента — объекты от собственников Сочи';
  $('#gate').hidden = true; $('#app').hidden = false;
  $('#who').textContent = me.name || me.login;
  if (me.role === 'admin') { $('#until').textContent = me.login === 'admin' ? 'главный администратор' : 'администратор'; $('#go-admin').hidden = false; }
  else if (me.expires_at) {
    const d = new Date(me.expires_at), left = Math.ceil((d - Date.now()) / 864e5);
    $('#until').textContent = `доступ до ${d.toLocaleDateString('ru-RU')}${left <= 5 ? ` · осталось ${left} дн.` : ''}`;
    $('#until').classList.toggle('warn', left <= 5);
  }
  $('#logout').hidden = !!me.tg;
  $('#go-pay').hidden = !meta.pay?.enabled;
  $('#go-map').hidden = !meta.features.map;
  document.querySelectorAll('[data-go="favs"]').forEach(b => b.hidden = !meta.features.favorites);
  document.querySelectorAll('[data-go="deals"]').forEach(b => b.hidden = !meta.features.deals);
  document.querySelectorAll('[data-go="sels"]').forEach(b => b.hidden = !meta.features.selections);
  $('#go-rk').hidden = !me.can_rk;   // «Реклама» — только тем, кому включил администратор
  clientUi();
  $('#q').value = text; $('#sort').value = sort;
  openF(!mobile() && !fclosed); sideUi();
  renderFilters(); selbar(); applyLay();
  search();
  if (location.hash === '#admin' && me.role === 'admin') admin();   // прямая ссылка на админ-панель: …/#admin
}

// ---------- фильтры ----------
const arr = k => Array.isArray(f[k]) ? f[k] : [];
function toggleIn(k, v) { const s = new Set(arr(k)); s.has(v) ? s.delete(v) : s.add(v); f[k] = [...s]; if (!f[k].length) delete f[k]; }
function chipRow(el, list, key) {
  el.innerHTML = list.map(([v, t]) => `<button type="button" class="chip${arr(key).includes(v) ? ' on' : ''}" data-v="${esc(v)}">${esc(t)}</button>`).join('');
  el.onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; toggleIn(key, typeof list[0][0] === 'number' ? +b.dataset.v : b.dataset.v); renderFilters(); };
}
function renderFilters() {
  chipRow($('#f-kind'), KINDS, 'k');
  chipRow($('#f-rooms'), ROOMS, 'r');
  chipRow($('#f-fin'), FIN, 'fin');
  // «Дизайнерский» — по фото (пока «скоро»: включается в админке, когда база проверена)
  const modernOn = meta.features.modern_filter;
  $('#f-fin').insertAdjacentHTML('beforeend', `<button type="button" class="chip${f.m ? ' on' : ''}" data-k="m" ${modernOn ? '' : 'disabled title="Скоро: дизайнерский ремонт будет определяться по фото"'}>Дизайнерский${modernOn ? '' : '<small>скоро</small>'}</button>`);
  const finClick = $('#f-fin').onclick;
  $('#f-fin').onclick = e => { const b = e.target.closest('[data-k]'); if (!b) return finClick(e); if (!b.disabled) { f.m = !f.m || undefined; renderFilters(); } };
  const flags = [['pool', 'Бассейн'], ['fz', 'ФЗ-214'], ['uniq', 'Только уникальные'], ['unseen', 'Непросмотренные'], ['fav', '★ Избранное'], ['deal', '🤝 Контакт']]
    .filter(([k]) => (k !== 'fav' || meta.features.favorites) && (k !== 'deal' || (meta.features.deals && !client.on)));
  $('#f-flags').innerHTML = flags.map(([k, t]) => `<button type="button" class="chip${f[k] ? ' on' : ''}" data-k="${k}">${t}</button>`).join('');
  $('#f-flags').onclick = e => { const b = e.target.closest('[data-k]'); if (!b || b.disabled) return; f[b.dataset.k] = !f[b.dataset.k] || undefined; renderFilters(); };
  // объявления собственников, взятые напрямую с площадок: галочка снята — таких не показывать (база собственников — всегда)
  $('#f-ext').innerHTML = EXT.map(([k, t]) => `<button type="button" class="chip${arr('noext').includes(k) ? '' : ' on'}" data-v="${k}">${arr('noext').includes(k) ? '' : '✓ '}${t}</button>`).join('');
  $('#f-ext').onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; toggleIn('noext', b.dataset.v); renderFilters(); };
  for (const k of ['amin', 'amax', 'fmin', 'fmax']) $('#' + k).value = f[k] ?? '';
  $('#nf').checked = !!f.nf; $('#nl').checked = !!f.nl;
  for (const k of ['pmin', 'pmax']) $('#' + k).value = f[k] ? dots(Math.round(f[k] * 1e6)) : '';
  $('#sea').value = f.sea ?? '';
  const nd = arr('d').length, nz = arr('zk').length;
  $('#open-areas').textContent = nd ? `${arr('d').map(areaName).slice(0, 2).join(', ')}${nd > 2 ? ` +${nd - 2}` : ''}` : 'Район';
  $('#open-areas').classList.toggle('on', !!nd);
  $('#open-zk').textContent = nz ? `ЖК: ${nz}` : 'ЖК';
  $('#open-zk').classList.toggle('on', !!nz);
  const n = Object.keys(f).filter(k => f[k] !== undefined && !(Array.isArray(f[k]) && !f[k].length)).length;
  $('#fcount').textContent = n ? `(${n})` : '';
}
// цена в рублях с точками: 12.000.000; число меньше 1000 — миллионы («12» → 12.000.000). В фильтре цена хранится в миллионах.
const dots = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const rubOf = s => { const v = +String(s).replace(/\D/g, ''); return v > 0 && v < 1000 ? v * 1e6 : v; };
function readInputs() {
  for (const k of ['amin', 'amax', 'fmin', 'fmax']) { const v = +$('#' + k).value; if (v > 0) f[k] = v; else delete f[k]; }
  for (const k of ['pmin', 'pmax']) { const v = rubOf($('#' + k).value); if (v > 0) f[k] = v / 1e6; else delete f[k]; }
  f.nf = $('#nf').checked || undefined; f.nl = $('#nl').checked || undefined;
  f.sea = +$('#sea').value || undefined;
}
for (const k of ['pmin', 'pmax']) {
  $('#' + k).addEventListener('input', e => { const d = e.target.value.replace(/\D/g, ''); e.target.value = d ? dots(+d) : ''; });
  $('#' + k).addEventListener('blur', e => { const v = rubOf(e.target.value); e.target.value = v ? dots(v) : ''; readInputs(); });
}
// поля сразу попадают в фильтр: иначе нажатие на любую кнопку фильтра стирало набранную площадь, этаж и цену
for (const k of ['amin', 'amax', 'fmin', 'fmax', 'pmin', 'pmax']) $('#' + k).addEventListener('input', readInputs);
for (const k of ['nf', 'nl', 'sea']) $('#' + k).addEventListener('change', readInputs);
$('#sea').innerHTML = '<option value="">Любое расстояние</option>' + SEA.map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
// на телефоне фильтры — окно на весь экран (страница под ним не прокручивается)
function openF(on) {
  $('#filters').classList.toggle('closed', !on); document.body.classList.toggle('fopen', on && mobile());
  document.body.classList.toggle('fshown', on); map?.invalidateSize();
}
$('#toggle-f').onclick = () => { const on = $('#filters').classList.contains('closed'); openF(on); fclosed = !on; if (!mobile()) savePrefs(); };
// фильтр колонкой слева или блоком сверху (на компьютере; на телефоне — всегда окно на весь экран)
function sideUi() {
  document.body.classList.toggle('fside', fside);
  $('#f-side').textContent = fside ? '⇧ Фильтр сверху' : '⇦ Фильтр слева';
  setTimeout(() => map?.invalidateSize(), 50);
}
$('#f-side').onclick = () => { fside = !fside; sideUi(); savePrefs(); };
$('#f-close').onclick = () => { readInputs(); openF(false); };
$('#apply').onclick = () => { readInputs(); if (mobile()) openF(false); changed(); };
$('#reset').onclick = () => { f = {}; text = ''; $('#q').value = ''; leaveFav(); renderFilters(); changed(); };
$('#status').addEventListener('click', e => { if (e.target.id === 'drop-f') { f = {}; leaveFav(); renderFilters(); changed(); } });   // текст запроса оставить
$('#sort').onchange = () => { sort = $('#sort').value; savePrefs(); view === 'map' ? mapList() : search(); };
$('#qform').addEventListener('submit', e => { e.preventDefault(); readInputs(); $('#q').blur(); changed(); });
// поле запроса очистили (крестиком или стёрли) — сразу ищем без текста: раньше при пустом поле продолжал работать прошлый запрос
$('#q').addEventListener('input', () => { if (!$('#q').value.trim() && text) changed(); });
function changed() {
  text = $('#q').value.trim();   // запрос — всегда то, что сейчас в поле
  f = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && !(Array.isArray(v) && !v.length)));
  if (!favMode) savePrefs();
  renderFilters();
  view === 'map' ? loadMap() : search();
}
function leaveFav() { favMode = null; beforeFav = null; document.querySelectorAll('[data-go="favs"], [data-go="deals"]').forEach(b => b.classList.remove('on')); }
function applyLay() {
  const l = lay();
  $('#list').classList.remove('l1', 'l3', 'l6'); $('#list').classList.add('l' + l);
  document.querySelectorAll('[data-lay]').forEach(b => b.classList.toggle('on', b.dataset.lay === l));
}
document.querySelectorAll('[data-lay]').forEach(b => b.onclick = () => { lays = { ...lays, v: 3, [mobile() ? 'm' : 'd']: b.dataset.lay }; applyLay(); savePrefs(); });

// окна: районы, ЖК
function sheet(title, html, wide = false) {
  $('#sheet-title').textContent = title; $('#sheet-body').innerHTML = html;
  $('#sheet').classList.toggle('wide', wide); $('#sheet').hidden = false; tg?.BackButton.show();
}
function closeSheet() { if ($('#sheet').hidden) return; $('#sheet').hidden = true; if ($('#viewer').hidden) tg?.BackButton.hide(); }
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
      return `<div class="tr${q || open.has(r.k) ? ' open' : ''}" data-r="${esc(r.k)}"><div class="tr-h">
        ${r.subs.length ? '<button type="button" class="tr-t" data-t aria-label="Микрорайоны"></button>' : '<span class="tr-t none"></span>'}${opt('d', r.k, r.name, all, r.n || '')}</div>
        ${subs.length ? `<div class="tr-subs">${subs.map(([k, name, n]) => opt('d', k, name, all || on(k), n ?? '', all)).join('')}</div>` : ''}</div>`;
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
    renderFilters(); draw();
  };
  $('#s-clear').onclick = () => { delete f.d; renderFilters(); draw(); };
};
$('#open-zk').onclick = () => {
  sheet('ЖК', `<input id="zk-find" type="search" placeholder="Найти ЖК"><div id="zk-list"></div>
    <div class="sheet-foot"><button class="btn ghost" id="s-clear">Сбросить</button><button class="btn primary" data-close>Готово</button></div>`);
  const draw = () => {
    const q = $('#zk-find').value.trim().toLowerCase();
    $('#zk-list').innerHTML = meta.zk.filter(z => !q || z.name.toLowerCase().includes(q)).map(z => opt('zk', z.id, z.name, arr('zk').includes(z.id), z.n)).join('') || '<p class="muted">Не нашёл такой ЖК</p>';
  };
  $('#zk-find').oninput = draw; draw();
  bindChecks('zk', true);
};
function bindChecks(key, num) {
  $('#sheet-body').onchange = e => { const i = e.target; if (i.name !== key) return; toggleIn(key, num ? +i.value : i.value); renderFilters(); };
  $('#s-clear').onclick = () => { delete f[key]; renderFilters(); $('#sheet-body').querySelectorAll('input[type=checkbox]').forEach(i => i.checked = false); };
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
const photoUrl = (x, k) => k < 4 || !meta.media ? `${meta.photos}/${x.num}/${k}.jpg` : `${meta.media}/${x.num}/${k}.webp`;

async function search(more = false) {
  if (busy) return;
  busy = true;
  if (!more) { offset = 0; items.clear(); $('#list').innerHTML = ''; $('#status').textContent = 'Ищу…'; $('#more').hidden = true; }
  $('#more').disabled = true;
  try {
    const r = await call('search', { f, text, offset, sort, cm: cmOn() });
    total = r.count;
    r.items.forEach(x => items.set(x.num, x));
    $('#list').insertAdjacentHTML('beforeend', r.items.map(card).join(''));
    offset += r.items.length;
    $('#status').textContent = (total ? `Найдено: ${total.toLocaleString('ru-RU')}` : r.hidden ? `Без фильтров нашлось бы: ${r.hidden.toLocaleString('ru-RU')} — их скрывают фильтры` : 'Ничего не нашёл — попробуйте убрать часть фильтров') + (r.understood ? ` · понял запрос так: ${r.understood}` : '') + (r.note ? ` · ${r.note}` : '');
    if (!total && r.hidden) $('#status').insertAdjacentHTML('beforeend', ' <button type="button" class="link" id="drop-f">Сбросить фильтры</button>');
    $('#more').hidden = view === 'map' || offset >= total;
    $('#more').textContent = `Показать ещё ${Math.min(r.page, total - offset)} из ${(total - offset).toLocaleString('ru-RU')}`;
  } catch (e) {
    if (e.gate) return showLogin(e.gate);
    $('#status').textContent = `Ошибка поиска: ${e.message}`;
  } finally { busy = false; $('#more').disabled = false; }
}
$('#more').addEventListener('click', () => search(true));

function gallery(x) {
  const n = x.web_photos || 0;
  return `<div class="gal" data-n="${n}">${isNew(x) ? '<span class="newmark">Новое</span>' : ''}
    <div class="strip">${n ? Array.from({ length: n }, (_, k) => `<div class="ph"><img src="${esc(photoUrl(x, k))}" alt="" loading="lazy" data-k="${k}"></div>`).join('')
      : '<div class="none">Фото загружаются<br>(обновляются каждую ночь)</div>'}</div>
    ${n > 1 ? `<button class="nav l" data-nav="-1" aria-label="Назад">‹</button><button class="nav r" data-nav="1" aria-label="Вперёд">›</button>
      <div class="dots">${Array.from({ length: n }, (_, k) => `<i class="${k ? '' : 'on'}"></i>`).join('')}</div>` : ''}
    ${meta.features.selections ? `<label class="pick"><input type="checkbox" data-sel ${sel.has(x.num) ? 'checked' : ''}> В подборку</label>` : ''}
    ${meta.features.favorites ? `<button class="fav${x.fav ? ' on' : ''}" data-fav aria-label="В избранное">${x.fav ? '★' : '☆'}</button>` : ''}
    ${meta.features.deals ? `<button class="deal agent-only${x.deal ? ' on' : ''}" data-deal aria-label="Контакт" title="Контакт — договорились с собственником">🤝</button>` : ''}
    ${x.seen ? '<span class="seenmark">Просмотрено</span>' : ''}
  </div>`;
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
    x.ad_state === 'unique' ? '<span class="tag ok agent-only">Уникальна</span>' : x.ad_state === 'ads' ? '<span class="tag grey agent-only">Есть в рекламе</span>' : ''].join('');
}
// микрорайон, а если его нет — район («Светлана», «Адлерский р-н»)
const placeOf = x => x.sub || (x.district ? (/ский$/.test(x.district) ? `${x.district} р-н` : x.district) : (x.mkr ? String(x.mkr).replace(/\s+мкр$/, '') : ''));
function card(x) {
  const price = x.price ? priceOf(x.price) : 0;
  const ppm = price && x.area ? `${Math.round(price / x.area).toLocaleString('ru-RU')} ₽/м²` : '';
  const zk = x.zk ?? zkName(x.complex);   // заголовок — название ЖК, если известно (по объявлению или по адресу дома)
  const where = [x.street || x.address, placeOf(x)].filter(Boolean).join(' · ');
  const date = x.created_at ? new Date(x.created_at).toLocaleDateString('ru-RU') : '—';
  return `<article class="card${x.seen ? ' seen' : ''}" data-num="${x.num}">
    ${gallery(x)}
    <div class="body">
      <div class="price${x.ad_state === 'unique' && !client.on ? ' uniq' : ''}"><b>${price ? rub(price) : 'Цена не указана'}</b><small>${ppm}</small></div>
      ${zk ? `<div class="zk" data-open>${esc(zk)}</div>` : ''}
      <div class="title" data-open>${esc(what(x))}</div>
      <div class="addr">${esc(where)}</div>
      <div class="tags">${tags(x)}</div>
      <div class="meta">Добавлено ${date} · № ${x.num}</div>
      ${x.descr ? `<div class="descr" data-d><p>${esc(x.descr)}</p>${x.descr.length > 160 ? '<button type="button" class="more" data-more><span>Развернуть описание</span><i>▾</i></button>' : ''}</div>` : ''}
      ${srcHtml(x)}
      ${x.note ? `<div class="note agent-only">📝 ${esc(x.note)}</div>` : ''}
      <div class="actions agent-only">${x.phone ? phoneBox(x.phone, null) : '<button class="btn soft" data-phone>📞 Телефон</button>'}
        ${meta.features.notes ? '<button class="btn ghost" data-note>📝 Заметка</button>' : ''}</div>
    </div>
  </article>`;
}
// источник объявления ссылкой (Авито, Циан, ДомКлик…) — только агенту: в режиме «С клиентом» скрыт
const srcHtml = x => x.src?.length ? `<div class="src agent-only">Источник: ${x.src.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join('')}</div>` : '';
function phoneBox(p, owner) {
  const d = p.replace(/\D/g, ''), t = encodeURIComponent(MSG);
  return `<div class="phone"><div><a class="num" href="tel:${esc(p)}">${esc(p)}</a>${owner ? ` — ${esc(owner)}` : ''} <small>может быть подменный</small></div>
    ${meta.features.messengers ? `<div class="msgs"><a class="m-call" href="tel:${esc(p)}">Позвонить</a>
      <a class="m-wa" href="https://wa.me/${d}?text=${t}" target="_blank" rel="noopener">WhatsApp</a>
      <button class="m-copy" data-copy="${esc(p)}">Копировать</button></div>` : ''}</div>`;
}

// действия в карточке
$('#list').addEventListener('click', e => onCard(e, e.target.closest('.card')));
async function onCard(e, cardEl) {
  if (!cardEl) return;
  const num = +cardEl.dataset.num, x = items.get(num);
  const t = e.target;
  if (t.closest('[data-nav]')) { const g = t.closest('.gal'); const s = g.querySelector('.strip'); s.scrollBy({ left: s.clientWidth * +t.closest('[data-nav]').dataset.nav, behavior: 'smooth' }); return; }
  if (t.closest('[data-sel]')) {
    const c = t.closest('[data-sel]');
    if (c.checked && sel.size >= MAXSEL) { c.checked = false; toast(`В одной подборке до ${MAXSEL} объектов — сформируйте PDF и начните новую`); return; }
    c.checked ? sel.add(num) : sel.delete(num); store.set('sel', [...sel]); selbar(); return;
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
  if (t.closest('[data-deal]')) {   // «Контакт»: с собственником договорились — объект в своём разделе
    const b = t.closest('[data-deal]'), on = !b.classList.contains('on');
    b.classList.toggle('on', on); if (x) x.deal = on;
    call('deal', { num, on }).then(() => toast(on ? 'В разделе «Контакт»' : 'Убрано из раздела «Контакт»')).catch(err => toast(err.message));
    return;
  }
  // фото в карточке — объявление целиком, как на Авито: большое фото, лента миниатюр, рядом цена и описание
  if (t.matches('.strip img')) { openItem(num, +t.dataset.k); markSeen(cardEl, num); return; }
  if (t.closest('[data-open]')) { openItem(num); return; }
  if (t.closest('summary')) { markSeen(cardEl, num); return; }
  if (t.closest('[data-copy]')) { copy(t.closest('[data-copy]').dataset.copy, 'Номер скопирован'); return; }
  if (t.closest('[data-note]')) { noteSheet(num, x); return; }
  const b = t.closest('[data-phone]');
  if (!b) return;
  const box = b.parentElement;
  b.disabled = true; b.textContent = 'Узнаю номер…';
  try {
    const p = await call('phone', { num });
    if (!p.phone) throw new Error(p.error || 'номер не найден');
    b.outerHTML = phoneBox(p.phone, p.owner);
    if (x) { x.phone = p.phone; x.ad_state = p.ad_state ?? x.ad_state; if (p.src?.length) x.src = p.src; }
    if (p.src?.length) { cardEl.querySelector('.src')?.remove(); box.insertAdjacentHTML('beforebegin', srcHtml({ src: p.src })); }
    markSeen(cardEl, num);
  } catch (err) {
    if (err.gate) return showLogin(err.gate);
    b.disabled = false; b.textContent = '📞 Телефон';
    box.querySelector('.err')?.remove();
    box.insertAdjacentHTML('beforeend', `<span class="err">${esc(err.message)}</span>`);
  }
}
$('#list').addEventListener('scroll', e => {
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
    try { const r = await call('item', { num }); x = r.item; items.set(num, x); } catch (e) { if (e.gate) return showLogin(e.gate); if (!x) return toast(e.message); }
  }
  sheet(`№ ${num}`, itemView(x, k), true);
  const el = $('#sheet-body .itemv');
  el.querySelectorAll('.iv-main img, .iv-th img').forEach(im => im.complete ? fitCrop(im) : im.addEventListener('load', () => fitCrop(im), { once: true }));
  el.addEventListener('click', e => {
    const t = e.target, n = x.web_photos || 0;
    const th = t.closest('[data-th]'), st = t.closest('[data-step]');
    if (th || st) { ivShow(el, x, th ? +th.dataset.th : (+el.dataset.k + +st.dataset.step + n) % n); return; }
    if (t.matches('[data-big]')) { openViewer(Array.from({ length: n }, (_, i) => photoUrl(x, i)), +el.dataset.k); return; }
    onCard(e, el);
  });
  const inList = document.querySelector(`#list .card[data-num="${num}"]`);
  if (inList) markSeen(inList, num);
}
function itemView(x, k) {
  const n = x.web_photos || 0, price = x.price ? priceOf(x.price) : 0;
  const ppm = price && x.area ? `${Math.round(price / x.area).toLocaleString('ru-RU')} ₽/м²` : '';
  const zk = x.zk ?? zkName(x.complex);
  const where = [x.street || x.address, placeOf(x)].filter(Boolean).join(' · ');
  const date = x.created_at ? new Date(x.created_at).toLocaleDateString('ru-RU') : '—';
  k = Math.min(Math.max(0, k), Math.max(0, n - 1));
  return `<article class="card itemv" data-num="${x.num}" data-k="${k}">
    <div class="iv-media">
      <div class="iv-main">${n ? `<div class="vc"><img src="${esc(photoUrl(x, k))}" alt="" data-big title="Открыть на весь экран"></div>` : '<div class="none">Фото загружаются<br>(обновляются каждую ночь)</div>'}
        ${isNew(x) ? '<span class="newmark">Новое</span>' : ''}
        ${n > 1 ? '<button class="nav l" data-step="-1" aria-label="Предыдущее фото">‹</button><button class="nav r" data-step="1" aria-label="Следующее фото">›</button>' : ''}
        ${n ? `<span class="iv-count">${k + 1} / ${n}</span>` : ''}
        ${meta.features.selections ? `<label class="pick"><input type="checkbox" data-sel ${sel.has(x.num) ? 'checked' : ''}> В подборку</label>` : ''}
        ${meta.features.favorites ? `<button class="fav${x.fav ? ' on' : ''}" data-fav aria-label="В избранное">${x.fav ? '★' : '☆'}</button>` : ''}
        ${meta.features.deals ? `<button class="deal agent-only${x.deal ? ' on' : ''}" data-deal aria-label="Контакт" title="Контакт — договорились с собственником">🤝</button>` : ''}
      </div>
      ${n > 1 ? `<div class="iv-thumbs">${Array.from({ length: n }, (_, i) => `<button type="button" class="iv-th${i === k ? ' on' : ''}" data-th="${i}" aria-label="Фото ${i + 1}"><span class="vc"><img src="${esc(photoUrl(x, i))}" alt="" loading="lazy"></span></button>`).join('')}</div>` : ''}
    </div>
    <div class="iv-info">
      <div class="price${x.ad_state === 'unique' && !client.on ? ' uniq' : ''}"><b>${price ? rub(price) : 'Цена не указана'}</b><small>${ppm}</small></div>
      ${zk ? `<div class="zk">${esc(zk)}</div>` : ''}
      <div class="iv-title">${esc(what(x))}</div>
      <div class="iv-addr">${esc(where)}</div>
      <div class="tags">${tags(x)}</div>
      <div class="meta">Добавлено ${date} · № ${x.num}</div>
      ${srcHtml(x)}
      ${x.note ? `<div class="note agent-only">📝 ${esc(x.note)}</div>` : ''}
      <div class="actions agent-only">${x.phone ? phoneBox(x.phone, null) : '<button class="btn soft" data-phone>📞 Телефон</button>'}
        ${meta.features.notes ? '<button class="btn ghost" data-note>📝 Заметка</button>' : ''}</div>
      ${x.descr ? `<div class="iv-descr"><div class="iv-h">Описание</div><p>${esc(x.descr)}</p></div>` : ''}
    </div>
  </article>`;
}
// другое фото в окне объявления: большое фото, счётчик, выделенная миниатюра
function ivShow(el, x, k) {
  const n = x.web_photos || 0; if (!n) return;
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
  s.innerHTML = urls.map(u => `<div class="vs"><div class="vc"><img src="${esc(u)}" alt=""></div></div>`).join('');
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
  const iv = !$('#sheet').hidden && !e.target.closest?.('input, textarea') && $('#sheet-body .itemv [data-step]');
  if (iv) iv.parentElement.querySelector(`[data-step="${e.key === 'ArrowRight' ? 1 : -1}"]`).click();
});

// ---------- подборка ----------
function selbar() {
  $('#selbar').hidden = !sel.size || !meta?.features.selections;
  $('#selcount').textContent = `Выбрано: ${sel.size}`;
}
$('#sel-clear').onclick = () => { sel.clear(); store.set('sel', []); selbar(); document.querySelectorAll('[data-sel]').forEach(c => c.checked = false); };
$('#sel-make').onclick = () => {
  const prof = store.get('agent', { name: me.name || '', phone: '' });
  sheet('Подборка в PDF', `
    <label class="field">Название<input id="s-title" placeholder="Например: Для Ивана — 2к до 15 млн" maxlength="80"></label>
    <div class="hint">Сразу два PDF: <b>клиенту</b> — без контактов собственника, цены с вашей комиссией; <b>агенту</b> — цены собственника, на первой странице список с телефонами собственников, пометка «Уникальна».
      Перед сборкой сайт откроет телефоны и проверит рекламу по каждому объекту (в пределах ваших лимитов) — это 10–15 секунд на объект.</div>
    <label class="field">Комиссия сверху цены (для клиента): <b id="s-mk-v">${client.on ? client.cm : 5}%</b><input id="s-mk" type="range" min="0" max="10" step="0.5" value="${client.on ? client.cm : 5}"></label>
    <div class="hint">Цены в PDF клиенту будут увеличены на этот процент (округление до 10 000 ₽). 0% — цены собственника.</div>
    <label class="field">Ваше имя в PDF<input id="s-name" value="${esc(prof.name)}"></label>
    <label class="field">Ваш телефон в PDF<input id="s-phone" type="tel" value="${esc(prof.phone)}"></label>
    <label class="chk"><input type="checkbox" id="s-hide" ${store.get('hideAddr', true) ? 'checked' : ''}> <span>Скрыть улицу и номер дома в PDF клиенту</span></label>
    <div class="hint">Объектов: ${sel.size} (до ${MAXSEL}). В PDF агенту — ссылка на источник объявления, в PDF клиенту источников нет. Имя файла будет латиницей (открывается на любом телефоне). PDF хранится 7 дней во вкладке «Мои подборки».</div>
    <p class="hint" id="s-prog"></p><p class="err" id="s-err"></p>
    <div class="sheet-foot"><button class="btn ghost" data-close>Отмена</button><button class="btn primary" id="s-go">Сформировать</button></div>`);
  $('#s-mk').oninput = () => $('#s-mk-v').textContent = `${$('#s-mk').value}%`;
  $('#s-go').onclick = async () => {
    const b = $('#s-go'); b.disabled = true; b.textContent = 'Готовлю…'; $('#s-err').textContent = '';
    store.set('agent', { name: $('#s-name').value, phone: $('#s-phone').value }); store.set('hideAddr', $('#s-hide').checked);
    const prog = t => { const el = $('#s-prog'); if (el) el.textContent = t; };
    try {
      // телефоны и проверка рекламы — по одному объекту за запрос: сервис телефонов отвечает 7–15 с, один общий запрос упирался в предел времени сервера
      const nums = [...sel].slice(0, MAXSEL); let limit = '';
      for (const [i, n] of nums.entries()) {
        const x = items.get(n);
        if (x?.phone && x.ad_state) continue;
        prog(`Открываю телефоны и проверяю рекламу: ${i + 1} из ${nums.length}…`);
        for (let t = 0; t < 2; t++) {
          try { const p = await call('phone', { num: n }); if (x) { x.phone = p.phone; x.ad_state = p.ad_state ?? x.ad_state; } break; }
          catch (err) { if (err.gate) throw err; if (/Лимит/.test(err.message)) { limit = err.message; break; } }
        }
        if (limit) break;
      }
      prog(`${limit ? limit + ' ' : ''}Собираю два PDF…`); b.textContent = 'Собираю PDF…';
      const r = await call('sel_create', { nums, title: $('#s-title').value, markup: +$('#s-mk').value,
        agent: $('#s-name').value, agent_phone: $('#s-phone').value, hide_addr: $('#s-hide').checked });
      $('#sheet-body').innerHTML = `<p>Подборка готова — два PDF.</p>
        <div class="sheet-foot"><a class="btn primary" href="${esc(r.url)}" target="_blank" rel="noopener" data-url="${esc(r.url)}">PDF клиенту</a>
        <a class="btn soft agent-only" href="${esc(r.url_agent)}" target="_blank" rel="noopener" data-url="${esc(r.url_agent)}">PDF агенту (с телефонами)</a></div>
        ${r.phones < r.total ? `<p class="hint">Телефоны в PDF агенту: ${r.phones} из ${r.total} — остальные не открылись (${limit ? 'лимит номеров' : 'у объявления нет мобильного или сервис телефонов не ответил'}).</p>` : ''}
        <p class="hint">Ссылки действуют час; сама подборка хранится 7 дней во вкладке «Мои подборки».</p>`;
      if (tg?.openLink) $('#sheet-body').onclick = ev => { const a = ev.target.closest('[data-url]'); if (a) { ev.preventDefault(); tg.openLink(a.dataset.url); } };
    } catch (e) { if (e.gate) return showLogin(e.gate); $('#s-err').textContent = e.message; b.disabled = false; b.textContent = 'Сформировать'; }
  };
};
async function showSelections() {
  sheet('Мои подборки', '<p class="muted">Загрузка…</p>');
  try {
    const r = await call('sel_list');
    $('#sheet-body').innerHTML = r.items.length ? r.items.map(s => `<div class="opt" style="cursor:default"><span><b>${esc(s.title)}</b><br>
      <small class="muted">${new Date(s.created_at).toLocaleString('ru-RU')} · ${{ agent: 'для агента · ', client: 'для клиента · ' }[s.mode] ?? ''}+${s.markup}% · объектов: ${s.nums.length}<br>
      удалится ${new Date(Date.parse(s.created_at) + 7 * 864e5).toLocaleDateString('ru-RU')}</small></span>
      ${s.url ? `<a class="btn soft" href="${esc(s.url)}" target="_blank" rel="noopener" data-url="${esc(s.url)}">${s.url_agent ? 'Клиенту' : 'PDF'}</a>` : ''}
      ${s.url_agent ? `<a class="btn soft" href="${esc(s.url_agent)}" target="_blank" rel="noopener" data-url="${esc(s.url_agent)}">Агенту</a>` : ''}
      <button class="btn ghost" data-again="${s.nums.join(',')}">В подборку</button></div>`).join('')
      : '<p class="muted">Подборок за последние 7 дней нет. Отметьте объекты галочкой «В подборку» и нажмите «Сформировать PDF».</p>';
    $('#sheet-body').onclick = e => {
      const a = e.target.closest('[data-url]'); if (a && tg?.openLink) { e.preventDefault(); tg.openLink(a.dataset.url); }
      const g = e.target.closest('[data-again]'); if (g) { g.dataset.again.split(',').forEach(n => sel.add(+n)); store.set('sel', [...sel]); selbar(); toast('Объекты добавлены в подборку'); }
    };
  } catch (e) { if (e.gate) return showLogin(e.gate); $('#sheet-body').innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}

// ---------- карта ----------
let map = null, cluster = null;
async function loadMap() {
  if (!window.L) return toast('Карта ещё загружается…');
  if (!map) {
    map = L.map('map', { zoomControl: true }).setView([43.585, 39.723], 11);
    map.on('moveend', () => mapList());
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
  }
  [50, 400].forEach(ms => setTimeout(() => map.invalidateSize(), ms));
  $('#status').textContent = 'Загружаю точки…';
  try {
    const r = await call('map', { f, text, cm: cmOn() });
    cluster?.remove();
    // несколько объявлений в одном доме (точки ближе 40 м) — открываются списком, а не разлетаются по карте;
    // без анимации «разлёта» при увеличении: кружки просто пересобираются, карта не дёргается; точки добавляются частями
    cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: z => z >= 15 ? 35 : 50, spiderfyOnMaxZoom: false, zoomToBoundsOnClick: false,
      animate: false, chunkedLoading: true, chunkInterval: 120, removeOutsideVisibleBounds: true });
    cluster.on('clusterclick', e => {
      const b = e.layer.getBounds();
      if (map.distance(b.getNorthEast(), b.getSouthWest()) > 40 && map.getZoom() < map.getMaxZoom()) return e.layer.zoomToBounds({ padding: [30, 30] });
      const ps = e.layer.getAllChildMarkers().map(m => m.p).sort((a, b) => a.i - b.i);
      L.popup({ minWidth: 260, maxWidth: 280 }).setLatLng(e.layer.getLatLng())
        .setContent(`<div class="mlist"><b>${ps.length} объявл. здесь</b>${ps.map(p => `<a href="#" class="mrow" data-num="${p.num}">
          ${p.ph ? `<img src="${esc(photoUrl(p, 0))}" alt="">` : '<span class="noph"></span>'}<span><b>${p.price ? mln(p.price) + ' млн ₽' : ''}</b>${esc(what(p))}</span></a>`).join('')}</div>`).openOn(map);
    });
    mapPts = r.points.map(([num, lat, lng, price, rooms, kind, area, floor, floors, addr, ph, nw], i) => ({ i, num, lat, lng, price: price ? priceOf(price) : price, rooms, kind, area, floor, floors, addr, ph, nw }));
    const marks = mapPts.map(p => {
      const m = L.marker([p.lat, p.lng]);
      m.p = p;
      m.bindPopup(() => `<div class="mpop">${p.ph ? `<img src="${esc(photoUrl(p, 0))}" alt="" data-num="${p.num}">` : ''}
        ${p.nw ? '<span class="mnew">Новое</span> ' : ''}<b>${p.price ? mln(p.price) + ' млн ₽' : ''}</b>${p.addr ? `<br><b class="zkline">${esc(p.addr)}</b>` : ''}<br>${esc(what(p))}
        <br><a href="#" data-num="${p.num}">Открыть № ${p.num}</a></div>`, { minWidth: 220, maxWidth: 240 });
      return m;
    });
    map.addLayer(cluster);
    cluster.addLayers(marks);
    if (marks.length) map.fitBounds(L.latLngBounds(mapPts.map(p => [p.lat, p.lng])), { maxZoom: 15, padding: [20, 20] });
    $('#status').textContent = `На карте: ${r.points.length.toLocaleString('ru-RU')}`;
    mapList();
  } catch (e) { if (e.gate) return showLogin(e.gate); $('#status').textContent = `Ошибка карты: ${e.message}`; }
}
// список объявлений в видимой части карты (под картой): обновляется при сдвиге и масштабе
let mapPts = [], mlShown = 60;
function mapList(reset = true) {
  if (!map || view !== 'map') return;
  if (reset) mlShown = 60;
  const b = map.getBounds(), by = {
    new: (a, c) => a.i - c.i, price: (a, c) => (a.price || 9e15) - (c.price || 9e15),
    price_desc: (a, c) => (c.price || 0) - (a.price || 0), area_desc: (a, c) => (c.area || 0) - (a.area || 0) };
  const list = mapPts.filter(p => b.contains([p.lat, p.lng])).sort(by[sort] ?? by.new);
  $('#ml-count').textContent = `В области карты: ${list.length.toLocaleString('ru-RU')}`;
  $('#ml-sort').value = by[sort] ? sort : 'new';
  $('#ml-items').innerHTML = list.slice(0, mlShown).map(p => `<div class="mcard" data-num="${p.num}">
    <div class="mph">${p.ph ? `<img src="${esc(photoUrl(p, 0))}" alt="" loading="lazy">` : ''}${p.nw ? '<span class="newmark">Новое</span>' : ''}</div>
    <div class="mb"><b>${p.price ? rub(p.price) : 'Цена не указана'}</b>${p.price && p.area ? `<small class="muted">${Math.round(p.price / p.area).toLocaleString('ru-RU')} ₽/м²</small>` : ''}
      ${p.addr ? `<span class="zkline">${esc(p.addr)}</span>` : ''}<span>${esc(what(p))}</span><small class="muted">№ ${p.num}</small></div></div>`).join('')
    || '<p class="muted">В этой части карты объявлений нет — отдалите карту.</p>';
  $('#ml-more').hidden = list.length <= mlShown;
}
$('#ml-items').addEventListener('click', e => { const c = e.target.closest('[data-num]'); if (c) openItem(+c.dataset.num); });
$('#ml-more').onclick = () => { mlShown += 60; mapList(false); };
$('#ml-sort').onchange = () => { sort = $('#ml-sort').value; $('#sort').value = sort; savePrefs(); mapList(); };
$('#map').addEventListener('click', e => { const a = e.target.closest('[data-num]'); if (a) { e.preventDefault(); openItem(+a.dataset.num); } });
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => {
  view = b.dataset.view;
  document.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('on', x === b));
  $('#list').hidden = view === 'map'; $('#map').hidden = view !== 'map'; $('#more').hidden = view === 'map' || offset >= total; $('#layouts').hidden = view === 'map';
  $('#maplist').hidden = view !== 'map';
  view === 'map' ? loadMap() : search();
});

// ---------- меню ----------
// «Избранное» и «Контакт» — свои списки поверх поиска; повторное нажатие возвращает прежние фильтры
const LISTS = { favs: ['fav', 'Показано избранное — нажмите «★ Избранное» ещё раз, чтобы вернуться к поиску'],
  deals: ['deal', 'Показаны объекты из раздела «Контакт» — нажмите на раздел ещё раз, чтобы вернуться к поиску'] };
document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
  const g = b.dataset.go;
  if (LISTS[g]) {
    const was = favMode;
    if (was) { ({ f, text } = beforeFav); $('#q').value = text; leaveFav(); if (was === g) { changed(); return; } }
    beforeFav = { f, text }; favMode = g; document.querySelectorAll(`[data-go="${g}"]`).forEach(x => x.classList.add('on'));
    f = { [LISTS[g][0]]: true }; $('#q').value = ''; changed();
    toast(LISTS[g][1], 4000);
  }
  if (g === 'client') clientSheet();
  if (g === 'sels') showSelections();
  if (g === 'rk') showReklama();
  if (g === 'admin') admin();
  if (g === 'pay') { sheet('Продлить доступ', '<div id="paywrap"></div>'); renderPay($('#paywrap'), {}, () => { closeSheet(); start(); }); }
});
$('#logout').onclick = logout;

// ---------- режим «С клиентом» ----------
function clientUi() {
  document.body.classList.toggle('client', client.on);
  const b = $('#go-client');
  b.classList.toggle('on', client.on);
  b.textContent = client.on ? '👤 С клиентом ✓' : '👤 С клиентом';
}
function clientSheet() {
  sheet('Показ клиенту', `
    <p>Цены на сайте — с вашей комиссией сверху. Источники объявлений, заметки, телефоны собственников и «Контакт» скрыты: экран можно показывать клиенту.</p>
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

// ---------- «Реклама»: перенос объектов в черновики рекламы (вкладку включает администратор участнику) ----------
const RKST = { new: 'в очереди', work: 'переношу', done: 'черновик создан', dup: 'уже есть (дубль)', error: 'ошибка' };
async function showReklama() {
  sheet('Реклама', '<p class="muted">Загрузка…</p>', true);
  let r;
  try { r = await call('rk_list'); } catch (e) { if (e.gate) return showLogin(e.gate); $('#sheet-body').innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
  const nums = [...sel];
  $('#sheet-body').innerHTML = `
    <p>Объекты переносятся в <b>черновики</b> рекламного кабинета: фото, адрес, цена, описание (без фраз «звоните через Авито» и т. п.). Сами объявления не публикуются — проверяете и публикуете вы.</p>
    <div class="hint">Отметьте объекты галочкой «В подборку» в списке и добавьте их сюда. Повторно один объект в очередь не встаёт.</div>
    <div class="sheet-foot"><span class="muted">Отмечено: ${nums.length}</span><button class="btn primary" id="rk-add" ${nums.length ? '' : 'disabled'}>Добавить отмеченные в очередь</button></div>
    <div class="group">Очередь и черновики (${r.items.length})</div>
    ${r.items.length ? `<div class="ascroll"><table class="atable"><thead><tr><th>№</th><th>Объект</th><th>Статус</th><th>Добавлен</th><th></th></tr></thead><tbody>
      ${r.items.map(j => `<tr><td>${j.num}</td><td>${esc(j.what || '')}</td><td>${esc(RKST[j.status] ?? j.status)}${j.error ? `<br><small class="err">${esc(j.error)}</small>` : ''}</td>
        <td>${new Date(j.created_at).toLocaleString('ru-RU')}</td><td>${j.status === 'new' || j.status === 'error' ? `<button class="btn ghost" data-rkdel="${j.num}">Убрать</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`
      : '<p class="muted">Очередь пуста.</p>'}
    <p class="hint">${r.worker ? '' : 'Вход в рекламный кабинет и автоматический перенос подключаются следующим шагом — пока объекты ждут в очереди.'}</p>`;
  $('#rk-add').onclick = async () => {
    try { const x = await call('rk_add', { nums }); toast(`В очередь добавлено: ${x.added}`); showReklama(); } catch (e) { toast(e.message); }
  };
  $('#sheet-body').onclick = async e => {
    const d = e.target.closest('[data-rkdel]'); if (!d) return;
    try { await call('rk_del', { num: +d.dataset.rkdel }); showReklama(); } catch (err) { toast(err.message); }
  };
}

// ---------- админ-панель ----------
const FEAT = { map: 'Карта', favorites: 'Избранное', deals: 'Контакт', selections: 'Подборки PDF', messengers: 'Кнопки мессенджеров', registration: 'Регистрация на сайте',
  modern_filter: 'Фильтр «Дизайнерский» (по фото)', notes: 'Заметки к объектам', compare: 'Сравнение (резерв)' };
const LIM = { phone_hour: 'Телефонов в час', phone_day: 'Телефонов в сутки', sel_hour: 'Подборок в час', max_sessions: 'Одновременных входов', access_days: 'Дней доступа по умолчанию' };
async function admin() {
  sheet('Админ-панель', '<p class="muted">Загрузка…</p>', true);
  let r;
  try { r = await call('admin_users'); } catch (e) { $('#sheet-body').innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
  const day = s => s ? new Date(s).toLocaleDateString('ru-RU') : '—';
  const pend = r.users.filter(u => u.status === 'pending');
  const row = u => `<tr data-login="${esc(u.login)}">
    <td><b>${esc(u.name || '')}</b><br><small>${esc(u.login)}${u.tg_id ? ' · Telegram' : ''}</small><br><small>${esc([u.phone, u.email, u.company].filter(Boolean).join(' · '))}</small></td>
    <td class="st-${u.status}">${{ pending: 'заявка', active: 'активен', off: 'отключён' }[u.status]}${u.role === 'admin' ? '<br><b>админ</b>' : ''}${u.can_rk ? '<br><small>📣 реклама</small>' : ''}</td>
    <td>${u.role === 'admin' ? '∞' : day(u.expires_at)}<br><small class="muted">вход: ${day(u.last_login)}</small></td>
    <td>${u.phones_day} тел. / ${u.pdfs_day} PDF<br><small class="muted">входов: ${u.sessions}</small></td>
    <td><input data-lim="lim_phone_hour" placeholder="${r.limits.phone_hour}" value="${u.lim_phone_hour ?? ''}" title="телефонов в час">
      <input data-lim="lim_phone_day" placeholder="${r.limits.phone_day}" value="${u.lim_phone_day ?? ''}" title="телефонов в сутки"><br>
      <input data-lim="lim_sel_hour" placeholder="${r.limits.sel_hour}" value="${u.lim_sel_hour ?? ''}" title="подборок в час">
      <input data-lim="max_sessions" placeholder="${r.limits.max_sessions}" value="${u.max_sessions ?? ''}" title="одновременных входов"></td>
    <td class="row-actions">
      ${u.status !== 'active' ? '<button class="btn primary" data-a="approve">Одобрить +30 дн.</button>' : '<button class="btn soft" data-a="plus">+30 дней</button>'}
      ${u.status !== 'off' ? '<button class="btn ghost" data-a="off">Отключить</button>' : ''}
      <button class="btn ghost" data-a="lims">Сохранить лимиты</button>
      <button class="btn ghost" data-a="pass">Новый пароль</button>
      <button class="btn ghost" data-a="kick">Выкинуть входы</button>
      <button class="btn ghost" data-a="rk">${u.can_rk ? 'Выключить «Рекламу»' : 'Включить «Рекламу»'}</button>
      <button class="btn ghost" data-a="role">${u.role === 'admin' ? 'Снять админа' : 'Сделать админом'}</button>
      <input type="date" data-a="date" value="${u.expires_at ? u.expires_at.slice(0, 10) : ''}" title="доступ до">
    </td></tr>`;
  $('#sheet-body').innerHTML = `
    ${pend.length ? `<div class="group">Заявки на доступ: ${pend.length}</div>` : ''}
    <div class="group">Участники (${r.users.length})</div>
    <input id="a-find" type="search" placeholder="Поиск по имени, логину, телефону">
    <div class="ascroll"><table class="atable"><thead><tr><th>Участник</th><th>Статус</th><th>Доступ до</th><th>Сегодня</th><th>Лимиты: тел/час, тел/сут, PDF/час, входов</th><th></th></tr></thead>
      <tbody id="a-rows">${[...pend, ...r.users.filter(u => u.status !== 'pending')].map(row).join('')}</tbody></table></div>
    <div class="group">Добавить участника</div>
    <form id="a-new" class="agrid"><input name="login" placeholder="логин (латиница)" required><input name="password" placeholder="пароль (от 6)" required>
      <input name="name" placeholder="Имя"><input name="phone" placeholder="Телефон"><input name="days" type="number" value="30" title="дней доступа">
      <button class="btn primary">Добавить</button></form>
    <div class="group">Лимиты по умолчанию (для всех, кроме админов)</div>
    <form id="a-lim" class="agrid">${Object.entries(LIM).map(([k, t]) => `<label class="field">${t}<input name="${k}" type="number" min="0" value="${r.limits[k]}"></label>`).join('')}
      <button class="btn primary">Сохранить лимиты</button></form>
    <div class="group">Ссылки на источники (Авито, Циан…) в карточке</div>
    <form id="a-src" class="agrid"><label class="field">Кому показывать<select name="mode">
      ${[['off', 'Никому'], ['admin', 'Только администраторам'], ['all', 'Всем участникам']].map(([v, t]) => `<option value="${v}"${r.src_links === v ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
      <button class="btn primary">Сохранить</button></form>
    <div class="group">Проверка уникальности новых объявлений (ночью после выгрузки)</div>
    <form id="a-uniq" class="agrid"><label class="chk opt"><input type="checkbox" name="enabled" ${r.uniq?.enabled ? 'checked' : ''}><span>Проверять: есть ли живое объявление на Авито, Циан, ДомКлик</span></label>
      <label class="field">Объявлений за ночь<input name="per_night" type="number" min="0" max="300" value="${r.uniq?.per_night ?? 40}"></label>
      <button class="btn primary">Сохранить</button></form>
    <div class="group">Оплата доступа в USDT (сеть TRON, TRC-20)</div>
    <form id="a-pay" class="agrid">
      <label class="chk opt"><input type="checkbox" name="enabled" ${r.pay?.enabled ? 'checked' : ''}><span>Принимать оплату (выключено — доступ бесплатный, кнопки оплаты не видно)</span></label>
      <label class="field">Кошелёк TRC-20<input name="address" value="${esc(r.pay?.address ?? '')}"></label>
      ${(r.pay?.tariffs ?? []).map((t, i) => `<div class="agrid" data-tar="${i}"><input name="tn${i}" value="${esc(t.name)}" title="название"><input name="td${i}" type="number" value="${t.days}" title="дней"><input name="tu${i}" type="number" value="${t.usdt}" title="USDT"></div>`).join('')}
      <button class="btn primary">Сохранить оплату</button></form>
    ${r.payments?.length ? `<div class="ascroll"><table class="atable"><thead><tr><th>Когда</th><th>Логин</th><th>Тариф</th><th>Сумма</th><th>Статус</th></tr></thead><tbody>
      ${r.payments.map(p => `<tr><td>${new Date(p.created_at).toLocaleString('ru-RU')}</td><td>${esc(p.login)}</td><td>${esc(p.tariff)}</td><td>${Number(p.amount).toFixed(2)}</td>
        <td>${{ pending: 'ждём', paid: 'оплачен', expired: 'истёк' }[p.status] ?? p.status}${p.txid ? ` · <a href="https://tronscan.org/#/transaction/${esc(p.txid)}" target="_blank" rel="noopener">TX</a>` : ''}</td></tr>`).join('')}</tbody></table></div>` : ''}
    <div class="group">Инструменты сайта (можно выключить)</div>
    <form id="a-feat" class="agrid">${Object.entries(FEAT).map(([k, t]) => `<label class="chk opt"><input type="checkbox" name="${k}" ${r.features[k] ? 'checked' : ''}><span>${t}</span></label>`).join('')}
      <button class="btn primary">Сохранить</button></form>`;
  $('#a-find').oninput = () => { const q = $('#a-find').value.toLowerCase(); document.querySelectorAll('#a-rows tr').forEach(tr => tr.hidden = !tr.textContent.toLowerCase().includes(q)); };
  const save = async (login, set, kick = false) => {
    try { const x = await call('admin_user', { login, set, kick }); if (x.error) throw new Error(x.message); toast('Сохранено'); admin(); } catch (e) { toast(e.message); }
  };
  $('#a-rows').onclick = e => {
    const b = e.target.closest('button[data-a]'); if (!b) return;
    const tr = b.closest('tr'), login = tr.dataset.login, a = b.dataset.a;
    if (a === 'approve') save(login, { status: 'active', add_days: 30 });
    if (a === 'plus') save(login, { add_days: 30 });
    if (a === 'off' && confirm(`Отключить ${login}?`)) save(login, { status: 'off' });
    if (a === 'kick') save(login, {}, true);
    if (a === 'rk') save(login, { can_rk: b.textContent.startsWith('Включить') });
    if (a === 'role') save(login, { role: b.textContent.startsWith('Снять') ? 'user' : 'admin' });
    if (a === 'pass') { const p = prompt(`Новый пароль для ${login} (от 6 символов):`); if (p) save(login, { password: p }); }
    if (a === 'lims') save(login, Object.fromEntries([...tr.querySelectorAll('[data-lim]')].map(i => [i.dataset.lim, i.value])));
  };
  $('#a-rows').onchange = e => { const i = e.target.closest('input[data-a="date"]'); if (i) save(i.closest('tr').dataset.login, { expires_at: i.value ? new Date(i.value + 'T23:59:00').toISOString() : null }); };
  $('#a-new').onsubmit = async e => {
    e.preventDefault(); const fm = e.target;
    try { const x = await call('admin_create', Object.fromEntries(['login', 'password', 'name', 'phone', 'days'].map(k => [k, fm[k].value]))); if (x.error) throw new Error(x.message); toast('Участник добавлен'); admin(); }
    catch (err) { toast(err.message); }
  };
  $('#a-lim').onsubmit = async e => {
    e.preventDefault(); const fm = e.target;
    try { await call('admin_settings', { limits: Object.fromEntries(Object.keys(LIM).map(k => [k, fm[k].value])) }); toast('Лимиты сохранены'); } catch (err) { toast(err.message); }
  };
  const saveSet = async (body, msg = 'Сохранено') => { try { const x = await call('admin_settings', body); toast(msg); return x; } catch (err) { toast(err.message); } };
  $('#a-src').onsubmit = e => { e.preventDefault(); saveSet({ src_links: e.target.mode.value }); };
  $('#a-uniq').onsubmit = e => { e.preventDefault(); saveSet({ uniq: { enabled: e.target.enabled.checked, per_night: e.target.per_night.value } }); };
  $('#a-pay').onsubmit = e => {
    e.preventDefault(); const fm = e.target;
    const tariffs = (r.pay?.tariffs ?? []).map((t, i) => ({ id: t.id, name: fm['tn' + i].value, days: fm['td' + i].value, usdt: fm['tu' + i].value }));
    saveSet({ pay: { enabled: fm.enabled.checked, address: fm.address.value, tariffs } }, 'Оплата сохранена');
  };
  $('#a-feat').onsubmit = async e => {
    e.preventDefault(); const fm = e.target;
    try { const x = await call('admin_settings', { features: Object.fromEntries(Object.keys(FEAT).map(k => [k, fm[k].checked])) }); meta.features = x.features; renderFilters(); toast('Сохранено'); }
    catch (err) { toast(err.message); }
  };
}

// ---------- оплата USDT (TRC-20) ----------
let qrLib = null;
const loadQr = () => qrLib ??= new Promise((ok, bad) => { const sc = document.createElement('script');
  sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'; sc.onload = ok; sc.onerror = bad; document.head.appendChild(sc); });
// вход прошёл, но доступ истёк или заявка не одобрена — оплата сразу на экране входа
function payGate(pay, msg) {
  gate(`<h2>Оплата доступа</h2><p>${esc(msg)}</p><div id="paywrap"></div><button class="btn ghost" id="back">Ко входу</button>`);
  $('#back').onclick = () => showLogin();
  renderPay($('#paywrap'), { pay }, () => showLogin());
}
async function renderPay(el, extra = {}, done) {
  el.innerHTML = '<p class="muted">Загрузка…</p>';
  let info;
  try { info = await call('pay_info', extra); } catch (e) { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
  if (!info.enabled) { el.innerHTML = '<p>Сейчас доступ бесплатный — оплата не нужна.</p>'; return; }
  el.innerHTML = `<div class="paybox">${info.expires_at ? `<p class="muted">Доступ сейчас: до ${new Date(info.expires_at).toLocaleDateString('ru-RU')}</p>` : ''}
    <div class="tariffs">${info.tariffs.map(t => `<button type="button" class="tariff" data-t="${esc(t.id)}"><span>${esc(t.name)}</span><b>${t.usdt} USDT</b><small class="muted">${t.days} дн.</small></button>`).join('')}</div>
    <p class="hint">Оплата в USDT в сети TRON (TRC-20) с любого кошелька или биржи. После перевода доступ продлится сам — обычно за 1–3 минуты.</p><div id="inv"></div></div>`;
  el.querySelector('.tariffs').onclick = async e => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    try { const r = await call('pay_create', { ...extra, tariff: b.dataset.t }); showInvoice(el.querySelector('#inv'), r.invoice, extra, done); }
    catch (err) { toast(err.message); }
  };
}
function showInvoice(box, inv, extra, done) {
  const amount = Number(inv.amount).toFixed(2);
  box.innerHTML = `<div class="inv">
    <div>Переведите <b>ровно</b> эту сумму:</div><div class="amount">${amount} USDT</div>
    <button type="button" class="btn soft" data-copy="${amount}">Копировать сумму</button>
    <div>На кошелёк (сеть <b>TRON, TRC-20</b>):</div><code>${esc(inv.address)}</code>
    <button type="button" class="btn soft" data-copy="${esc(inv.address)}">Копировать адрес</button>
    <div class="qr" id="qr"></div>
    <p class="warn-box">Только сеть TRC-20 и сумма до цента — по ней мы находим ваш платёж. Счёт действует до ${new Date(inv.expires_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}.</p>
    <p id="inv-st" class="muted">Жду перевод — страницу можно не закрывать, проверка идёт сама.</p></div>`;
  box.onclick = e => { const c = e.target.closest('[data-copy]'); if (c) copy(c.dataset.copy, 'Скопировано'); };
  loadQr().then(() => new window.QRCode(box.querySelector('#qr'), { text: inv.address, width: 160, height: 160 })).catch(() => box.querySelector('#qr')?.remove());
  clearInterval(showInvoice.t);
  const tick = async () => {
    if (!document.body.contains(box)) return clearInterval(showInvoice.t);
    try {
      const r = await call('pay_check', { ...extra, id: inv.id });
      if (r.invoice.status === 'paid') {
        clearInterval(showInvoice.t);
        box.innerHTML = `<div class="inv"><b>Оплата получена, спасибо!</b><div>Доступ до ${new Date(r.expires_at).toLocaleDateString('ru-RU')}.</div><button class="btn primary" id="pay-done">Продолжить</button></div>`;
        box.querySelector('#pay-done').onclick = () => done?.();
      } else if (r.invoice.status === 'expired') $('#inv-st').textContent = 'Время счёта вышло. Если вы уже перевели — платёж найдётся в течение суток; если нет — выберите тариф ещё раз.';
    } catch { /* сеть — проверим в следующий раз */ }
  };
  showInvoice.t = setInterval(tick, 20000);
}

start();
