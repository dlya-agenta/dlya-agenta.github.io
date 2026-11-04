// v5.25a: «Позвать коллегу» — не чаще 2 раз в неделю (на устройстве), только после удачного момента: открыл телефон собственника, собрал подборку.
// Ссылка с кодом — из функции pay (ref_my). Нельзя приглашать (нет кода) — не показываем. Кнопки мессенджеров — обычные ссылки: msgapp.js откроет приложение.
window.INVITE = (() => {
  const KEY = 'inv_seen', WEEK = 7 * 864e5, MAX = 2, DELAY = 2500;
  const token = () => { try { return JSON.parse(localStorage.getItem('token')); } catch { return null; } };
  const seen = () => { try { return (JSON.parse(localStorage.getItem(KEY)) || []).filter(t => Date.now() - t < WEEK); } catch { return []; } };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let me = null, busy = false;
  const css = () => document.getElementById('inv-css') || document.head.insertAdjacentHTML('beforeend', `<style id="inv-css">
.inv-pop { position: fixed; right: 16px; bottom: 80px; z-index: 3900; width: min(380px, calc(100vw - 32px)); background: var(--card, #fff); color: var(--text, #111);
  border: 1px solid var(--line, rgba(0,0,0,.12)); border-radius: 16px; padding: 16px 16px 14px; box-shadow: 0 12px 40px rgba(0,0,0,.22);
  transform: translateY(16px); opacity: 0; transition: transform .25s ease, opacity .25s ease; }
.inv-pop.on { transform: none; opacity: 1; }
.inv-pop p { margin: 6px 0 10px; line-height: 1.45; font-size: 14px; }
.inv-row { display: flex; gap: 6px; flex-wrap: wrap; }
.inv-x { position: absolute; top: 8px; right: 8px; border: 0; background: none; font-size: 16px; cursor: pointer; color: inherit; opacity: .6; min-width: 32px; min-height: 32px; }
@media (max-width: 760px) { .inv-pop { left: 12px; right: 12px; bottom: 84px; width: auto; } }
@media (prefers-reduced-motion: reduce) { .inv-pop { transition: none; } }
</style>`);
  async function info() {
    if (me) return me;
    const r = await fetch(String(window.API).replace(/\/web$/, '/pay'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ref_my', auth: { token: token() } }) });
    const j = await r.json().catch(() => null);
    return me = r.ok && j && !j.error ? j : { can: false };
  }
  async function hit(why) {
    if (busy || document.body.classList.contains('client') || seen().length >= MAX || document.querySelector('#inv-pop')) return;
    busy = true;
    try {
      const r = await info();
      if (!r.can || !r.link) return;
      await new Promise(ok => setTimeout(ok, DELAY));
      for (let i = 0; i < 45 && document.querySelector('.sheet:not([hidden]), .modal:not([hidden])'); i++) await new Promise(ok => setTimeout(ok, 2000));   // подождать, пока закроют окно подборки
      if (document.querySelector('#inv-pop, .sheet:not([hidden])')) return;
      css();
      localStorage.setItem(KEY, JSON.stringify([...seen(), Date.now()]));
      const text = `Коллега, пользуюсь «Для Агента» — база объявлений собственников Сочи с телефонами, подборки клиентам ссылкой и PDF. По моей ссылке — 7 дней бесплатно: ${r.link}`;
      const t = encodeURIComponent(text), head = why === 'sel' ? 'Подборка готова 👍' : 'Телефон собственника открыт 👍';
      const pct = r.tier === 'founder' && r.founder_ok ? r.rates?.founder?.y1?.[0] : r.mode === 'service' ? r.rates?.sub?.service_y1 : r.rates?.sub?.y1;
      document.body.insertAdjacentHTML('beforeend', `<div id="inv-pop" class="inv-pop agent-only" role="dialog" aria-label="Позвать коллегу">
        <button type="button" class="inv-x" aria-label="Закрыть">✕</button><b>${head}</b>
        <p>Позовите коллегу: ему — 7 дней бесплатно, вам — ${esc(pct ?? 20)}% с его оплат. Код <code>${esc(r.code)}</code></p>
        <div class="inv-row"><a class="btn soft" href="https://wa.me/?text=${t}" target="_blank" rel="noopener">WhatsApp</a>
          <a class="btn soft" href="https://t.me/share/url?url=${encodeURIComponent(r.link)}&text=${encodeURIComponent(text.replace(r.link, '').trim())}" target="_blank" rel="noopener">Telegram</a>
          <button type="button" class="btn soft" data-inv-copy>Скопировать</button><a class="btn ghost" href="partner.html">Подробнее</a></div></div>`);
      const pop = document.getElementById('inv-pop');
      pop.addEventListener('click', async e => {
        if (e.target.closest('.inv-x')) return pop.remove();
        if (e.target.closest('[data-inv-copy]')) { try { await navigator.clipboard.writeText(text); e.target.textContent = 'Скопировано'; } catch { prompt('Скопируйте текст', text); } }
      });
      setTimeout(() => pop.isConnected && pop.classList.add('on'), 20);
    } catch { /* не мешаем работе */ } finally { busy = false; }
  }
  return { hit };
})();
