// «Архив за 2 года» — отдельная страница сайта «Для Агента»: объявления собственников Сочи за 2 года (в продаже и снятые).
// Данные приходят от функции web (arch_*) в момент открытия страницы; свой фильтр (af) с деревом «Сочи и районы» в микрорайонах источника.
// Объявление открывается своей страницей: адрес arch.html#o=<ключ> (можно переслать коллеге с доступом к архиву).
'use strict';
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
const token = store.get('token', null);
const auth = token ? { token } : null;   // вход — на главной (и из Telegram: там initData меняется на токен своей сессии)
// фильтр архива — свой; в первый раз берём основные фильтры сайта (тип, комнаты, цена, площадь, этаж, район)
let af = store.get('af', null), text = store.get('atext', ''), sort = store.get('asort', 'new');
if (!af) {
  const f = store.get('f2', {});
  af = Object.fromEntries(['k', 'r', 'pmin', 'pmax', 'amin', 'amax', 'fmin', 'fmax', 'nf', 'd'].filter(k => f[k] !== undefined).map(k => [k, f[k]]));
  text = store.get('text', '');
}
let tree = [], feat = {}, view = 'list', page = 0, total = 0, busy = false, items = [], listY = 0;
const byT = new Map();   // объявления по ключу — из выдачи и точки карты: для кнопок в карточках
const mobile = () => innerWidth <= 760;
let fside = store.get('afside', true);   // фильтр на компьютере колонкой слева (по умолчанию) или сверху — выбор помнит браузер

async function call(action, extra = {}, region = REGIONS[0], signal) {
  const r = await fetch(window.API, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-region': region }, body: JSON.stringify({ action, auth, ...extra }), signal });
  const data = await r.json().catch(() => ({ error: 'server', message: `Ошибка сервера (HTTP ${r.status})` }));
  if (['no_auth', 'no_access', 'expired', 'kicked', 'off'].includes(data.error)) { location.href = './'; throw new Error(data.message); }   // вход — на главной
  if (!r.ok || data.error) throw Object.assign(new Error(data.message || data.error || `HTTP ${r.status}`), { data });
  return data;
}
// регионы сервера, откуда источник отвечает (из eu-west-2/3 — почти нет); не ответил — повтор в следующем регионе, до 3 попыток
const REGIONS = ['eu-central-1', 'eu-west-1', 'eu-central-2'];
async function callRetry(action, extra = {}, tries = 3, signal) {   // signal — отменить устаревший запрос (новый поиск вместо прежнего)
  for (let t = 1; ; t++) {
    try { return await call(action, extra, REGIONS[(t - 1) % REGIONS.length], signal); }
    catch (e) { if (t >= tries || signal?.aborted || !/источник не ответил/.test(e.message)) throw e; }
  }
}
function toast(t, ms = 2600) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, ms); }
function gate(html) { $('#gate').innerHTML = html; $('#gate').hidden = false; $('#app').hidden = true; }
function save() { store.set('af', af); store.set('atext', text); store.set('asort', sort); }

