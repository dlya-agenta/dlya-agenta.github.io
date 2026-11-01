// Оформление сайта (v5.17): три стиля — «Классика» (как админка: тёмно-синяя шапка, белые карточки с синей полосой), «Резиденция» (вместо «Авроры»:
// слоновая кость, глубокий изумруд и латунь — как у агентств бизнес- и премиум-класса) и «Премиум» (графит и золото). Файлы design-<id>.css — поверх style.css.
// Ещё два выбора: логотип (4 варианта знака) и значки меню (линии, плитки, без значков, эмодзи). Всё по умолчанию для всех выбирает администратор
// (админка → «🎨 Стиль сайта», app_settings.design {default, logo, icons}; без входа — hub design_public, кэш в localStorage design_def / logo_def / icons_def).
// Кнопка «Стиль» ([data-style]) переключает стиль по кругу; личный выбор — localStorage design / logo / icons. ?design= ?logo= ?icons= — примерить.
(() => {
  const V = '5.17.2', IDS = ['classic', 'residence', 'premium'], NAMES = { classic: 'Классика', residence: 'Резиденция', premium: 'Премиум' };
  // знак логотипа: viewBox 64×64; .lg-bg — плитка, .lg-s — линии, .lg-f — заливка, .lg-t — буквы (цвета задаёт стиль: --logo-bg, --logo-ink)
  const LOGOS = {
    keyhole: { name: 'Дом-замок', text: 'Крыша и дом, вместо двери — замочная скважина: «ключи от объекта у агента».',
      svg: '<rect class="lg-bg" width="64" height="64" rx="16"/><path class="lg-s" d="M14.5 31.5 32 17l17.5 14.5" stroke-width="3.6"/><path class="lg-s" d="M20 28.5V47h24V28.5" stroke-width="3"/><circle class="lg-f" cx="32" cy="35" r="3.7"/><path class="lg-f" d="M30.2 37.2h3.6l1.3 6.6h-6.2z"/>' },
    mono: { name: 'Монограмма «ДА»', text: 'Буквы «Д» и «А» с засечками в тонкой рамке — как клеймо ювелирного дома или частного банка.',
      svg: '<rect class="lg-bg" width="64" height="64" rx="16"/><rect class="lg-s" x="7.5" y="7.5" width="49" height="49" rx="10" stroke-width="1.3" opacity=".6"/><text class="lg-t" x="32" y="41" text-anchor="middle" font-size="24">ДА</text>' },
    roof: { name: 'Буква «А»-крыша', text: 'Заглавная «А» — она же крыша, под перекладиной — дверь. Читается и как дом, и как «Агент».',
      svg: '<rect class="lg-bg" width="64" height="64" rx="16"/><path class="lg-s" d="M16 48.5 32 15l16 33.5" stroke-width="4.4"/><path class="lg-s" d="M23.3 37h17.4" stroke-width="2.4"/><path class="lg-f" d="M28.6 48.5v-7h6.8v7z"/>' },
    key: { name: 'Ключ-дом', text: 'Ключ, у которого головка — домик: «ключ к сделке». Хорошо смотрится маленьким на телефоне.',
      svg: '<rect class="lg-bg" width="64" height="64" rx="16"/><path class="lg-s" d="M9.5 31 20.5 21l11 10v13.5h-22z" stroke-width="3.2"/><circle class="lg-f" cx="20.5" cy="34.5" r="2.8"/><path class="lg-s" d="M31.5 38h23M49 38v6.5M43.5 38v4.5" stroke-width="3.2"/>' },
  };
  const ICONS = { lines: 'Тонкие линии', tiles: 'Линии на плитке', none: 'Без значков', emoji: 'Эмодзи (как было)' };
  const HUB = 'https://arojogajdamsyrrpcmso.supabase.co/functions/v1/hub';
  const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* приватный режим */ } } };
  const ok = x => IDS.includes(x) ? x : null, okLogo = x => x in LOGOS ? x : null, okIcons = x => x in ICONS ? x : null;
  // старые «Море» и «Песок» (v5.5) и «Аврора» (v5.16) — на нынешние
  const OLD = { a: 'classic', b: 'premium', aurora: 'residence' };
  for (const k of ['design', 'design_def']) { const o = ls.get(k); if (OLD[o]) ls.set(k, OLD[o]); }
  const qs = new URLSearchParams(location.search);
  if (ok(qs.get('design'))) ls.set('design', qs.get('design'));
  if (okLogo(qs.get('logo'))) ls.set('logo', qs.get('logo'));
  if (okIcons(qs.get('icons'))) ls.set('icons', qs.get('icons'));
  let def = ok(ls.get('design_def')) ?? 'classic', mine = ok(ls.get('design')), d = mine ?? def;
  let logoDef = okLogo(ls.get('logo_def')) ?? 'keyhole', iconsDef = okIcons(ls.get('icons_def')) ?? 'lines';
  const logo = () => okLogo(ls.get('logo')) ?? logoDef, icons = () => okIcons(ls.get('icons')) ?? iconsDef;
  document.write(`<link rel="stylesheet" id="design-css" href="design-${d}.css?v=${V}">`);
  const root = document.documentElement;
  const apply = () => { root.dataset.design = d; root.dataset.logo = logo(); root.dataset.icons = icons(); };
  apply();
  const label = () => document.querySelectorAll('[data-style]').forEach(b => {
    b.textContent = '🎨 Стиль'; b.title = `Сейчас «${NAMES[d]}». Нажмите — «${NAMES[IDS[(IDS.indexOf(d) + 1) % IDS.length]]}»`; b.setAttribute('aria-label', `Стиль оформления: ${NAMES[d]}. Сменить`); });
  // знак логотипа во всех шапках (.logo) и большой блок бренда на входе ([data-brand])
  const markSvg = (id = logo()) => `<svg viewBox="0 0 64 64" aria-hidden="true">${LOGOS[id].svg}</svg>`;
  const brandHtml = (id, small = '5 минут — вместо тысячи часов!', fixed = false) => `<div class="gbrand"><span class="logo"${fixed ? ' data-fixed' : ''}>${markSvg(id)}</span><span class="gbrand-t"><b>Для Агента</b><small>${small}</small></span></div>`;
  function paintLogos(el = document) {
    el.querySelectorAll('.logo:not([data-fixed])').forEach(s => { if (s.dataset.lg !== logo()) { s.innerHTML = markSvg(); s.dataset.lg = logo(); } });
    el.querySelectorAll('[data-brand]:empty').forEach(b => { b.innerHTML = brandHtml(logo(), b.dataset.brand || undefined); b.querySelector('.logo').dataset.lg = logo(); });
  }
  // новый файл стилей подключается рядом со старым, старый убирается, когда новый загрузился, — без вспышки «голой» страницы
  function load(x) {
    if (!ok(x) || x === d) return;
    d = x; apply();
    const was = document.getElementById('design-css'), l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = `design-${d}.css?v=${V}`;
    l.onload = l.onerror = () => { was?.remove(); l.id = 'design-css'; };
    (was ?? document.head.lastChild).after(l);
    label();
  }
  function set(x, personal = true) { if (!ok(x)) return; if (personal) { mine = x; ls.set('design', x); } load(x); }
  function setLogo(x, personal = true) { if (!okLogo(x)) return; if (personal) ls.set('logo', x); else { logoDef = x; ls.set('logo_def', x); } apply(); paintLogos(); }
  function setIcons(x, personal = true) { if (!okIcons(x)) return; if (personal) ls.set('icons', x); else { iconsDef = x; ls.set('icons_def', x); } apply(); }
  function toast(t) {
    let el = document.getElementById('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
    el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 2200);
  }
  function next() { const x = IDS[(IDS.indexOf(d) + 1) % IDS.length]; set(x); toast(`Стиль «${NAMES[x]}»`); }
  // выбор администратора: раз в 30 минут уточняем у сервера; личного выбора нет — применяем сразу
  async function refreshDefault() {
    const t = +ls.get('design_def_at') || 0;
    if (Date.now() - t < 30 * 60e3) return;
    try {
      const r = await (await fetch(HUB, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'design_public' }) })).json();
      const x = ok(OLD[r?.default] ?? r?.default);
      if (!x) return;
      ls.set('design_def', x); ls.set('design_def_at', String(Date.now())); def = x;
      if (okLogo(r.logo)) { logoDef = r.logo; ls.set('logo_def', r.logo); }
      if (okIcons(r.icons)) { iconsDef = r.icons; ls.set('icons_def', r.icons); }
      apply(); paintLogos();
      if (!mine) load(x);
    } catch { /* нет сети — остаёмся на кэше */ }
  }
  // страницы без кнопки (инструменты агента, рассылки, оплата…) — кнопка «Стиль» в меню шапки, справа (рядом с «Выйти», под «Профилем»)
  function ensureButton() {
    if (document.querySelector('[data-style]') || document.body.classList.contains('adm2')) return;
    const menu = document.querySelector('.top .menu');
    if (!menu) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'link'; b.dataset.style = '';
    menu.appendChild(b); label();
  }
  // ---------- значки меню (v5.17; 24×24, линии толщиной 1.7, цвет — как у текста) ----------
  const P = {
    home: 'M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z',
    building: 'M4 21V4.5A1.5 1.5 0 0 1 5.5 3h8A1.5 1.5 0 0 1 15 4.5V21M15 9h3.5a1.5 1.5 0 0 1 1.5 1.5V21M2.5 21h19M7.5 7h4M7.5 11h4M7.5 15h4',
    crane: 'M6 21V3.5M3 6.5h17.5M6 3.5l12.5 3M17 6.5v5M15 11.5h4v3h-4zM3 21h6.5M10 10l-4 4',
    gem: 'M6.5 3.5h11L21.5 9 12 20.5 2.5 9zM2.5 9h19M9.5 3.5 8 9l4 11.5L16 9l-1.5-5.5',
    archive: 'M3 4h18v4H3zM5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M10 12h4',
    trend: 'M3.5 3.5v17h17M7.5 15l4-4 3 3 5.5-6.5M16 7.5h4v4',
    bookmark: 'M6.5 3.5h11a1 1 0 0 1 1 1v16.5l-6.5-4.5-6.5 4.5V4.5a1 1 0 0 1 1-1z',
    star: 'm12 3.2 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.2l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
    files: 'M8.5 3.5h7.5l4 4v11a1 1 0 0 1-1 1H8.5a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1zM16 3.5v4h4M4.5 7.5v12a1 1 0 0 0 1 1h9M11 12h5.5M11 15.5h4',
    users: 'M9 11a3.8 3.8 0 1 0 0-7.6A3.8 3.8 0 0 0 9 11zM2.5 20.5v-.8A5.7 5.7 0 0 1 8.2 14h1.6a5.7 5.7 0 0 1 5.7 5.7v.8M16 3.6a3.8 3.8 0 0 1 0 7.3M21.5 20.5v-.8a5.7 5.7 0 0 0-3.6-5.3',
    deal: 'M14 3.5H6.5a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V8zM14 3.5V8h4.5M8.5 12.5h7M8.5 16.5c1.2 0 1.6-1.6 2.6-1.6s.9 1.6 2 1.6 1.4-.8 2.4-.8',
    pin: 'M12 16.5V21.5M8.5 3.5h7l-1 6 3.5 3.5v1.5H6V13l3.5-3.5z',
    handshake: 'M11 17.5l2 2a1.5 1.5 0 0 0 2.1-2.1M13 15.5l2.5 2.5a1.5 1.5 0 0 0 2.1-2.1l-4-4M15.5 11.5l3 3 3-3V6l-3 1.5-4-2-4.5 4a1.5 1.5 0 0 0 2.1 2.1L14 10M2.5 6v8l6 6a1.5 1.5 0 0 0 2.1-2.1M8.5 6.5 6 5.5 2.5 6',
    megaphone: 'M4 9.5h3l9-5v15l-9-5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1zM7 14.5l1.5 5.5h3l-1.3-4.8M19 9.5a3 3 0 0 1 0 5',
    send: 'M21.5 2.5 10.5 13.5M21.5 2.5l-7 19-4-8-8-4z',
    film: 'M3.5 4h17v16h-17zM7.5 4v16M16.5 4v16M3.5 9h4M3.5 15h4M16.5 9h4M16.5 15h4M3.5 12h17',
    sparkles: 'M11 3.5l1.9 5.1 5.1 1.9-5.1 1.9L11 17.5l-1.9-5.1L4 10.5l5.1-1.9zM18.5 15l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9zM18.5 2.5v4M16.5 4.5h4',
    scale: 'M12 3.5v17M7.5 20.5h9M4.5 6.5h15M12 3.5l-7.5 3M12 3.5l7.5 3M4.5 6.5l-2.5 7a2.6 2.6 0 0 0 5 0zM19.5 6.5l-2.5 7a2.6 2.6 0 0 0 5 0z',
    bank: 'M2.5 20.5h19M3.5 9.5h17M12 3l8.5 6.5h-17zM5.5 9.5v8M10 9.5v8M14 9.5v8M18.5 9.5v8M3.5 17.5h17',
    book: 'M4 18.5V5a1.5 1.5 0 0 1 1.5-1.5H20v14H5.5A1.5 1.5 0 0 0 4 19a1.5 1.5 0 0 0 1.5 1.5H20M8 7.5h8M8 11h5',
    chat: 'M20.5 12a8.5 8.5 0 0 1-12.4 7.5L3.5 20.5l1.1-4.4A8.5 8.5 0 1 1 20.5 12zM8.5 12h.01M12 12h.01M15.5 12h.01',
    receipt: 'M5.5 3h13v18l-2.6-1.6L13.3 21 12 19.4 10.7 21l-2.6-1.6L5.5 21zM9 8h6M9 11.5h6M9 15h3.5',
    help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.4 9.2a2.7 2.7 0 0 1 5.2 1c0 1.8-2.6 2.4-2.6 4M12 17.2h.01',
    briefcase: 'M4 7.5h16a1 1 0 0 1 1 1v10.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1zM8.5 7.5v-2a1.5 1.5 0 0 1 1.5-1.5h4a1.5 1.5 0 0 1 1.5 1.5v2M3 13h18M10.5 12v2.5h3V12',
    wallet: 'M3.5 7a2 2 0 0 1 2-2h12v4M3.5 7v11.5a1.5 1.5 0 0 0 1.5 1.5h15.5V9H5.5a2 2 0 0 1-2-2zM16.5 14.5h.01',
    partners: 'M9 11a3.8 3.8 0 1 0 0-7.6A3.8 3.8 0 0 0 9 11zM2.5 20.5v-.8A5.7 5.7 0 0 1 8.2 14h1.6a5.7 5.7 0 0 1 5.7 5.7v.8M19 8v6M16 11h6',
    link: 'M10 14a4 4 0 0 0 5.7 0l3.3-3.3a4 4 0 0 0-5.7-5.7l-1.1 1.1M14 10a4 4 0 0 0-5.7 0L5 13.3a4 4 0 0 0 5.7 5.7l1.1-1.1',
    card: 'M3.5 5.5h17a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1zM2.5 10h19M6.5 15h4',
    buoy: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 15.8a3.8 3.8 0 1 0 0-7.6 3.8 3.8 0 0 0 0 7.6zM5.6 5.6l3.7 3.7M14.7 14.7l3.7 3.7M18.4 5.6l-3.7 3.7M9.3 14.7l-3.7 3.7',
    present: 'M2.5 4h19M4 4v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V4M12 15v3.5M8 21l4-2.5 4 2.5M9.5 9.5c1.6-2.4 3.4-2.4 5 0-1.6 2.4-3.4 2.4-5 0z',
    sliders: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4',
    palette: 'M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.8 1.8-1.8 0-.5-.2-.9-.5-1.2a1.8 1.8 0 0 1 1.3-3H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3zM7.5 11.5h.01M10 7.5h.01M14.5 7.5h.01M17 11h.01',
    logout: 'M9.5 20.5h-4a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1h4M16 16.5l4.5-4.5L16 7.5M20.5 12H9.5',
    crown: 'M3.5 8l4.3 4 4.2-7 4.2 7 4.3-4-1.8 11h-13.4zM5.3 19h13.4',
    notebook: 'M6 3.5h12a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6zM6 3.5v17M3.5 7.5H6M3.5 12H6M3.5 16.5H6M10 8h5M10 11.5h5',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5a7.5 7.5 0 0 1 15 0',
    // v5.17.2 — для заголовков разделов
    steps: 'M5 4.5h.01M5 12h.01M5 19.5h.01M9 4.5h11M9 12h11M9 19.5h11M5 6.5v3.5M5 14v3.5',
    shield: 'M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6zM8.8 12l2.2 2.2 4.3-4.4',
    search: 'M10.5 17.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM15.5 15.5l5 5',
    camera: 'M4 7.5h3l1.8-2.5h6.4L17 7.5h3a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
    clipboard: 'M9 4H6.5a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H15M9 3h6v3H9zM9 11h6M9 15h4',
    doc: 'M14 3.5H6.5a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V8zM14 3.5V8h4.5M8.5 12.5h7M8.5 16h5',
    check: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.2l2.7 2.7L16 9.5',
    chart: 'M3.5 20.5h17M6.5 20.5v-6M11 20.5V9M15.5 20.5v-8M20 20.5V5',
    cash: 'M2.5 6.5h19v11h-19zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM5.5 9.5v.01M18.5 14.5v.01',
    note: 'M4 20h4l11-11-4-4L4 16zM13.5 6.5l4 4',
  };
  // название пункта → значок (сначала по словам — у «Кабинета» и «С клиентом» раньше был один эмодзи 👤), затем по эмодзи
  const BY_TEXT = { 'Объявления': 'building', 'Все объявления': 'home', 'Все': 'home', 'Новостройки': 'crane', 'Эксклюзивы коллег': 'gem', 'Архив 2 года': 'archive', 'Архив': 'archive',
    'Цены рынка': 'trend', 'Моё': 'bookmark', 'Избранное': 'star', 'Мои подборки': 'files', 'Подборки': 'files', 'Клиенты': 'users', 'Сделки': 'deal', 'Фиксации': 'pin', 'Контакт': 'handshake',
    'Продвижение': 'megaphone', 'Реклама': 'megaphone', 'Рассылки': 'send', 'Видеомонтаж-СММ': 'film', 'Помощник': 'sparkles', 'Мой помощник': 'sparkles', 'Юрист': 'scale',
    'Ипотечный брокер': 'bank', 'База знаний': 'book', 'Чат подписчиков': 'chat', 'Налоги при продаже': 'receipt', 'Как пользоваться помощником': 'help', 'Кабинет': 'briefcase',
    'Баланс': 'wallet', 'Партнёрская программа': 'partners', 'Партнёрам': 'partners', 'Мессенджеры и соцсети': 'link', 'Оплата и тарифы': 'card', 'Помощь': 'buoy',
    'С клиентом': 'present', 'Админ': 'sliders', 'Настройки': 'sliders', 'Стиль': 'palette', 'Журнал': 'notebook', 'Выйти': 'logout', 'Продлить доступ': 'crown' };
  const BY_EMO = { '💬': 'chat', '🎬': 'film', '🧾': 'receipt', '🧭': 'steps', '🧑‍⚖️': 'scale', '🧑‍⚖': 'scale', '⚖️': 'scale', '⚖': 'scale', '🏦': 'bank', '🤝': 'partners',
    '🛡': 'shield', '🛡️': 'shield', '🔗': 'link', '🔎': 'search', '🔍': 'search', '📷': 'camera', '📚': 'book', '📑': 'deal', '📌': 'pin', '📋': 'clipboard', '📈': 'trend', '📄': 'doc',
    '💰': 'wallet', '💎': 'gem', '👥': 'users', '🏗': 'crane', '🏗️': 'crane', '✅': 'check', '📊': 'chart', '💵': 'cash', '📝': 'note', '⭐': 'star', '★': 'star', '🗂': 'archive', '🗂️': 'archive',
    '📘': 'help', '🏠': 'home', '✉️': 'send', '✉': 'send', '📒': 'notebook', '⚙': 'sliders', '⚙️': 'sliders', '🎨': 'palette', '💬': 'chat', '📣': 'megaphone', '🤖': 'sparkles', '📚': 'book', '💳': 'card' };
  // эмодзи для набора «Эмодзи»: у «Кабинета» и «С клиентом» — разные
  const EMO = { 'Кабинет': '💼', 'С клиентом': '🖥️', 'Выйти': '🚪', 'Продлить доступ': '👑' };
  const LEAD = /^(\s*)((?:\p{Extended_Pictographic}|[★☰])\uFE0F?(?:\u200D\p{Extended_Pictographic}\uFE0F?)*)\s*/u;
  const icon = (name, e) => `<i class="mi" data-e="${e}" aria-hidden="true"><svg viewBox="0 0 24 24"><use href="#ic-${name}"/></svg></i>`;
  function sprite() {
    if (document.getElementById('ic-sprite')) return;
    document.body.insertAdjacentHTML('afterbegin', `<svg id="ic-sprite" width="0" height="0" style="position:absolute" aria-hidden="true">${Object.entries(P).map(([k, d]) => `<symbol id="ic-${k}" viewBox="0 0 24 24"><path d="${d}"/></symbol>`).join('')}</svg>`);
  }
  const clean = t => t.replace(/[^\p{L}\p{N}\s-]+/gu, ' ').replace(/\s+/g, ' ').trim();
  // пункт меню: ведущий эмодзи → значок; «Выйти» и «Продлить доступ» — значок без эмодзи
  function iconizeEl(el, strict = false) {
    const lbl = el.querySelectorAll(':scope > .lbl-long, :scope > .lbl-short');
    for (const host of lbl.length ? lbl : [el]) {
      if (host.querySelector(':scope > .mi')) continue;
      const first = [...host.childNodes].find(n => n.nodeType !== 3 || n.data.trim());
      if (!first || first.nodeType !== 3) continue;
      const m = LEAD.exec(first.data), text = clean(m ? first.data.slice(m[0].length) : first.data);
      const name = BY_TEXT[text] ?? (m && BY_EMO[m[2]]);
      if (!name || (!m && (strict || !EMO[text]))) continue;
      if (m) first.data = first.data.slice(m[0].length);
      host.insertBefore(document.createRange().createContextualFragment(icon(name, EMO[text] ?? m?.[2] ?? '')), first);
    }
  }
  // заголовки разделов внутри страниц, окон и боковое меню админки (v5.17.2): ведущий эмодзи → значок в цвет акцента; карточки мессенджеров не трогаем (там значок — сам сервис)
  const HEADS = 'main h1, main h2, main h3, main h4, .sheet-head b, .adm-side nav a, .dl-head > a.btn';
  let headsT = 0;
  function heads() {
    cancelAnimationFrame(headsT);
    headsT = requestAnimationFrame(() => document.querySelectorAll(HEADS).forEach(el => { if (!el.closest('.conn-card')) iconizeEl(el, true); }));
  }
  window.DESIGN = { get: () => d, set, def: () => def, mine: () => mine, names: NAMES, ids: IDS, logos: LOGOS, icons: ICONS,
    logo, iconsSet: icons, setLogo, setIcons, markSvg, brandHtml, paint: paintLogos, iconizeEl, sprite, heads,
    mineLogo: () => okLogo(ls.get('logo')), mineIcons: () => okIcons(ls.get('icons')), logoDef: () => logoDef, iconsDef: () => iconsDef,
    reset() { mine = null; ls.set('design', null); ls.set('logo', null); ls.set('icons', null); apply(); paintLogos(); load(def); },
    // админка: новый выбор «для всех» — сразу в кэш (у себя тоже, если нет личного)
    setDefault(x, lg, ic) { if (ok(x)) { def = x; ls.set('design_def', x); } if (okLogo(lg)) { logoDef = lg; ls.set('logo_def', lg); } if (okIcons(ic)) { iconsDef = ic; ls.set('icons_def', ic); }
      ls.set('design_def_at', String(Date.now())); apply(); paintLogos(); if (!mine) load(def); } };
  document.addEventListener('click', e => { if (e.target.closest('[data-style]')) { e.preventDefault(); next(); } });
  document.addEventListener('DOMContentLoaded', () => {
    sprite(); label(); paintLogos(); setTimeout(ensureButton, 900); refreshDefault();
    // вход и окна рисуются позже (app.js gate, sheet) — знак и бренд дорисовываются сами
    heads();
    new MutationObserver(ms => { if (ms.some(m => m.addedNodes.length)) { paintLogos(); heads(); } }).observe(document.body, { childList: true, subtree: true });
  });
})();
