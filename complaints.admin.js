// v5.24a (04.11.2026, п. 1 Алексея): админка → «🛡 Модерация» → «⚠ Жалобы на объявления». Участник жалуется внутри объявления
// (продано, передумал, отложил продажу, это агент, другое + текст) — объявление само НЕ снимается, решает админ: «Оставить» | «Скрыть» | «Удалить»
// (те же, что прежние 👁/🗑). Сервер — web admin_complaints {status: new|done} и admin_complaint {id, do} (web/complain.ts), журнал admin_log complaint.
// Счётчик новых жалоб — у пункта «Модерация» слева. Позже ту же таблицу (listing_complaints) читает Управляющий.
window.CMPADM = (() => {
  const H = window.HUB, esc = H.esc;
  const WHY = { sold: 'Продано', changed: 'Передумал продавать', later: 'Отложил продажу', agent: 'Это агент', other: 'Другое', excl: '💎 У агента эксклюзив' };
  const DONE = { keep: '✓ Оставлено', hide: '🙈 Скрыто', del: '🗑 Удалено', excl: '✅ Договор подтверждён — снято', dup: '🔁 Помечено дублем', no: '✓ Не дубль' };
  const mln = p => p ? `${(p / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} млн ₽` : '';
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

  // v5.67: эксклюзив ↔ собственник — две карточки рядом, договор, решения
  const mini = (o, tag) => !o ? '<div class="xd-c muted">не найдено</div>' : `<a class="xd-c" href="./?q=${o.num}#o=${o.num}" target="_blank" rel="noopener">
    ${o.photo ? `<img src="${esc(o.photo)}" alt="" loading="lazy">` : '<span class="xd-np">без фото</span>'}
    <span><small>${tag}</small><b>№ ${o.num}</b> ${esc(what(o))}${o.zk ? `<br>${esc(o.zk)}` : ''}${o.addr ? `<br><span class="muted">${esc(o.addr)}</span>` : ''}${o.hidden ? ' <span class="cmp-tag">скрыто</span>' : ''}${o.contract_ok ? ' <span class="cmp-tag">договор ✓</span>' : ''}</span></a>`;
  const pair = (own, ex, doc = '', until = null) => `<div class="xd-pair">${mini(own, 'Собственник')}<span class="xd-eq">=</span>${mini(ex, '💎 Эксклюзив')}</div>
    ${doc || until ? `<div class="cmp-acts">${doc}${until ? `<span class="muted">действует до ${new Date(until).toLocaleDateString('ru-RU')}</span>` : ''}</div>` : ''}`;
  const exclActs = () => `<div class="cmp-acts"><button type="button" class="btn primary sm" data-do="excl" title="Объявление собственника пропадёт у всех, у эксклюзива — «договор ✓»">✅ Договор действующий — снять объявление</button>
    <button type="button" class="btn ghost sm" data-do="dup" title="Объявление остаётся, в нём — «эта квартира есть в эксклюзивах коллеги»">🔁 Договора нет — пометить дублем</button>
    <button type="button" class="btn ghost sm" data-do="keep" title="Разные квартиры — пара больше не предлагается">✓ Не дубль</button></div>`;
  let dtab = 'new';
  async function dups(box) {
    if (!box) return;
    let r; try { r = await H.call('xdup_adm', { status: dtab }); } catch (e) { box.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    const st = { new: '🔁 дубль по фото', cand: 'похожи параметры — сравните фото' };
    box.innerHTML = `<div class="cmp-tabs"><button type="button" class="seg${dtab === 'new' ? ' on' : ''}" data-dtab="new">Найдены · ${(r.counts?.new ?? 0) + (r.counts?.cand ?? 0)}</button><button type="button" class="seg${dtab === 'done' ? ' on' : ''}" data-dtab="done">Решённые</button></div>
      <p class="muted">Сервис сам ищет одну и ту же квартиру среди эксклюзивов и объявлений собственников: тот же дом, этаж и площадь, затем ИИ сравнивает только интерьер (фасад и двор ЖК не в счёт). Автору эксклюзива приходит просьба приложить договор.</p>
      ${r.items?.length ? r.items.map(d => `<div class="cmp-row" data-xd="${d.id}"><div class="cmp-main"><b>${esc(st[d.status] ?? DONE[d.status] ?? d.status)}</b>${d.why ? ` — ${esc(d.why)}` : ''}${d.decided_by ? ` <span class="muted">· ${esc(d.decided_by)}, ${when(d.decided_at)}</span>` : ''}</div>
        ${pair(d.own, d.excl)}
        ${['new', 'cand'].includes(d.status) ? `<div class="cmp-acts"><button type="button" class="btn ${d.status === 'new' ? 'primary' : 'ghost'} sm" data-do="dup" title="Объявление остаётся, в нём — «эта квартира есть в эксклюзивах коллеги»">🔁 Та же квартира — пометить дублем</button>
          <button type="button" class="btn ghost sm" data-do="no" title="Разные квартиры — пара больше не предлагается">✓ Не дубль</button>
          <span class="muted small">Снять объявление собственника — только по жалобе с договором</span></div>` : ''}</div>`).join('') : `<p class="muted">${dtab === 'new' ? 'Дублей не найдено.' : 'Решённых пока нет.'}</p>`}`;
    box.onclick = async e => {
      const t = e.target.closest('[data-dtab]'); if (t) { dtab = t.dataset.dtab; return dups(box); }
      const b = e.target.closest('[data-do]'); if (!b) return;
      const id = +b.closest('[data-xd]').dataset.xd;
      if (b.dataset.do === 'excl' && !confirm('Снять объявление собственника? Сделайте это, только если видели действующий эксклюзивный договор.')) return;
      b.closest('.cmp-acts').querySelectorAll('button').forEach(x => x.disabled = true);
      try { await H.call('xdup_set', { id, do: b.dataset.do }); H.toast(DONE[b.dataset.do]); } catch (er) { H.toast(er.message, 5000); }
      dups(box);
    };
  }

  async function render(box) {
    if (!box) return;
    box.innerHTML = '<p class="muted">Загрузка…</p>';
    let r;
    try { r = await H.web('admin_complaints', { status: tab }); } catch (e) { box.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    badge(r.counts?.new ?? 0);
    const row = c => `<div class="cmp-row" data-id="${c.id}">
      <div class="cmp-main"><a href="./?q=${c.num}#o=${c.num}" target="_blank" rel="noopener"><b>№ ${c.num}</b></a> · ${esc(what(c.obj))}${c.obj?.zk ? ` · ${esc(c.obj.zk)}` : ''}${c.obj?.addr ? ` · ${esc(c.obj.addr)}` : ''}
        ${c.obj?.hidden_kind ? `<span class="cmp-tag">${c.obj.hidden_kind === 'del' ? 'удалено' : 'скрыто'}</span>` : c.obj?.gone ? '<span class="cmp-tag">снято</span>' : ''}
        ${c.n > 1 ? `<span class="cmp-tag hot">жалоб на объект: ${c.n}</span>` : ''}</div>
      <div class="cmp-why"><b>${esc(WHY[c.reason] ?? c.reason)}</b>${c.text ? ` — ${esc(c.text)}` : ''}</div>
      ${c.reason === 'excl' ? pair(c.obj && { ...c.obj, num: c.num }, c.excl, c.doc ? `<a class="btn soft sm" href="${esc(c.doc)}" target="_blank" rel="noopener">📄 Открыть договор${c.doc_name ? ` · ${esc(c.doc_name)}` : ''}</a>` : c.status === 'new' ? '<span class="muted">договор не открылся</span>' : '', c.doc_until) : ''}
      <div class="cmp-who muted">${esc(c.name || c.login)} (${esc(c.login)}) · ${when(c.created_at)}${c.status !== 'new' ? ` · ${DONE[c.status] ?? c.status} — ${esc(c.decided_by ?? '')}, ${when(c.decided_at)}` : ''}</div>
      ${c.status === 'new' && c.reason === 'excl' ? exclActs() : c.status === 'new' ? `<div class="cmp-acts"><button type="button" class="btn ghost sm" data-do="keep" title="Жалоба не подтвердилась — объявление остаётся">✓ Оставить</button>
        <button type="button" class="btn ghost sm" data-do="hide" title="Пропадёт у всех, будет в «🙈 Скрытые»">🙈 Скрыть</button>
        <button type="button" class="btn ghost sm cmp-del" data-do="del" title="Пропадёт у всех, ночная загрузка не вернёт">🗑 Удалить</button></div>` : ''}</div>`;
    box.innerHTML = `<style>
      .cmp-tabs { display: flex; gap: 6px; margin: 0 0 10px; } .cmp-row { padding: 10px 0; border-top: 1px solid var(--line); display: grid; gap: 4px; }
      .cmp-tag { display: inline-block; margin-left: 6px; padding: 1px 7px; border-radius: 999px; font-size: 12px; background: var(--soft); color: var(--muted); }
      .cmp-tag.hot { background: color-mix(in srgb, var(--bad) 12%, var(--card)); color: var(--bad); font-weight: 700; }
      .cmp-who { font-size: 13px; }
      .cmp-row { min-width: 0; } .cmp-acts .btn { white-space: normal; max-width: 100%; text-align: left; overflow-wrap: anywhere; }
      .xd-pair { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: 8px; align-items: stretch; }
      .xd-c span { min-width: 0; overflow-wrap: anywhere; } .xd-c { display: flex; gap: 8px; padding: 6px; border: 1px solid var(--line); border-radius: 10px; color: inherit; text-decoration: none; font-size: 13px; line-height: 1.35; min-width: 0; }
      .xd-c img, .xd-np { width: 64px; height: 64px; flex: none; object-fit: cover; border-radius: 8px; background: var(--soft); display: grid; place-items: center; font-size: 11px; color: var(--muted); }
      .xd-c small { display: block; font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
      .xd-eq { align-self: center; font-weight: 800; color: var(--muted); }
      @media (max-width: 640px) { .xd-pair { grid-template-columns: minmax(0, 1fr); } .xd-eq { display: none; } }
      .cmp-h2 { margin: 18px 0 6px; font-size: 16px; } .cmp-acts { display: flex; flex-wrap: wrap; gap: 6px; } .cmp-del:hover { background: var(--bad); color: #fff; border-color: var(--bad); }
    </style>
    <div class="cmp-tabs"><button type="button" class="seg${tab === 'new' ? ' on' : ''}" data-tab="new">Новые · ${r.counts?.new ?? 0}</button><button type="button" class="seg${tab === 'done' ? ' on' : ''}" data-tab="done">Решённые · ${r.counts?.done ?? 0}</button></div>
    <p class="muted">Участники жалуются внутри объявления. Объявление само не снимается — решаете вы; решение действует сразу по всем новым жалобам на этот объект.</p>
    ${r.items?.length ? r.items.map(row).join('') : `<p class="muted">${tab === 'new' ? 'Новых жалоб нет.' : 'Решённых жалоб пока нет.'}</p>`}
    <h3 class="cmp-h2">🔁 Дубли: эксклюзив ↔ собственник</h3><div class="xd-box"><p class="muted">Загрузка…</p></div>`;
    dups(box.querySelector('.xd-box'));
    box.onclick = async e => {
      if (e.target.closest('.xd-box')) return;
      const t = e.target.closest('[data-tab]');
      if (t) { tab = t.dataset.tab; return render(box); }
      const b = e.target.closest('[data-do]'); if (!b) return;
      const id = +b.closest('[data-id]').dataset.id, how = b.dataset.do, num = b.closest('.cmp-row').querySelector('b').textContent;
      if (how === 'excl' && !confirm(`Снять объявление ${num}? Сделайте это, только если договор действующий.`)) return;
      if (how === 'del' && !confirm(`Удалить объявление ${num}? Оно пропадёт у всех и не вернётся ночной загрузкой. Вернуть можно в «Скрытые» → «Удалённые».`)) return;
      b.closest('.cmp-acts').querySelectorAll('button').forEach(x => x.disabled = true);
      try { await H.web('admin_complaint', { id, do: how }); H.toast({ keep: `${num}: оставлено`, hide: `${num} скрыт`, del: `${num} удалён`, excl: `${num} снят — договор подтверждён`, dup: `${num} помечен дублем` }[how]); render(box); }
      catch (er) { H.toast(er.message, 5000); render(box); }
    };
  }
  return { render, count, badge };
})();