const mln = v => (v / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
const rub = v => Math.round(v).toLocaleString('ru-RU') + ' ₽';
const dots = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const rubOf = s => { const v = +String(s).replace(/\D/g, ''); return v > 0 && v < 1000 ? v * 1e6 : v; };
const zkName = c => c ? 'ЖК ' + String(c).replace(/(^|\s)ЖК(?=\s|$)/gi, ' ').replace(/\s+/g, ' ').trim() : '';
const day = s => s ? new Date(s).toLocaleDateString('ru-RU') : '—';
function what(x) {
  if (x.kind === 'участок') return `Участок${x.land ? ` ${x.land} сот.` : ''}${x.use_land ? ` · ${x.use_land}` : ''}`;
  if (x.kind === 'коммерция') return [x.type_name || 'Коммерция', x.area && `${x.area} м²`].filter(Boolean).join(' · ');
  if (x.kind === 'дом') return [x.type_name || 'Дом', x.area && `${x.area} м²`, x.land && `участок ${x.land} сот.`].filter(Boolean).join(' · ');
  const t = x.rooms === 0 ? 'Студия' : `${x.rooms ?? '?'}-комн. ${x.kind === 'апартаменты' ? 'апартаменты' : 'квартира'}`;
  return [t, x.area && `${x.area} м²`, x.floor && `${x.floor}/${x.floors ?? '?'} эт.`].filter(Boolean).join(' · ');
}
const placeOf = x => x.sub || (x.district ? (/ский$/.test(x.district) ? `${x.district} р-н` : x.district) : (x.mkr ? String(x.mkr).replace(/\s+мкр$/, '') : ''));
// «В продаже» / «Снято: продано (сделка)» — причина из объявления, если есть
const statusTag = x => x.gone ? `<span class="tag grey">Снято с продажи${x.reason ? `: ${esc(x.reason)}` : ''}</span>`
  : `<span class="tag ok">В продаже</span>${x.reason ? ` <span class="tag grey">${esc(x.reason)}</span>` : ''}`;
const img = (u, extra = '') => `<img src="${esc(u)}" alt="" referrerpolicy="no-referrer" ${extra}>`;

// ---------- запуск ----------
async function start() {
  tg?.ready(); tg?.expand();
  if (!auth) { location.href = './'; return; }
  let r;
  PLANS.use({ call, sheet, toast });
  try { r = await call('arch_init'); }
  catch (e) {   // без PRO/MAX — описание архива и «Оформить PRO» (окно с тем, что даёт PRO)
    if (e.data?.error === 'need_pro') return gate(`${PLANS.lockedHtml('arch')}<a class="btn ghost" href="./">← Все объявления</a>`);
    return gate(`<h2>Архив недоступен</h2><p>${esc(e.message)}</p><a class="btn ghost" href="./">← Все объявления</a>`);
  }
  tree = r.tree; feat = r.features ?? {};
  selbar();
  $('#who').textContent = r.me.name || r.me.login;
  PLANS.counter(r.me.used);
  $('#gate').hidden = true; $('#app').hidden = false;
  $('#q').value = text; $('#sort').value = sort;
  openF(!mobile()); sideUi();
  FUI.help(); renderFilters();
  route();
}

// ---------- фильтр ----------
const arr = k => Array.isArray(af[k]) ? af[k] : [];
function toggleIn(k, v) { const s = new Set(arr(k)); s.has(v) ? s.delete(v) : s.add(v); af[k] = [...s]; if (!af[k].length) delete af[k]; }
function chipRow(el, list, key, off = () => '') {   // off(v) — почему вариант сейчас неактивен (несовместим с выбранным)
  el.innerHTML = list.map(([v, t]) => { const why = off(v);
    return `<button type="button" class="chip${arr(key).includes(v) ? ' on' : ''}" data-v="${esc(v)}"${why ? ` disabled title="${esc(why)}"` : ''}>${esc(t)}</button>`; }).join('');
  el.onclick = e => { const b = e.target.closest('[data-v]'); if (!b || b.disabled) return; toggleIn(key, typeof list[0][0] === 'number' ? +b.dataset.v : b.dataset.v); fchg(); };
}
// несовместимое уже выбранное снимаем с пояснением (как на главной): у участков нет комнат и этажа, студии — только у квартир и апартаментов
function compatFix() {
  const c = FUI.compat(af), gone = ['r', 'fmin', 'fmax', 'nf'].filter(k => c.land && af[k] !== undefined);
  gone.forEach(k => delete af[k]);
  if (gone.length) toast('У участков нет комнат и этажа — эти фильтры сняты', 4000);
  if (!c.studio && arr('r').includes(0)) { toggleIn('r', 0); toast('«Студия» снята: студии бывают только у квартир и апартаментов', 4000); }
  if (!c.nf && af.nf) { delete af.nf; if (!c.land) toast('«Не первый» снят: этаж «до 1» — это только первый этаж', 4000); }
  return c;
}
// выбранные микрорайоны: подписи для кнопки «Сочи и районы»
function areaLabel() {
  const on = new Set(arr('mk')), names = [];
  for (const d of tree) {
    const all = d.subs.flatMap(s => s.ids);
    if (all.every(i => on.has(i))) { names.push(d.name + (/ский$/.test(d.name) ? ' р-н' : '')); continue; }
    d.subs.filter(s => s.ids.every(i => on.has(i))).forEach(s => names.push(s.name));
  }
  return names;
}
function renderFilters() {
  const c = compatFix(), land = c.land ? 'У участков этого нет' : '';
  chipRow($('#f-kind'), KINDS, 'k');
  chipRow($('#f-rooms'), ROOMS, 'r', v => land || (v === 0 && !c.studio ? 'Студии бывают только у квартир и апартаментов' : ''));
  $('#f-sale').innerHTML = [[false, 'Все: в продаже и снятые'], [true, 'Только в продаже']]
    .map(([v, t]) => `<button type="button" class="chip${!!af.sale === v ? ' on' : ''}" data-s="${v ? 1 : ''}">${t}</button>`).join('');
  $('#f-sale').onclick = e => { const b = e.target.closest('[data-s]'); if (!b) return; af.sale = !!b.dataset.s || undefined; fchg(); };
  // поле, в котором сейчас печатают, не трогаем: иначе цена «12» на полуслове превращалась в «12.000.000»
  const put = (k, v) => { const el = $('#' + k); if (el !== document.activeElement) el.value = v; };
  for (const k of ['amin', 'amax', 'fmin', 'fmax']) put(k, af[k] ?? '');
  for (const k of ['pmin', 'pmax']) put(k, af[k] ? dots(Math.round(af[k] * 1e6)) : '');
  $('#nf').checked = !!af.nf;
  for (const k of ['fmin', 'fmax']) $('#' + k).disabled = c.land;
  $('#nf').disabled = !c.nf;
  $('#fmin').closest('.fcell').classList.toggle('off', c.land);
  FUI.pairs(af);
  // улица или область карты — главнее районов (сервер районы тогда не учитывает)
  $('#f-place').innerHTML = [af.st && `<button type="button" class="chip on" data-x="st">📍 ${esc(af.stl || 'улица')} ✕</button>`,
    af.geo && '<button type="button" class="chip on" data-x="geo">▭ Область карты ✕</button>',
    af.dl && arr('d').length && !arr('mk').length && `<button type="button" class="chip on" data-x="d">📍 ${esc(af.dl)} ✕</button>`].filter(Boolean).join('');
  const names = areaLabel(), oldD = arr('d').length && !arr('mk').length;
  $('#open-areas').textContent = names.length ? `${names.slice(0, 2).join(', ')}${names.length > 2 ? ` +${names.length - 2}` : ''}`
    : oldD ? (af.dl || 'Районы из основного поиска') : 'Весь Сочи';
  $('#open-areas').classList.toggle('on', names.length > 0 || oldD);
  if ((af.st || af.geo) && (names.length || oldD)) $('#open-areas').textContent += ' (не учитывается)';
  const n = Object.keys(af).filter(k => !['dl', 'stl', 'house'].includes(k) && af[k] !== undefined && !(Array.isArray(af[k]) && !af[k].length)).length;
  $('#fcount').textContent = n ? `(${n})` : '';
}
function readInputs() {
  for (const k of ['amin', 'amax', 'fmin', 'fmax']) { const v = +$('#' + k).value; if (v > 0) af[k] = v; else delete af[k]; }
  for (const k of ['pmin', 'pmax']) { const v = rubOf($('#' + k).value); if (v > 0) af[k] = v / 1e6; else delete af[k]; }
  af.nf = $('#nf').checked || undefined;
}
for (const k of ['pmin', 'pmax']) {
  $('#' + k).addEventListener('input', e => { const d = e.target.value.replace(/\D/g, ''); e.target.value = d ? dots(+d) : ''; });
  $('#' + k).addEventListener('blur', e => { const v = rubOf(e.target.value); e.target.value = v ? dots(v) : ''; readInputs(); });
}
// поля сразу попадают в фильтр, поиск — через 0,5 с после последней цифры
for (const k of ['amin', 'amax', 'fmin', 'fmax', 'pmin', 'pmax']) $('#' + k).addEventListener('input', () => { readInputs(); later(); });
$('#nf').addEventListener('change', () => { readInputs(); fchg(); });
$('#f-place').onclick = e => { const b = e.target.closest('[data-x]'); if (!b) return; const x = b.dataset.x;
  if (x === 'st') { delete af.st; delete af.house; delete af.stl; } else if (x === 'd') { delete af.d; delete af.dl; } else delete af.geo; changed(); };
// одна строка поиска, как на главной: подсказки того же словаря (улицы, дома, районы; ЖК архив не учитывает).
// Улица или дом уходят в источник по его адресам (arch_geo: «улица Позднякова, 2»), район — как район из основного поиска (af.d)
// улицы нет в словаре (на ней нет объявлений в нашей базе) — последний пункт «Искать адрес …»: адрес разбирает источник
SUGG.attach($('#q'), { load: (q, signal) => callRetry('suggest', { q, arch: true }, 2, signal).then(r => /[а-яё]{3}/i.test(q) && !r.items.some(x => x.kind === 'house')
  ? [...r.items.slice(0, 7), { kind: 'addr', type: 'адрес', name: `Искать адрес «${q}»`, geo: q, label: q }] : r.items), pick: async x => {
  if (x.kind === 'district') {
    delete af.mk; delete af.st; delete af.house; delete af.stl; af.d = [x.key]; af.dl = x.name;
    $('#q').value = ''; changed(); return;
  }
  try {
    const r = await callRetry('arch_geo', { text: x.geo || x.name });
    af.st = r.st; af.house = r.house || undefined; af.stl = x.label || x.name; delete af.geo;
    $('#q').value = ''; changed();
  } catch (e) { toast(e.message, 4000); }
} });
function openF(on) {
  $('#filters').classList.toggle('closed', !on); document.body.classList.toggle('fopen', on && mobile());
  document.body.classList.toggle('fshown', on); map?.invalidateSize();
}
// фильтр колонкой слева или блоком сверху (на компьютере; на телефоне — окно на весь экран)
function sideUi() {
  document.body.classList.toggle('fside', fside);
  $('#f-side').textContent = fside ? '⇧ Фильтр сверху' : '⇦ Фильтр слева';
  setTimeout(() => map?.invalidateSize(), 50);
}
$('#f-side').onclick = () => { fside = !fside; store.set('afside', fside); sideUi(); };
$('#toggle-f').onclick = () => openF($('#filters').classList.contains('closed'));
// любое изменение фильтра применяется само — через 0,5 с после последнего (кнопки «Применить» нет);
// на телефоне кнопка «Показать N» внизу окна только закрывает его: выдача к этому времени уже обновлена
function later(ms = 500) { clearTimeout(later.t); later.t = setTimeout(changed, ms); $('#apply').textContent = 'Показать …'; }
function fchg() { renderFilters(); later(); }
const flush = () => { if (later.t) changed(); };
$('#f-close').onclick = () => { readInputs(); flush(); openF(false); };
$('#apply').onclick = () => { readInputs(); flush(); openF(false); };
$('#reset').onclick = () => { af = {}; text = ''; $('#q').value = ''; renderFilters(); changed(); };
// «Ничего не нашлось»: «Сбросить его» — фильтр, который больше всего мешает; «Сбросить все» — все фильтры (текст запроса остаётся)
document.addEventListener('click', e => {
  const one = e.target.closest('[data-drop]'), all = e.target.closest('[data-drop-all]');
  if (!one && !all) return;
  if (one) one.dataset.drop.split(',').forEach(k => delete af[k]); else af = {};
  renderFilters(); changed();
});
$('#sort').onchange = () => { sort = $('#sort').value; save(); view === 'map' ? mapList() : search(); };
$('#qform').addEventListener('submit', e => { e.preventDefault(); readInputs(); $('#q').blur(); changed(); });
$('#q').addEventListener('input', () => { if (!$('#q').value.trim() && text) changed(); });
function changed() {
  clearTimeout(later.t); later.t = 0;
  text = $('#q').value.trim();
  af = Object.fromEntries(Object.entries(af).filter(([, v]) => v !== undefined && !(Array.isArray(v) && !v.length)));
  save(); renderFilters();
  view === 'map' ? loadMap() : search();
}

// «Сочи и районы» — дерево микрорайонов источника по районам: галочка на районе — весь район
function sheet(title, html) { $('#sheet-title').textContent = title; $('#sheet-body').innerHTML = html; $('#sheet').hidden = false; tg?.BackButton.show(); }
function closeSheet() { $('#sheet').hidden = true; if ($('#viewer').hidden && !location.hash) tg?.BackButton.hide(); }
$('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet' || e.target.closest('[data-close]')) closeSheet(); });
const opt = (name, value, label, checked) => `<label class="opt"><input type="checkbox" name="${name}" value="${esc(value)}"${checked ? ' checked' : ''}><span>${esc(label)}</span></label>`;
$('#open-areas').onclick = () => {
  const has = ids => ids.every(i => arr('mk').includes(i)), open = new Set();
  tree.forEach((d, i) => { if (d.subs.some(s => has(s.ids))) open.add(i); });
  sheet('Сочи и районы', `<input id="ar-find" type="search" placeholder="Поиск микрорайона" autocomplete="off"><div id="ar-tree" class="tree"></div>
    <div class="sheet-foot"><button class="btn ghost" id="s-clear">Весь Сочи</button><button class="btn primary" id="s-ok">Применить</button></div>`);
  const draw = () => {
    const q = $('#ar-find').value.trim().toLowerCase().replace(/ё/g, 'е'), hit = s => s.toLowerCase().replace(/ё/g, 'е').includes(q);
    $('#ar-tree').innerHTML = tree.map((d, i) => {
      const subs = q && !hit(d.name) ? d.subs.filter(s => hit(s.name)) : d.subs;
      if (q && !subs.length) return '';
      const all = has(d.subs.flatMap(s => s.ids));
      return `<div class="tr${q || open.has(i) ? ' open' : ''}" data-i="${i}"><div class="tr-h"><button type="button" class="tr-t" data-t aria-label="Микрорайоны"></button>
        ${opt('d', i, d.name + (/ский$/.test(d.name) ? ' район' : ''), all)}</div>
        <div class="tr-subs">${subs.map(s => opt('s', s.ids.join(','), s.name, all || has(s.ids))).join('')}</div></div>`;
    }).join('') || '<p class="muted">Не нашёл такой микрорайон</p>';
  };
  $('#ar-find').oninput = draw; draw();
  $('#sheet-body').onclick = e => {
    if (e.target.closest('[data-t]')) { const i = +e.target.closest('.tr').dataset.i; open.has(i) ? open.delete(i) : open.add(i); draw(); }
  };
  $('#sheet-body').onchange = e => {
    const i = e.target, set = new Set(arr('mk'));
    const ids = i.name === 'd' ? tree[+i.value].subs.flatMap(s => s.ids) : i.value.split(',').map(Number);
    ids.forEach(x => i.checked ? set.add(x) : set.delete(x));
    af.mk = [...set]; if (!af.mk.length) delete af.mk;
    delete af.d; delete af.dl;   // районы из основного поиска (или из подсказки) заменяются выбором здесь
    fchg(); draw();
  };
  $('#s-clear').onclick = () => { delete af.mk; delete af.d; delete af.dl; fchg(); draw(); };
  $('#s-ok').onclick = () => { closeSheet(); flush(); };
};

