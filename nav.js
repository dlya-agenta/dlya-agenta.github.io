// Общее меню группами (v5.16, пп. 7 и 9): те же группы, что на главной («Объявления», «Моё», «Продвижение», «Помощник», «Кабинет»),
// на всех страницах, кроме админки. Подразделы раскрываются нажатием; на компьютере с мышью — ещё и при наведении.
// Главная (index.html): группы уже в разметке — здесь только поведение; пункты с data-go обрабатывает app.js.
// Другие страницы: <nav class="menu" data-nav> — группы вставляются в начало, ссылки страницы (журнал, настройки…) остаются после них.
// Телефон (до 760 px): «☰ Меню», группы одной колонкой с заголовками.
// v5.17: значки — рисованные линии вместо эмодзи (рисует design.js: DESIGN.iconizeEl; набор выбирает админ — html[data-icons]);
// наведение с «намерением» — быстрый проход мыши над соседней группой не перехватывает открытое меню; справа — «Профиль» с подпиской, под ним «Стиль» и «Выйти».
// v5.23c (п. 11): порядок — Объявления → Мои подборки (своя группа: все, ответы собственников, отклики клиентов, как собрать) → Моё → Помощник → Продвижение →
// Эксклюзивы → Кабинет; разделы «Моих подборок» открывает app.js по ./#sels=all|own|fb и ./#selhow. Узкое окно — «Подборки» вместо «Мои подборки» (.lbl-*).
window.NAV = (() => {
  const G = [
    ['obj', '🏠 Объявления', [['./', '🏠 Все объявления'], ['hub.html#newb', '🏗 Новостройки'], ['arch.html', '🗂 Архив 2 года'], ['hub.html#market', '📈 Цены рынка']]],
    ['sels', '<span class="lbl-long">📄 Мои подборки</span><span class="lbl-short">📄 Подборки</span>', [['./#sels=all', '📄 Все подборки'], ['./#sels=own', '✉️ Ответы собственников'], ['./#sels=fb', '👍 Отклики клиентов'], ['./#sels=ex', '💎 Подборки эксклюзивов'], ['./#sels=pick', '🎯 Самоподбор клиента'], ['./#pick', '➕ Новый самоподбор'], ['./#selhow', '💡 Как собрать подборку']]],
    ['my', '⭐ Моё', [['./#favs', '★ Избранное'], ['./#crm', '👥 Клиенты'], ['./#deals', '🤝 Контакт'], ['hub.html#deal', '📑 Сделки'], ['hub.html#fix', '📌 Фиксации']]],
    ['help', '🤖 Помощник', [['hub.html#helper', '🤖 Мой помощник'], ['hub.html#lawyer', '⚖️ Юрист'], ['hub.html#broker', '🏦 Ипотечный брокер'], ['hub.html#kb', '📚 База знаний'],
      ['hub.html#chat', '💬 Чат подписчиков'], ['hub.html#taxes', '🧾 Налоги при продаже'], ['help-helper.html', '📘 Как пользоваться помощником']]],
    ['promo', '📣 Продвижение', [['hub.html#msg', '🔌 Подключения'], ['./#rk', '📣 Реклама'], ['mail.html', '✉️ Рассылки'], ['hub.html#video', '🎬 Видеомонтаж-СММ']]],
    ['excl', '💎 Эксклюзивы', 'excl.html'],
    ['cab', '💼 Кабинет', [['hub.html#balance', '💰 Баланс'], ['partner.html', '🤝 Партнёрская программа'], ['pay.html', '💳 Оплата и тарифы'], ['support.html', '💬 Помощь'], ['./#tour', '🎓 Краткий курс (1 мин)']]],
  ];
  let iconTimer = 0;
  function iconize() {
    cancelAnimationFrame(iconTimer);
    iconTimer = requestAnimationFrame(() => document.querySelectorAll('.top .menu .link, .top .whomg .mg-p .link').forEach(el => window.DESIGN?.iconizeEl(el)));
  }
  // справа в шапке — «Профиль», под ним подписка (имя — в подсказке); на страницах, где профиля в шапке не было, — ссылка на профиль главной
  function profile() {
    const top = document.querySelector('.top');
    if (!top || document.body.classList.contains('adm2')) return;
    let w = top.querySelector('.who');
    if (w && w.tagName !== 'BUTTON' && !w.dataset.prof) {
      const a = document.createElement('a'); a.className = 'who'; a.href = './#prof';
      while (w.firstChild) a.appendChild(w.firstChild);
      w.remove(); w = a;
    }
    if (!w) { w = document.createElement('a'); w.className = 'who'; w.href = './#prof'; }
    w.dataset.prof = 1; w.title ||= 'Профиль: тариф, номера, контакты, устройства';
    if (w.parentElement !== top) top.insertBefore(w, top.querySelector(':scope > .burger'));
    if (!w.querySelector('.who-t')) w.insertAdjacentHTML('afterbegin', '<b class="who-t">Профиль</b>');
    const wt = w.querySelector('.who-t');
    if (!wt.querySelector('.mi')) wt.insertAdjacentHTML('afterbegin', '<i class="mi" data-e="👤" aria-hidden="true"><svg viewBox="0 0 24 24"><use href="#ic-user"/></svg></i>');
    // имя участника — подсказкой, не текстом (скрипты страниц по-прежнему пишут его в #who)
    const nm = w.querySelector('#who');
    if (nm) { const t = () => { if (nm.textContent.trim()) w.title = `Профиль: ${nm.textContent.trim()} — тариф, номера, контакты, устройства`; }; t(); new MutationObserver(t).observe(nm, { childList: true, characterData: true, subtree: true }); }
  }
  // v5.20: «Стиль» и «Выйти» — в меню под «Профилем» (компьютер; наведение или ▾): строка разделов всегда в одну линию.
  // v5.31c (п. 5 Алексея): «Стиль» (выбор стиля и темы — окно design.js), «🌐 Прокси» (окно proxy.js вкладки B) и «Выйти» — только под «Профилем»:
  // компьютер — выпадающее меню у «Профиля», телефон — раздел «👤 Профиль» в «☰ Меню» (плитки «Мой профиль», «Стиль», «Прокси», «Выйти»). Отдельной кнопки «Стиль» в шапке нет нигде.
  // Кнопки переносятся сами (обработчики app.js и design.js остаются на них)
  const wide = matchMedia('(min-width: 761px)');
  const PROF_ITEMS = ':scope [data-style], :scope [data-conns], :scope [data-proxy], :scope [data-prof-tile], :scope #logout, :scope [data-logout]';
  let placing = false;
  // v5.54: «🔌 Подключения» — мессенджеры, соцсети, реклама и прокси в одной вкладке (hub.html#msg), рядом со «Стилем» и «Прокси»
  function connsBtn(menu) {
    let b = document.querySelector('.top [data-conns]'), px = document.querySelector('.top [data-proxy]');
    if (!b) { b = document.createElement('a'); b.className = 'link agent-only'; b.dataset.conns = ''; b.href = 'hub.html#msg'; b.textContent = '🔌 Подключения'; b.title = 'Мессенджеры, соцсети, реклама и прокси — вход и настройки'; menu.appendChild(b); }
    if (px && b.hidden !== px.hidden) b.hidden = px.hidden;
    return b;
  }
  function proxyBtn(menu, who) {
    let b = document.querySelector('.top [data-proxy]');
    if (!b) { b = document.createElement('button'); b.type = 'button'; b.className = 'link agent-only'; b.dataset.proxy = ''; b.textContent = '🌐 Прокси'; b.title = 'Свой прокси для WhatsApp, Telegram и MAX'; menu.appendChild(b); }
    // гость (не вошёл) — прокси не нужен: прячем вместе с «Выйти» (на главной #logout скрыт до входа)
    const out = document.querySelector('.top #logout, .top [data-logout]');
    const off = out ? out.hidden : !who;
    if (b.hidden !== off) b.hidden = off;
    return b;
  }
  function tools() {
    const top = document.querySelector('.top');
    if (!top || placing || document.body.classList.contains('adm2')) return;
    const menu = top.querySelector('.menu');
    let box = top.querySelector(':scope > .whomg');
    const who = box ? box.querySelector(':scope > .who') : top.querySelector(':scope > .who');
    if (!menu || !who) return;
    placing = true;
    try {
      proxyBtn(menu, who); connsBtn(menu);
      let mob = menu.querySelector(':scope > .mg-prof');
      if (wide.matches) {
        if (!box) {
          box = document.createElement('div'); box.className = 'mg whomg'; box.dataset.g = 'prof';
          top.insertBefore(box, who); box.appendChild(who);
          box.insertAdjacentHTML('beforeend', '<button type="button" class="mg-b who-more" aria-expanded="false" aria-haspopup="true" title="Стиль, прокси, выход"><span class="mg-a" aria-hidden="true">▾</span></button><div class="mg-p" role="menu"></div>');
          wire(top);
        }
        const p = box.querySelector('.mg-p');
        [...menu.querySelectorAll(PROF_ITEMS)].filter(b => !b.matches('[data-prof-tile]')).forEach(b => { b.classList.add('link'); p.appendChild(b); });
        if (mob) { mob.querySelectorAll('.mg-p > :not([data-prof-tile])').forEach(b => p.appendChild(b)); mob.remove(); }
        order(p);
      } else {
        if (box) { top.insertBefore(who, box); box.querySelectorAll('.mg-p > *').forEach(b => menu.appendChild(b)); box.remove(); }
        if (!mob) {
          menu.insertAdjacentHTML('beforeend', '<div class="mg mg-prof" data-g="profm"><button type="button" class="link mg-b" tabindex="-1">👤 Профиль</button><div class="mg-p" role="menu">'
            + '<a class="link" role="menuitem" href="./#prof" data-prof-tile>👤 Мой профиль</a></div></div>');
          mob = menu.querySelector(':scope > .mg-prof'); wire(menu);
        }
        const p = mob.querySelector('.mg-p');
        menu.querySelectorAll(':scope > [data-style], :scope > [data-conns], :scope > [data-proxy], :scope > #logout, :scope > [data-logout]').forEach(b => { b.classList.add('link'); p.appendChild(b); });
        if (menu.lastElementChild !== mob) menu.appendChild(mob);   // раздел профиля — последним
        order(p);
      }
    } finally { placing = false; }
  }
  // порядок под «Профилем»: Мой профиль → Стиль → Прокси → Выйти
  function order(p) {
    const want = ['[data-prof-tile]', '[data-style]', '[data-conns]', '[data-proxy]', '#logout, [data-logout]'].map(q => p.querySelector(`:scope > :is(${q})`)).filter(Boolean);
    if (want.some((b, i) => p.children[i] !== b)) want.forEach(b => p.appendChild(b));
  }
  // «🌐 Прокси» (контракт с вкладкой B): окно рисует site/proxy.js — window.PROXY.open(); скрипта нет — подгружаем и открываем
  function say(t) {
    let el = document.getElementById('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
    el.textContent = t; el.hidden = false; clearTimeout(say.t); say.t = setTimeout(() => { el.hidden = true; }, 2600);
  }
  let proxyLoading = null;
  function openProxy() {
    if (window.PROXY?.open) return window.PROXY.open();
    say('Окно прокси загружается…');
    proxyLoading ??= new Promise((ok, bad) => { const sc = document.createElement('script'); sc.src = 'proxy.js?v=5.40'; sc.onload = ok; sc.onerror = bad; document.head.appendChild(sc); });
    proxyLoading.then(() => window.PROXY?.open ? window.PROXY.open() : say('Прокси пока недоступен — попробуйте позже'))
      .catch(() => { proxyLoading = null; say('Не удалось открыть настройки прокси — проверьте интернет'); });
  }
  document.addEventListener('click', e => {
    if (e.target.closest('[data-proxy]')) { e.preventDefault(); close(); document.querySelector('.top')?.classList.remove('open'); openProxy(); return; }
    // «Мой профиль» на телефоне: на главной — окно профиля той же кнопкой, что «Профиль» в шапке; на других страницах — ссылка ./#prof
    const t = e.target.closest('[data-prof-tile]'), w = document.querySelector('.top .who');
    if (t && w?.tagName === 'BUTTON') { e.preventDefault(); document.querySelector('.top')?.classList.remove('open'); w.click(); }
  });
  wide.addEventListener?.('change', tools);

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hoverable = () => matchMedia('(hover: hover) and (pointer: fine) and (min-width: 761px)').matches;
  // v5.19: пункт без подменю (строка G с href вместо списка) — просто ссылка в шапке, например «💎 Эксклюзивы»
  const groupHtml = ([id, title, items]) => typeof items === 'string' ? `<a class="link mg-solo" data-g="${id}" href="${esc(items)}">${title}</a>` : `<div class="mg" data-g="${id}"><button type="button" class="link mg-b" aria-expanded="false" aria-haspopup="true">${title} <span class="mg-a" aria-hidden="true">▾</span></button>
    <div class="mg-p" role="menu">${items.map(([href, t]) => `<a class="link" role="menuitem" href="${esc(href)}"${/^help-/.test(href) ? ' target="_blank"' : ''}>${esc(t)}</a>`).join('')}</div></div>`;

  function close(except) {
    document.querySelectorAll('.mg.open').forEach(g => { if (g !== except) { g.classList.remove('open'); g.querySelector('.mg-b')?.setAttribute('aria-expanded', false); } });
  }
  // v5.17: закрытие группы закрывает только её (раньше — все: уход мыши с соседней кнопки закрывал открытое меню — «пропадает при быстром наведении»)
  function open(g, on = true) { if (on) close(g); g.classList.toggle('open', on); g.querySelector('.mg-b')?.setAttribute('aria-expanded', on); }

  // какой пункт открыт сейчас: страница + раздел (#deal=12 → #deal); на главной подсветку ставит app.js (tabs → mgSync)
  function sync() {
    const page = location.pathname.split('/').pop() || 'index.html', sec = location.hash.slice(1).split('=')[0];
    document.querySelectorAll('nav[data-nav] .mg').forEach(g => {
      let any = false;
      g.querySelectorAll('.mg-p > a').forEach(a => {
        const [p, h = ''] = a.getAttribute('href').split('#');
        const ap = p === './' || p === '' ? 'index.html' : p;
        const on = ap === page && (h ? h === sec || (page === 'hub.html' && h === 'helper' && !sec) : !sec || page !== 'hub.html');
        a.classList.toggle('on', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); any ||= on;
      });
      g.querySelector('.mg-b').classList.toggle('on', any);
    });
  }

  let pend = 0;
  function wire(root = document) {
    root.querySelectorAll('.mg').forEach(g => {
      if (g.dataset.wired) return; g.dataset.wired = 1;
      const b = g.querySelector('.mg-b');
      let hoverAt = 0;
      b.addEventListener('click', e => {
        e.stopPropagation();
        // открыли наведением только что — нажатие не закрывает (иначе меню мигнёт)
        if (hoverable() && g.classList.contains('open') && Date.now() - hoverAt < 600) return;
        open(g, !g.classList.contains('open'));
      });
      // v5.17: открыта другая группа — курсор, скорее всего, идёт к её пунктам «наискосок» через эту кнопку: переключаемся, только если мышь задержалась (260 мс);
      // ушли из группы — закрываем через 450 мс (вернулись раньше — остаётся открытой)
      g.addEventListener('mouseenter', () => {
        if (!hoverable()) return;
        clearTimeout(g._close); clearTimeout(pend);
        if (g.classList.contains('open')) return;
        const go = () => { hoverAt = Date.now(); open(g); };
        if (document.querySelector('.mg.open')) pend = setTimeout(go, 260); else go();
      });
      g.addEventListener('mouseleave', () => { if (!hoverable()) return; clearTimeout(pend); clearTimeout(g._close); g._close = setTimeout(() => { if (g.classList.contains('open') && !g.matches(':hover')) open(g, false); }, 450); });
      g.querySelector('.mg-p')?.addEventListener('click', e => { if (e.target.closest('a, button')) { close(); document.querySelector('.top')?.classList.remove('open'); } });
    });
  }

  function build() {
    const nav = document.querySelector('nav[data-nav]');
    if (!nav || nav.querySelector('.mg')) return;
    nav.insertAdjacentHTML('afterbegin', G.map(groupHtml).join(''));
    nav.classList.add('menu'); nav.id ||= 'menu';
    // «🏠 Все объявления» отдельной ссылкой больше не нужен — он в группе «Объявления»; pay.js прячет #go-home при входе только для оплаты — тогда и группы
    const home = nav.querySelector(':scope > a[href="./"]');
    const groups = [...nav.querySelectorAll(':scope > .mg')];
    if (home) {
      const apply = () => groups.forEach(g => g.hidden = home.hidden);
      home.classList.add('nav-home'); apply();
      new MutationObserver(apply).observe(home, { attributes: true, attributeFilter: ['hidden'] });
    }
    // телефон: кнопка «☰ Меню», если на странице её нет
    const top = nav.closest('.top');
    if (top && !top.querySelector('.burger')) {
      top.insertAdjacentHTML('beforeend', '<button type="button" class="burger" aria-expanded="false" aria-controls="menu">☰ Меню</button>');
      const bg = top.querySelector('.burger');
      bg.onclick = () => { const on = !top.classList.contains('open'); top.classList.toggle('open', on); bg.setAttribute('aria-expanded', on); };
    }
    sync();
    addEventListener('hashchange', sync);
  }
  // значки и профиль — на всех страницах с меню (на главной разметка своя, build её не трогает)
  function dress() {
    window.DESIGN?.sprite(); profile(); iconize(); tools();
    const top = document.querySelector('.top');
    if (top && !top.dataset.ic) { top.dataset.ic = 1; new MutationObserver(() => { iconize(); tools(); }).observe(top, { childList: true, subtree: true, characterData: true }); }
  }

  document.addEventListener('click', e => { if (!e.target.closest('.mg')) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  // v5.31c: ссылка из бота ./#proxy (вкладка B: «прокси перестал работать») — сразу окно прокси; на главной — после входа (app.js рисует страницу), поэтому с задержкой
  const proxyHash = () => { if (location.hash === '#proxy') setTimeout(openProxy, document.querySelector('.top .who') ? 600 : 1500); };
  addEventListener('hashchange', proxyHash);
  // v5.47 E → v5.51: сайт открыт с главного экрана (режим приложения, iOS) — у Safari нет своих кнопок: панель ⌂ ‹ › ⟳ ⤴ внизу (appnav.js).
  // Проверка без телефона: ?pwa=1
  const pwa = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true || /[?&]pwa=1\b/.test(location.search);
  // v5.51: панель режима приложения — внизу экрана, одна на всех страницах (appnav.js); старые значки в шапке убраны
  function appBar() {
    if (!pwa() || window.__pwaBar || document.querySelector('script[src*="appnav.js"]')) return;
    const sc = document.createElement('script'); sc.src = 'appnav.js?v=5.55'; document.head.appendChild(sc);
  }
  // v5.52 (п. 2 Алексея): единый стиль — ui.css последним на всех страницах и одна подпись в шапке
  function uiKit() {
    if (!document.querySelector('link[href^="ui.css"]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'ui.css?v=5.54'; document.head.appendChild(l); }
    document.querySelectorAll('.top .brand small').forEach(s => { s.textContent = '5 минут — вместо тысячи часов!'; });
  }
  // v5.54c (Алексей 11.11): «показывать начало ответа» во всех диалогах — ответ ИИ/автоответ встаёт началом под шапку, а не концом.
  // SHOWSTART(box, el): el — ответ (по умолчанию последний в box); box со своей прокруткой — внутри него, иначе — страница с учётом закреплённой шапки.
  // SHOWLAST(box, mine): последний ответ не свой — его начало; свой (только что отправили) — низ, как обычно.
  window.SHOWSTART = (box, el, smooth = true) => {
    el ||= box?.lastElementChild; if (!el) return;
    const sc = box && box.scrollHeight > box.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(box).overflowY) ? box : null;
    if (sc) { sc.scrollTo({ top: sc.scrollTop + el.getBoundingClientRect().top - sc.getBoundingClientRect().top - 8, behavior: smooth ? 'smooth' : 'instant' }); return; }
    let h = 0; document.querySelectorAll('.top, .ag-bar, .h-sticky-top').forEach(t => { const cs = getComputedStyle(t), r = t.getBoundingClientRect(); if (/sticky|fixed/.test(cs.position) && r.top <= 1 && r.height < innerHeight / 2) h = Math.max(h, r.bottom); });
    scrollBy({ top: el.getBoundingClientRect().top - h - 10, behavior: smooth ? 'smooth' : 'instant' });
  };
  window.SHOWLAST = (box, mine) => { const el = box?.lastElementChild; if (!el) return; if (mine && el.matches(mine)) { box.scrollTop = box.scrollHeight; return; } window.SHOWSTART(box, el, false); };
  const start = () => { uiKit(); build(); wire(); dress(); proxyHash(); appBar(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  return { close, open, sync, wire, iconize, tools, groups: G, openProxy };
})();
