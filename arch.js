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
const auth = token ? { token } : tg?.initData || null;
// фильтр архива — свой; в первый раз берём основные фильтры сайта (тип, комнаты, цена, площадь, этаж, район)
let af = store.get('af', null), text = store.get('atext', ''), sort = store.get('asort', 'new');
if (!af) {
  const f = store.get('f2', {});
  af = Object.fromEntries(['k', 'r', 'pmin', 'pmax', 'amin', 'amax', 'fmin', 'fmax', 'nf', 'd'].filter(k => f[k] !== undefined).map(k => [k, f[k]]));
  text = store.get('text', '');
}
let tree = [], view = 'list', page = 0, total = 0, busy = false, items = [], listY = 0;
const mobile = () => innerWidth <= 760;

async function call(action, extra = {}, region = REGIONS[0]) {
  const r = await fetch(window.API, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-region': region }, body: JSON.stringify({ action, auth, ...extra }) });
  const data = await r.json().catch(() => ({ error: 'server', message: `Ошибка сервера (HTTP ${r.status})` }));
  if (['no_auth', 'no_access', 'expired', 'kicked', 'off'].includes(data.error)) { location.href = './'; throw new Error(data.message); }   // вход — на главной
  if (!r.ok || data.error) throw Object.assign(new Error(data.message || data.error || `HTTP ${r.status}`), { data });
  return data;
}
// регионы сервера, откуда источник отвечает (из eu-west-2/3 — почти нет); не ответил — повтор в следующем регионе, до 3 попыток
const REGIONS = ['eu-central-1', 'eu-west-1', 'eu-central-2'];
async function callRetry(action, extra = {}, tries = 3) {
  for (let t = 1; ; t++) {
    try { return await call(action, extra, REGIONS[(t - 1) % REGIONS.length]); }
    catch (e) { if (t >= tries || !/источник не ответил/.test(e.message)) throw e; }
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
  try { r = await call('arch_init'); }
  catch (e) { return gate(`<h2>Архив недоступен</h2><p>${esc(e.message)}</p><a class="btn ghost" href="./">← Все объявления</a>`); }
  tree = r.tree;
  $('#who').textContent = r.me.name || r.me.login;
  $('#gate').hidden = true; $('#app').hidden = false;
  $('#q').value = text; $('#sort').value = sort;
  if (mobile()) $('#filters').classList.add('closed');
  renderFilters();
  route();
}

// ---------- фильтр ----------
const arr = k => Array.isArray(af[k]) ? af[k] : [];
function toggleIn(k, v) { const s = new Set(arr(k)); s.has(v) ? s.delete(v) : s.add(v); af[k] = [...s]; if (!af[k].length) delete af[k]; }
function chipRow(el, list, key) {
  el.innerHTML = list.map(([v, t]) => `<button type="button" class="chip${arr(key).includes(v) ? ' on' : ''}" data-v="${esc(v)}">${esc(t)}</button>`).join('');
  el.onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; toggleIn(key, typeof list[0][0] === 'number' ? +b.dataset.v : b.dataset.v); renderFilters(); };
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
  chipRow($('#f-kind'), KINDS, 'k');
  chipRow($('#f-rooms'), ROOMS, 'r');
  $('#f-sale').innerHTML = [[false, 'Все: в продаже и снятые'], [true, 'Только в продаже']]
    .map(([v, t]) => `<button type="button" class="chip${!!af.sale === v ? ' on' : ''}" data-s="${v ? 1 : ''}">${t}</button>`).join('');
  $('#f-sale').onclick = e => { const b = e.target.closest('[data-s]'); if (!b) return; af.sale = !!b.dataset.s || undefined; renderFilters(); };
  for (const k of ['amin', 'amax', 'fmin', 'fmax']) $('#' + k).value = af[k] ?? '';
  for (const k of ['pmin', 'pmax']) $('#' + k).value = af[k] ? dots(Math.round(af[k] * 1e6)) : '';
  $('#nf').checked = !!af.nf;
  // улица или область карты — главнее районов (сервер районы тогда не учитывает)
  $('#f-place').innerHTML = [af.st && `<button type="button" class="chip on" data-x="st">📍 ${esc(af.stl || 'улица')} ✕</button>`,
    af.geo && '<button type="button" class="chip on" data-x="geo">▭ Область карты ✕</button>'].filter(Boolean).join('');
  const names = areaLabel(), oldD = arr('d').length && !arr('mk').length;
  $('#open-areas').textContent = names.length ? `${names.slice(0, 2).join(', ')}${names.length > 2 ? ` +${names.length - 2}` : ''}`
    : oldD ? 'Районы из основного поиска' : 'Весь Сочи';
  $('#open-areas').classList.toggle('on', names.length > 0 || oldD);
  if ((af.st || af.geo) && (names.length || oldD)) $('#open-areas').textContent += ' (не учитывается)';
  const n = Object.keys(af).filter(k => af[k] !== undefined && !(Array.isArray(af[k]) && !af[k].length)).length;
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
for (const k of ['amin', 'amax', 'fmin', 'fmax', 'pmin', 'pmax']) $('#' + k).addEventListener('input', readInputs);
$('#nf').addEventListener('change', readInputs);
$('#f-place').onclick = e => { const b = e.target.closest('[data-x]'); if (!b) return; if (b.dataset.x === 'st') { delete af.st; delete af.house; delete af.stl; } else delete af.geo; changed(); };
// улица и дом: источник сам разбирает адрес (улица в Сочи + номер дома)
async function addrGo() {
  const v = $('#addr').value.trim(); if (!v) return;
  $('#addr-go').disabled = true;
  try {
    const r = await callRetry('arch_geo', { text: v });
    af.st = r.st; af.house = r.house || undefined; af.stl = r.label; delete af.geo;
    $('#addr').value = ''; if (mobile()) openF(false); changed();
  } catch (e) { toast(e.message, 4000); }
  finally { $('#addr-go').disabled = false; }
}
$('#addr-go').onclick = addrGo;
$('#addr').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addrGo(); } });
function openF(on) { $('#filters').classList.toggle('closed', !on); document.body.classList.toggle('fopen', on && mobile()); map?.invalidateSize(); }
$('#toggle-f').onclick = () => openF($('#filters').classList.contains('closed'));
$('#f-close').onclick = () => { readInputs(); openF(false); };
$('#apply').onclick = () => { readInputs(); if (mobile()) openF(false); changed(); };
$('#reset').onclick = () => { af = {}; text = ''; $('#q').value = ''; renderFilters(); changed(); };
$('#sort').onchange = () => { sort = $('#sort').value; save(); view === 'map' ? mapList() : search(); };
$('#qform').addEventListener('submit', e => { e.preventDefault(); readInputs(); $('#q').blur(); changed(); });
$('#q').addEventListener('input', () => { if (!$('#q').value.trim() && text) changed(); });
function changed() {
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
    delete af.d;   // районы из основного поиска заменяются выбором здесь
    renderFilters(); draw();
  };
  $('#s-clear').onclick = () => { delete af.mk; delete af.d; renderFilters(); draw(); };
  $('#s-ok').onclick = () => { closeSheet(); changed(); };
};