// ---------- избранное, «Контакт», подборка, заметка — как на главной; объект из архива при первом действии заносится в базу (arch_import → наш №) ----------
const MAXSEL = 10;   // объектов в одной подборке PDF (как на главной)
const selSet = () => new Set(store.get('sel', []));
function selbar() { const n = selSet().size; $('#selbar').hidden = !n || feat.selections === false; $('#selcount').textContent = `В подборке: ${n}`; }
// mini — в карточке на карте только «Избранное» (остальное — на странице объявления)
const acts = (x, mini = false) => `<div class="arch-acts">
  ${feat.favorites !== false ? `<button type="button" class="chip${x.fav ? ' on' : ''}" data-act="fav">${x.fav ? '★' : '☆'} Избранное</button>` : ''}
  ${!mini && feat.deals !== false ? `<button type="button" class="chip${x.deal ? ' on' : ''}" data-act="deal">🤝 Контакт</button>` : ''}
  ${!mini && feat.selections !== false ? `<button type="button" class="chip${x.num && selSet().has(x.num) ? ' on' : ''}" data-act="sel">${x.num && selSet().has(x.num) ? '✓ В подборке' : '＋ В подборку'}</button>` : ''}
  ${!mini && feat.notes !== false ? `<button type="button" class="chip" data-act="note">📝 Заметка</button>` : ''}</div>
  ${!mini && x.note ? `<div class="note">📝 ${esc(x.note)}</div>` : ''}`;
