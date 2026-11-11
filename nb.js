// v5.59 (Алексей 11.11): «🏗 Новостройки Сочи» (nb.html) — каталог ЖК с разделами как у выбранного Алексеем образца, в стиле сайта.
// Разделы (адрес #s=…): все; класс (econom | business | deluxe) и в нём сданные / строящиеся / у моря / спецпредложения / лучшие цены; районы; сданные, строящиеся,
// у моря, ФЗ-214, ипотека, с акциями. Карточка ЖК (#zk=<slug>): фото и планировки застройщика, цены по комнатам, сбоку — акции из Telegram-канала застройщика,
// шахматка, сайт, канал, отдел продаж; внизу — «В этом ЖК — квартиры на вторичном рынке» (наша база, как в «Эксклюзивах»).
// Данные — функция web: nbc_list, nbc_item; обновляет Mac раз в неделю (src/nb/weekly.mjs).
(() => {
  const H = window.HUB, esc = H.esc, $ = s => document.querySelector(s);
  let all = [], at = null;
  const CLS = { econom: 'Эконом-класс', business: 'Бизнес-класс', deluxe: 'Элитные' };
  const SUB = { ready: 'Сданные', build: 'Строящиеся', sea: 'У моря', promo: 'Спецпредложения', best: 'Лучшие цены', fz: 'ФЗ-214', mg: 'Ипотека' };
  // районы — как у образца (подразделы «Новостройки в …»), плюс остальные микрорайоны списком
  const AREAS = [['adler', 'Адлер', x => x.d === 'Адлерский'], ['bytkha', 'Бытха', x => x.s === 'Бытха'], ['dagomys', 'Дагомыс', x => x.s === 'Дагомыс'],
    ['fabritsiusa', 'Фабрициуса', x => x.s === 'Фабрициуса'], ['khosta', 'Хоста', x => x.s === 'Хоста'], ['krasnaya-polyana', 'Красная Поляна', x => x.s === 'Красная Поляна'],
    ['kudepsta', 'Кудепста', x => x.s === 'Кудепста'], ['mamayka', 'Мамайка', x => x.s === 'Мамайка'], ['matsesta', 'Мацеста', x => x.s === 'Мацеста'],
    ['novyy-sochi', 'Новый Сочи', x => x.s === 'Новый Сочи'], ['olimpiyskiy-park', 'Олимпийский парк (Сириус)', x => x.d === 'Сириус'], ['tsentr', 'Центр', x => x.s === 'Центр'],
    ['svetlana', 'Светлана', x => x.s === 'Светлана'], ['primorye', 'Приморье', x => x.s === 'Приморье'], ['lazarevskiy', 'Лазаревский район', x => x.d === 'Лазаревский']];
  const SEA = 600;
  const mln = v => v ? `${(v / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: v < 1e7 ? 2 : 1 })} млн ₽` : '';
  const rubm = v => v ? `${Math.round(v / 1000).toLocaleString('ru-RU')} тыс. ₽/м²` : '';
  const seaTxt = m => m == null ? '' : m <= 150 ? 'первая линия' : m < 1000 ? `${Math.round(m / 10) * 10} м до моря` : `${(m / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} км до моря`;
  const term = x => x.ready ? 'Сдан' : x.y ? `Сдача ${x.q ? `${x.q} кв. ` : ''}${x.y}` : 'Строится';
  const KIND = { FLAT: 'квартиры', APARTMENT: 'апартаменты', LIVING_AREA: 'квартиры', HOTEL: 'гостиничный комплекс' };

  // ---------- разделы ----------
  function pick(key) {
    const [a, b] = String(key || 'all').split('/');
    let L = all, title = 'Все новостройки Сочи';
    if (CLS[a]) { L = L.filter(x => x.cls === a); title = `${CLS[a]}`; }
    const area = AREAS.find(r => r[0] === a);
    if (area) { L = L.filter(area[2]); title = `Новостройки: ${area[1]}`; }
    if (a.startsWith('m-')) { const m = decodeURIComponent(a.slice(2)); L = L.filter(x => x.s === m); title = `Новостройки: ${m}`; }
    const sub = CLS[a] || area || a.startsWith('m-') ? b : a;
    if (sub && SUB[sub]) {
      title = CLS[a] || area || a.startsWith('m-') ? `${title} · ${SUB[sub].toLowerCase()}` : `${SUB[sub]} новостройки`;
      if (sub === 'ready') L = L.filter(x => x.ready);
      if (sub === 'build') L = L.filter(x => !x.ready);
      if (sub === 'sea') L = L.filter(x => x.sea != null && x.sea <= SEA);
      if (sub === 'promo') L = L.filter(x => x.np);
      if (sub === 'fz') L = L.filter(x => x.fz);
      if (sub === 'mg') L = L.filter(x => x.mg);
      if (sub === 'best') { const m2 = L.filter(x => x.m2).map(x => x.m2).sort((p, q) => p - q); const lim = m2[Math.floor(m2.length / 3)] ?? Infinity; L = L.filter(x => x.m2 && x.m2 <= lim); }
    }
    return { L, title };
  }
  const count = key => pick(key).L.length;
  function side(cur) {
    const li = (key, t, cls = '') => { const n = count(key); return n ? `<a class="nb-s${key === cur ? ' on' : ''}${cls}" href="#s=${key}"${key === cur ? ' aria-current="page"' : ''}>${esc(t)} <small>${n}</small></a>` : ''; };
    const grp = (t, items) => { const h = items.filter(Boolean).join(''); return h ? `<div class="nb-g"><b>${esc(t)}</b>${h}</div>` : ''; };
    const mk = [...new Set(all.map(x => x.s).filter(Boolean))].filter(m => !AREAS.some(a => a[1] === m)).sort((a, b) => a.localeCompare(b, 'ru'));
    return `<nav class="nb-side" aria-label="Разделы новостроек">
      ${li('all', 'Все новостройки', ' nb-top')}
      ${Object.entries(CLS).map(([k, t]) => grp(t, [li(k, 'Все'), ...['ready', 'build', 'sea', 'promo', 'best', ...(k === 'econom' ? ['fz', 'mg'] : [])].map(s => li(`${k}/${s}`, SUB[s]))])).join('')}
      ${grp('Подборки', ['ready', 'build', 'sea', 'promo', 'fz', 'mg'].map(s => li(s, SUB[s])))}
      ${grp('По районам', AREAS.map(([k, t]) => li(k, t)))}
      ${mk.length ? `<details class="nb-g nb-more"><summary><b>Ещё микрорайоны</b></summary>${mk.map(m => li(`m-${encodeURIComponent(m)}`, m)).join('')}</details>` : ''}
    </nav>`;
  }

  // ---------- список ----------
  function sortL(L) {
    const s = $('#nb-sort').value, by = {
      name: (a, b) => a.name.localeCompare(b.name, 'ru'), price: (a, b) => (a.p ?? 9e12) - (b.p ?? 9e12), m2: (a, b) => (a.m2 ?? 9e12) - (b.m2 ?? 9e12),
      sea: (a, b) => (a.sea ?? 9e9) - (b.sea ?? 9e9), new: (a, b) => (a.ready - b.ready) || ((b.y ?? 0) - (a.y ?? 0)), promo: (a, b) => (b.np - a.np) || a.name.localeCompare(b.name, 'ru') };
    const f = by[s] ?? by.name;
    return [...L].sort((a, b) => s === 'name' ? ((!!b.ph - !!a.ph) || (!!b.p - !!a.p) || f(a, b)) : f(a, b));   // по названию — сначала с фото и ценой
  }
  const cardHtml = x => `<a class="ex-card nb-card" href="#zk=${esc(x.slug)}">
      <div class="nb-ph">${x.ph ? `<img src="${esc(x.ph)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="nb-noph" aria-hidden="true">🏗</span>`}
        <span class="nb-bdg nb-cls-${esc(x.cls)}">${esc(CLS[x.cls] ?? '')}</span>${x.np ? `<span class="nb-bdg nb-fire" title="${esc(x.promo ?? '')}">🔥 Акция</span>` : ''}</div>
      <div class="nb-cb"><b class="nb-name">${esc(x.name)}</b>
        <small class="muted">${esc([x.s || x.d, x.st].filter(Boolean).join(' · '))}</small>
        <span class="nb-facts">${esc([term(x), x.fl ? `${x.fl} эт.` : '', seaTxt(x.sea)].filter(Boolean).join(' · '))}</span>
        ${x.p ? `<span class="nb-price">от ${esc(mln(x.p))}${x.m2 ? ` <small>· от ${esc(rubm(x.m2))}</small>` : ''}</span>` : '<span class="nb-price muted">Цена по запросу</span>'}
        ${x.promo ? `<span class="nb-promo">🔥 ${esc(x.promo)}</span>` : ''}</div></a>`;
  function list(key) {
    const q = $('#nb-q').value.trim().toLowerCase().replace(/ё/g, 'е');
    let { L, title } = pick(key);
    if (q) L = L.filter(x => `${x.name} ${x.st ?? ''} ${x.s ?? ''} ${x.d ?? ''} ${x.dev ?? ''}`.toLowerCase().replace(/ё/g, 'е').includes(q));
    L = sortL(L);
    $('#nb').innerHTML = `<div class="nb-wrap">${side(key)}<section class="nb-list"><div class="nb-bar"><h3>${esc(title)}</h3><span class="muted">${L.length} ${L.length % 10 === 1 && L.length % 100 !== 11 ? 'комплекс' : 'комплексов'}${q ? ` по запросу «${esc(q)}»` : ''}</span></div>
      ${L.length ? `<div class="ex-grid nb-grid">${L.map(cardHtml).join('')}</div>` : '<p class="muted">В этом разделе пока ничего нет.</p>'}
      <p class="muted nb-note">Сведения о комплексах, акциях и шахматках обновляются раз в неделю${at ? ` (последнее — ${esc(H.day(at))})` : ''}. Цены — ориентир «от», перед показом клиенту уточняйте в отделе продаж.</p></section></div>`;
    document.title = `${title} — Для Агента`;
  }

  // ---------- карточка ЖК ----------
  const ROOT = String(window.API || '').replace(/\/functions\/v1\/web$/, ''), PHW = `${ROOT}/storage/v1/object/public/photos/w`,
    MEDIA = 'https://zpkqduhbymvadtwgcyhp.supabase.co/storage/v1/object/public/photos/w';
  const basePh = x => x.pics?.[0] ?? (x.web_photos ? (x.web_photos_v === 3 ? `${MEDIA}/${x.num}/0.jpg` : `${PHW}/${x.num}/0.jpg`) : null);
  const baseWhat = x => [x.rooms === 0 ? 'Студия' : x.rooms ? `${x.rooms}-комн.` : '', x.area ? `${String(x.area).replace('.', ',')} м²` : '', x.floor ? `${x.floor}/${x.floors ?? '?'} эт.` : ''].filter(Boolean).join(' · ');
  const mini = x => `<a class="ex-mini nb-mini" href="./#o=${x.num}" data-onum="${x.num}">${basePh(x) ? `<span class="nb-mph"><img src="${esc(basePh(x))}" alt="" loading="lazy" referrerpolicy="no-referrer"></span>` : '<span class="nb-mph nb-noph">🏠</span>'}
    <span class="ex-mb"><b>${esc(mln(x.price))}</b><small>${esc(baseWhat(x))}</small><small class="muted">№ ${x.num}</small></span></a>`;
  const ROOMS = [['r0', 'Студии'], ['r1', '1-комнатные'], ['r2', '2-комнатные'], ['r3', '3-комнатные'], ['r4', '4-комнатные'], ['r5', '5+ комнат']];
  async function card(slug) {
    $('#nb').innerHTML = '<div class="nb-load"><div class="spinner"></div></div>';
    let r; try { r = await H.web('nbc_item', { slug }); } catch (e) { $('#nb').innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    const x = r.item; if (!x) { $('#nb').innerHTML = '<p class="muted">Комплекс не найден. <a href="#s=all">Все новостройки</a></p>'; return; }
    document.title = `${x.name} — Новостройки — Для Агента`;
    const ph = x.photos ?? [], pr = x.prices ?? {}, promos = x.promos ?? [];
    const rows = ROOMS.filter(([k]) => pr[k]?.count || pr[k]?.from);
    const fact = (t, v) => v ? `<tr><th>${esc(t)}</th><td>${v}</td></tr>` : '';
    const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
    $('#nb').innerHTML = `<article class="nb-zk">
      <p class="nb-back"><a class="btn ghost" href="${esc(sessionStorage.getItem('nb_back') || '#s=all')}">‹ Новостройки</a></p>
      <header class="nb-zh"><h2>${esc(x.name)}</h2>
        <p class="muted">${esc([x.district, x.sub, x.street].filter(Boolean).join(' · '))}</p>
        <div class="nb-tags"><span class="nb-bdg nb-cls-${esc(x.cls)}">${esc(CLS[x.cls] ?? '')}</span><span class="nb-tag">${esc(term({ ready: x.ready, y: x.build_year, q: x.build_q }))}</span>
          ${x.fz214 ? '<span class="nb-tag">ФЗ-214</span>' : ''}${x.mortgage ? '<span class="nb-tag">Ипотека</span>' : ''}${x.sea_m != null ? `<span class="nb-tag">🌊 ${esc(seaTxt(x.sea_m))}</span>` : ''}</div></header>
      <div class="nb-zgrid"><div class="nb-zmain">
        ${ph.length ? `<div class="nb-gal" data-k="0"><img src="${esc(ph[0])}" alt="${esc(x.name)}" referrerpolicy="no-referrer">${ph.length > 1 ? `<button class="nb-gp" data-g="-1" aria-label="Назад">‹</button><button class="nb-gn" data-g="1" aria-label="Дальше">›</button><span class="nb-gc">1 / ${ph.length}</span>` : ''}</div>
          <div class="nb-thumbs">${ph.map((u, k) => `<button data-t="${k}"${k ? '' : ' class="on"'}><img src="${esc(u)}" alt="" loading="lazy" referrerpolicy="no-referrer"></button>`).join('')}</div>`
          : '<div class="nb-gal nb-gal0"><span>🏗</span><small class="muted">Фото застройщика появятся после еженедельной проверки</small></div>'}
        ${rows.length ? `<section class="hub-sec"><h3>Цены и площади</h3><table class="nb-pt"><thead><tr><th>Квартиры</th><th>Площадь</th><th>Цена</th><th>За м²</th><th>В продаже</th></tr></thead><tbody>
          ${rows.map(([k, t]) => { const v = pr[k]; return `<tr><td>${t}</td><td>${v.a_from ? `${v.a_from}${v.a_to && v.a_to !== v.a_from ? `–${v.a_to}` : ''} м²` : '—'}</td><td>${v.from ? `от ${esc(mln(v.from))}` : '—'}</td><td>${v.m2_from ? esc(rubm(v.m2_from)) : '—'}</td><td>${v.count ?? '—'}</td></tr>`; }).join('')}
          </tbody></table><p class="muted nb-small">Ориентир «от» на ${esc(H.day(pr.at || x.checked_at))}${x.prices_at ? '' : '; точные цены планировок — в отделе продаж'}.</p></section>` : ''}
        ${(x.plans ?? []).length ? `<section class="hub-sec"><h3>Планировки</h3><div class="nb-plans">${x.plans.map(p => `<a href="${esc(p.img)}" target="_blank" rel="noopener"><img src="${esc(p.img)}" alt="${esc(p.title ?? 'Планировка')}" loading="lazy"><small>${esc([p.title, p.rooms != null ? `${p.rooms}-комн.` : '', p.area ? `${p.area} м²` : '', p.price ? mln(p.price) : ''].filter(Boolean).join(' · '))}</small></a>`).join('')}</div></section>` : ''}
        <section class="hub-sec"><h3>О комплексе</h3><table class="nb-ft">
          ${fact('Класс', esc(CLS[x.cls] ?? ''))}${fact('Тип', esc(KIND[x.kind] ?? ''))}${fact('Срок сдачи', esc(term({ ready: x.ready, y: x.build_year, q: x.build_q })))}${fact('Этажность', x.floors ? `${x.floors}` : '')}
          ${fact('Материал', esc({ MONOLITH: 'монолит', BRICK: 'кирпич', PANEL: 'панель', MONOLITH_BRICK: 'монолит-кирпич', BLOCK: 'блоки' }[x.material] ?? ''))}${fact('Парковка', esc((x.parking ?? []).map(p => ({ UNDERGROUND: 'подземная', GROUND: 'наземная', MULTILEVEL: 'многоуровневая' }[p] ?? '')).filter(Boolean).join(', ')))}
          ${fact('До моря', esc(seaTxt(x.sea_m)))}${fact('Адрес', esc(x.address ?? ''))}${fact('ФЗ-214', x.fz214 ? 'да' : '')}${fact('Ипотека', x.mortgage ? 'да' : '')}</table>
          ${x.descr ? `<div class="nb-descr">${H.md ? H.md(x.descr) : esc(x.descr).replace(/\n/g, '<br>')}</div>` : ''}</section>
        ${(x.news ?? []).length ? `<section class="hub-sec"><h3>Новости застройщика</h3>${x.news.map(n => `<p class="nb-news">${n.at ? `<small class="muted">${esc(H.day(n.at))}</small> ` : ''}${esc(n.text)}${n.url ? ` <a href="${esc(n.url)}" target="_blank" rel="noopener">в канале ›</a>` : ''}</p>`).join('')}</section>` : ''}
        <section class="hub-sec nb-sec2" id="nb-sec2"><h3>🏠 В этом ЖК — квартиры на вторичном рынке</h3><p class="muted">Ищем в базе собственников…</p></section>
      </div>
      <aside class="nb-zside">
        <div class="hub-sec nb-box"><div class="nb-big">${pr.total?.from ? `от ${esc(mln(pr.total.from))}` : 'Цена по запросу'}</div>${pr.total?.m2_from ? `<small class="muted">от ${esc(rubm(pr.total.m2_from))}</small>` : ''}
          ${x.sales_phone ? `<a class="btn primary nb-call" href="tel:${esc(x.sales_phone)}">📞 Отдел продаж ${esc(x.sales_phone.replace(/^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/, '+7 $1 $2-$3-$4'))}</a>` : ''}</div>
        <div class="hub-sec nb-box nb-promos"><h4>🔥 Акции</h4>${promos.length ? promos.map(p => `<div class="nb-pr"><b>${esc(p.title)}</b>${p.text ? `<p>${esc(p.text)}</p>` : ''}<small class="muted">${p.until ? `до ${esc(H.day(p.until))}` : 'срок уточняйте'}${p.url ? ` · <a href="${esc(p.url)}" target="_blank" rel="noopener">пост ›</a>` : ''}</small></div>`).join('')
          : `<p class="muted">${x.tg_at ? 'Действующих акций в канале застройщика нет.' : 'Проверим акции в канале застройщика на этой неделе.'}</p>`}</div>
        ${x.chess?.url ? `<div class="hub-sec nb-box"><h4>📊 ${esc(x.chess.what === 'прайс' ? 'Прайс' : 'Шахматка')}</h4><a href="${esc(x.chess.url)}" target="_blank" rel="noopener">Открыть${x.chess.at ? ` (от ${esc(H.day(x.chess.at))})` : ''} ›</a></div>` : ''}
        <div class="hub-sec nb-box"><h4>Застройщик</h4>${x.developer ? `<b>${esc(x.developer)}</b>` : '<span class="muted">уточняется</span>'}
          ${x.dev_page ? `<p><a href="${esc(x.dev_page)}" target="_blank" rel="noopener">🌐 Страница ЖК: ${esc(host(x.dev_page))}</a></p>` : ''}${x.dev_site && x.dev_site !== x.dev_page ? `<p><a href="${esc(x.dev_site)}" target="_blank" rel="noopener">🏢 Сайт: ${esc(host(x.dev_site))}</a></p>` : ''}
          ${x.tg ? `<p><a href="${esc(x.tg)}" target="_blank" rel="noopener">✈️ Telegram: @${esc(x.tg.replace(/^https:\/\/t\.me\//, ''))}</a></p>` : ''}</div>
        ${x.lat ? `<div class="hub-sec nb-box"><a href="https://yandex.ru/maps/?pt=${x.lng},${x.lat}&z=16&l=map" target="_blank" rel="noopener">📍 На карте</a></div>` : ''}
      </aside></div></article>`;
    // галерея
    const g = $('.nb-gal'); let k = 0;
    const go = n => { if (!ph.length) return; k = (n + ph.length) % ph.length; g.querySelector('img').src = ph[k]; const c = g.querySelector('.nb-gc'); if (c) c.textContent = `${k + 1} / ${ph.length}`;
      document.querySelectorAll('.nb-thumbs button').forEach((b, i) => b.classList.toggle('on', i === k)); };
    g?.addEventListener('click', e => { const b = e.target.closest('[data-g]'); if (b) go(k + +b.dataset.g); });
    document.querySelector('.nb-thumbs')?.addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) go(+b.dataset.t); });
    second(x);
    scrollTo(0, 0);
  }
  // «В этом ЖК — квартиры на вторичном рынке»: объявления собственников в нашей базе (как «Ещё в этом ЖК» в «Эксклюзивах»); ЖК не связан — объекты этого дома/рядом
  async function second(x) {
    const box = $('#nb-sec2'); let items = [], head = '🏠 В этом ЖК — квартиры на вторичном рынке', more = '';
    try {
      if (x.zk_id) { const r = await H.web('search', { f: { zk: [x.zk_id] }, text: '', offset: 0, sort: 'price' }); items = r.items ?? []; if (r.count > items.length) more = `./?q=${encodeURIComponent(x.name)}`; }
      if (!items.length && x.lat) { const r = await H.web('similar', { lat: x.lat, lng: x.lng, kind: 'квартира' }); items = r.items ?? []; if (r.mode !== 'zk' && r.mode !== 'house') head = '🏠 Рядом с ЖК — квартиры на вторичном рынке'; }
    } catch { /* без базы */ }
    if (!box?.isConnected) return;
    box.innerHTML = `<h3>${head}</h3>${items.length ? `<div class="ex-sim-row nb-row">${items.slice(0, 12).map(mini).join('')}</div>${more ? `<p><a class="btn ghost" href="${esc(more)}">Все объявления в этом ЖК ›</a></p>` : ''}`
      : '<p class="muted">Сейчас в этом ЖК нет объявлений собственников в продаже.</p>'}`;
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-onum]'); if (!a || !window.OBJPOP?.open || e.metaKey || e.ctrlKey) return;
    e.preventDefault(); window.OBJPOP.open(+a.dataset.onum);
  });

  // ---------- маршрут ----------
  function route() {
    const h = location.hash.slice(1);
    document.body.classList.toggle('nb-onzk', h.startsWith('zk='));
    if (h.startsWith('zk=')) return card(decodeURIComponent(h.slice(3)));
    const key = h.startsWith('s=') ? decodeURIComponent(h.slice(2)) : 'all';
    sessionStorage.setItem('nb_back', `#s=${key}`);
    list(key);
  }
  async function start() {
    if (!H.token()) { location.href = './#login'; return; }
    try { const r = await H.web('nbc_list'); all = r.items ?? []; at = r.at; }
    catch (e) { if (e.status === 401) { location.href = './#login'; return; } $('#gate').innerHTML = `<p class="err">${esc(e.message)}</p><a class="btn primary" href="./">На главную</a>`; return; }
    $('#gate').hidden = true; $('#app').hidden = false;
    H.ping?.();
    $('#nb-qf').addEventListener('submit', e => e.preventDefault());
    let t; $('#nb-q').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { if (location.hash.startsWith('#zk=')) location.hash = 's=all'; else route(); }, 200); });
    $('#nb-sort').addEventListener('change', route);
    addEventListener('hashchange', route);
    route();
  }
  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', start) : start();
})();