// ---------- список ----------
function card(x, i) {
  const n = x.pics.length, where = [x.street || x.address, placeOf(x)].filter(Boolean).join(' · ');
  const ppm = x.price && x.area ? `${Math.round(x.price / x.area).toLocaleString('ru-RU')} ₽/м²` : '';
  return `<article class="card${x.gone ? ' arch-gone' : ''}" data-i="${i}">
    <a class="gal" href="#o=${esc(x.t)}" data-n="${n}"><div class="strip">${n ? `<div class="ph">${img(x.pics[0], 'loading="lazy"')}</div>` : '<div class="none">Нет фото</div>'}</div>
      ${n > 1 ? `<span class="iv-count">${n} фото</span>` : ''}</a>
    <div class="body">
      <div class="price"><b>${x.price ? rub(x.price) : 'Цена не указана'}</b><small>${ppm}</small></div>
      ${x.complex ? `<div class="zk">${esc(zkName(x.complex))}</div>` : ''}
      <a class="title" href="#o=${esc(x.t)}">${esc(what(x))}</a>
      <div class="addr">${esc(where)}</div>
      <div class="tags">${statusTag(x)}</div>
      <div class="meta">Размещено ${day(x.created_at)}${x.num ? ` · в базе № ${x.num}` : ''}</div>
      <div class="actions">${x.cont ? contHtml(x.cont) : '<button class="btn soft" data-cont>📞 Контакты и источник</button>'}<a class="btn ghost" href="#o=${esc(x.t)}">Открыть</a></div>
    </div></article>`;
}
async function search(more = false) {
  if (busy) return;
  busy = true;
  if (!more) { page = 0; items = []; $('#list').innerHTML = ''; $('#status').textContent = 'Ищу в архиве…'; $('#more').hidden = true; }
  $('#more').disabled = true;
  try {
    const r = await callRetry('arch_search', { f: af, text, sort, page: page + 1 });
    page++; total = r.count;
    const from = items.length; items.push(...r.items);
    $('#list').insertAdjacentHTML('beforeend', r.items.map((x, k) => card(x, from + k)).join(''));
    showStatus(r, total ? `Найдено за 2 года: ${total.toLocaleString('ru-RU')}` : 'Ничего не нашёл — уберите часть фильтров');
    const left = total - page * r.page;
    $('#more').hidden = view === 'map' || left <= 0;
    $('#more').textContent = `Показать ещё ${Math.min(r.page, left)} из ${left.toLocaleString('ru-RU')}`;
  } catch (e) { $('#status').textContent = `Ошибка: ${e.message}`; }
  finally { busy = false; $('#more').disabled = false; }
}
const showStatus = (r, head) => $('#status').textContent = head + (r.understood ? ` · понял запрос так: ${r.understood}` : '') + (r.skipped?.length ? ` · в архиве не учитываются: ${r.skipped.join(', ')}` : '');
$('#more').onclick = () => search(true);
$('#list').addEventListener('click', e => {
  const c = e.target.closest('[data-i]'); if (!c) return;
  const x = items[+c.dataset.i];
  if (e.target.closest('[data-cont]')) contacts(x, e.target.closest('[data-cont]'));
  if (e.target.closest('[data-copy]')) copy(e.target.closest('[data-copy]').dataset.copy);
});

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
    x.cont = c; b.outerHTML = contHtml(c);
  } catch (err) { b.disabled = false; b.textContent = '📞 Контакты и источник'; toast(err.message); }
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
      <div class="meta">Размещено ${day(x.created_at)}${x.changed_at ? ` · обновлено ${day(x.changed_at)}` : ''}${x.num ? ` · в базе № ${x.num}` : ''}</div>
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
const ptRow = ([t, lat, lng, price, rooms, kind, area, floor, floors, street, pic, gone, created_at, sub, type_name, land, reason]) =>
  ({ t, lat, lng, price, rooms, kind, area, floor, floors, street, pic, gone: !!gone, created_at, sub, type_name, land, reason });