async function ensureNum(x) {
  if (x.num) return x.num;
  const r = await callRetry('arch_import', { t: x.t });
  if (!r.num) throw new Error(r.message || 'не удалось добавить объявление');
  return x.num = r.num;
}
async function act(x, a, box) {
  box.querySelectorAll('[data-act]').forEach(b => b.disabled = true);
  try {
    const num = await ensureNum(x);
    if (a === 'fav') { x.fav = !x.fav; await call('fav', { num, on: x.fav }); toast(x.fav ? 'В избранном' : 'Убрано из избранного'); }
    if (a === 'deal') { x.deal = !x.deal; await call('deal', { num, on: x.deal }); toast(x.deal ? 'В разделе «Контакт»' : 'Убрано из раздела «Контакт»'); }
    if (a === 'note') {
      const v = prompt('Заметка к объекту (видна только вам):', x.note ?? ''); if (v === null) return;
      await call('note', { num, text: v.trim() }); x.note = v.trim() || null; toast('Заметка сохранена');
    }
    if (a === 'sel') {
      const s = selSet();
      if (s.has(num)) s.delete(num);
      else if (s.size >= MAXSEL) return toast(`В одной подборке до ${MAXSEL} объектов — сформируйте PDF на главной и начните новую`, 4000);
      else s.add(num);
      store.set('sel', [...s]); selbar();
      toast(s.has(num) ? `В подборке № ${num} — PDF формируется на главной (кнопка внизу)` : 'Убрано из подборки', 3500);
    }
  } catch (e) { toast(e.message, 4000); }
  finally {
    const wrap = box.closest('.arch-actwrap');
    if (wrap) wrap.innerHTML = acts(x, !!wrap.closest('.mc'));
    box.closest('.card')?.querySelector('.meta')?.replaceWith(Object.assign(document.createElement('div'), { className: 'meta', innerHTML: metaLine(x, !$('#ipage').hidden) }));
  }
}
// «Размещено …» (на странице объявления — и «обновлено») и наш № — появляется, когда объект занесён в базу
const metaLine = (x, full = false) => `Размещено ${day(x.created_at)}${full && x.changed_at ? ` · обновлено ${day(x.changed_at)}` : ''}${x.num ? ` · № ${x.num}` : ''}`;

