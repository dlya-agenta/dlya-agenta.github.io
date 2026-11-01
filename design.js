// Оформление сайта (v5.16): три стиля — «Классика» (как админка: тёмно-синяя шапка, белые карточки с синей полосой), «Аврора» (живой
// градиентный фон, стеклянные панели, мягкое появление) и «Премиум» (графит и золото, блеск на кнопках). Файлы design-<id>.css — поверх style.css.
// Стиль по умолчанию для всех выбирает администратор (админка → «🎨 Стиль сайта», app_settings.design.default; без входа — hub design_public,
// кэш в localStorage design_def). Кнопка «🎨 Стиль» ([data-style]) переключает по кругу; личный выбор — localStorage design. ?design=<id> — открыть нужный.
(() => {
  const V = '5.16', IDS = ['classic', 'aurora', 'premium'], NAMES = { classic: 'Классика', aurora: 'Аврора', premium: 'Премиум' };
  const HUB = 'https://arojogajdamsyrrpcmso.supabase.co/functions/v1/hub';
  const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* приватный режим */ } } };
  const ok = x => IDS.includes(x) ? x : null;
  // старые «Море» и «Песок» (v5.5): море → классика, песок → премиум
  const OLD = { a: 'classic', b: 'premium' };
  const old = ls.get('design');
  if (OLD[old]) ls.set('design', OLD[old]);
  const q = ok(new URLSearchParams(location.search).get('design'));
  if (q) ls.set('design', q);
  let def = ok(ls.get('design_def')) ?? 'classic', mine = ok(ls.get('design')), d = mine ?? def;
  document.write(`<link rel="stylesheet" id="design-css" href="design-${d}.css?v=${V}">`);
  const apply = () => { document.documentElement.dataset.design = d; };
  apply();
  const label = () => document.querySelectorAll('[data-style]').forEach(b => {
    b.textContent = '🎨 Стиль'; b.title = `Сейчас «${NAMES[d]}». Нажмите — «${NAMES[IDS[(IDS.indexOf(d) + 1) % IDS.length]]}»`; b.setAttribute('aria-label', `Стиль оформления: ${NAMES[d]}. Сменить`); });
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
  function toast(t) {
    let el = document.getElementById('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
    el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 2200);
  }
  function next() { const x = IDS[(IDS.indexOf(d) + 1) % IDS.length]; set(x); toast(`🎨 Стиль «${NAMES[x]}»`); }
  // стиль администратора: раз в 30 минут уточняем у сервера; личного выбора нет — применяем сразу
  async function refreshDefault() {
    const t = +ls.get('design_def_at') || 0;
    if (Date.now() - t < 30 * 60e3) return;
    try {
      const r = await (await fetch(HUB, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'design_public' }) })).json();
      const x = ok(r?.default);
      if (!x) return;
      ls.set('design_def', x); ls.set('design_def_at', String(Date.now())); def = x;
      if (!mine) load(x);
    } catch { /* нет сети — остаёмся на кэше */ }
  }
  // страницы без кнопки (инструменты агента, рассылки, оплата…) — кнопка «🎨 Стиль» в меню шапки
  function ensureButton() {
    if (document.querySelector('[data-style]') || document.body.classList.contains('adm2')) return;
    const menu = document.querySelector('.top .menu');
    if (!menu) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'link'; b.dataset.style = '';
    menu.appendChild(b); label();
  }
  window.DESIGN = { get: () => d, set, def: () => def, mine: () => mine, names: NAMES, ids: IDS,
    reset() { mine = null; ls.set('design', null); load(def); },
    // админка: новый стиль по умолчанию — сразу в кэш (у себя тоже, если нет личного)
    setDefault(x) { if (!ok(x)) return; def = x; ls.set('design_def', x); ls.set('design_def_at', String(Date.now())); if (!mine) load(x); } };
  document.addEventListener('click', e => { if (e.target.closest('[data-style]')) { e.preventDefault(); next(); } });
  document.addEventListener('DOMContentLoaded', () => { label(); setTimeout(ensureButton, 900); refreshDefault(); });
})();
