// Код партнёра в профиле (решение Алексея 30.10.2026): по нему друзья регистрируются на сайте. Код есть только у тех, кто оплатил любую подписку, и у администраторов;
// считает сервер (функция pay, действие ref_my, SQL ref_info). Партнёрская программа целиком — шаг 3.1.
window.PARTNER = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  async function mount(el, toast) {
    if (!el) return;
    let r;
    try {
      const token = JSON.parse(localStorage.getItem('token'));
      r = await (await fetch(String(window.API).replace(/\/web$/, '/pay'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ref_my', auth: { token } }) })).json();
    } catch { r = null; }
    if (!r || r.error) { el.hidden = true; return; }
    const left = r.left == null ? '' : r.left ? `Осталось приглашений: ${r.left}.` : 'Приглашения пока закончились.';
    const first = r.first_end && Date.parse(r.first_end) > Date.now() ? ` В первый месяц после оплаты — ограничение до ${new Date(r.first_end).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' })}.` : '';
    el.innerHTML = `<div class="group">Код партнёра</div>${r.can && r.code ? `<p><code class="ref-code">${esc(r.code)}</code></p>
      <div class="sheet-foot"><button type="button" class="btn soft" data-ref="${esc(r.code)}">Скопировать код</button><button type="button" class="btn ghost" data-ref="${esc(r.link)}">Скопировать ссылку</button></div>
      <p class="hint">Регистрация на сайте — только по коду партнёра. Дайте код другу или отправьте ссылку. ${esc(left + first)} Приглашено: ${r.invited}.</p>`
      : '<p class="muted">Код партнёра появится после оплаты любой подписки. По нему друзья регистрируются на сайте.</p>'}`;
    el.onclick = async e => {
      const b = e.target.closest('[data-ref]');
      if (!b) return;
      try { await navigator.clipboard.writeText(b.dataset.ref); toast?.('Скопировано'); } catch { toast?.(b.dataset.ref, 8000); }
    };
  }
  return { mount };
})();