function marker(p) {
  const m = L.marker([p.lat, p.lng], { opacity: p.gone ? 0.55 : 1 });
  m.p = p;
  m.bindPopup(() => `<div class="mpop">${p.pic ? img(p.pic) : ''}<b>${p.price ? mln(p.price) + ' млн ₽' : ''}</b><br>${esc(what(p))}
    <br><span class="a">${esc([p.street, p.sub].filter(Boolean).join(' · '))}</span><br>${p.gone ? `Снято${p.reason ? ': ' + esc(p.reason) : ''}` : 'В продаже'}
    <br><a href="#o=${esc(p.t)}">Открыть объявление</a></div>`, { minWidth: 220, maxWidth: 240 });
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
  const row = p => `<a href="#o=${esc(p.t)}" class="mrow">${p.pic ? img(p.pic) : '<span class="noph"></span>'}<span><b>${p.price ? mln(p.price) + ' млн ₽' : ''}</b>${esc(what(p))}${p.gone ? '<br><small>снято</small>' : ''}</span></a>`;
  cluster.on('clusterclick', e => {
    const b = e.layer.getBounds();
    if (map.distance(b.getNorthEast(), b.getSouthWest()) > 40 && map.getZoom() < map.getMaxZoom()) return e.layer.zoomToBounds({ padding: [30, 30] });
    L.popup({ minWidth: 260, maxWidth: 280 }).setLatLng(e.layer.getLatLng()).setContent(`<div class="mlist"><b>${e.layer.getChildCount()} объявл. здесь</b>${e.layer.getAllChildMarkers().map(m => row(m.p)).join('')}</div>`).openOn(map);
  });
  map.addLayer(cluster);
  let info = null, done = 0, failed = 0, fitted = false;
  const add = r => {
    if (gen !== mapGen) return;
    const ps = r.points.map((x, k) => ({ ...ptRow(x), i: mapPts.length + k }));
    mapPts.push(...ps); cluster.addLayers(ps.map(marker));
    if (!fitted && mapPts.length && !af.geo) { fitted = true; map.fitBounds(L.latLngBounds(mapPts.map(p => [p.lat, p.lng])), { maxZoom: 15, padding: [20, 20] }); }
  };
  const head = () => `На карте: ${mapPts.length.toLocaleString('ru-RU')} из ${info.count.toLocaleString('ru-RU')}` +
    (done < info.parts ? ` · загружаю… ${Math.round(done / info.parts * 100)}%` : info.count > 1200 ? ' (последние 1200 — уточните район, область или цену, чтобы увидеть все)' : '') +
    (failed ? ` · не загрузилось частей: ${failed}` : '');
  $('#status').textContent = 'Загружаю точки архива…';
  try {
    info = await callRetry('arch_map', { f: af, text, page: 1 }); done = 1; add(info);
    if (gen !== mapGen) return;
    showStatus(info, head());
    for (let p = 2; p <= info.parts; p += 3) {
      await Promise.all(Array.from({ length: Math.min(3, info.parts - p + 1) }, (_, k) => callRetry('arch_map', { f: af, text, page: p + k })
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
    new: (a, c) => a.i - c.i, price: (a, c) => (a.price || 9e15) - (c.price || 9e15),
    price_desc: (a, c) => (c.price || 0) - (a.price || 0), area_desc: (a, c) => (c.area || 0) - (a.area || 0) };
  const list = mapPts.filter(p => b.contains([p.lat, p.lng])).sort(by[sort] ?? by.new);
  $('#ml-count').textContent = `В области карты: ${list.length.toLocaleString('ru-RU')}`;
  $('#ml-items').innerHTML = list.slice(0, mlShown).map(p => `<a class="mcard" href="#o=${esc(p.t)}">
    <div class="mph">${p.pic ? img(p.pic, 'loading="lazy"') : ''}${p.gone ? '<span class="newmark grey">Снято</span>' : ''}</div>
    <div class="mb"><b>${p.price ? rub(p.price) : 'Цена не указана'}</b>${p.price && p.area ? `<small class="muted">${Math.round(p.price / p.area).toLocaleString('ru-RU')} ₽/м²</small>` : ''}
      <span>${esc(what(p))}</span><span class="a">${esc([p.street, p.sub].filter(Boolean).join(' · '))}</span><small class="muted">Размещено ${day(p.created_at)}</small></div></a>`).join('')
    || '<p class="muted">В этой части карты объявлений нет — отдалите карту.</p>';
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
  document.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('on', x === b));
  $('#list').hidden = view === 'map'; $('#map').hidden = view !== 'map'; $('#maplist').hidden = view !== 'map';
  $('#more').hidden = view === 'map' || page * 24 >= total;
  if (view === 'list') mapGen++;   // ушли с карты — недогруженные части не нужны
  view === 'map' ? loadMap() : (page ? showStatus({}, `Найдено за 2 года: ${total.toLocaleString('ru-RU')}`) : search());
});

start();
