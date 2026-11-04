// v5.26 (п. 1 и 3 задачи Алексея 04.11): пока открыто окно (шторка, фото на весь экран, меню телефона) — страница под ним не листается.
// iOS Safari и Android Chrome не слушают overflow:hidden у body при прокрутке пальцем, поэтому body ставится position:fixed со сдвигом
// на текущую прокрутку и возвращается на то же место после закрытия. Окна находятся сами (MutationObserver): ничего вызывать не нужно.
// Меню телефона (.top.open): шапка становится fixed на весь экран и листается сама — до последнего пункта (место под шапкой сохраняется).
(() => {
  if (window.SCROLLLOCK) return;
  const OVER = '.sheet, .viewer, .s-view, .sa-modal, .ml-pop, .sup-wrap, .ma-sheet, [aria-modal="true"]';
  const phone = matchMedia('(max-width: 760px)');
  let locked = false, y = 0, pad = '', raf = 0, lastY = scrollY;
  const shown = el => {
    if (el.hidden || el.closest('[hidden]')) return false;
    const r = el.getBoundingClientRect();
    if (r.width < innerWidth * 0.6 || r.height < innerHeight * 0.6) return false;   // маленькие всплывашки страницу не держат
    const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.01;
  };
  const menuOpen = () => phone.matches && !!document.querySelector('.top.open');
  const filtersOpen = () => phone.matches && [...document.querySelectorAll('.filters:not(.closed)')].some(shown);
  const need = () => menuOpen() || filtersOpen() || [...document.querySelectorAll(OVER)].some(shown);
  function lock() {
    if (locked) return; locked = true;
    // меню раскрывается внутри шапки: браузер (scroll anchoring) успевает сдвинуть страницу на высоту меню — берём прокрутку до открытия
    const b = document.body, top = document.querySelector('.top'); y = menuOpen() ? lastY : scrollY;
    pad = b.style.paddingTop;
    if (menuOpen() && top) b.style.paddingTop = `${top.dataset.h || 0}px`;   // шапка ушла в fixed — её место держим, чтобы страница не прыгнула
    Object.assign(b.style, { position: 'fixed', top: `-${y}px`, left: '0', right: '0', width: '100%', overflow: 'hidden' });
    document.documentElement.classList.add('scroll-locked');
  }
  function unlock() {
    if (!locked) return; locked = false;
    const b = document.body;
    Object.assign(b.style, { position: '', top: '', left: '', right: '', width: '', overflow: '', paddingTop: pad });
    document.documentElement.classList.remove('scroll-locked');
    scrollTo({ top: y, behavior: 'instant' });
  }
  const check = () => { raf = 0; const top = document.querySelector('.top'); if (top && !top.classList.contains('open')) top.dataset.h = Math.round(top.getBoundingClientRect().height);
    if (need()) lock(); else unlock(); };
  const soon = () => { if (!raf) raf = requestAnimationFrame(check); };
  const css = document.createElement('style');
  css.textContent = `@media (max-width:760px){html.scroll-locked .top.open{position:fixed!important;top:0;left:0;right:0;z-index:2500;max-height:100dvh;overflow-y:auto;
      overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding-bottom:calc(16px + env(safe-area-inset-bottom))}
    html.scroll-locked .top.open .menu{max-height:none!important;overflow:visible!important}}
    .sheet-box,.sheet-body,#sheet-body,.sa-sheet,.sa-chat,.ml-pop>*,.sup-panel,.ma-sheet>*{overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
    .sheet,.viewer,.s-view,.sa-modal,.ml-pop,.ma-sheet{overscroll-behavior:contain}`;
  const go = () => {
    document.head.appendChild(css);
    new MutationObserver(soon).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'class', 'style', 'open'] });
    addEventListener('scroll', () => { if (!locked && !document.querySelector('.top.open')) lastY = scrollY; }, { passive: true });
    phone.addEventListener?.('change', soon); addEventListener('resize', soon);
    check();
  };
  if (document.body) go(); else document.addEventListener('DOMContentLoaded', go);
  window.SCROLLLOCK = { check, get locked() { return locked; }, get y() { return locked ? y : scrollY; } };
})();
