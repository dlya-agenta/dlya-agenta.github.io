// v5.51 (Алексей 11.11): режим приложения (сайт открыт с главного экрана) — навигация ВНИЗУ экрана, как у приложений: ⌂ ‹ › ⟳ ⤴ с подписями.
// Одна панель на всех страницах: nav.js сам подгружает этот файл, на страницах без nav.js он подключён в разметке. Проверка без телефона: ?pwa=1.
// Чтобы ничему не мешать: всё, что прижато к низу (кнопки ИИ-Агента и «Помощь», полоса подборки, фильтры, уведомления), поднимается над панелью
// через CSS-свойство translate (у элементов своё transform для центровки — оно не сбивается); страница получает отступ снизу; пока печатают на телефоне — панель скрыта
// (клавиатура), окна поверх страницы (z-index ≥ 2000) закрывают панель.
(() => {
  const pwa = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true || /[?&]pwa=1\b/.test(location.search);
  if (!pwa() || window.parent !== window || window.__pwaBar) return;
  window.__pwaBar = 1;
  const UP = ['.sup-fab', '#ag-fabs', '.selbar', '.ex-selbar', '.notes', '.offer-chip', '.sp-undo', '.v-live', '#v-toast', '.ag-card', '.sai-toast', '.mg-newmsg'];
  function bar() {
    if (document.querySelector('.pwa-bot')) return;
    document.querySelectorAll('.top > .pwa-nav, .pwa-fix').forEach(x => x.remove());   // старые кнопки в шапке (кэш старого nav.js)
    const st = document.createElement('style');
    st.textContent = `:root{--pwa-h:calc(58px + env(safe-area-inset-bottom))}
      .pwa-bot{position:fixed;left:0;right:0;bottom:0;z-index:1500;display:flex;justify-content:space-around;align-items:stretch;gap:2px;height:58px;padding:0 6px env(safe-area-inset-bottom);
        background:color-mix(in srgb,var(--card,#fff) 90%,transparent);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border-top:1px solid var(--line,rgba(127,127,127,.25));
        color:var(--text,#111);transition:transform .2s ease;font:500 10.5px/1.1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
      .pwa-bot button{flex:1;max-width:90px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:0;border-radius:12px;margin:4px 0;background:transparent;color:inherit;cursor:pointer;padding:0;font:inherit;-webkit-tap-highlight-color:transparent}
      .pwa-bot button:active{background:color-mix(in srgb,currentColor 12%,transparent)}
      .pwa-bot button[data-pwa=home]{color:var(--link,var(--accent,#2f6fdc))}
      .pwa-bot svg{width:23px;height:23px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
      html.pwa-b body{padding-bottom:var(--pwa-h)!important}
      html.pwa-b :is(${UP.join(',')}){translate:0 calc(-58px)}
      @media (max-width:760px){html.pwa-b .filters{padding-bottom:calc(150px + env(safe-area-inset-bottom))!important}html.pwa-b .ffoot{translate:0 -58px}html.pwa-b.pwa-kb .ffoot{translate:none}}
      html.pwa-b.pwa-kb .pwa-bot{transform:translateY(110%)}
      html.pwa-b.pwa-kb :is(${UP.join(',')}){translate:none}
      @media (min-width:761px){.pwa-bot{left:50%;right:auto;transform:translateX(-50%);width:min(520px,100%);bottom:10px;border:1px solid var(--line,rgba(127,127,127,.25));border-radius:18px;padding:0 6px;box-shadow:0 8px 28px rgba(0,0,0,.18)}
        html.pwa-b.pwa-kb .pwa-bot{transform:translateX(-50%)}}`;
    document.head.appendChild(st);
    const svg = d => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
    const b = document.createElement('nav'); b.className = 'pwa-bot'; b.setAttribute('aria-label', 'Навигация приложения');
    b.innerHTML = [['back', 'Назад', 'M14.5 5.5 8 12l6.5 6.5'], ['fwd', 'Вперёд', 'M9.5 5.5 16 12l-6.5 6.5'], ['home', 'Главная', 'M4 11.5 12 5l8 6.5M6.5 10v9h11v-9'],
      ['reload', 'Обновить', 'M19 12a7 7 0 1 1-2.05-4.95M19 4.5V8h-3.5'], ['share', 'Поделиться', 'M12 15V4M8 7.5 12 3.5l4 4M6.5 11H5.5v9h13v-9h-1']]
      .map(([k, t, d]) => `<button type="button" data-pwa="${k}" aria-label="${t}">${svg(d)}<span>${t}</span></button>`).join('');
    b.addEventListener('click', async e => {
      const k = e.target.closest('[data-pwa]')?.dataset.pwa;
      if (k === 'home') location.href = './';
      if (k === 'back') { if (history.length > 1) history.back(); else location.href = './'; }
      if (k === 'fwd') history.forward();
      if (k === 'reload') location.reload();
      if (k === 'share') {
        const url = location.href.replace(/[?&]pwa=1\b/, ''), title = document.title;
        try { if (navigator.share) await navigator.share({ title, url }); else { await navigator.clipboard.writeText(url); window.HUB?.toast?.('Ссылка скопирована'); } } catch { /* отменили */ }
      }
    });
    document.body.appendChild(b);
    document.documentElement.classList.add('pwa', 'pwa-b');
    // телефон: пока открыта клавиатура (фокус в поле ввода) — панель уезжает вниз, чтобы не висеть над клавиатурой
    const H = document.documentElement, typing = el => el && el.matches?.('input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=range]), textarea, select, [contenteditable="true"]');
    document.addEventListener('focusin', e => { if (innerWidth <= 760 && typing(e.target)) H.classList.add('pwa-kb'); });
    document.addEventListener('focusout', () => setTimeout(() => { if (!typing(document.activeElement)) H.classList.remove('pwa-kb'); }, 150));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bar); else bar();
})();
