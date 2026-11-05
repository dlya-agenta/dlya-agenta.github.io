// v5.25a: подпись внизу подборки клиента (s.html) — «Сделано в «Для Агента» — 7 дней бесплатно» со ссылкой с кодом автора подборки.
// Показывать ли и какой код — решает сервер (функция pay, ref_badge по токену подборки).
// v5.31a (Алексей 05.11): только у авторов на бесплатных 7 днях (pay/ref.ts badge) и только после первой отметки клиента (after_mark):
// ✓, ✗ или комментарий хотя бы к одному объекту — s.js ставит window.SEL_MARKED и шлёт событие 'sel:mark'. Появляется плавно, без прыжка страницы.
(() => {
  const t = location.hash.slice(1).split(/[?&]/)[0];
  if (!t || !window.API || /(^|[?&])a=1(&|$)/.test(location.hash.slice(1))) return;   // страница агента — без подписи
  const put = r => {
    if (!r?.show || document.getElementById('da-promo')) return;
    const a = document.createElement('a');
    a.id = 'da-promo'; a.href = r.url; a.target = '_blank'; a.rel = 'noopener'; a.dataset.web = '1';
    a.textContent = r.text;
    a.style.cssText = 'display:block;box-sizing:border-box;margin:28px auto 18px;width:calc(100% - 32px);max-width:520px;padding:12px 16px;border-radius:12px;text-align:center;font:500 14px/1.4 system-ui,sans-serif;'
      + 'text-decoration:none;color:#e9d9b0;background:linear-gradient(135deg,#14161c,#23252d);border:1px solid rgba(217,180,90,.45);box-shadow:0 2px 10px rgba(0,0,0,.18);'
      + 'opacity:0;transform:translateY(8px);transition:opacity .45s ease,transform .45s ease';
    document.body.appendChild(a);   // внизу страницы — ниже списка, поэтому страница не прыгает
    requestAnimationFrame(() => requestAnimationFrame(() => { a.style.opacity = '1'; a.style.transform = 'none'; }));
  };
  const show = r => {
    if (!r?.show) return;
    if (!r.after_mark || window.SEL_MARKED) return put(r);
    document.addEventListener('sel:mark', () => put(r), { once: true });
  };
  fetch(String(window.API).replace(/\/web$/, '/pay'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ref_badge', t }) })
    .then(r => r.json()).then(r => (document.readyState === 'loading' ? addEventListener('DOMContentLoaded', () => show(r)) : show(r))).catch(() => {});
})();
