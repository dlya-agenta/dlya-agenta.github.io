// v5.49 (п. 1, 4): кнопки приложения ‹ › ⟳ ⤴ на страницах без общего меню (ссылка подборки, тарифы, правила, оплата…).
// Только в режиме «на главном экране» (standalone) — там у телефона нет своих кнопок браузера, и со страницы иначе не уйти.
// На страницах с nav.js кнопки ставит nav.js (appBar) — этот файл тогда ничего не делает. Проверка без телефона: ?pwa=1.
(() => {
  const pwa = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true || /[?&]pwa=1\b/.test(location.search);
  if (!pwa() || window.parent !== window) return;
  function bar() {
    if (document.querySelector('.pwa-nav')) return;
    const svg = d => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
    const st = document.createElement('style');
    st.textContent = `.pwa-fix{position:fixed;left:0;right:0;top:0;z-index:3000;display:flex;justify-content:space-between;gap:4px;padding:calc(4px + env(safe-area-inset-top)) 10px 4px;
      background:color-mix(in srgb,var(--card,#fff) 92%,transparent);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border:0;border-radius:0;border-bottom:1px solid color-mix(in srgb,currentColor 12%,transparent);color:var(--text,#121722)}
      .pwa-fix button{flex:1;max-width:72px;width:auto;height:40px;display:grid;place-items:center;border:0;border-radius:12px;background:transparent;color:inherit;cursor:pointer;padding:0;-webkit-tap-highlight-color:transparent}
      .pwa-fix button:active{background:color-mix(in srgb,currentColor 14%,transparent)}
      .pwa-fix svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
      html.pwa-fixed body{padding-top:calc(52px + env(safe-area-inset-top))!important}`;
    document.head.appendChild(st);
    const b = document.createElement('div'); b.className = 'pwa-nav pwa-fix'; b.setAttribute('role', 'toolbar'); b.setAttribute('aria-label', 'Навигация');
    b.innerHTML = [['home', 'На главную', 'M4 11.5 12 5l8 6.5M6.5 10v9h11v-9'], ['back', 'Назад', 'M14.5 5.5 8 12l6.5 6.5'], ['fwd', 'Вперёд', 'M9.5 5.5 16 12l-6.5 6.5'],
      ['reload', 'Обновить', 'M19 12a7 7 0 1 1-2.05-4.95M19 4.5V8h-3.5'], ['share', 'Поделиться', 'M12 15V4M8 7.5 12 3.5l4 4M6.5 11H5.5v9h13v-9h-1']]
      .map(([k, t, d]) => `<button type="button" data-pwa="${k}" title="${t}" aria-label="${t}">${svg(d)}</button>`).join('');
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
    document.body.prepend(b);
    document.documentElement.classList.add('pwa', 'pwa-fixed');
  }
  // nav.js (если есть на странице) ставит свои кнопки на DOMContentLoaded — ждём его и только потом решаем
  const go = () => setTimeout(bar, 60);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
