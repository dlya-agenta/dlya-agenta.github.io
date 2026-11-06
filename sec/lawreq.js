// «⚖️ Проверка» (v5.38r, Алексей 06.11): в карточке объявления и в карточке клиента CRM юрист сразу даёт списки документов —
// объект: «для задатка» (первичный) и «для проверки и сделки»; клиент-покупатель: «для брони», «для задатка», «для сделки» (клиент-продавец — как объект).
// Галочки — что запросить (уже есть в пакете юриста — ✓ и без галочки), обстоятельства (ипотека, наследство, дети…) добавляют пункты.
// Текст сообщения собирается сам: «📋 Скопировать» (отправить самому) или «✉️ Запросить у собственника / клиента» — WhatsApp, Telegram, MAX (через приложение, msgapp.js).
// Ниже — файлы проверки, вывод и риск, «💬 Чат с проверкой» и «📎 Загрузить документы юристу» (hub.html#lawyer=docs:n<num> | docs:c<клиент>).
// Сервер — hub/lawreq.ts (lreq_obj, lreq_client, lreq_ctx, lreq_log); окно юриста — sec/law.js (LAWREQ.lawCtx, LAWREQ.panel).
window.LAWREQ = (() => {
  const H = () => window.HUB;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const digits = p => { const d = String(p ?? '').replace(/\D/g, ''); return /^8\d{10}$/.test(d) ? '7' + d.slice(1) : /^\d{10}$/.test(d) ? '7' + d : d; };
  const day = t => t ? new Date(t).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit' }) : '';
  const RISK = { low: ['🟢', 'низкий'], mid: ['🟡', 'средний'], high: ['🔴', 'высокий'] };
  const TO = { owner: 'собственнику', client: 'клиенту', self: 'скопировали' };
  const hub = location.pathname.endsWith('hub.html');
  const lawUrl = (tab, key) => `${hub ? '' : 'hub.html'}#lawyer=${tab}:${key}`;
  const css = () => document.getElementById('lq-css') || document.head.insertAdjacentHTML('beforeend', `<style id="lq-css">
    .lq-bg { position: fixed; inset: 0; z-index: 3500; background: rgba(10,14,22,.55); display: flex; align-items: flex-end; justify-content: center; }
    @media (min-width: 761px) { .lq-bg { align-items: center; padding: 24px; } }
    .lq { background: var(--card, #fff); color: var(--text, #111); width: min(720px, 100%); max-height: 92vh; display: flex; flex-direction: column; border-radius: 16px 16px 0 0; box-shadow: 0 20px 60px rgba(0,0,0,.35); }
    @media (min-width: 761px) { .lq { border-radius: 16px; } }
    .lq-h { display: flex; gap: 10px; align-items: flex-start; padding: 14px 16px 10px; border-bottom: 1px solid var(--line, rgba(127,127,127,.2)); }
    .lq-h b { font-size: 17px; display: block; } .lq-h small { color: var(--muted, #666); display: block; margin-top: 2px; overflow-wrap: anywhere; }
    .lq-h .x { margin-left: auto; border: 0; background: none; font-size: 22px; line-height: 1; cursor: pointer; color: inherit; padding: 2px 6px; }
    .lq-b { overflow: auto; padding: 12px 16px 16px; display: grid; gap: 12px; overscroll-behavior: contain; }
    .lq-tabs, .lq-fl, .lq-side { display: flex; flex-wrap: wrap; gap: 6px; }
    .lq-tab { border: 1px solid var(--line, rgba(127,127,127,.3)); background: none; color: inherit; border-radius: 999px; padding: 6px 12px; font: inherit; font-weight: 600; cursor: pointer; }
    .lq-tab.on { background: var(--accent, #1453d8); border-color: var(--accent, #1453d8); color: var(--accent-text, #fff); }
    .lq-fl .chip { font-size: 13px; } .lq-lab { font-size: 13px; color: var(--muted, #666); margin-right: 2px; align-self: center; }
    .lq-list { display: grid; gap: 4px; margin: 0; padding: 0; }
    .lq-it { display: grid; grid-template-columns: 22px 1fr; gap: 8px; align-items: start; padding: 7px 8px; border-radius: 10px; cursor: pointer; }
    .lq-it:hover { background: var(--soft, rgba(20,83,216,.06)); }
    .lq-it input { margin-top: 3px; width: 17px; height: 17px; }
    .lq-it span { min-width: 0; overflow-wrap: anywhere; line-height: 1.4; } .lq-it small { display: block; color: var(--muted, #666); }
    .lq-it.have { opacity: .78; } .lq-it .ok { color: #15803d; font-weight: 700; } html[data-theme="dark"] .lq-it .ok { color: #4ade80; }
    .lq-q { font-size: 12px; font-weight: 700; border-radius: 6px; padding: 0 5px; background: var(--soft, rgba(20,83,216,.08)); margin-right: 4px; }
    .lq textarea { width: 100%; box-sizing: border-box; font: inherit; font-size: 14px; border: 1px solid var(--line, rgba(127,127,127,.3)); border-radius: 10px; padding: 9px 10px; background: var(--bg, #f6f7f9); color: inherit; resize: vertical; }
    .lq-acts { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .lq-box { border: 1px solid var(--line, rgba(127,127,127,.25)); border-radius: 12px; padding: 10px 12px; display: grid; gap: 8px; }
    .lq-box h4 { margin: 0; font-size: 15px; } .lq-files { display: grid; gap: 4px; }
    .lq-f { display: flex; gap: 8px; align-items: center; justify-content: space-between; } .lq-f span { min-width: 0; overflow-wrap: anywhere; }
    .lq-muted { color: var(--muted, #666); font-size: 13px; margin: 0; }
    .lq-star { color: #c62828; font-size: 12.5px; margin: 0; }
    .lq-ctx { border: 1px dashed var(--accent, #1453d8); border-radius: 12px; padding: 10px 12px; display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; margin: 0 0 10px; }
    .lq-ctx b { flex: 1 1 240px; min-width: 0; overflow-wrap: anywhere; }
    .lq-line { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; }
    .lq-line .lq-muted { flex: 1 1 200px; }
    @media (max-width: 600px) { .lq-acts .btn { flex: 1 1 auto; text-align: center; } }
    .crm-obj:has([data-lq-obj]) { grid-template-columns: 64px minmax(0, 1fr) auto 32px; } .crm-obj [data-lq-obj] { padding: 4px 8px; min-width: 0; }
  </style>`);

  // ---------- окно ----------
  let M = null;   // {d (данные сервера), stage, flags, off (снятые галочки), on (поставленные), ctx {num|client_id, phone, opts}, el}
  function close() { M?.el?.remove(); M = null; document.removeEventListener('keydown', onKey); }
  const onKey = e => { if (e.key === 'Escape') close(); };
  async function openWith(load, ctx) {
    css(); close();
    const el = document.createElement('div');
    el.className = 'lq-bg';
    el.innerHTML = '<div class="lq" role="dialog" aria-modal="true" aria-label="Проверка юриста"><div class="lq-h"><div><b>⚖️ Проверка юриста</b><small>Готовлю списки документов…</small></div><button class="x" data-x aria-label="Закрыть">×</button></div><div class="lq-b"><p class="lq-muted">Загрузка…</p></div></div>';
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-x]')) close(); });
    document.addEventListener('keydown', onKey);
    M = { el, ctx, off: new Set(), on: new Set() };
    el.querySelector('.lq').addEventListener('click', onClick);
    el.querySelector('.lq').addEventListener('change', onChange);
    el.querySelector('.lq').addEventListener('input', e => { if (e.target.matches('[data-msg]')) M.edited = true; });
    try { M.d = await load(); } catch (e) {
      if (e?.code === 'limit' && window.LAWR?.fail) { close(); return window.LAWR.fail(e); }
      el.querySelector('.lq-b').innerHTML = `<p class="err">${esc(e.message)}</p>`; return;
    }
    M.stage = Object.keys(M.d.stages)[0];
    M.flags = { ...(M.d.flags ?? {}) };
    if (M.ctx.phone) M.d.phone ??= M.ctx.phone;
    if (M.ctx.tg) M.d.tg = M.ctx.tg;
    draw();
  }
  const seller = () => M.d.kind === 'obj' || M.d.side === 'seller';
  const whom = () => M.d.kind === 'obj' ? 'собственника' : 'клиента';
  const shown = () => (M.d.lists[M.stage] ?? []).filter(i => !i.when || i.when.some(f => M.flags[f]));
  const picked = i => M.on.has(i.id) || (!i.have && !M.off.has(i.id));
  function text() {
    const its = shown().filter(picked), docs = its.filter(i => !i.q), qs = its.filter(i => i.q), d = M.d, a = d.agent ?? {};
    const name = d.kind === 'obj' ? (d.owner || '') : (d.name || '');
    const me = `${a.name || 'агент по недвижимости'}${a.company ? ` (${a.company})` : ''}`;
    const st = d.stages[M.stage];
    const what = d.kind === 'obj' ? `по вашему объявлению: ${d.what}` : M.obj ? `по объекту: ${M.obj}` : '';
    const goal = d.kind === 'obj' || d.side === 'seller'
      ? (M.stage === 'deal' ? 'Чтобы проверить объект и подготовить сделку' : 'Чтобы подготовить договор задатка и проверить объект до передачи денег')
      : `Чтобы подготовить документы ${st}`;
    if (!docs.length && !qs.length) return '';
    return [`Здравствуйте${name ? `, ${name}` : ''}! Это ${me}${what ? `, ${what}` : ''}.`,
      docs.length ? `${goal}, пришлите, пожалуйста, фото или сканы:\n${docs.map((i, k) => `${k + 1}. ${i.t}${i.where && seller() ? ` (${i.where})` : ''}`).join('\n')}` : `${goal}, подскажите, пожалуйста:`,
      qs.length ? `${docs.length ? 'И подскажите:\n' : ''}${qs.map(i => `• ${i.t}`).join('\n')}` : '',
      'Можно прямо сюда, в этот чат. Спасибо!'].filter(Boolean).join('\n\n');
  }
  function draw() {
    const d = M.d, st = Object.entries(d.stages), its = shown(), n = its.filter(picked).length, have = its.filter(i => i.have).length;
    const head = d.kind === 'obj' ? `Объект № ${d.num}` : `Клиент: ${d.name || d.phone || 'без имени'}`;
    M.el.querySelector('.lq-h div').innerHTML = `<b>⚖️ Проверка юриста — ${esc(head)}</b><small>${esc(d.kind === 'obj' ? d.what : seller() ? 'документы продавца' : 'документы покупателя')}</small>`;
    const ph = digits(d.phone), t = M.edited ? M.el.querySelector('[data-msg]')?.value ?? text() : text();
    const fl = Object.entries(d.flag_names ?? {});
    M.el.querySelector('.lq-b').innerHTML = `
      ${d.kind === 'client' ? `<div class="lq-side" role="radiogroup" aria-label="Кто клиент">${[['buyer', '🧑 Покупатель'], ['seller', '🏠 Продавец']].map(([k, v]) =>
        `<button type="button" class="lq-tab${d.side === k ? ' on' : ''}" data-side="${k}" role="radio" aria-checked="${d.side === k}">${v}</button>`).join('')}</div>` : ''}
      <div class="lq-tabs" role="tablist">${st.map(([k, v]) => `<button type="button" role="tab" class="lq-tab${M.stage === k ? ' on' : ''}" data-stage="${k}" aria-selected="${M.stage === k}">📋 ${esc(v[0].toUpperCase() + v.slice(1))}</button>`).join('')}</div>
      ${fl.length ? `<div class="lq-fl"><span class="lq-lab">Обстоятельства:</span>${fl.map(([k, v]) => `<button type="button" class="chip${M.flags[k] ? ' on' : ''}" data-flag="${k}" aria-pressed="${!!M.flags[k]}">${M.flags[k] ? '✓ ' : ''}${esc(v)}</button>`).join('')}</div>` : ''}
      <div class="lq-list">${its.map(i => `<label class="lq-it${i.have ? ' have' : ''}"><input type="checkbox" data-it="${esc(i.id)}"${picked(i) ? ' checked' : ''}>
        <span>${i.q ? '<i class="lq-q">уточнить</i>' : ''}${esc(i.t)}${i.have ? ` <span class="ok">✓ есть: ${esc(i.have)}</span>` : ''}
        ${i.why || i.where ? `<small>${esc([i.why, i.where && `где взять: ${i.where}`].filter(Boolean).join(' · '))}</small>` : ''}</span></label>`).join('')}</div>
      <p class="lq-muted">Отмечено: ${n} из ${its.length}${have ? ` · уже есть в проверке: ${have}` : ''}. Галочка — запросить; снимите, что не нужно.</p>
      ${d.kind === 'client' && d.objs?.length && !seller() ? `<label class="lq-muted">Объект в сообщении <select data-objpick><option value="">— не указывать —</option>${d.objs.map(o => `<option value="${esc(o.what)}"${M.obj === o.what ? ' selected' : ''}>№ ${o.num} · ${esc(o.what)}</option>`).join('')}</select></label>` : ''}
      <textarea data-msg rows="8" aria-label="Текст сообщения">${esc(t)}</textarea>
      <div class="lq-acts">${contact(ph)}<button type="button" class="btn soft" data-copy>📋 Скопировать — отправлю сам</button></div>
      ${d.reqs?.length ? `<p class="lq-muted">Запрашивали: ${d.reqs.slice(0, 3).map(r => `${day(r.at)} — ${esc(d.stages[r.stage] ?? r.stage)}, ${r.n} пункт.${r.to !== 'self' ? ` (${TO[r.to]})` : ''}`).join(' · ')}</p>` : ''}
      ${filesBox(d)}
      ${d.kind === 'client' && d.objs?.length ? `<div class="lq-box"><h4>🏠 Объекты клиента — в проверку</h4>${d.objs.map(o => `<div class="lq-f"><span>№ ${o.num} · ${esc(o.what)}${o.law ? ' · <b>⚖️ в проверке</b>' : ''}</span>
        <button type="button" class="btn ghost sm" data-objcheck="${o.num}">⚖️ Проверка объекта</button></div>`).join('')}<p class="lq-muted">У объекта — свои списки и свой пакет юриста; оттуда же — запрос документов собственнику.</p></div>` : ''}
      <p class="lq-star">${esc(d.star ?? '* Перед сделкой обязательна проверка реального юриста и ипотечного брокера')}</p>`;
  }
  function contact(ph) {
    const d = M.d, who = d.kind === 'obj' ? 'собственника' : 'клиента';
    if (ph) return `<a class="btn primary" data-send="wa" href="https://wa.me/${ph}?text=${encodeURIComponent(M.el?.querySelector('[data-msg]')?.value ?? text())}" target="_blank" rel="noopener">✉️ Запросить у ${who} — WhatsApp</a>
      <a class="btn soft" data-send="tg" href="https://t.me/+${ph}" target="_blank" rel="noopener" title="Текст скопируется — вставьте в чат">Telegram</a>
      <a class="btn soft" data-send="max" href="${innerWidth <= 760 ? 'max://' : 'https://web.max.ru/'}" target="_blank" rel="noopener" data-max="${ph}" title="Текст скопируется — найдите контакт в MAX и вставьте">MAX</a>`;
    if (d.tg) return `<a class="btn primary" data-send="tg" href="https://t.me/${encodeURIComponent(d.tg)}" target="_blank" rel="noopener" title="Текст скопируется — вставьте в чат">✉️ Запросить у ${who} — Telegram</a>`;
    if (d.kind === 'obj' && M.ctx.phone_fn) return `<button type="button" class="btn primary" data-getphone>📞 Узнать телефон собственника, чтобы запросить</button>`;
    if (d.kind === 'obj') return `<a class="btn soft" href="${hub ? './' : ''}#o=${d.num}" data-x>📞 Откройте телефон в объявлении — и запросите отсюда</a>`;
    return '<span class="lq-muted">У клиента нет телефона — добавьте его в карточке («Изменить»).</span>';
  }
  function filesBox(d) {
    const b = d.batch, key = d.kind === 'obj' ? `n${d.num}` : `c${d.client_id}`;
    const acts = `<div class="lq-acts"><a class="btn primary" href="${lawUrl('docs', key)}">📎 ${b ? 'Догрузить документы юристу' : 'Загрузить документы юристу'}</a>${b ? `<a class="btn soft" href="${lawUrl('ask', key)}">💬 Чат с проверкой</a>` : ''}</div>`;
    if (!b) return `<div class="lq-box"><h4>📎 Файлы проверки</h4><p class="lq-muted">Собственник прислал документы — загрузите их юристу: он прочитает, отметит здесь, что уже есть, и проверит ${d.kind === 'obj' ? 'объект и собственника' : 'документы'} по открытым источникам.</p>${acts}</div>`;
    const r = b.report, rk = r ? RISK[r.risk] ?? RISK.mid : null;
    return `<div class="lq-box"><h4>📎 Файлы проверки · ${b.docs.length}</h4>
      <div class="lq-files">${b.docs.map(f => `<div class="lq-f"><span>${/^image\//.test(f.mime ?? '') ? '🖼' : '📄'} ${esc(f.kind || f.name)}${f.kind ? ` <small class="lq-muted">${esc(f.name)}</small>` : ' <small class="lq-muted">не прочитан</small>'}</span>
        <button type="button" class="btn ghost sm" data-fopen="${f.id}">Открыть</button></div>`).join('') || '<p class="lq-muted">Файлов нет.</p>'}</div>
      ${b.summary ? `<p class="lq-muted">${esc(b.summary)}</p>` : ''}
      ${r ? `<p><b>${rk[0]} Проверка ${r.kind === 'owner' ? 'собственника' : 'объекта'} ${day(r.at)}: риск ${rk[1]}</b><br><span class="lq-muted">${esc(String(r.summary ?? '').slice(0, 300))}</span></p>` : '<p class="lq-muted">Проверки ещё не было — откройте «Догрузить документы юристу» и нажмите «🔎 Проверить».</p>'}
      ${b.missing?.length ? `<p class="lq-muted">⚠️ Юрист просит: ${esc(b.missing.map(m => m.name ?? m).join('; '))}</p>` : ''}${acts}</div>`;
  }
  async function logReq(to) {
    const d = M.d, ids = shown().filter(picked).map(i => i.id);
    try { const r = await H().call('lreq_log', { ...(d.kind === 'obj' ? { num: d.num } : { client_id: d.client_id }), side: seller() ? 'seller' : 'buyer', stage: M.stage, items: ids, to }); d.reqs = r.reqs; } catch { /* журнал — не главное */ }
  }
  async function onClick(e) {
    const t = e.target, d = M?.d; if (!d) return;
    const sg = t.closest('[data-stage]'); if (sg) { M.stage = sg.dataset.stage; M.edited = false; M.off.clear(); M.on.clear(); return draw(); }
    const fl = t.closest('[data-flag]'); if (fl) { M.flags[fl.dataset.flag] = !M.flags[fl.dataset.flag]; M.edited = false; return draw(); }
    const sd = t.closest('[data-side]');
    if (sd && sd.dataset.side !== d.side) {
      try { localStorage.setItem(`lqSide:${d.client_id}`, sd.dataset.side); } catch { /* */ }
      const ctx = M.ctx; return openWith(() => H().call('lreq_client', { client_id: d.client_id, side: sd.dataset.side }), ctx);
    }
    if (t.closest('[data-copy]')) { const v = M.el.querySelector('[data-msg]').value; if (!v.trim()) return H().toast('Нечего копировать — отметьте пункты'); await H().copy(v, 'Текст скопирован — отправьте сами'); logReq('self'); return; }
    const sn = t.closest('[data-send]');
    if (sn) {
      const v = M.el.querySelector('[data-msg]').value;
      if (!v.trim()) { e.preventDefault(); return H().toast('Отметьте, что запросить'); }
      if (sn.dataset.send === 'wa') sn.href = sn.href.replace(/\?text=.*$/, `?text=${encodeURIComponent(v)}`);
      else { try { await navigator.clipboard.writeText(v); H().toast('Текст скопирован — вставьте его в чат', 5000); } catch { /* */ } }
      logReq(d.kind === 'obj' ? 'owner' : 'client');
      return;
    }
    if (t.closest('[data-getphone]')) {
      const b = t.closest('[data-getphone]'); b.disabled = true; b.textContent = 'Узнаю номер…';
      try { const p = await M.ctx.phone_fn(); d.phone = p?.phone ?? null; d.owner ??= p?.owner ?? null; if (p?.tg) d.tg = p.tg; draw(); if (!d.phone && !d.tg) H().toast('Номер пока не найден', 5000); }
      catch (er) { H().toast(er.message, 6000); b.disabled = false; b.textContent = '📞 Узнать телефон собственника, чтобы запросить'; }
      return;
    }
    const fo = t.closest('[data-fopen]');
    if (fo) { try { const r = await H().call('law_doc_url', { id: +fo.dataset.fopen }); window.open(r.url, '_blank', 'noopener'); } catch (er) { H().toast(er.message, 5000); } return; }
    const oc = t.closest('[data-objcheck]'); if (oc) return obj({ num: +oc.dataset.objcheck });
    if (t.closest('a[href*="#lawyer="]') && hub) close();   // на hub.html — переход внутри страницы
  }
  function onChange(e) {
    const it = e.target.closest('[data-it]');
    if (it) { const i = shown().find(x => x.id === it.dataset.it); if (i) { if (it.checked) { M.on.add(i.id); M.off.delete(i.id); } else { M.off.add(i.id); M.on.delete(i.id); } } M.edited = false; return draw(); }
    if (e.target.matches('[data-objpick]')) { M.obj = e.target.value; M.edited = false; return draw(); }
  }

  // ---------- снаружи ----------
  // объект: x — объявление (num, phone, tg), o.phone — функция «открыть телефон» (из app.js, по тарифу)
  function obj(x, o = {}) { const num = +x?.num; if (!num) return; return openWith(() => H().call('lreq_obj', { num }), { num, phone: x.phone, tg: x.tg, phone_fn: o.phone }); }
  function client(id) { let side; try { side = localStorage.getItem(`lqSide:${id}`) || undefined; } catch { /* */ } return openWith(() => H().call('lreq_client', { client_id: id, side }), { client_id: id }); }
  // строка в карточке клиента CRM: «⚖️ Документы и проверка» + файлы/риск, если есть
  async function clientLine(box, c) {
    if (!box || !c?.id || !H()) return;
    css();
    const btns = `<button type="button" class="btn primary" data-lq-client>⚖️ Документы и проверка</button>`;
    box.innerHTML = `<div class="crm-h"><b>⚖️ Документы и проверка юриста</b></div><div class="lq-line">${btns}<span class="lq-muted">Списки для брони, задатка и сделки — и запрос клиенту в мессенджер.</span></div>`;
    box.onclick = e => { if (e.target.closest('[data-lq-client]')) client(c.id); };
    try {
      const d = await H().call('lreq_client', { client_id: c.id });
      if (!document.body.contains(box)) return;
      const b = d.batch, r = b?.report, rk = r ? RISK[r.risk] ?? RISK.mid : null, lastReq = d.reqs?.[0];
      const info = [b ? `📎 файлов в проверке: ${b.docs.length}` : '', rk ? `${rk[0]} риск ${rk[1]} (${day(r.at)})` : '', lastReq ? `запрошено ${day(lastReq.at)}` : ''].filter(Boolean).join(' · ');
      box.querySelector('.lq-line').innerHTML = `${btns}${b ? `<a class="btn soft" href="${lawUrl('ask', `c${c.id}`)}">💬 Чат с проверкой</a>` : ''}<span class="lq-muted">${esc(info || 'Списки для брони, задатка и сделки — и запрос клиенту в мессенджер.')}</span>`;
    } catch { /* нет доступа (Main, гость) — остаётся кнопка */ }
  }

  // окно юриста (sec/law.js): arg «docs:n123» → {batch_id, ctx}
  async function lawCtx(key) { return H().call('lreq_ctx', { key }); }
  function panel(S) {
    const c = S.ctx ?? (S.batch?.num ? { num: S.batch.num, side: 'seller', title: `Объект № ${S.batch.num}` } : S.batch?.client_id ? { client_id: S.batch.client_id, side: S.batch.side, title: 'Клиент из CRM' } : null);
    if (!c) return '';
    css();
    return `<div class="lq-ctx"><b>🎯 ${esc(c.title)} · ${c.side === 'buyer' ? 'документы покупателя' : 'документы продавца'}</b>
      <button type="button" class="btn soft" data-lq-panel>📋 Что запросить${c.num ? ' у собственника' : ' у клиента'}</button>${c.num ? `<a class="btn ghost" href="./#o=${c.num}" target="_blank" rel="noopener">Открыть объект</a>` : ''}</div>`;
  }
  function bind(p, S) {
    if (!p || p._lq) return;
    p._lq = true;
    p.addEventListener('click', e => {
      if (!e.target.closest('[data-lq-panel]')) return;
      const c = S.ctx ?? (S.batch?.num ? { num: S.batch.num } : { client_id: S.batch?.client_id });
      if (c.num) obj({ num: c.num }); else if (c.client_id) client(c.client_id);
    });
  }
  return { obj, client, clientLine, lawCtx, panel, bind, close };
})();
