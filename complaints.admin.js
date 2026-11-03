// v5.24a (04.11.2026, п. 1 Алексея): админка → «🛡 Модерация» → «⚠ Жалобы на объявления». Участник жалуется внутри объявления
// (продано, передумал, отложил продажу, это агент, другое + текст) — объявление само НЕ снимается, решает админ: «Оставить» | «Скрыть» | «Удалить»
// (те же, что прежние 👁/🗑). Сервер — web admin_complaints {status: new|done} и admin_complaint {id, do} (web/complain.ts), журнал admin_log complaint.
// Счётчик новых жалоб — у пункта «Модерация» слева. Позже ту же таблицу (listing_complaints) читает Управляющий.
window.CMPADM = (() => {
  const H = window.HUB, esc = H.esc;
  const WHY = { sold: 'Продано', changed: 'Передумал продавать', later: 'Отложил продажу', agent: 'Это агент', other: 'Другое' };
  const DONE = { keep: '✓ Оставлено', hide: '🙈 Скрыто', del: '🗑 Удалено' };
  const when = s => s ? new Date(s).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
  const what = o => !o ? 'объявление не найдено' : [o.kind, o.rooms === 0 ? 'студия' : o.rooms ? `${o.rooms}-комн.` : '', o.area ? `${o.area} м²` : '', o.floor ? `${o.floor}/${o.floors ?? '?'} эт.` : '',
    o.price ? `${(o.price / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} млн ₽` : ''].filter(Boolean).join(', ');
  let tab = 'new';

  function badge(n) {
    const a = document.querySelector('.adm-side [data-s="mod"]'); if (!a) return;
    let b = a.querySelector('.cmp-n');
    if (!n) { b?.remove(); return; }
    if (!b) { b = document.createElement('b'); b.className = 'cmp-n'; b.title = 'Новые жалобы на объявления'; b.style.cssText = 'margin-left:auto;min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:#c62828;color:#fff;font-size:12px;line-height:20px;text-align:center'; a.appendChild(b); }
    b.textContent = n;
  }
  async function count() { try { const r = await H.web('admin_complaints', { status: 'new' }); badge(r.counts?.new ?? 0); } catch { /* старый сервер — без счётчика */ } }

  async function render(box) {
    if (!box) return;
    box.innerHTML = '<p class="muted">Загрузка…</p>';
    let r;
    try { r = await H.web('admin_complaints', { status: tab }); } catch (e) { box.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    badge(r.counts?.new ?? 0);
    const row = c => `<div class="cmp-row" data-id="${c.id}">
      <div class="cmp-main"><a href="./?q=${c.num}" target="_blank" rel="noopener"><b>№ ${c.num}</b></a> · ${esc(what(c.obj))}${c.obj?.zk ? ` · ${esc(c.obj.zk)}` : ''}${c.obj?.addr ? ` · ${esc(c.obj.addr)}` : ''}
        ${c.obj?.hidden_kind ? `<span class="cmp-tag">${c.obj.hidden_kind === 'del' ? 'удалено' : 'скрыто'}</span>` : c.obj?.gone ? '<span class="cmp-tag">снято</span>' : ''}
        ${c.n > 1 ? `<span class="cmp-tag hot">жалоб на объект: ${c.n}</span>` : ''}</div>
      <div class="cmp-why"><b>${esc(WHY[c.reason] ?? c.reason)}</b>${c.text ? ` — ${esc(c.text)}` : ''}</div>
      <div class="cmp-who muted">${esc(c.name || c.login)} (${esc(c.login)}) · ${when(c.created_at)}${c.status !== 'new' ? ` · ${DONE[c.status] ?? c.status} — ${esc(c.decided_by ?? '')}, ${when(c.decided_at)}` : ''}</div>
      ${c.status === 'new' ? `<div class="cmp-acts"><button type="button" class="btn ghost sm" data-do="keep" title="Жалоба не подтвердилась — объявление остаётся">✓ Оставить</button>
        <button type="button" class="btn ghost sm" data-do="hide" title="Пропадёт у всех, будет в «🙈 Скрытые»">🙈 Скрыть</button>
        <button type="button" class="btn ghost sm cmp-del" data-do="del" title="Пропадёт у всех, ночная загрузка не вернёт">🗑 Удалить</button></div>` : ''}</div>`;
    box.innerHTML = `<style>
      .cmp-tabs { display: flex; gap: 6px; margin: 0 0 10px; } .cmp-row { padding: 10px 0; border-top: 1px solid var(--line); display: grid; gap: 4px; }
      .cmp-tag { display: inline-block; margin-left: 6px; padding: 1px 7px; border-radius: 999px; font-size: 12px; background: var(--soft); color: var(--muted); }
      .cmp-tag.hot { background: color-mix(in srgb, var(--bad) 12%, var(--card)); color: var(--bad); font-weight: 700; }
      .cmp-who { font-size: 13px; } .cmp-acts { display: flex; flex-wrap: wrap; gap: 6px; } .cmp-del:hover { background: var(--bad); color: #fff; border-color: var(--bad); }
    </style>
    <div class="cmp-tabs"><button type="button" class="seg${tab === 'new' ? ' on' : ''}" data-tab="new">Новые · ${r.counts?.new ?? 0}</button><button type="button" class="seg${tab === 'done' ? ' on' : ''}" data-tab="done">Решённые · ${r.counts?.done ?? 0}</button></div>
    <p class="muted">Участники жалуются внутри объявления. Объявление само не снимается — решаете вы; решение действует сразу по всем новым жалобам на этот объект.</p>
    ${r.items?.length ? r.items.map(row).join('') : `<p class="muted">${tab === 'new' ? 'Новых жалоб нет.' : 'Решённых жалоб пока нет.'}</p>`}`;
    box.onclick = async e => {
      const t = e.target.closest('[data-tab]');
      if (t) { tab = t.dataset.tab; return render(box); }
      const b = e.target.closest('[data-do]'); if (!b) return;
      const id = +b.closest('[data-id]').dataset.id, how = b.dataset.do, num = b.closest('.cmp-row').querySelector('b').textContent;
      if (how === 'del' && !confirm(`Удалить объявление ${num}? Оно пропадёт у всех и не вернётся ночной загрузкой. Вернуть можно в «Скрытые» → «Удалённые».`)) return;
      b.closest('.cmp-acts').querySelectorAll('button').forEach(x => x.disabled = true);
      try { await H.web('admin_complaint', { id, do: how }); H.toast({ keep: `${num}: оставлено`, hide: `${num} скрыт`, del: `${num} удалён` }[how]); render(box); }
      catch (er) { H.toast(er.message, 5000); render(box); }
    };
  }
  return { render, count, badge };
})();
