// «Эксклюзивы» (v5.19, excl.html): вторичка от агентов-коллег — без договоров и проверки, размещать может любой вошедший агент (даже без подписки),
// смотреть чужие — по тарифу. Лента с фильтром как на главной (те же поля и подсказки FUI), карточка с галереей, избранное, «Мои размещения»
// (изменить, продлить на 30 дней, продано, снять, удалить), форма с фото до 15 (сжатие на странице, порядок, обложка), комиссия коллеге.
// Адреса: excl.html — лента, #fav — избранное, #my — мои, #new — разместить, #edit=<id> — изменить, #o=<номер> — карточка объекта.
(() => {
  const $ = s => document.querySelector(s);
  const H = window.HUB, esc = H.esc;
  const KINDS = [['квартира', 'Квартира'], ['апартаменты', 'Апартаменты'], ['дом', 'Дом'], ['коммерция', 'Коммерция'], ['участок', 'Участок']];
  const ROOMS = [['0', 'Студия'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4+']];
  const FIN = [['none', 'Без отделки'], ['white', 'Предчистовая'], ['clean', 'Чистовая'], ['repair', 'С ремонтом'], ['designer', 'Дизайнерский']];
  const SEA = [['', 'Любое'], ['300', 'до 300 м'], ['500', 'до 500 м'], ['1000', 'до 1 км'], ['2000', 'до 2 км'], ['5000', 'до 5 км']];
  const EXTRA = [['comm', 'Комиссия от 3%'], ['ph', 'С фото'], ['new', 'Новые за 3 дня'], ['drop', 'Цена снижена']];
  const SORTS = [['new', 'Сначала новые'], ['price', 'Сначала дешевле'], ['price_desc', 'Сначала дороже'], ['area_desc', 'Больше площадь'], ['comm', 'Больше комиссия'], ['m2', 'Дешевле за м²']];
  const ST = { draft: ['Черновик', 'warn'], active: ['В ленте', 'ok'], hidden: ['Снят с показа', 'muted'], sold: ['Продано', 'ok'], archived: ['В архиве', 'muted'] };
  const FN = Object.fromEntries(FIN);
  let caps = null, ref = null, items = [], canView = true, f = {}, sort = 'new', my = null, fopen = false;
  try { const p = JSON.parse(localStorage.getItem('excl_f') || 'null'); if (p) { f = p.f ?? {}; sort = p.sort ?? 'new'; } } catch { /* нет */ }
  const keep = () => localStorage.setItem('excl_f', JSON.stringify({ f, sort }));

  // ---------- формат ----------
  const dots = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const rubOf = s => { const v = +String(s ?? '').replace(/[^\d]/g, ''); return v > 0 && v < 1000 ? v * 1e6 : v; };   // «12» — 12 млн, как на главной
  const money = v => v ? `${dots(Math.round(v))} ₽` : 'Цена не указана';
  const mln = v => v >= 1e6 ? `${(v / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} млн ₽` : money(v);
  const what = x => [x.kind === 'квартира' || x.kind === 'апартаменты' ? (x.rooms === 0 ? 'Студия' : x.rooms ? `${x.rooms}-комн.` : '') : '',
    x.kind === 'квартира' && x.rooms != null ? '' : (KINDS.find(k => k[0] === x.kind)?.[1] ?? x.kind), x.area ? `${String(x.area).replace('.', ',')} м²` : '',
    x.land ? `${String(x.land).replace('.', ',')} сот.` : '', x.floor ? `${x.floor}/${x.floors ?? '?'} эт.` : ''].filter(Boolean).join(' · ');
  const title = x => `${x.kind === 'квартира' || x.kind === 'апартаменты' ? (x.rooms === 0 ? 'Студия' : x.rooms ? `${x.rooms}-комн. ${x.kind === 'апартаменты' ? 'апартаменты' : 'квартира'}` : KINDS.find(k => k[0] === x.kind)?.[1]) : KINDS.find(k => k[0] === x.kind)?.[1] ?? 'Объект'}${x.area ? `, ${String(x.area).replace('.', ',')} м²` : ''}`;
  const place = x => [x.sub || (x.district ? `${x.district} р-н` : ''), x.complex ? `ЖК «${x.complex}»` : ''].filter(Boolean).join(' · ');
  const sea = m => !m ? '' : m >= 1000 ? `${(m / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} км до моря` : `${Math.round(m / 10) * 10} м до моря`;
  const comm = x => x.comm_pct ? `${String(x.comm_pct).replace('.', ',')}%` : x.comm_rub ? mln(x.comm_rub) : '';
  const commPct = x => x.comm_pct || (x.comm_rub && x.price ? x.comm_rub / x.price * 100 : 0);
  const ago = s => { const d = Math.floor((Date.now() - Date.parse(s)) / 864e5); return d <= 0 ? 'сегодня' : d === 1 ? 'вчера' : `${d} дн. назад`; };
  const left = s => s ? Math.ceil((Date.parse(s) - Date.now()) / 864e5) : null;
  const isNew = x => Date.now() - Date.parse(x.created_at) < 3 * 864e5;

  // ---------- старт ----------
  async function start() {
    if (!H.token()) { location.href = './#login'; return; }
    try { [caps, ref] = await Promise.all([H.call('caps'), H.call('excl_ref')]); }
    catch (e) {
      if (e.status === 401) { location.href = './#login'; return; }
      $('#gate').innerHTML = `<p class="err">${esc(e.message)}</p><a class="btn primary" href="./">На главную</a>`; return;
    }
    $('#gate').hidden = true; $('#app').hidden = false;
    H.ping();
    addEventListener('hashchange', route);
    route();
    markNav();
  }
  // пункт «💎 Эксклюзивы» в шапке — подсветка (nav.js подсвечивает только группы)
  function markNav() {
    const a = document.querySelector('.top a[data-g="excl"]');
    if (!a) { setTimeout(markNav, 200); return; }
    a.classList.add('on'); a.setAttribute('aria-current', 'page');
  }
  function route() {
    const [k, v] = location.hash.slice(1).split('=');
    document.querySelectorAll('[data-tab]').forEach(t => { const on = t.dataset.tab === (k === 'fav' || k === 'my' ? k : 'all'); t.classList.toggle('on', on); t.setAttribute('aria-selected', on); });
    closeSheet();
    if (k === 'my') return showMy();
    if (k === 'new') return form(null);
    if (k === 'edit') return form(+v);
    feed(k === 'fav').then(() => { if (k === 'o' && v) card(+v); });
  }

  // ---------- лента ----------
  async function load() { const r = await H.call('excl_list'); items = r.items; canView = r.can_view; }
  async function feed(favOnly) {
    const el = $('#ex');
    el.onclick = null;
    if (!el.querySelector('.ex-feed')) {
      el.innerHTML = `<div class="ex-feed${fopen ? ' fopen' : ''}">
        <aside class="filters ex-f" id="filters" aria-label="Фильтры">${filterHtml()}</aside>
        <section class="ex-list"><div class="ex-bar"><button type="button" class="btn soft ex-ftog" data-ftog>⚙ Фильтры <b class="fmore-n" id="ex-fn" hidden></b></button>
          <span id="ex-count" class="muted"></span><label class="ex-sort">Сортировка <select id="ex-sort">${SORTS.map(([k, t]) => `<option value="${k}"${k === sort ? ' selected' : ''}>${t}</option>`).join('')}</select></label></div>
          <div id="ex-lock"></div><div id="ex-grid" class="ex-grid"><p class="muted">Загрузка…</p></div></section></div>`;
      wireFilter();
      window.FUI?.help();
    }
    el.querySelector('.ex-feed').dataset.only = favOnly ? 1 : '';
    try { await load(); } catch (e) { $('#ex-grid').innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    $('#ex-lock').innerHTML = canView ? '' : `<div class="hub-lock ex-lock"><b>🔒 Объекты коллег — по подписке</b><p>Разместить свой объект можно и без подписки — коллеги с подпиской увидят его и приведут покупателя.
      Чтобы видеть объекты коллег, оформите подписку.</p><a class="btn primary" href="pay.html">Оформить подписку</a> <a class="btn soft" href="#new">＋ Разместить объект</a></div>`;
    draw();
  }
  function filtered() {
    const fav = $('.ex-feed')?.dataset.only === '1', q = window.FUI ? FUI.clean(f) : f, now = Date.now();
    const k = q.k ?? [], r = q.r ?? [], fin = q.fin ?? [], ex = q.x ?? [], d = q.d ?? [];
    const zk = String(q.zk ?? '').trim().toLowerCase().replace(/ё/g, 'е');
    let xs = items.filter(x => (!fav || x.fav)
      && (!k.length || k.includes(x.kind))
      && (!r.length || r.some(v => v === '4' ? x.rooms >= 4 : x.rooms === +v))
      && (!(+q.amin) || x.area >= +q.amin) && (!(+q.amax) || (x.area && x.area <= +q.amax))
      && (!(+q.pmin) || x.price >= +q.pmin) && (!(+q.pmax) || (x.price && x.price <= +q.pmax))
      && (!d.length || d.some(v => v.startsWith('d:') ? x.district === v.slice(2) : x.sub === v.slice(2)))
      && (!zk || String(x.complex ?? '').toLowerCase().replace(/ё/g, 'е').includes(zk))
      && (!(+q.sea) || (x.sea_m && x.sea_m <= +q.sea))
      && (!(+q.fmin) || x.floor >= +q.fmin) && (!(+q.fmax) || (x.floor && x.floor <= +q.fmax))
      && (!q.nf || x.floor !== 1) && (!q.nl || !x.floors || x.floor !== x.floors)
      && (!fin.length || fin.includes(x.finish))
      && (!ex.includes('comm') || commPct(x) >= 3) && (!ex.includes('ph') || x.photos.length) && (!ex.includes('new') || now - Date.parse(x.created_at) < 3 * 864e5)
      && (!ex.includes('drop') || x.price_prev));
    const by = { new: (a, b) => Date.parse(b.at) - Date.parse(a.at), price: (a, b) => (a.price || 9e15) - (b.price || 9e15), price_desc: (a, b) => (b.price || 0) - (a.price || 0),
      area_desc: (a, b) => (b.area || 0) - (a.area || 0), comm: (a, b) => commPct(b) - commPct(a), m2: (a, b) => (a.area ? a.price / a.area : 9e15) - (b.area ? b.price / b.area : 9e15) };
    return xs.sort(by[sort] ?? by.new);
  }
  const nOn = () => ['k', 'r', 'fin', 'x', 'd'].reduce((n, k) => n + ((f[k] ?? []).length ? 1 : 0), 0) + ['amin', 'amax', 'pmin', 'pmax', 'sea', 'fmin', 'fmax', 'zk', 'nf', 'nl'].filter(k => f[k]).length;
  function draw() {
    const xs = filtered(), fav = $('.ex-feed')?.dataset.only === '1', n = nOn();
    $('#ex-count').textContent = `Найдено: ${xs.length}`;
    const fn = $('#ex-fn'); fn.hidden = !n; fn.textContent = n;
    $('#ex-grid').innerHTML = xs.map(cardHtml).join('') || `<div class="ex-empty"><p>${fav ? 'В избранном пока пусто — нажмите ☆ на фото объекта.' : items.length ? 'Ничего не нашлось — попробуйте изменить фильтр.' : 'Пока никто не разместил объекты. Будьте первым!'}</p>
      ${n ? '<button type="button" class="btn soft" data-reset>Сбросить фильтр</button>' : ''} <a class="btn primary" href="#new">＋ Разместить объект</a></div>`;
  }
  function cardHtml(x) {
    const ph = x.photos[0], pc = comm(x);
    return `<article class="ex-card" data-num="${x.num}" tabindex="0" aria-label="${esc(title(x))}, ${esc(money(x.price))}">
      <div class="ex-ph">${ph ? `<img src="${esc(ph)}" alt="" loading="lazy">` : '<span class="ex-noph">💎</span>'}
        <span class="ex-badges">${isNew(x) ? '<i class="b-new">Новое</i>' : ''}${x.price_prev ? '<i class="b-drop">Цена снижена</i>' : ''}${x.mine ? '<i class="b-mine">Ваш</i>' : ''}</span>
        ${pc ? `<span class="ex-comm" title="Комиссия коллеге">🤝 ${esc(pc)}</span>` : ''}
        ${x.photos.length > 1 ? `<span class="ex-n">📷 ${x.photos.length}</span>` : ''}
        <button type="button" class="ex-fav${x.fav ? ' on' : ''}" data-fav="${x.id}" aria-label="${x.fav ? 'Убрать из избранного' : 'В избранное'}" aria-pressed="${!!x.fav}">${x.fav ? '★' : '☆'}</button></div>
      <div class="ex-cb"><b class="ex-price">${esc(money(x.price))}${x.price_prev ? ` <s>${esc(dots(x.price_prev))}</s>` : ''}</b>
        ${x.area && x.price ? `<small class="muted">${esc(dots(Math.round(x.price / x.area)))} ₽/м²</small>` : ''}
        <span class="ex-what">${esc(what(x))}</span><span class="ex-place muted">${esc(place(x) || 'Сочи')}</span>
        <span class="ex-meta muted">${x.sea_m ? `🌊 ${esc(sea(x.sea_m))} · ` : ''}${x.finish ? `${esc(FN[x.finish] ?? '')} · ` : ''}${esc(ago(x.at))}</span>
        ${x.agent ? `<span class="ex-ag">👤 ${esc(x.agent.name)}${x.agent.company ? `, ${esc(x.agent.company)}` : ''}</span>` : ''}</div></article>`;
  }

  // ---------- фильтр (как на главной: те же поля, подписи и подсказки «?») ----------
  const chips = (key, list) => list.map(([v, t]) => `<button type="button" class="chip${(f[key] ?? []).includes(v) ? ' on' : ''}" data-ch="${key}" data-v="${esc(v)}" aria-pressed="${(f[key] ?? []).includes(v)}">${esc(t)}</button>`).join('');
  const areaLabel = () => { const d = f.d ?? []; return !d.length ? 'Район' : d.length === 1 ? d[0].slice(2) : `Районов: ${d.length}`; };
  function filterHtml() {
    return `<div class="fhead ex-fhead"><b>Фильтры</b><button type="button" class="x" data-ftog aria-label="Скрыть фильтры">✕</button></div>
      <div class="fgrid">
      <div class="fcell w2"><div class="fl" data-h="kind">Тип недвижимости</div><div class="chips">${chips('k', KINDS)}</div></div>
      <div class="fcell w2"><div class="fl" data-h="rooms">Комнаты</div><div class="chips">${chips('r', ROOMS)}</div></div>
      <div class="fcell"><div class="fl" data-h="area">Площадь, м²</div><div class="pair"><input id="amin" type="number" min="0" placeholder="от" inputmode="numeric" value="${esc(f.amin ?? '')}"><span>—</span><input id="amax" type="number" min="0" placeholder="до" inputmode="numeric" value="${esc(f.amax ?? '')}"></div></div>
      <div class="fcell"><div class="fl" data-h="price">Цена, ₽</div><div class="pair"><input id="pmin" type="text" placeholder="от" inputmode="numeric" autocomplete="off" value="${f.pmin ? dots(f.pmin) : ''}"><span>—</span><input id="pmax" type="text" placeholder="до" inputmode="numeric" autocomplete="off" value="${f.pmax ? dots(f.pmax) : ''}"></div></div>
      <div class="fcell"><div class="fl" data-h="place">Район и ЖК</div><div class="chips"><button type="button" class="chip pick-btn${(f.d ?? []).length ? ' on' : ''}" id="ex-areas">${esc(areaLabel())}</button></div>
        <input id="zk" type="search" placeholder="ЖК — название" list="ex-zk" value="${esc(f.zk ?? '')}" autocomplete="off"><datalist id="ex-zk">${(ref?.complexes ?? []).map(z => `<option value="${esc(z)}">`).join('')}</datalist></div>
      <div class="fcell"><div class="fl" data-h="sea">До моря</div><select id="sea" aria-label="Расстояние до моря">${SEA.map(([v, t]) => `<option value="${v}"${String(f.sea ?? '') === v ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="fcell w2"><div class="fl" data-h="floor">Этаж</div><div class="pair"><input id="fmin" type="number" min="1" placeholder="от" inputmode="numeric" value="${esc(f.fmin ?? '')}"><span>—</span><input id="fmax" type="number" min="1" placeholder="до" inputmode="numeric" value="${esc(f.fmax ?? '')}"></div>
        <div class="checks"><label><input type="checkbox" id="nf"${f.nf ? ' checked' : ''}> не первый</label><label><input type="checkbox" id="nl"${f.nl ? ' checked' : ''}> не последний</label></div></div>
      <div class="fcell w2"><div class="fl" data-h="fin">Отделка</div><div class="chips">${chips('fin', FIN)}</div></div>
      <div class="fcell w2"><div class="fl">Комиссия и размещение</div><div class="chips">${chips('x', EXTRA)}</div></div>
      </div>
      <div class="ffoot"><button type="button" class="btn ghost" data-reset>Сбросить всё</button><button type="button" class="btn primary ex-show" data-ftog>Показать</button></div>`;
  }
  function wireFilter() {
    const box = $('#filters'), chg = () => { keep(); window.FUI?.pairs(f); draw(); };
    box.addEventListener('click', e => {
      const c = e.target.closest('[data-ch]');
      if (c) { const k = c.dataset.ch, v = c.dataset.v, a = new Set(f[k] ?? []); a.has(v) ? a.delete(v) : a.add(v); f[k] = [...a]; if (!f[k].length) delete f[k];
        c.classList.toggle('on', a.has(v)); c.setAttribute('aria-pressed', a.has(v)); chg(); }
      if (e.target.closest('#ex-areas')) areas();
    });
    for (const k of ['amin', 'amax', 'fmin', 'fmax']) $('#' + k).addEventListener('input', e => { e.target.value ? f[k] = +e.target.value : delete f[k]; chg(); });
    for (const k of ['pmin', 'pmax']) $('#' + k).addEventListener('input', e => { const d = e.target.value.replace(/\D/g, ''); e.target.value = d ? dots(+d) : ''; const v = rubOf(d); v ? f[k] = v : delete f[k]; chg(); });
    $('#zk').addEventListener('input', e => { e.target.value.trim() ? f.zk = e.target.value.trim() : delete f.zk; chg(); });
    $('#sea').addEventListener('change', e => { e.target.value ? f.sea = +e.target.value : delete f.sea; chg(); });
    for (const k of ['nf', 'nl']) $('#' + k).addEventListener('change', e => { e.target.checked ? f[k] = true : delete f[k]; chg(); });
    $('#ex-sort').addEventListener('change', e => { sort = e.target.value; keep(); draw(); });
    window.FUI?.pairs(f);
  }
  // районы как на главной: дерево, поиск, галочка на районе — весь район
  function areas() {
    const regs = ref?.districts ?? [], on = k => (f.d ?? []).includes(k), open = new Set();
    const s = sheet('Районы', `<input id="ar-find" type="search" placeholder="Поиск района" autocomplete="off"><div id="ar-tree" class="tree"></div>`,
      '<button class="btn ghost" data-clear>Сбросить</button><button class="btn primary" data-close>Применить</button>');
    const opt = (v, t, ch, dis) => `<label class="opt${dis ? ' dis' : ''}"><input type="checkbox" value="${esc(v)}"${ch ? ' checked' : ''}${dis ? ' disabled' : ''}><span>${esc(t)}</span></label>`;
    const drawT = () => {
      const q = s.querySelector('#ar-find').value.trim().toLowerCase().replace(/ё/g, 'е'), has = t => t.toLowerCase().replace(/ё/g, 'е').includes(q);
      s.querySelector('#ar-tree').innerHTML = regs.map(r => {
        const subs = q && !has(r.name) ? r.subs.filter(has) : r.subs, all = on('d:' + r.name);
        if (q && !subs.length && !has(r.name)) return '';
        return `<div class="tr${q || open.has(r.name) || r.subs.some(x => on('s:' + x)) ? ' open' : ''}" data-r="${esc(r.name)}"><div class="tr-h">${r.subs.length ? '<button type="button" class="tr-t" data-t aria-label="Микрорайоны"></button>' : '<span class="tr-t none"></span>'}${opt('d:' + r.name, r.name, all)}</div>
          ${subs.length ? `<div class="tr-subs">${subs.map(x => opt('s:' + x, x, all || on('s:' + x), all)).join('')}</div>` : ''}</div>`;
      }).join('') || '<p class="muted">Не нашёл такой район</p>';
    };
    s.querySelector('#ar-find').oninput = drawT; drawT();
    s.addEventListener('click', e => { const t = e.target.closest('[data-t]'); if (t) { const k = t.closest('.tr').dataset.r; open.has(k) ? open.delete(k) : open.add(k); drawT(); }
      if (e.target.closest('[data-clear]')) { delete f.d; drawT(); upd(); } });
    const upd = () => { const b = $('#ex-areas'); b.textContent = areaLabel(); b.classList.toggle('on', !!(f.d ?? []).length); keep(); draw(); };
    s.addEventListener('change', e => {
      const v = e.target.value, a = new Set(f.d ?? []); a.has(v) ? a.delete(v) : a.add(v);
      const r = v.startsWith('d:') && regs.find(x => 'd:' + x.name === v);
      if (r && a.has(v)) r.subs.forEach(x => a.delete('s:' + x));   // весь район — микрорайоны отдельно не нужны
      f.d = [...a]; if (!f.d.length) delete f.d; drawT(); upd();
    });
  }

  // ---------- окно (лист) ----------
  function sheet(head, body, foot = '', wide = false) {
    closeSheet();
    const d = document.createElement('div');
    d.className = `sheet ex-sheet${wide ? ' wide' : ''}`; d.id = 'ex-sheet';
    d.innerHTML = `<div class="sheet-box" role="dialog" aria-modal="true" aria-label="${esc(head)}"><div class="sheet-head"><b>${esc(head)}</b><button class="btn ghost" data-close aria-label="Закрыть">✕</button></div>
      <div class="sheet-body">${body}</div>${foot ? `<div class="sheet-foot">${foot}</div>` : ''}</div>`;
    document.body.appendChild(d); document.body.classList.add('ex-modal');
    d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) { closeSheet(); if (/^#o=/.test(location.hash)) history.replaceState(null, '', location.pathname + (d.dataset.back || '')); } });
    return d;
  }
  function closeSheet() { $('#ex-sheet')?.remove(); document.body.classList.remove('ex-modal'); }
  addEventListener('keydown', e => { if (e.key === 'Escape' && $('#ex-sheet')) $('#ex-sheet [data-close]')?.click(); });

  // ---------- карточка объекта ----------
  async function card(n) {
    let x = items.find(i => i.num === n);
    try { x = (await H.call('excl_get', { num: n })).item; } catch (e) { if (!x) { H.toast(e.message, 5000); return; } }
    let k = 0;
    const back = location.hash.startsWith('#o=') ? ($('.ex-feed')?.dataset.only === '1' ? '#fav' : '') : location.hash;
    const ag = x.agent, msg = `Здравствуйте! По вашему эксклюзиву № ${x.num} (${title(x)}, ${money(x.price)}) на «Для Агента» — есть покупатель.`;
    const tgLink = ag?.tg ? `https://t.me/${String(ag.tg).replace(/^@/, '').replace(/^https?:\/\/t\.me\//, '')}` : ag?.phone ? `https://t.me/+${String(ag.phone).replace(/\D/g, '')}` : '';
    const waNum = String(ag?.wa || ag?.phone || '').replace(/\D/g, '');
    const rows = [['Тип', title(x)], ['Площадь', x.area ? `${String(x.area).replace('.', ',')} м²` : ''], ['Участок', x.land ? `${x.land} сот.` : ''], ['Этаж', x.floor ? `${x.floor} из ${x.floors ?? '?'}` : ''],
      ['Район', [x.district, x.sub].filter(Boolean).join(', ')], ['ЖК', x.complex ?? ''], ['До моря', sea(x.sea_m).replace(' до моря', '')], ['Отделка', FN[x.finish] ?? ''],
      ['Цена за м²', x.area && x.price ? `${dots(Math.round(x.price / x.area))} ₽` : ''], ['Размещено', new Date(x.created_at).toLocaleDateString('ru-RU')], ['Просмотров', x.views ? String(x.views) : '']].filter(r => r[1]);
    const s = sheet(`№ ${x.num} · ${title(x)}`, `<div class="ex-card-v">
      <div class="ex-gal">${x.photos.length ? `<div class="ex-gal-main"><img id="ex-gimg" src="${esc(x.photos[0])}" alt="Фото объекта">
        ${x.photos.length > 1 ? '<button type="button" class="ex-gnav prev" data-g="-1" aria-label="Предыдущее фото">‹</button><button type="button" class="ex-gnav next" data-g="1" aria-label="Следующее фото">›</button>' : ''}
        <span class="ex-gn" id="ex-gn">1 / ${x.photos.length}</span></div>
        ${x.photos.length > 1 ? `<div class="ex-thumbs">${x.photos.map((p, i) => `<button type="button" class="${i ? '' : 'on'}" data-gi="${i}" aria-label="Фото ${i + 1}"><img src="${esc(p)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}`
        : '<div class="ex-gal-main ex-noph">💎<small>Фото не добавлены</small></div>'}</div>
      <div class="ex-info">
        <div class="ex-pr"><b>${esc(money(x.price))}</b>${x.price_prev ? `<s>${esc(money(x.price_prev))}</s><i class="b-drop">Цена снижена</i>` : ''}</div>
        <p class="muted">${esc(place(x) || 'Сочи')}</p>
        ${comm(x) ? `<div class="ex-commbox"><b>🤝 Комиссия коллеге: ${esc(comm(x))}</b>${x.comm_note ? `<small>${esc(x.comm_note)}</small>` : ''}</div>` : ''}
        <table class="ex-tbl">${rows.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</table>
        ${x.descr ? `<div class="ex-descr">${esc(x.descr).replace(/\n/g, '<br>')}</div>` : ''}
        ${ag ? `<div class="ex-agent"><b>👤 ${esc(ag.name)}</b>${ag.company ? `<small class="muted">${esc(ag.company)}</small>` : ''}
          <div class="ex-acts">${ag.phone ? `<a class="btn primary" href="tel:+${esc(String(ag.phone).replace(/\D/g, ''))}">📞 Позвонить</a>` : ''}
          ${waNum ? `<a class="btn soft" href="https://wa.me/${esc(waNum)}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
          ${tgLink ? `<a class="btn soft" href="${esc(tgLink)}" target="_blank" rel="noopener">Telegram</a>` : ''}
          ${ag.phone ? `<a class="btn soft" href="${H.mobile() ? 'max://' : 'https://web.max.ru/'}" target="_blank" rel="noopener" data-max="${esc(String(ag.phone).replace(/\D/g, ''))}">MAX</a>` : ''}</div></div>`
        : '<p class="muted">Агент скрыл контакт — напишите в чат подписчиков.</p>'}
        <div class="ex-acts">
          <button type="button" class="btn soft" data-fav="${x.id}" aria-pressed="${!!x.fav}">${x.fav ? '★ В избранном' : '☆ В избранное'}</button>
          <button type="button" class="btn soft" data-share>🔗 Ссылка</button>
          ${x.mine ? `<a class="btn soft" href="#edit=${x.id}">✏️ Изменить</a>` : `<a class="btn ghost" href="hub.html#deal=new:${x.num}">📑 В сделку</a>`}
        </div><p class="hint">Контакты собственника не публикуются — только контакт агента, разместившего объект.</p></div></div>`, '', true);
    s.dataset.back = back;
    const show = i => { k = (i + x.photos.length) % x.photos.length; s.querySelector('#ex-gimg').src = x.photos[k]; s.querySelector('#ex-gn').textContent = `${k + 1} / ${x.photos.length}`;
      s.querySelectorAll('[data-gi]').forEach(b => b.classList.toggle('on', +b.dataset.gi === k)); };
    s.addEventListener('click', e => {
      const g = e.target.closest('[data-g]'); if (g) show(k + +g.dataset.g);
      const gi = e.target.closest('[data-gi]'); if (gi) show(+gi.dataset.gi);
      if (e.target.closest('[data-share]')) H.copy(`${location.origin}${location.pathname}#o=${x.num}`, 'Ссылка скопирована — откроется у агентов сервиса');
    });
    let sx = null; const im = s.querySelector('.ex-gal-main');
    im?.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
    im?.addEventListener('touchend', e => { if (sx == null || x.photos.length < 2) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) show(k + (dx < 0 ? 1 : -1)); sx = null; });
    if (!location.hash.startsWith('#o=')) history.replaceState(null, '', `#o=${x.num}`);
    const it = items.find(i => i.num === n); if (it) it.views = x.views;
  }

  // избранное — с ленты и из карточки
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-fav]');
    if (b) {
      e.stopPropagation();
      const id = +b.dataset.fav, x = items.find(i => i.id === id), on = !(x ? x.fav : b.getAttribute('aria-pressed') === 'true');
      try { await H.call('excl_fav', { id, on }); } catch (er) { H.toast(er.message, 4000); return; }
      if (x) x.fav = on;
      document.querySelectorAll(`[data-fav="${id}"]`).forEach(el => { el.setAttribute('aria-pressed', on); el.classList.toggle('on', on);
        el.textContent = el.classList.contains('ex-fav') ? (on ? '★' : '☆') : on ? '★ В избранном' : '☆ В избранное'; });
      H.toast(on ? 'Добавлено в избранное' : 'Убрано из избранного', 1800);
      if ($('.ex-feed')?.dataset.only === '1' && !$('#ex-sheet')) draw();
      return;
    }
    if (e.target.closest("[data-ftog]")) { fopen = !fopen; $('.ex-feed')?.classList.toggle('fopen', fopen); return; }
    if (e.target.closest('[data-reset]')) { f = {}; keep(); const fav = $('.ex-feed')?.dataset.only === '1'; $('#ex').innerHTML = ''; feed(fav); return; }
    const c = e.target.closest('.ex-card');
    if (c && !e.target.closest('a, button')) card(+c.dataset.num);
  });
  document.addEventListener('keydown', e => { const c = e.target.closest?.('.ex-card'); if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); card(+c.dataset.num); } });

  // ---------- мои размещения ----------
  async function showMy() {
    const el = $('#ex');
    el.innerHTML = '<p class="muted">Загрузка…</p>';
    try { my = await H.call('excl_my'); } catch (e) { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    const xs = my.items, act = xs.filter(x => x.status === 'active');
    const views = xs.reduce((n, x) => n + (x.views || 0), 0), favs = xs.reduce((n, x) => n + (x.favs || 0), 0);
    el.innerHTML = `<div class="ex-stats"><div><b>${act.length}</b><small>в ленте</small></div><div><b>${xs.filter(x => x.status === 'draft').length}</b><small>черновиков</small></div>
      <div><b>${views}</b><small>просмотров коллег</small></div><div><b>${favs}</b><small>в избранном у коллег</small></div><div><b>${xs.filter(x => x.status === 'sold').length}</b><small>продано</small></div></div>
      <p class="hint">Размещение — бесплатно и без подписки. Объект в ленте 30 дней; «Продлить» — ещё 30 дней и подъём наверх. За 3 дня до конца пришлём напоминание.</p>
      <div class="ex-my">${xs.map(x => { const st = ST[x.status] ?? [x.status, 'muted'], l = left(x.until);
        return `<div class="ex-row"><a class="ex-rph" href="${x.status === 'active' ? `#o=${x.num}` : `#edit=${x.id}`}">${x.photos[0] ? `<img src="${esc(x.photos[0])}" alt="" loading="lazy">` : '<span class="ex-noph">💎</span>'}</a>
          <div class="ex-rb"><b>${esc(title(x))} · ${esc(money(x.price))}</b><small class="muted">№ ${x.num} · ${esc(place(x) || 'район не указан')}</small>
            <span class="ex-rst"><i class="pill ${st[1]}">${st[0]}</i>${x.status === 'active' && l != null ? `<small class="${l <= 3 ? 'warn' : 'muted'}">ещё ${l} дн.</small>` : ''}
              <small class="muted">👁 ${x.views || 0} · ★ ${x.favs || 0}${comm(x) ? ` · 🤝 ${esc(comm(x))}` : ''}</small></span></div>
          <div class="ex-ra">${x.status === 'active' ? `<button class="btn primary sm" data-a="extend" data-id="${x.id}">↻ Продлить</button><button class="btn soft sm" data-a="sold" data-id="${x.id}">✓ Продано</button><button class="btn ghost sm" data-a="hide" data-id="${x.id}">Снять</button>`
            : `<button class="btn primary sm" data-a="publish" data-id="${x.id}">Опубликовать</button>`}
            <a class="btn soft sm" href="#edit=${x.id}">Изменить</a>${x.status !== 'active' ? `<button class="btn ghost bad sm" data-a="delete" data-id="${x.id}">Удалить</button>` : ''}</div></div>`; }).join('')
        || '<div class="ex-empty"><p>У вас пока нет размещений. Добавьте объект — коллеги увидят его с вашим контактом и комиссией.</p><a class="btn primary" href="#new">＋ Разместить объект</a></div>'}</div>`;
    el.onclick = async e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'delete' && !confirm('Удалить объект и все фото? Вернуть будет нельзя.')) return;
      b.disabled = true;
      try { const r = await H.call('excl_act', { id: +b.dataset.id, do: b.dataset.a }); if (r.message) H.toast(r.message, 4000); showMy(); } catch (er) { H.toast(er.message, 5000); b.disabled = false; }
    };
  }

  // ---------- форма: разместить / изменить ----------
  async function form(id) {
    const el = $('#ex');
    el.onclick = null;
    if (!my) try { my = await H.call('excl_my'); } catch (e) { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    let x = id ? my.items.find(i => i.id === id) : null;
    if (id && !x) { try { my = await H.call('excl_my'); x = my.items.find(i => i.id === id); } catch { /* нет */ } }
    if (id && !x) { el.innerHTML = '<p class="err">Объект не найден</p><a class="btn soft" href="#my">‹ Мои размещения</a>'; return; }
    x ??= { kind: 'квартира', agent_show: true, photos: [], ph: [] };
    const ag = my.agent, regs = ref?.districts ?? [];
    const subsOf = d => regs.find(r => r.name === d)?.subs ?? [];
    const sel = (name, list, v, empty = '') => `<select name="${name}">${empty !== null ? `<option value="">${empty}</option>` : ''}${list.map(([k, t]) => `<option value="${esc(k)}"${String(v ?? '') === String(k) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
    el.innerHTML = `<p><a class="btn ghost" href="#my">‹ Мои размещения</a></p>
      <form class="ex-form" id="ex-form" novalidate>
      <h3>${x.id ? `✏️ № ${x.num} — изменить` : '＋ Новый объект'}</h3>
      <section class="ex-fs"><h4>Фото <small class="muted">до 15, первое — обложка</small></h4>
        <div class="ex-phs" id="ex-phs"></div>
        <label class="btn soft ex-up"><input type="file" accept="image/*" multiple hidden id="ex-file">📷 Добавить фото</label> <span class="hint" id="ex-upst"></span></section>
      <section class="ex-fs"><h4>Объект</h4>
        <div class="fl">Тип</div><div class="chips" id="ex-kind">${KINDS.map(([k, t]) => `<button type="button" class="chip${x.kind === k ? ' on' : ''}" data-k="${esc(k)}">${esc(t)}</button>`).join('')}</div>
        <div class="ex-g">
          <label class="field ex-rooms">Комнат${sel('rooms', ROOMS.map(([k, t]) => [k, t === '4+' ? '4' : t]).concat([['5', '5'], ['6', '6+']]), x.rooms, '—')}</label>
          <label class="field">Площадь, м²<input name="area" type="number" step="0.1" min="0" inputmode="decimal" value="${esc(x.area ?? '')}"></label>
          <label class="field">Этаж<input name="floor" type="number" min="-2" inputmode="numeric" value="${esc(x.floor ?? '')}"></label>
          <label class="field">Этажей в доме<input name="floors" type="number" min="1" inputmode="numeric" value="${esc(x.floors ?? '')}"></label>
          <label class="field ex-land">Участок, сот.<input name="land" type="number" step="0.1" min="0" inputmode="decimal" value="${esc(x.land ?? '')}"></label>
          <label class="field">Отделка${sel('finish', FIN, x.finish, '—')}</label>
        </div></section>
      <section class="ex-fs"><h4>Где</h4><div class="ex-g">
          <label class="field">Район *${sel('district', regs.map(r => [r.name, r.name]), x.district, 'Выберите')}</label>
          <label class="field">Микрорайон<select name="sub" id="ex-sub"></select></label>
          <label class="field">ЖК<input name="complex" list="ex-zk2" maxlength="80" value="${esc(x.complex ?? '')}" autocomplete="off"><datalist id="ex-zk2">${(ref?.complexes ?? []).map(z => `<option value="${esc(z)}">`).join('')}</datalist></label>
          <label class="field">До моря, м<input name="sea_m" type="number" min="0" step="10" inputmode="numeric" value="${esc(x.sea_m ?? '')}" placeholder="например, 800"></label>
        </div><p class="hint">Точный адрес коллегам не показываем — только район, микрорайон и ЖК.</p></section>
      <section class="ex-fs"><h4>Цена и комиссия</h4><div class="ex-g">
          <label class="field">Цена, ₽ *<input name="price" inputmode="numeric" autocomplete="off" value="${x.price ? dots(x.price) : ''}" placeholder="12 500 000"></label>
          <label class="field">Комиссия коллеге<span class="ex-comm-in"><input name="comm_v" inputmode="decimal" value="${esc(x.comm_pct ?? (x.comm_rub ? dots(x.comm_rub) : ''))}" placeholder="2">
            ${sel('comm_t', [['pct', '%'], ['rub', '₽']], x.comm_rub && !x.comm_pct ? 'rub' : 'pct', null)}</span></label>
          <label class="field ex-w2">Условия комиссии<input name="comm_note" maxlength="200" value="${esc(x.comm_note ?? '')}" placeholder="например: 50/50 от моей комиссии, выплата в день сделки"></label>
        </div></section>
      <section class="ex-fs"><h4>Описание</h4><textarea name="descr" rows="6" maxlength="4000" placeholder="Что важно покупателю: вид, планировка, документы, условия показа">${esc(x.descr ?? '')}</textarea>
        <p class="hint">Без телефонов и ссылок в тексте — контакт берём из вашего профиля.</p></section>
      <section class="ex-fs"><h4>Ваш контакт</h4>
        <label class="ex-chk"><input type="checkbox" name="agent_show"${x.agent_show !== false ? ' checked' : ''}> Показывать коллегам мой контакт</label>
        <p class="muted">${ag ? `${esc(ag.name)}${ag.company ? `, ${esc(ag.company)}` : ''}${ag.phone ? ` · +${esc(String(ag.phone).replace(/\D/g, ''))}` : ''}${ag.wa ? ` · WhatsApp ${esc(ag.wa)}` : ''}${ag.tg ? ` · Telegram ${esc(ag.tg)}` : ''}` : ''}
          <a href="./#prof">Изменить в профиле</a></p></section>
      <div class="ex-save"><span class="hint" id="ex-need"></span><button type="button" class="btn soft" data-save="0">Сохранить черновик</button>
        <button type="button" class="btn primary" data-save="1">${x.status === 'active' ? 'Сохранить' : 'Опубликовать'}</button></div>
      </form>`;
    const fm = $('#ex-form');
    const subs = () => { const d = fm.district.value; fm.querySelector('#ex-sub').innerHTML = `<option value="">—</option>${subsOf(d).map(s => `<option${s === x.sub ? ' selected' : ''}>${esc(s)}</option>`).join('')}`; };
    const kindUi = () => { const land = x.kind === 'участок', house = x.kind === 'дом' || land;
      fm.querySelector('.ex-rooms').hidden = land || x.kind === 'коммерция'; fm.querySelector('.ex-land').hidden = !house;
      fm.floor.closest('label').hidden = land; fm.floors.closest('label').hidden = land; };
    subs(); kindUi();
    fm.district.onchange = () => { x.sub = null; subs(); };
    fm.querySelector('#ex-kind').onclick = e => { const c = e.target.closest('[data-k]'); if (!c) return; x.kind = c.dataset.k; fm.querySelectorAll('#ex-kind .chip').forEach(b => b.classList.toggle('on', b === c)); kindUi(); };
    fm.price.oninput = e => { const d = e.target.value.replace(/\D/g, ''); e.target.value = d ? dots(+d) : ''; };
    const data = () => {
      const cv = String(fm.comm_v.value).replace(/\s/g, '').replace(',', '.'), pct = fm.comm_t.value === 'pct';
      return { id: x.id, kind: x.kind, rooms: fm.rooms.closest('label').hidden ? null : fm.rooms.value, area: fm.area.value, floor: fm.floor.value, floors: fm.floors.value,
        land: fm.land.closest('label').hidden ? null : fm.land.value, finish: fm.finish.value, district: fm.district.value, sub: fm.sub.value, complex: fm.complex.value,
        sea_m: fm.sea_m.value, price: rubOf(fm.price.value), comm_pct: pct ? cv : null, comm_rub: pct ? null : cv.replace(/\D/g, ''), comm_note: fm.comm_note.value,
        descr: fm.descr.value, agent_show: fm.agent_show.checked };
    };
    async function save(publish, quiet = false) {
      const r = await H.call('excl_save', { ...data(), publish });
      x = { ...x, ...r.item, photos: x.photos, ph: r.item.ph ?? x.ph };
      $('#ex-need').textContent = r.need?.length ? `Чтобы опубликовать, добавьте: ${r.need.join(', ')}` : '';
      if (!quiet) H.toast(r.message, 4500);
      my = null;
      return r;
    }
    fm.querySelector('.ex-save').onclick = async e => {
      const b = e.target.closest('[data-save]'); if (!b) return;
      b.disabled = true;
      try { const r = await save(b.dataset.save === '1'); if (r.status === 'active' && b.dataset.save === '1') location.hash = 'my'; else if (!id && x.id) history.replaceState(null, '', `#edit=${x.id}`); }
      catch (er) { H.toast(er.message, 5000); } finally { b.disabled = false; }
    };
    // фото: сжатие на странице (до 1400 px, JPEG до 500 КБ), загрузка по одному; ‹ › — порядок, ✕ — удалить
    const phs = () => { $('#ex-phs').innerHTML = x.photos.map((p, i) => `<div class="ex-pht"><img src="${esc(p)}" alt="Фото ${i + 1}">${i ? '' : '<i>Обложка</i>'}
      <span>${i ? `<button type="button" data-mv="-1" data-i="${i}" aria-label="Левее">‹</button>` : ''}${i < x.photos.length - 1 ? `<button type="button" data-mv="1" data-i="${i}" aria-label="Правее">›</button>` : ''}
      <button type="button" data-del="${i}" aria-label="Удалить фото">✕</button></span></div>`).join('') || '<p class="muted">Пока нет фото. Объект с фото смотрят в 5 раз чаще.</p>'; };
    phs();
    $('#ex-phs').onclick = async e => {
      const mv = e.target.closest('[data-mv]'), del = e.target.closest('[data-del]');
      try {
        if (mv) { const i = +mv.dataset.i, j = i + +mv.dataset.mv, o = [...x.ph]; [o[i], o[j]] = [o[j], o[i]]; const r = await H.call('excl_photo', { id: x.id, order: o }); x.ph = r.ph; x.photos = r.photos; phs(); }
        if (del && confirm('Удалить это фото?')) { const r = await H.call('excl_photo', { id: x.id, del: x.ph[+del.dataset.del] }); x.ph = r.ph; x.photos = r.photos; phs(); }
      } catch (er) { H.toast(er.message, 5000); }
    };
    $('#ex-file').onchange = async e => {
      const files = [...e.target.files].slice(0, 15 - x.photos.length); e.target.value = '';
      if (!files.length) { H.toast('Уже 15 фото — больше нельзя'); return; }
      try { if (!x.id) await save(false, true); } catch (er) { H.toast(er.message, 5000); return; }
      if (!id) history.replaceState(null, '', `#edit=${x.id}`);
      let n = 0;
      for (const fl of files) {
        $('#ex-upst').textContent = `Загружаем ${++n} из ${files.length}…`;
        try { const r = await H.call('excl_photo', { id: x.id, data: await shrink(fl) }); x.ph = r.ph; x.photos = r.photos; phs(); }
        catch (er) { H.toast(`${fl.name}: ${er.message}`, 5000); }
      }
      $('#ex-upst').textContent = '';
    };
  }
  async function shrink(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('Не удалось открыть фото')); i.src = url; });
      let side = 1400, q = .82, out = '';
      for (let t = 0; t < 6; t++) {
        const k = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        out = c.toDataURL('image/jpeg', q);
        if (out.length * .75 < 490_000) break;
        q -= .1; if (q < .55) { q = .75; side -= 300; }
      }
      return out;
    } finally { URL.revokeObjectURL(url); }
  }

  document.addEventListener('DOMContentLoaded', start);
})();