// ---------- список ----------
// mini — карточка на карте (окно точки и список под картой): та же, без «Контакта», подборки и заметки
function card(x, mini = false) {
  const n = x.pics.length, where = [x.street || x.address, placeOf(x)].filter(Boolean).join(' · ');
  const ppm = x.price && x.area ? `${Math.round(x.price / x.area).toLocaleString('ru-RU')} ₽/м²` : '';
  return `<article class="card${mini ? ' mc' : ''}${x.gone ? ' arch-gone' : ''}" data-t="${esc(x.t)}">
    <a class="gal" href="#o=${esc(x.t)}" data-n="${n}"><div class="strip">${n ? `<div class="ph">${img(x.pics[0], 'loading="lazy"')}</div>` : '<div class="none">Нет фото</div>'}</div>
      ${n > 1 ? `<span class="iv-count">${n} фото</span>` : ''}</a>
    <div class="body">
      <div class="price"><b>${x.price ? rub(x.price) : 'Цена не указана'}</b><small>${ppm}</small></div>
      ${x.complex ? `<div class="zk">${esc(zkName(x.complex))}</div>` : ''}
      <a class="title" href="#o=${esc(x.t)}">${esc(what(x))}</a>
      <div class="addr">${esc(where)}</div>
      <div class="tags">${statusTag(x)}</div>
      <div class="meta">${metaLine(x)}</div>
      <div class="arch-actwrap">${acts(x, mini)}</div>
      <div class="actions">${x.cont ? contHtml(x.cont) : `<button class="btn soft" data-cont>📞 ${mini ? 'Контакты' : 'Контакты и источник'}</button>`}<a class="btn ghost" href="#o=${esc(x.t)}">Открыть</a></div>
    </div></article>`;
}
// новый поиск отменяет запрос в пути: выдача не мигает (прежняя видна бледной до ответа) и не подменяется устаревшим ответом
let sctl = null;
async function search(more = false) {
  if (more && busy) return;
  sctl?.abort();
  const ctl = sctl = new AbortController();
  busy = true;
  if (!more) { $('#list').classList.add('stale'); $('#status').classList.add('wait'); if (!$('#status').textContent) $('#status').textContent = 'Ищу в архиве…'; $('#more').hidden = true; }
  $('#more').disabled = true;
  try {
    const r = await callRetry('arch_search', { f: FUI.clean(af), text, sort, page: more ? page + 1 : 1 }, 3, ctl.signal);
    if (!more) { page = 0; items = []; $('#list').innerHTML = ''; }
    page++; total = r.count;
    items.push(...r.items); r.items.forEach(x => byT.set(x.t, x));
    $('#list').insertAdjacentHTML('beforeend', r.items.map(x => card(x)).join(''));
    showStatus(r, total ? `Найдено за 2 года: ${total.toLocaleString('ru-RU')}` : 'Ничего не нашлось');
    if (!more) noneBox(total ? null : r);
    $('#apply').textContent = `Показать ${total.toLocaleString('ru-RU')}`;
    const left = total - page * r.page;
    $('#more').hidden = view === 'map' || left <= 0;
    $('#more').textContent = `Показать ещё ${Math.min(r.page, left)} из ${left.toLocaleString('ru-RU')}`;
    if (!more) { const y = $('.bar').getBoundingClientRect().top + scrollY - 70; if (scrollY > y) scrollTo({ top: Math.max(0, y) }); }
  } catch (e) { if (!ctl.signal.aborted) $('#status').textContent = `Ошибка: ${e.message}`; }
  finally { if (sctl === ctl) { busy = false; $('#more').disabled = false; $('#list').classList.remove('stale'); $('#status').classList.remove('wait'); } }
}
// «Ничего не нашлось»: что мешает (сервер посчитал у источника) — в выдаче и в окне фильтра на телефоне
function noneBox(r) {
  const html = r ? FUI.empty(r, Object.keys(af).length > 0) : '';
  if (r) $('#list').innerHTML = `<div class="empty">${html}</div>`;
  $('#f-drop').innerHTML = html; $('#f-drop').hidden = !html;
}
const showStatus = (r, head) => $('#status').textContent = head + (r.understood ? ` · понял запрос так: ${r.understood}` : '') + (r.skipped?.length ? ` · в архиве не учитываются: ${r.skipped.join(', ')}` : '');
$('#more').onclick = () => search(true);
// кнопки карточек — в выдаче, в окне точки на карте и в списке под картой
const onCard = e => {
  const c = e.target.closest('.card[data-t]'), x = c && byT.get(c.dataset.t); if (!x) return;
  if (e.target.closest('[data-cont]')) contacts(x, e.target.closest('[data-cont]'));
  if (e.target.closest('[data-copy]')) copy(e.target.closest('[data-copy]').dataset.copy);
  if (e.target.closest('[data-act]')) act(x, e.target.closest('[data-act]').dataset.act, e.target.closest('.arch-actwrap'));
};
['#list', '#map', '#ml-items'].forEach(s => $(s).addEventListener('click', onCard));

