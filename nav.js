// Общее меню группами (v5.16, пп. 7 и 9): те же группы, что на главной («Объявления», «Моё», «Продвижение», «Помощник», «Кабинет»),
// на всех страницах, кроме админки. Подразделы раскрываются нажатием; на компьютере с мышью — ещё и при наведении.
// Главная (index.html): группы уже в разметке — здесь только поведение; пункты с data-go обрабатывает app.js.
// Другие страницы: <nav class="menu" data-nav> — группы вставляются в начало, ссылки страницы (журнал, настройки…) остаются после них.
// Телефон (до 760 px): «☰ Меню», группы одной колонкой с заголовками.
// v5.17: значки — рисованные линии вместо эмодзи (рисует design.js: DESIGN.iconizeEl; набор выбирает админ — html[data-icons]);
// наведение с «намерением» — быстрый проход мыши над соседней группой не перехватывает открытое меню; справа — «Профиль» с подпиской, под ним «Стиль» и «Выйти».
window.NAV = (() => {
  const G = [
    ['obj', '🏠 Объявления', [['./', '🏠 Все объявления'], ['hub.html#newb', '🏗 Новостройки'], ['arch.html', '🗂 Архив 2 года'], ['hub.html#market', '📈 Цены рынка']]],
    ['excl', '💎 Эксклюзивы', 'excl.html'],
    ['my', '⭐ Моё', [['./#favs', '★ Избранное'], ['./#sels', '📄 Мои подборки'], ['./#crm', '👥 Клиенты'], ['./#deals', '🤝 Контакт'], ['hub.html#deal', '📑 Сделки'], ['hub.html#fix', '📌 Фиксации']]],
    ['promo', '📣 Продвижение', [['hub.html#msg', '🔗 Мессенджеры и соцсети'], ['./#rk', '📣 Реклама'], ['mail.html', '✉️ Рассылки'], ['hub.html#video', '🎬 Видеомонтаж-СММ']]],
    ['help', '🤖 Помощник', [['hub.html#helper', '🤖 Мой помощник'], ['hub.html#lawyer', '⚖️ Юрист'], ['hub.html#broker', '🏦 Ипотечный брокер'], ['hub.html#kb', '📚 База знаний'],
      ['hub.html#chat', '💬 Чат подписчиков'], ['hub.html#taxes', '🧾 Налоги при продаже'], ['help-helper.html', '📘 Как пользоваться помощником']]],
    ['cab', '💼 Кабинет', [['hub.html#balance', '💰 Баланс'], ['partner.html', '🤝 Партнёрская программа'], ['pay.html', '💳 Оплата и тарифы'], ['support.html', '💬 Помощь']]],
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
  // v5.20: «Стиль» и «Выйти» — в меню под «Профилем» (компьютер; наведение или ▾): строка разделов всегда в одну линию (раньше «Выйти» уходил на 2–3-ю строку).
  // Телефон — как раньше, в «☰ Меню». Кнопки переносятся сами (обработчики app.js и design.js остаются на них)
  const wide = matchMedia('(min-width: 761px)');
  let placing = false;
  function tools() {
    const top = document.querySelector('.top');
    if (!top || placing || document.body.classList.contains('adm2')) return;
    const menu = top.querySelector('.menu');
    let box = top.querySelector(':scope > .whomg');
    const who = box ? box.querySelector(':scope > .who') : top.querySelector(':scope > .who');
    if (!menu || !who) return;
    placing = true;
    try {
      if (wide.matches) {
        if (!box) {
          box = document.createElement('div'); box.className = 'mg whomg'; box.dataset.g = 'prof';
          top.insertBefore(box, who); box.appendChild(who);
          box.insertAdjacentHTML('beforeend', '<button type="button" class="mg-b who-more" aria-expanded="false" aria-haspopup="true" title="Стиль, выход"><span class="mg-a" aria-hidden="true">▾</span></button><div class="mg-p" role="menu"></div>');
          wire(top);
        }
        const p = box.querySelector('.mg-p');
        menu.querySelectorAll(':scope [data-style], :scope #logout, :scope [data-logout]').forEach(b => { b.classList.add('link'); p.appendChild(b); });
      } else if (box) {
        box.querySelectorAll('.mg-p > *').forEach(b => menu.appendChild(b));
        top.insertBefore(who, box); box.remove();
      }
    } finally { placing = false; }
  }
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
  const start = () => { build(); wire(); dress(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  return { close, open, sync, wire, iconize, tools, groups: G };
})();
