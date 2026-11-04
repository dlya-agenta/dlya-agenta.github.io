// v5.25a: подпись внизу подборки клиента (s.html) — «Сделано в «Для Агента» — 7 дней бесплатно» со ссылкой с кодом автора подборки.
// Показывать ли и какой код — решает сервер (функция pay, ref_badge по токену подборки): автор с оплаченной подпиской может её убрать (partner.html).
(() => {
  const t = location.hash.slice(1).split(/[?&]/)[0];
  if (!t || !window.API) return;
  const put = r => {
    if (!r?.show || document.getElementById('da-promo')) return;
    const a = document.createElement('a');
    a.id = 'da-promo'; a.href = r.url; a.target = '_blank'; a.rel = 'noopener'; a.dataset.web = '1';
    a.textContent = r.text;
    a.style.cssText = 'display:block;margin:28px auto 18px;max-width:520px;padding:12px 16px;border-radius:12px;text-align:center;font:500 14px/1.4 system-ui,sans-serif;'
      + 'text-decoration:none;color:#e9d9b0;background:linear-gradient(135deg,#14161c,#23252d);border:1px solid rgba(217,180,90,.45);box-shadow:0 2px 10px rgba(0,0,0,.18)';
    document.body.appendChild(a);
  };
  fetch(String(window.API).replace(/\/web$/, '/pay'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ref_badge', t }) })
    .then(r => r.json()).then(r => (document.readyState === 'loading' ? addEventListener('DOMContentLoaded', () => put(r)) : put(r))).catch(() => {});
})();