// ---------- контакты и источник: только по кнопке (в лимит телефонов) ----------
function phoneBox(p, owner) {
  const d = p.replace(/\D/g, ''), t = encodeURIComponent(MSG);
  return `<div class="phone"><div><a class="num" href="tel:${esc(p)}">${esc(p)}</a>${owner ? ` — ${esc(owner)}` : ''}</div>
    <div class="msgs"><a class="m-call" href="tel:${esc(p)}">Позвонить</a><a class="m-wa" href="https://wa.me/${d}?text=${t}" target="_blank" rel="noopener">WhatsApp</a>
      <button class="m-copy" data-copy="${esc(p)}">Копировать</button></div></div>`;
}
const srcHtml = c => c.src?.length ? `<div class="src">Источник: ${c.src.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join('')}</div>` : '';
const contHtml = c => `<div class="cont">${c.phones?.length ? c.phones.map((p, i) => phoneBox(p, i ? null : c.owner)).join('') : `<span class="err">${esc(c.error || 'номера нет')}</span>`}${srcHtml(c)}</div>`;
async function contacts(x, b) {
  b.disabled = true; b.textContent = 'Узнаю контакты…';
  try {
    const c = await callRetry('arch_contacts', { t: x.t }, 2);
    if (c.error && !c.phones) throw new Error(c.message || c.error);
    PLANS.counter(c.used);
    x.cont = c; b.outerHTML = contHtml(c);
  } catch (err) {
    b.disabled = false; b.textContent = '📞 Контакты и источник';
    if (err.data?.used) PLANS.counter(err.data.used);
    b.parentElement.querySelectorAll('.lim').forEach(e => e.remove());
    if (err.data?.limit) b.insertAdjacentHTML('afterend', `<div class="lim">${PLANS.limitHtml(err.message, err.data.limit)}</div>`);   // лимит — с «Докупить»
    else toast(err.message);
  }
}
function copy(t) { navigator.clipboard?.writeText(t).then(() => toast('Номер скопирован'), () => toast(t)); }

// ---------- страница объявления: #o=<ключ> ----------
addEventListener('hashchange', route);
async function route() {
  const t = /^#o=(.+)$/.exec(location.hash)?.[1];
  if (!t) {
    $('#ipage').hidden = true; $('#lpage').hidden = false; tg?.BackButton.hide();
    if (!page && view === 'list') search(); else if (view === 'map' && !mapPts.length) loadMap();
    requestAnimationFrame(() => scrollTo(0, listY));
    return;
  }
  if (!$('#lpage').hidden) { listY = scrollY; fromList = true; }
  $('#lpage').hidden = true; $('#ipage').hidden = false; tg?.BackButton.show(); scrollTo(0, 0);
  let x = items.find(i => i.t === t);   // с карты и по пересланной ссылке — запрос объявления целиком
  if (!x) {
    $('#ipage').innerHTML = '<p class="muted">Загрузка объявления…</p>';
    try { x = (await callRetry('arch_item', { t })).item; } catch (e) { $('#ipage').innerHTML = `<p class="err">${esc(e.message)}</p><a class="link" href="#">← К списку</a>`; return; }
  }
  itemPage(x, 0);
}
tg?.BackButton.onClick(() => !$('#viewer').hidden ? closeViewer() : !$('#sheet').hidden ? closeSheet() : history.back());
// «← К списку»: пришли из списка или с карты — шаг назад (список на том же месте), открыли ссылкой — просто список
let fromList = false;
const back = () => fromList ? history.back() : (location.hash = '');
function itemPage(x, k) {
  const n = x.pics.length, where = [x.street || x.address, placeOf(x)].filter(Boolean).join(' · ');
  const ppm = x.price && x.area ? `${Math.round(x.price / x.area).toLocaleString('ru-RU')} ₽/м²` : '';
  document.title = `${what(x)} — архив`;
  $('#ipage').innerHTML = `<div class="ip-head"><button class="link" id="ip-back">← К списку</button></div>
    <article class="card itemv" data-k="${k}">
    <div class="iv-media">
      <div class="iv-main">${n ? `<div class="vc">${img(x.pics[k], 'data-big title="Открыть на весь экран"')}</div>` : '<div class="none">Нет фото</div>'}
        ${n > 1 ? '<button class="nav l" data-step="-1" aria-label="Предыдущее фото">‹</button><button class="nav r" data-step="1" aria-label="Следующее фото">›</button>' : ''}
        ${n ? `<span class="iv-count">${k + 1} / ${n}</span>` : ''}</div>
      ${n > 1 ? `<div class="iv-thumbs">${x.pics.map((u, i) => `<button type="button" class="iv-th${i === k ? ' on' : ''}" data-th="${i}" aria-label="Фото ${i + 1}"><span class="vc">${img(u, 'loading="lazy"')}</span></button>`).join('')}</div>` : ''}
    </div>
    <div class="iv-info">
      <div class="price"><b>${x.price ? rub(x.price) : 'Цена не указана'}</b><small>${ppm}</small></div>
      ${x.complex ? `<div class="zk">${esc(zkName(x.complex))}</div>` : ''}
      <div class="iv-title">${esc(what(x))}</div>
      <div class="iv-addr">${esc(where)}</div>
      <div class="tags">${statusTag(x)}</div>
      <div class="meta">${metaLine(x, true)}</div>
      <div class="arch-actwrap">${acts(x)}</div>
      <div class="actions">${x.cont ? contHtml(x.cont) : '<button class="btn soft" data-cont>📞 Контакты и источник</button>'}</div>
      ${x.descr ? `<div class="iv-descr"><div class="iv-h">Описание</div><p>${esc(x.descr)}</p></div>` : ''}
    </div></article>`;
  const el = $('#ipage .itemv');
  el.querySelectorAll('.iv-main img, .iv-th img').forEach(im => im.complete ? fitCrop(im) : im.addEventListener('load', () => fitCrop(im), { once: true }));
  $('#ip-back').onclick = back;
  el.onclick = e => {
    const t = e.target, th = t.closest('[data-th]'), st = t.closest('[data-step]');
    if (th || st) { const y = scrollY; itemPage(x, th ? +th.dataset.th : (+el.dataset.k + +st.dataset.step + n) % n); scrollTo(0, y); return; }
    if (t.matches('[data-big]')) return openViewer(x.pics, +el.dataset.k);
    if (t.closest('[data-cont]')) contacts(x, t.closest('[data-cont]'));
    if (t.closest('[data-copy]')) copy(t.closest('[data-copy]').dataset.copy);
    if (t.closest('[data-act]')) act(x, t.closest('[data-act]').dataset.act, t.closest('.arch-actwrap'));
  };
}

