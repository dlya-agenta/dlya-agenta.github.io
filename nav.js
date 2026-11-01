// Общее меню группами (v5.16, пп. 7 и 9): те же группы, что на главной («Объявления», «Моё», «Продвижение», «Помощник», «Кабинет»),
// на всех страницах, кроме админки. Подразделы раскрываются нажатием; на компьютере с мышью — ещё и при наведении (закрытие с задержкой 250 мс).
// Главная (index.html): группы уже в разметке — здесь только поведение; пункты с data-go обрабатывает app.js.
// Другие страницы: <nav class="menu" data-nav> — группы вставляются в начало, ссылки страницы (журнал, настройки…) остаются после них.
// Телефон (до 760 px): «☰ Меню», группы одной колонкой с заголовками.
window.NAV = (() => {
  const G = [
    ['obj', '🏠 Объявления', [['./', '🏠 Все объявления'], ['hub.html#newb', '🏗 Новостройки'], ['hub.html#excl', '💎 Эксклюзивы коллег'], ['arch.html', '🗂 Архив 2 года'], ['hub.html#market', '📈 Цены рынка']]],
    ['my', '⭐ Моё', [['./#favs', '★ Избранное'], ['./#sels', '📄 Мои подборки'], ['./#crm', '👥 Клиенты'], ['hub.html#deal', '📑 Сделки'], ['hub.html#fix', '📌 Фиксации']]],
    ['promo', '📣 Продвижение', [['./#rk', '📣 Реклама'], ['mail.html', '✉️ Рассылки'], ['hub.html#video', '🎬 Видеомонтаж-СММ']]],
    ['help', '🤖 Помощник', [['hub.html#helper', '🤖 Мой помощник'], ['hub.html#lawyer', '⚖️ Юрист'], ['hub.html#broker', '🏦 Ипотечный брокер'], ['hub.html#kb', '📚 База знаний'],
      ['hub.html#chat', '💬 Чат подписчиков'], ['hub.html#taxes', '🧾 Налоги при продаже'], ['help-helper.html', '📘 Как пользоваться помощником']]],
    ['cab', '👤 Кабинет', [['hub.html#balance', '💰 Баланс'], ['partner.html', '🤝 Партнёрская программа'], ['hub.html#msg', '🔗 Мессенджеры и соцсети'], ['pay.html', '💳 Оплата и тарифы'], ['support.html', '💬 Помощь']]],
  ];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hoverable = () => matchMedia('(hover: hover) and (pointer: fine) and (min-width: 761px)').matches;
  const groupHtml = ([id, title, items]) => `<div class="mg" data-g="${id}"><button type="button" class="link mg-b" aria-expanded="false" aria-haspopup="true">${title} <span class="mg-a" aria-hidden="true">▾</span></button>
    <div class="mg-p" role="menu">${items.map(([href, t]) => `<a class="link" role="menuitem" href="${esc(href)}"${/^help-/.test(href) ? ' target="_blank"' : ''}>${esc(t)}</a>`).join('')}</div></div>`;

  function close(except) {
    document.querySelectorAll('.mg.open').forEach(g => { if (g !== except) { g.classList.remove('open'); g.querySelector('.mg-b')?.setAttribute('aria-expanded', false); } });
  }
  function open(g, on = true) { close(on ? g : null); g.classList.toggle('open', on); g.querySelector('.mg-b')?.setAttribute('aria-expanded', on); }

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

  function wire(root = document) {
    root.querySelectorAll('.mg').forEach(g => {
      if (g.dataset.wired) return; g.dataset.wired = 1;
      const b = g.querySelector('.mg-b');
      let t = null, hoverAt = 0;
      b.addEventListener('click', e => {
        e.stopPropagation();
        // открыли наведением только что — нажатие не закрывает (иначе меню мигнёт)
        if (hoverable() && g.classList.contains('open') && Date.now() - hoverAt < 600) return;
        open(g, !g.classList.contains('open'));
      });
      g.addEventListener('mouseenter', () => { if (!hoverable()) return; clearTimeout(t); if (!g.classList.contains('open')) { hoverAt = Date.now(); open(g); } });
      g.addEventListener('mouseleave', () => { if (!hoverable()) return; clearTimeout(t); t = setTimeout(() => open(g, false), 250); });
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

  document.addEventListener('click', e => { if (!e.target.closest('.mg')) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  const start = () => { build(); wire(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  return { close, open, sync, wire, groups: G };
})();
