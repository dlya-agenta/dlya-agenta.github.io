// v5.39: страница «Отметить выполненной» для ссылки из календаря телефона (Apple / Google). Сервер — hub cal_done {t, go}.
(() => {
  const box = document.getElementById('box'), t = location.hash.slice(1);
  const hub = String(window.API || '').replace(/\/web$/, '/hub');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  async function call(go) {
    const r = await fetch(hub, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cal_done', t, go }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error(j.message || 'Не получилось — откройте задачу на сайте');
    return j;
  }
  function draw(x) {
    const open = x.deal_id ? `hub.html#deal=${x.deal_id}` : `./#task=${x.id}`;
    box.innerHTML = `<p style="font-size:18px"><b>${esc(x.text)}</b></p>` + (x.done
      ? '<p style="font-size:18px;color:#15803d"><b>✅ Выполнено</b></p><p>В календаре задача обновится при следующей синхронизации.</p>'
      : '<p><button id="go" style="font:inherit;font-size:18px;font-weight:700;padding:14px 22px;border-radius:12px;border:0;background:#1453d8;color:#fff;cursor:pointer">✅ Отметить выполненной</button></p>')
      + `<p><a href="${open}">Открыть на сайте</a></p>`;
    const b = document.getElementById('go');
    if (b) b.onclick = async () => { b.disabled = true; b.textContent = 'Отмечаю…'; try { draw(await call(true)); } catch (e) { box.insertAdjacentHTML('beforeend', `<p style="color:#c62828">${esc(e.message)}</p>`); b.disabled = false; b.textContent = '✅ Отметить выполненной'; } };
  }
  if (!/^\d+\.[0-9a-f]{20}$/.test(t)) { box.innerHTML = '<p>Ссылка неполная — откройте задачу на сайте.</p><p><a href="./#crm">Мои задачи</a></p>'; return; }
  call(false).then(draw).catch(e => { box.innerHTML = `<p style="color:#c62828">${esc(e.message)}</p><p><a href="./#crm">Мои задачи</a></p>`; });
})();