// ---------- фото на весь экран ----------
function openViewer(urls, i) {
  const v = $('#viewer'), s = v.querySelector('.viewer-strip');
  s.innerHTML = urls.map(u => `<div class="vs"><div class="vc">${img(u)}</div></div>`).join('');
  v.hidden = false;
  s.querySelectorAll('img').forEach(im => im.complete ? fitCrop(im) : im.addEventListener('load', () => fitCrop(im), { once: true }));
  s.scrollLeft = i * s.clientWidth;
  const count = () => {
    const k = Math.round(s.scrollLeft / s.clientWidth);
    v.querySelector('.viewer-count').textContent = `${k + 1} / ${urls.length}`;
    v.querySelector('.viewer-nav.l').hidden = k <= 0; v.querySelector('.viewer-nav.r').hidden = k >= urls.length - 1;
  };
  s.onscroll = count; count();
}
// фото без нижней 1/20 (водяные знаки): рамка с пропорцией обрезанного фото
function fitCrop(im) {
  const box = im.closest('.vs, .iv-main, .iv-th'), r = im.naturalWidth / (im.naturalHeight * 0.95);
  if (!box || !r || !box.clientWidth) return;
  const W = box.clientWidth, H = box.clientHeight;
  if (box.classList.contains('iv-th')) { const w = W / H > r ? W : H * r; return Object.assign(im.parentElement.style, { width: `${w}px`, height: `${w / r}px` }); }
  const w = W / H > r ? H * r : W;
  Object.assign(im.parentElement.style, { width: `${w}px`, height: `${w / r}px` });
}
addEventListener('resize', () => document.querySelectorAll($('#viewer').hidden ? '.iv-main img' : '.viewer-strip img').forEach(fitCrop));
function closeViewer() { $('#viewer').hidden = true; }
const viewerStep = d => { const s = $('.viewer-strip'); s.scrollBy({ left: s.clientWidth * d, behavior: 'smooth' }); };
$('#viewer').addEventListener('click', e => {
  const n = e.target.closest('[data-vnav]');
  if (n) return viewerStep(+n.dataset.vnav);
  if (e.target.closest('.viewer-close') || e.target.tagName !== 'IMG') closeViewer();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (!$('#viewer').hidden) closeViewer(); else if (!$('#sheet').hidden) closeSheet(); else if (location.hash) back(); }
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' || e.target.closest?.('input, textarea')) return;
  if (!$('#viewer').hidden) return viewerStep(e.key === 'ArrowRight' ? 1 : -1);
  $(`#ipage [data-step="${e.key === 'ArrowRight' ? 1 : -1}"]`)?.click();
});

// ---------- карта: до 1200 последних объявлений по фильтру, частями по 120 (по 3 части сразу) — точки появляются по мере загрузки ----------
let map = null, cluster = null, mapPts = [], mlShown = 60, mapGen = 0;
// точка карты — объявление без описания и с одним фото: карточка на карте та же, что в выдаче
const ptRow = ([t, lat, lng, price, rooms, kind, area, floor, floors, street, pic, gone, created_at, sub, type_name, land, reason, complex]) =>
  ({ t, lat, lng, price, rooms, kind, area, floor, floors, street, pics: pic ? [pic] : [], gone: !!gone, created_at, sub, type_name, land, reason, complex });
