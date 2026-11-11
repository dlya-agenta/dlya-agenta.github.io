// v5.51 (Алексей 11.11): 20 вариантов логотипа «Ключ-дом» — фон плитки и цвет знака (design.js KEYC k1…k20). «Примерить» — у себя на всём сайте (localStorage keycolor),
// «Выбрать» — отметка на этой странице (localStorage logo_pick); администратор — «Сделать для всех» (hub adm_design_set {keycolor}).
(() => {
  const D = window.DESIGN, HUB = 'https://arojogajdamsyrrpcmso.supabase.co/functions/v1/hub';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tok = () => { try { return JSON.parse(localStorage.getItem('token') || 'null'); } catch { return null; } };
  const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* приватный режим */ } } };
  let admin = false;
  const ids = Object.keys(D.keyColors).filter(k => /^k\d+$/.test(k));
  // одинаковые id градиентов в разных местах страницы — у каждого места свой
  let u = 0; const mark = id => { const n = ++u; return D.markSvg('key', id).replace(/lg-(k\d+)/g, (m, k) => `lg-${k}-${n}`); };
  function cur() {
    const mine = D.mineKc?.(), def = D.kcDef?.(), pick = ls.get('logo_pick');
    const nm = id => D.keyColors[id]?.[0] ?? id, no = id => ids.includes(id) ? `№ ${ids.indexOf(id) + 1} ` : '';
    document.getElementById('lp-cur').innerHTML = `<span class="logo">${mark(D.keyColor())}</span>
      <span>Сейчас у вас: <b>${esc(no(D.keyColor()) + nm(D.keyColor()))}</b>${mine ? ' (примерка)' : ''} · для всех: <b>${esc(no(def) + nm(def))}</b>${pick ? ` · вы выбрали: <b>${esc(no(pick) + nm(pick))}</b>` : ''}</span>
      ${mine ? '<button class="btn ghost" type="button" data-reset>Вернуть как у всех</button>' : ''}`;
  }
  function draw() {
    const pick = ls.get('logo_pick'), def = D.kcDef?.();
    document.getElementById('lp-grid').innerHTML = ids.map((id, i) => {
      const [name] = D.keyColors[id];
      return `<article class="lp-card${pick === id ? ' on' : ''}" data-id="${id}">
        <div class="lp-t"><span class="lp-n">${i + 1}</span><b>${esc(name)}</b>${def === id ? '<span class="lp-tag">для всех</span>' : pick === id ? '<span class="lp-tag">выбран</span>' : ''}</div>
        <div class="lp-phone"><span class="lp-app"><i>${mark(id)}</i>Для Агента</span><span class="lp-app"><i class="sq">${mark(id)}</i>Android</span></div>
        <div class="lp-tab">${mark(id)}<span>Для Агента — объявления…</span><span class="x32">${mark(id)}</span></div>
        <div class="lp-tab dk">${mark(id)}<span>Для Агента — тёмная тема</span></div>
        <div class="lp-hdr lt"><span class="lg">${mark(id)}</span><span><b>Для Агента</b><small>5 минут — вместо тысячи часов</small></span></div>
        <div class="lp-hdr dk"><span class="lg">${mark(id)}</span><span><b>Для Агента</b><small>5 минут — вместо тысячи часов</small></span></div>
        <div class="lp-act"><button class="btn ghost" type="button" data-try="${id}">Примерить</button><button class="btn primary" type="button" data-pick="${id}">${pick === id ? '✓ Выбран' : 'Выбрать'}</button>
          ${admin && def !== id ? `<button class="btn ghost" type="button" data-all="${id}">Для всех</button>` : ''}</div></article>`;
    }).join('');
    cur();
  }
  function toast(t) { let el = document.getElementById('toast'); if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); } el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 2600); }
  async function hub(action, b = {}) {
    const r = await fetch(HUB, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, auth: { token: tok() }, ...b }) });
    const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.message || `Ошибка ${r.status}`); return j;
  }
  document.addEventListener('click', async e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.try) { D.setKeyColor(t.dataset.try); draw(); toast(`Примерка: № ${ids.indexOf(t.dataset.try) + 1} — откройте любую страницу сайта`); }
    if (t.dataset.pick) { ls.set('logo_pick', t.dataset.pick); D.setKeyColor(t.dataset.pick); draw(); toast(`Выбран № ${ids.indexOf(t.dataset.pick) + 1}. Напишите Claude номер — обновлю значки приложения`); }
    if (t.dataset.reset) { ls.set('keycolor', null); location.reload(); }
    if (t.dataset.all) {
      t.disabled = true;
      try { const c = await hub('adm_design_set', { keycolor: t.dataset.all }); D.setDefault(c.default, c.logo, c.icons, c.keycolor); ls.set('keycolor', null); draw(); toast('Теперь для всех'); }
      catch (er) { toast(er.message); t.disabled = false; }
    }
  });
  draw();
  if (tok()) hub('adm_design').then(() => { admin = true; draw(); }).catch(() => {});   // админ — видит «Для всех»
})();