const ptCard = p => card(byT.get(p.t) ?? p, true);
const newest = (a, c) => String(c.created_at ?? '').localeCompare(String(a.created_at ?? '')) || a.i - c.i;   // части карты приходят вразнобой — по дате
const popHtml = ps => `<div class="mlist${ps.length > 1 ? ' many' : ''}">${ps.length > 1 ? `<b class="ml-n">${ps.length} объявл. здесь</b>` : ''}${ps.map(ptCard).join('')}</div>`;
function marker(p) {
  const m = L.marker([p.lat, p.lng], { opacity: p.gone ? 0.55 : 1 });
  m.p = p;
  m.bindPopup(() => popHtml([p]), { minWidth: 250, maxWidth: 250 });
  return m;
}
async function loadMap() {
  if (!window.L) return toast('Карта ещё загружается…');
  if (!map) {
    map = L.map('map').setView([43.585, 39.723], 11);
    map.on('moveend', () => mapList());
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
  }
  [50, 400].forEach(ms => setTimeout(() => map.invalidateSize(), ms));
  const gen = ++mapGen;
  cluster?.remove(); mapPts = []; mapList();
  cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: z => z >= 15 ? 35 : 50, spiderfyOnMaxZoom: false, zoomToBoundsOnClick: false, animate: false, chunkedLoading: true });
  cluster.on('clusterclick', e => {
    const b = e.layer.getBounds();
    if (map.distance(b.getNorthEast(), b.getSouthWest()) > 40 && map.getZoom() < map.getMaxZoom()) return e.layer.zoomToBounds({ padding: [30, 30] });
    L.popup({ minWidth: 300, maxWidth: 300 }).setLatLng(e.layer.getLatLng()).setContent(popHtml(e.layer.getAllChildMarkers().map(m => m.p).sort(newest))).openOn(map);
  });
  map.addLayer(cluster);
  let info = null, done = 0, failed = 0, fitted = false;
  const add = r => {
    if (gen !== mapGen) return;
    const ps = r.points.map((x, k) => ({ ...ptRow(x), i: mapPts.length + k }));
    ps.forEach(p => byT.has(p.t) || byT.set(p.t, p));
    mapPts.push(...ps); cluster.addLayers(ps.map(marker));
    if (!fitted && mapPts.length && !af.geo) { fitted = true; map.fitBounds(L.latLngBounds(mapPts.map(p => [p.lat, p.lng])), { maxZoom: 15, padding: [20, 20] }); }
  };
  const head = () => `На карте: ${mapPts.length.toLocaleString('ru-RU')} из ${info.count.toLocaleString('ru-RU')}` +
    (done < info.parts ? ` · загружаю… ${Math.round(done / info.parts * 100)}%` : info.count > 1200 ? ' (последние 1200 — уточните район, область или цену, чтобы увидеть все)' : '') +
    (failed ? ` · не загрузилось частей: ${failed}` : '');
  $('#status').textContent = 'Загружаю точки архива…';
  try {
    info = await callRetry('arch_map', { f: FUI.clean(af), text, page: 1 }); done = 1; add(info);
    if (gen !== mapGen) return;
    showStatus(info, head());
    for (let p = 2; p <= info.parts; p += 3) {
      await Promise.all(Array.from({ length: Math.min(3, info.parts - p + 1) }, (_, k) => callRetry('arch_map', { f: FUI.clean(af), text, page: p + k })
        .then(add, () => { failed++; }).finally(() => { done++; if (gen === mapGen) { showStatus(info, head()); mapList(); } })));
      if (gen !== mapGen) return;
    }
    if (mapPts.length && !af.geo) map.fitBounds(L.latLngBounds(mapPts.map(p => [p.lat, p.lng])), { maxZoom: 15, padding: [20, 20] });
    showStatus(info, head()); mapList();
  } catch (e) { if (gen === mapGen) $('#status').textContent = `Ошибка карты: ${e.message}`; }
}
// объявления видимой части карты — списком под картой
function mapList(reset = true) {
  if (!map || view !== 'map') return;
  if (reset) mlShown = 60;
  const b = map.getBounds(), by = {
    new: newest, price: (a, c) => (a.price || 9e15) - (c.price || 9e15),
    price_desc: (a, c) => (c.price || 0) - (a.price || 0), area_desc: (a, c) => (c.area || 0) - (a.area || 0) };
  const list = mapPts.filter(p => b.contains([p.lat, p.lng])).sort(by[sort] ?? by.new);
  $('#ml-count').textContent = `В области карты: ${list.length.toLocaleString('ru-RU')}`;
  $('#ml-items').innerHTML = list.slice(0, mlShown).map(ptCard).join('') || '<p class="muted">В этой части карты объявлений нет — отдалите карту.</p>';
  $('#ml-more').hidden = list.length <= mlShown;
}
// «Искать в этой области»: видимая часть карты — прямоугольник [долгота, широта]; улица и районы тогда не учитываются
$('#map-area').onclick = e => {
  e.stopPropagation();
  const b = map.getBounds(), r = v => Math.round(v * 1e5) / 1e5;
  af.geo = [[r(b.getWest()), r(b.getSouth())], [r(b.getEast()), r(b.getSouth())], [r(b.getEast()), r(b.getNorth())], [r(b.getWest()), r(b.getNorth())]];
  delete af.st; delete af.house; delete af.stl;
  changed();
};
$('#ml-more').onclick = () => { mlShown += 60; mapList(false); };
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => {
  view = b.dataset.view;
  document.querySelectorAll('[data-view]').forEach(x => { x.classList.toggle('on', x === b); x === b ? x.setAttribute('aria-current', 'true') : x.removeAttribute('aria-current'); });
  $('#list').hidden = view === 'map'; $('#map').hidden = view !== 'map'; $('#maplist').hidden = view !== 'map';
  $('#more').hidden = view === 'map' || page * 24 >= total;
  if (view === 'list') mapGen++;   // ушли с карты — недогруженные части не нужны
  view === 'map' ? loadMap() : (page ? showStatus({}, `Найдено за 2 года: ${total.toLocaleString('ru-RU')}`) : search());
});

start();
