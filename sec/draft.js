// v5.38: «📝 Составить документы» — конструктор документов сделки (ПДКП, задаток, аванс, бронь, ДКП, акт, расписка, допсоглашения, расторжение…).
// window.DRAFT.mount(el, {batch?, deal_id?, role, pre?}) — во вкладке юриста «📎 Документы и проверка» (sec/law.js) и в «Сделке» (sec/deal.js).
// Галочки шаблонов → поля только нужных шаблонов (стороны, объект, деньги, сроки) с подсказками и проверкой на месте; суммы прописью и расчёты — кодом;
// «🤖 Заполнить пустое по документам» — ИИ предлагает только пустые поля (жёлтые — проверить); «📄 Составить» — PDF и Word по одному шаблону за запрос.
// Сервер — hub/law.ts (law_drf_*), справочник — hub/drafts_kb.ts. Пустое поле в документе — строка «____» (лучше пусто, чем выдумка).
(() => {
  const H = window.HUB, esc = H.esc;
  if (!document.getElementById('drf-css')) document.head.insertAdjacentHTML('beforeend', `<style id="drf-css">
    .drf { display: grid; gap: 12px; min-width: 0; }
    #lw-drf, #d-drf, .drf-res, .drf-form { scroll-margin-top: 110px; }
    .drf > * { min-width: 0; }
    .drf-src-hint { margin: 0; padding: 8px 12px; border-radius: 10px; background: var(--soft, rgba(20,83,216,.08)); font-size: 14px; }
    .drf-tg { display: grid; gap: 6px; }
    .drf-tg > b { font-size: 13.5px; color: var(--muted); font-weight: 600; }
    .drf-chips { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 8px; }
    .drf-chip { position: relative; display: flex; gap: 8px; align-items: flex-start; border: 1px solid var(--line); border-radius: 12px; padding: 9px 11px; cursor: pointer; background: var(--card); min-width: 0; }
    .drf-chip input { margin: 3px 0 0; flex: none; width: 18px; height: 18px; accent-color: var(--accent); }
    .drf-chip span { display: grid; gap: 2px; min-width: 0; }
    .drf-chip b { font-size: 14.5px; line-height: 1.25; }
    .drf-chip small { font-size: 12.5px; line-height: 1.3; color: var(--muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .drf-chip.on small { -webkit-line-clamp: 6; }
    .drf-chip i { font-style: normal; font-size: 11.5px; color: var(--muted); opacity: .8; }
    .drf-chip.on { border-color: var(--accent); background: var(--soft, rgba(20,83,216,.08)); box-shadow: inset 0 0 0 1px var(--accent); }
    .drf-chip.done i::after { content: ' · ✓ составлен'; font-weight: 700; color: #15803d; opacity: 1; }
    .drf-none { margin: 0; padding: 10px 12px; border: 1px dashed var(--line); border-radius: 10px; color: var(--muted); }
    .drf-form { display: grid; gap: 12px; }
    .drf-grp { border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; display: grid; gap: 8px; min-width: 0; }
    .drf-grp > h4 { margin: 0; font-size: 15px; }
    .drf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; }
    .drf-f { display: grid; gap: 3px; min-width: 0; align-content: start; }
    .drf-f.wide { grid-column: 1 / -1; }
    .drf-l { font-size: 13px; font-weight: 600; display: flex; flex-wrap: wrap; gap: 4px 6px; align-items: center; }
    .drf-f input, .drf-f select, .drf-f textarea { width: 100%; box-sizing: border-box; font-size: 15px; }
    .drf-f textarea { min-height: 60px; resize: vertical; }
    .drf-h { font-size: 12px; color: var(--muted); line-height: 1.3; }
    .drf-w { font-size: 12px; color: var(--accent); line-height: 1.3; }
    .drf-msg { font-size: 12.5px; line-height: 1.3; }
    .drf-msg:empty { display: none; }
    .drf-f.err input, .drf-f.err select, .drf-f.err textarea { border-color: #dc2626; }
    .drf-f.err .drf-msg { color: #dc2626; }
    .drf-f.warn .drf-msg { color: #b45309; }
    .drf-f.warn input, .drf-f.warn textarea { border-color: #d97706; }
    .drf-src { font-style: normal; font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: 999px; background: color-mix(in srgb, var(--text) 8%, transparent); color: var(--muted); white-space: nowrap; }
    .drf-src.s-docs { background: rgba(22,163,74,.13); color: #15803d; }
    .drf-src.s-deal { background: rgba(20,83,216,.12); color: var(--accent); }
    .drf-src.s-ai { background: rgba(234,179,8,.22); color: #92400e; }
    .drf-f.ai input, .drf-f.ai textarea, .drf-f.ai select { background: rgba(234,179,8,.10); border-color: rgba(202,138,4,.6); }
    .drf-f.filled { animation: drf-flash 2.4s ease-out 1; }
    @keyframes drf-flash { 0% { box-shadow: 0 0 0 3px rgba(234,179,8,.6); border-radius: 10px; } 100% { box-shadow: 0 0 0 0 transparent; } }
    .drf-p { border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; display: grid; gap: 6px; background: color-mix(in srgb, var(--text) 2%, var(--card)); }
    .drf-ph { display: flex; gap: 8px; align-items: center; }
    .drf-ph b { flex: 1; font-size: 14px; }
    .drf-p details summary { cursor: pointer; font-size: 13px; color: var(--accent); }
    .drf-p details[open] summary { margin-bottom: 6px; }
    .drf-calc { display: flex; flex-wrap: wrap; gap: 6px 10px; margin: 0; }
    .drf-calc span { font-size: 13.5px; padding: 5px 10px; border-radius: 999px; background: var(--soft, rgba(20,83,216,.08)); }
    .drf-acts { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 0; }
    .drf-acts .btn { white-space: normal; }
    .drf-prog { margin: 0; font-size: 14px; }
    .drf-res { display: grid; gap: 6px; }
    .drf-row { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; padding: 8px 10px; border: 1px solid var(--line); border-radius: 10px; }
    .drf-row > b { flex: 1 1 200px; min-width: 0; overflow-wrap: anywhere; font-size: 14px; }
    .drf-row small { color: var(--muted); font-size: 12.5px; }
    .drf-row .drf-empty { color: #b45309; }
    .drf-ask { border-top: 1px solid var(--line); padding-top: 10px; display: grid; gap: 8px; }
    .drf-ask h4 { margin: 0; font-size: 15px; }
    .drf-ask-in { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
    .drf-ask select, .drf-ask textarea { width: 100%; box-sizing: border-box; font-size: 15px; }
    .drf-ans .hub-msg { max-width: none; }
    @media (prefers-color-scheme: dark) {
      .drf-src.s-docs, .drf-chip.done i::after { color: #4ade80; } .drf-src.s-ai { color: #fcd34d; } .drf-f.warn .drf-msg, .drf-row .drf-empty { color: #fbbf24; } .drf-f.err .drf-msg { color: #fca5a5; }
    }
    html[data-theme="dark"] .drf-src.s-docs, html[data-theme="dark"] .drf-chip.done i::after { color: #4ade80; } html[data-theme="dark"] .drf-src.s-ai { color: #fcd34d; }
    html[data-theme="dark"] .drf-f.warn .drf-msg, html[data-theme="dark"] .drf-row .drf-empty { color: #fbbf24; } html[data-theme="dark"] .drf-f.err .drf-msg { color: #fca5a5; }
    @media (max-width: 640px) { .drf-grid { grid-template-columns: 1fr; } .drf-chips { grid-template-columns: 1fr; } .drf-acts .btn { flex: 1 1 100%; } }
  </style>`);

  // ---------- суммы прописью (как drafts_kb.ts на сервере) ----------
  const U = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'], UF = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
  const T = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
  const DZ = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
  const SS = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];
  const plural = (n, a, b, c) => { const m = n % 100, k = n % 10; return m >= 11 && m <= 14 ? c : k === 1 ? a : k >= 2 && k <= 4 ? b : c; };
  const tri = (n, fem) => { const h = Math.floor(n / 100), d = Math.floor(n / 10) % 10, u = n % 10; return [SS[h], d === 1 ? T[u] : DZ[d], d === 1 ? '' : (fem ? UF : U)[u]].filter(Boolean).join(' '); };
  function words(n) {
    n = Math.floor(Math.abs(Number(n) || 0));
    if (!n) return 'ноль';
    const parts = [];
    for (const [v, a, b, c, f] of [[1e9, 'миллиард', 'миллиарда', 'миллиардов', false], [1e6, 'миллион', 'миллиона', 'миллионов', false], [1e3, 'тысяча', 'тысячи', 'тысяч', true]]) {
      const k = Math.floor(n / v) % 1000; if (k) parts.push(tri(k, f), plural(k, a, b, c));
    }
    if (n % 1000) parts.push(tri(n % 1000, false));
    return parts.join(' ');
  }
  const grp = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  function rub(n) {
    n = Number(n) || 0;
    const r = Math.floor(n), k = Math.round((n - r) * 100);
    return `${grp(r)} (${words(r)}) ${plural(r, 'рубль', 'рубля', 'рублей')} ${String(k).padStart(2, '0')} ${plural(k, 'копейка', 'копейки', 'копеек')}`;
  }
  const money = v => { const n = Number(String(v ?? '').replace(/[\s  ]/g, '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0; };
  const rubShort = n => `${grp(Math.round(n))} ₽`;
  const pdate = v => { const m = String(v ?? '').trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); if (!m) return null; const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], 12)); return d.getUTCDate() === +m[1] && d.getUTCMonth() === +m[2] - 1 ? d : null; };

  // ---------- проверка на месте (сервер проверяет ещё раз — problems) ----------
  function fmt(type, key, v) {
    v = String(v ?? '');
    if (type === 'money') { const d = v.replace(/[^\d.,]/g, ''); const [a, b] = d.split(/[.,]/); return a ? grp(a.replace(/^0+(?=\d)/, '')) + (b != null ? ',' + b.slice(0, 2) : '') : ''; }
    if (key === 'pass' || key === 'sp_pass') { const d = v.replace(/\D/g, ''); return d.length === 10 ? `${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4)}` : v; }
    if (key === 'pass_code') { const d = v.replace(/\D/g, ''); return d.length === 6 ? `${d.slice(0, 3)}-${d.slice(3)}` : v; }
    if (type === 'date') { const d = v.replace(/[^\d]/g, ''); if (/^\d{8}$/.test(d)) return `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4)}`; return v.replace(/[/,\-\s]/g, '.'); }
    return v;
  }
  function bad(type, key, v) {
    v = String(v ?? '').trim();
    if (!v) return '';
    if (type === 'date' && !pdate(v)) return 'Дата — в виде дд.мм.гггг';
    if (type === 'money' && !money(v)) return 'Сумма — числом в рублях, например 5 000 000';
    if (type === 'cad' && !/^\d{2}:\d{2}:\d{6,7}:\d{1,7}$/.test(v)) return 'Кадастровый номер — вида 23:49:0302008:2005';
    if ((type === 'int' || type === 'area') && !(Number(v.replace(',', '.')) > 0)) return 'Нужно число больше нуля';
    if ((key === 'pass' || key === 'sp_pass') && v.replace(/\D/g, '').length !== 10) return 'Паспорт — 10 цифр: серия (4) и номер (6)';
    if (key === 'pass_code' && !/^\d{3}-?\d{3}$/.test(v)) return 'Код подразделения — вида 230-001';
    return '';
  }

  // ---------- справочник (один раз на страницу) ----------
  let kbP = null;
  const kbGet = () => (kbP ??= H.call('law_drf_kb').catch(e => { kbP = null; throw e; }));
  const fail = e => (window.LAWR?.fail ?? (x => H.toast(x?.message ?? String(x), 6000)))(e);
  const SRC = { docs: ['s-docs', '📄 из документов'], deal: ['s-deal', '📑 из сделки'], ai: ['s-ai', '🤖 ИИ — проверьте'], def: ['s-def', 'по умолчанию'] };
  const PMAIN = ['name'];
  const live = new Set();   // смонтированные блоки — сохранить несохранённое перед новым монтированием

  async function mount(el, opt = {}) {
    for (const m of live) if (m.dirty) m.flush();
    el.innerHTML = '<p class="muted">📝 Загружаем конструктор документов…</p>';
    let kb, d;
    try {
      [kb, { draft: d }] = await Promise.all([kbGet(), H.call('law_drf_get', { batch: opt.batch || undefined, deal_id: opt.deal_id || undefined, role: opt.role || 'lawyer' })]);
    } catch (e) { el.innerHTML = `<p class="err">📝 Конструктор документов не загрузился: ${esc(e.message)}</p>`; return null; }
    const M = { el, opt, kb, d, sel: new Set(d.tpls ?? []), filled: new Set(), edited: new Set(), res: {}, dirty: false, timer: null, busy: null };
    d.vals ??= {}; d.sellers = d.sellers?.length ? d.sellers : [{}]; d.buyers = d.buyers?.length ? d.buyers : [{}]; d.from ??= {}; d.files ??= {};
    const pre = (opt.pre ?? []).filter(id => kb.tpls.some(t => t.id === id));
    if (pre.some(id => !M.sel.has(id))) { pre.forEach(id => M.sel.add(id)); M.dirty = true; }
    M.flush = () => save(M);
    live.add(M);
    el._drf = M;
    draw(M);
    if (M.dirty) save(M);
    return M;
  }

  const tplOf = (M, id) => M.kb.tpls.find(t => t.id === id);
  const selTpls = M => M.kb.tpls.filter(t => M.sel.has(t.id));
  function usedFields(M) {
    const set = new Set();
    for (const t of selTpls(M)) for (const f of t.fields) set.add(f);
    return Object.keys(M.kb.fields).filter(k => set.has(k));
  }
  const needParty = (M, p) => selTpls(M).some(t => (t.parties ?? []).includes(p));

  function draw(M) {
    const { kb, d } = M;
    const groups = Object.entries(kb.tgroups).map(([g, title]) => {
      const ts = kb.tpls.filter(t => t.group === g);
      return ts.length ? `<div class="drf-tg"><b>${esc(title)}</b><div class="drf-chips">${ts.map(t => `<label class="drf-chip${M.sel.has(t.id) ? ' on' : ''}${d.files[t.id] ? ' done' : ''}" title="${esc(t.note ?? t.when)}">
        <input type="checkbox" data-tpl="${esc(t.id)}"${M.sel.has(t.id) ? ' checked' : ''}><span><b>${esc(t.name)}</b><small>${esc(t.when)}</small><i>${esc(t.law)}</i></span></label>`).join('')}</div></div>` : '';
    }).join('');
    M.el.innerHTML = `<div class="drf">
      <p class="hint">Отметьте, что составить — ниже появятся только нужные поля. Данные подставляются из загруженных документов${d.deal_id ? ' и сделки' : ''}; чего нет — впишите сами. Пустое поле в документе останется строкой «____» — лучше пусто, чем выдумка.</p>
      ${d.src && !d.src.facts ? `<p class="drf-src-hint">📎 ФИО и кадастровый номер подставятся из загруженных документов: ${d.deal_id ? 'загрузите документы сделки и нажмите «📖 Подставить из документов»' : 'загрузите их выше'}.</p>` : ''}
      ${groups}
      <div class="drf-form" data-form></div>
      <p class="drf-calc" data-calc></p>
      <p class="drf-acts">
        <button type="button" class="btn soft" data-fill>🤖 Заполнить пустое по документам</button>
        <button type="button" class="btn ghost" data-refresh>📖 Подставить из документов</button>
        <button type="button" class="btn primary" data-make>📄 Составить PDF и Word</button></p>
      <p class="drf-prog hint" data-prog hidden></p>
      <div class="drf-res" data-res></div>
      <div class="drf-ask" data-askbox></div>
      ${H.star()}</div>`;
    const root = M.el.querySelector('.drf');
    root.addEventListener('change', e => onChange(M, e));
    root.addEventListener('input', e => onInput(M, e));
    root.addEventListener('focusout', e => onBlur(M, e));
    root.addEventListener('click', e => onClick(M, e));
    drawForm(M); drawCalc(M); drawRes(M); drawAsk(M); showProblems(M);
  }

  function fieldHtml(M, k, f, val, key, src) {
    const id = `drf-${Math.random().toString(36).slice(2, 9)}`, s = SRC[src];
    if (val && f.type !== 'select' && f.type !== 'textarea') val = fmt(f.type, k, val);
    const attr = `id="${id}" data-k="${esc(key)}" data-t="${esc(f.type)}"${f.ph ? ` placeholder="${esc(f.ph)}"` : f.type === 'date' ? ' placeholder="дд.мм.гггг"' : ''}`;
    let inp;
    if (f.type === 'select') inp = `<select ${attr}>${(f.opts ?? []).map(o => `<option${o === val ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    else if (f.type === 'textarea') inp = `<textarea ${attr} rows="2" maxlength="2000">${esc(val)}</textarea>`;
    else inp = `<input ${attr} value="${esc(val)}" maxlength="${f.type === 'text' ? 400 : 40}"${['money', 'int', 'area', 'date'].includes(f.type) ? ' inputmode="decimal"' : ''}${k === 'pass' || k === 'sp_pass' || k === 'pass_code' ? ' inputmode="numeric"' : ''} autocomplete="off">`;
    const wide = f.type === 'textarea' || k === 'rep' || k === 'addr' || k === 'o_addr';
    return `<div class="drf-f${wide ? ' wide' : ''}${src === 'ai' ? ' ai' : ''}${M.filled.has(key) ? ' filled' : ''}" data-fk="${esc(key)}">
      <label class="drf-l" for="${id}">${esc(f.label)}${s ? ` <em class="drf-src ${s[0]}">${s[1]}</em>` : ''}</label>${inp}
      ${f.type === 'money' ? `<small class="drf-w" data-w>${money(val) ? esc(rub(money(val))) : ''}</small>` : ''}
      ${f.hint ? `<small class="drf-h">${esc(f.hint)}</small>` : ''}<small class="drf-msg" data-msg></small></div>`;
  }
  function partyHtml(M, p, i, x) {
    const { pfields } = M.kb, title = p === 'S' ? 'Продавец' : 'Покупатель', from = M.d.from;
    const f = (k) => fieldHtml(M, k, pfields[k], x[k] ?? '', `${p}${i}.${k}`, from[`${p}${i}.${k}`]);
    const rest = Object.keys(pfields).filter(k => !PMAIN.includes(k));
    const anyErr = rest.some(k => (M.d.problems ?? []).some(q => q.key === `${p}${i}.${k}`));
    return `<div class="drf-p" data-party="${p}" data-i="${i}"><div class="drf-ph"><b>${title} ${i + 1}</b>
        ${i > 0 ? `<button type="button" class="btn ghost bad" data-prm="${p}${i}" aria-label="Убрать: ${title} ${i + 1}">✕</button>` : ''}</div>
      ${f('name')}
      <details${anyErr || M.openP?.has(`${p}${i}`) ? ' open' : ''} data-pd="${p}${i}"><summary>Паспорт, адрес, доля${x.pass ? ' · паспорт ✓' : ''}</summary><div class="drf-grid">${rest.map(f).join('')}</div></details></div>`;
  }
  function drawForm(M) {
    const box = M.el.querySelector('[data-form]'), { kb, d } = M;
    const btn = M.el.querySelector('[data-make]');
    if (btn) btn.textContent = `📄 Составить PDF и Word${M.sel.size ? ` (${M.sel.size})` : ''}`;
    if (!M.sel.size) { box.innerHTML = '<p class="drf-none">☝️ Отметьте хотя бы один документ — появятся поля для заполнения.</p>'; return; }
    const used = usedFields(M), out = [];
    const parties = (p, list) => `<div class="drf-grp"><h4>${p === 'S' ? '🧑‍💼 Продавцы' : '🧑 Покупатели'}</h4>${list.map((x, i) => partyHtml(M, p, i, x)).join('')}
      ${list.length < 4 ? `<p class="drf-acts"><button type="button" class="btn ghost" data-padd="${p}">＋ ещё ${p === 'S' ? 'продавец' : 'покупатель'}</button></p>` : ''}</div>`;
    if (needParty(M, 'S')) out.push(parties('S', d.sellers));
    if (needParty(M, 'B')) out.push(parties('B', d.buyers));
    for (const [g, title] of Object.entries(kb.fgroups)) {
      const ks = used.filter(k => kb.fields[k].group === g);
      if (!ks.length) continue;
      out.push(`<div class="drf-grp"><h4>${esc(title)}</h4><div class="drf-grid">${ks.map(k => {
        const f = kb.fields[k]; let v = d.vals[k], src = d.from[k];
        if ((v == null || v === '') && f.def) { v = f.def; d.vals[k] = v; src ??= 'def'; }
        return fieldHtml(M, k, f, v ?? '', k, src);
      }).join('')}</div></div>`);
    }
    box.innerHTML = out.join('');
    M.filled.clear();
  }
  function drawCalc(M) {
    const box = M.el.querySelector('[data-calc]'), c = M.d.calc ?? {}, ids = [...M.sel], v = M.d.vals;
    const zad = ids.includes('zadatok') || ids.includes('rastorg') || ids.includes('claim') || (ids.includes('pdkp') && (v.dep_kind ?? 'Задаток') === 'Задаток');
    const parts = [];
    if (M.sel.size) {
      if (c.price && c.dep) parts.push(`Остаток к оплате: <b>${rubShort(c.rest ?? c.price - c.dep)}</b>`);
      if (c.price && (money(v.credit) || money(v.mc_sum)) && c.own != null) parts.push(`Свои деньги покупателя: <b>${c.own < 0 ? '⚠️ ' : ''}${rubShort(c.own)}</b>`);
      if (c.dep && zad) parts.push(`Двойной задаток: <b>${rubShort(c.double ?? c.dep * 2)}</b>`);
      if (c.bron_until && ids.includes('bron')) parts.push(`Бронь до: <b>${esc(H.day(c.bron_until))}</b>`);
    }
    box.innerHTML = parts.map(x => `<span>${x}</span>`).join('');
    box.hidden = !parts.length;
  }
  function showProblems(M) {
    M.el.querySelectorAll('.drf-f').forEach(x => { if (!x.dataset.local) { x.classList.remove('err', 'warn'); const m = x.querySelector('[data-msg]'); if (m) m.textContent = ''; } });
    const seen = new Set();
    for (const p of M.d.problems ?? []) {
      const box = M.el.querySelector(`.drf-f[data-fk="${CSS.escape(p.key)}"]`);
      if (!box || box.dataset.local) continue;
      const m = box.querySelector('[data-msg]');
      if (seen.has(p.key)) { m.textContent += ` ${p.msg}`; continue; }
      seen.add(p.key); box.classList.add(p.warn ? 'warn' : 'err'); m.textContent = `${p.warn ? '⚠️' : '✗'} ${p.msg}`;
    }
  }
  function drawRes(M) {
    const box = M.el.querySelector('[data-res]'), files = M.d.files ?? {};
    const ids = [...new Set([...Object.keys(M.res), ...Object.keys(files)])].filter(id => tplOf(M, id));
    if (!ids.length) { box.innerHTML = ''; return; }
    box.innerHTML = `<b>📂 Составленные документы</b>${ids.map(id => {
      const r = M.res[id], f = files[id] ?? {}, t = tplOf(M, id), empty = r?.empty ?? f.empty ?? [];
      const n = Array.isArray(empty) ? empty.length : Number(empty) || 0;
      return `<div class="drf-row"><b>📄 ${esc(r?.name ?? f.name ?? t.name)}</b>
        <small>${f.at ? esc(H.when(f.at)) : r ? 'только что' : ''}${n ? ` · <span class="drf-empty" title="${esc(Array.isArray(empty) ? empty.join(', ') : '')}">пусто ${n} ${plural(n, 'поле', 'поля', 'полей')}</span>` : ' · все поля заполнены'}</small>
        <button type="button" class="btn soft" data-get="${esc(id)}" data-fmt="pdf">PDF</button><button type="button" class="btn soft" data-get="${esc(id)}" data-fmt="docx">Word</button></div>`;
    }).join('')}<small class="hint">Word — чтобы поправить текст. Перед подписанием покажите документы юристу.</small>`;
  }
  function drawAsk(M) {
    const box = M.el.querySelector('[data-askbox]'), ts = selTpls(M), who = M.opt.role === 'broker' ? 'брокеру' : 'юристу';
    if (!ts.length) { box.innerHTML = ''; box.hidden = true; return; }
    box.hidden = false;
    const was = box.querySelector('[data-aq]')?.value ?? '', wasT = box.querySelector('[data-at]')?.value;
    box.innerHTML = `<h4>💬 Вопрос ${who} по документу</h4>
      <select data-at aria-label="Документ">${ts.map(t => `<option value="${esc(t.id)}"${t.id === wasT ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
      <div class="drf-ask-in"><textarea data-aq rows="2" maxlength="4000" placeholder="Например: нужно ли в ПДКП условие о возврате задатка, если банк откажет? Как прописать выписку детей?">${esc(was)}</textarea>
        ${H.voiceOk() ? '<button type="button" class="btn soft law-mic" data-amic title="Сказать голосом" aria-label="Сказать голосом">🎤</button>' : ''}</div>
      <p class="drf-acts"><button type="button" class="btn primary" data-ask>Спросить</button><small class="hint">${who[0].toUpperCase() + who.slice(1, -1)} видит заполненные поля документа (без номеров паспортов) и ваши документы. Ответ — до 2 минут.</small></p>
      <div class="drf-ans" data-ans></div>`;
  }

  // ---------- состояние ----------
  function setVal(M, key, v) {
    const m = key.match(/^([SB])(\d+)\.(\w+)$/);
    if (m) { const list = m[1] === 'S' ? M.d.sellers : M.d.buyers; (list[+m[2]] ??= {})[m[3]] = v; }
    else M.d.vals[key] = v;
    M.edited.add(key);
    if (M.d.from[key]) { delete M.d.from[key]; const box = M.el.querySelector(`.drf-f[data-fk="${CSS.escape(key)}"]`); box?.classList.remove('ai'); box?.querySelector('.drf-src')?.remove(); }
    dirty(M);
  }
  function dirty(M) { M.dirty = true; clearTimeout(M.timer); M.timer = setTimeout(() => save(M), 1000); }
  async function save(M) {
    clearTimeout(M.timer);
    if (M.busy) { await M.busy; if (!M.dirty) return; }
    if (!M.dirty) return;
    M.dirty = false;
    const d = M.d, body = { id: d.id, tpls: [...M.sel], vals: d.vals, sellers: d.sellers, buyers: d.buyers };
    M.busy = H.call('law_drf_save', body).then(r => {
      const from = { ...(r.draft.from ?? d.from) };
      for (const k of M.edited) delete from[k];   // поле поправил агент — значок «из документов / ИИ» больше не нужен
      M.d = { ...r.draft, vals: M.d.vals, sellers: M.d.sellers, buyers: M.d.buyers, from, files: { ...(r.draft.files ?? {}), ...M.d.files } };
      if (document.body.contains(M.el)) { drawCalc(M); showProblems(M); }
    }).catch(e => { M.dirty = true; if (document.body.contains(M.el)) H.toast(`Черновик не сохранился: ${e.message}`, 5000); }).finally(() => { M.busy = null; });
    return M.busy;
  }
  function reload(M, d, filled = []) {
    d.vals ??= {}; d.sellers = d.sellers?.length ? d.sellers : [{}]; d.buyers = d.buyers?.length ? d.buyers : [{}]; d.from ??= {}; d.files ??= {};
    M.d = d; M.sel = new Set(d.tpls ?? [...M.sel]); M.edited.clear();
    filled.forEach(k => M.filled.add(k));
    M.openP = new Set(filled.filter(k => /^[SB]\d+\.(?!name)/.test(k)).map(k => k.split('.')[0]));
    drawForm(M); drawCalc(M); showProblems(M); M.openP = null;
  }

  // ---------- события ----------
  function onInput(M, e) {
    const t = e.target, key = t.dataset?.k;
    if (!key) return;
    if (t.dataset.t === 'money') {
      const before = t.value, pos = t.selectionStart ?? before.length, digitsBefore = before.slice(0, pos).replace(/\D/g, '').length;
      t.value = fmt('money', key, before);
      let p = 0, n = 0; while (p < t.value.length && n < digitsBefore) { if (/\d/.test(t.value[p])) n++; p++; }
      try { t.setSelectionRange(p, p); } catch { /* */ }
      const w = t.closest('.drf-f')?.querySelector('[data-w]'); if (w) w.textContent = money(t.value) ? rub(money(t.value)) : '';
    }
    if (t.tagName !== 'SELECT') setVal(M, key, t.value);
  }
  function onBlur(M, e) {
    const t = e.target, key = t.dataset?.k;
    if (!key || t.tagName === 'SELECT') return;
    const k = key.split('.').pop(), v = fmt(t.dataset.t, k, t.value.trim());
    if (v !== t.value) { t.value = v; setVal(M, key, v); }
    const box = t.closest('.drf-f'), m = box.querySelector('[data-msg]'), b = bad(t.dataset.t, k, v);
    if (b) { box.dataset.local = 1; box.classList.remove('warn'); box.classList.add('err'); m.textContent = `✗ ${b}`; }
    else if (box.dataset.local) { delete box.dataset.local; box.classList.remove('err'); m.textContent = ''; }
  }
  function onChange(M, e) {
    const t = e.target;
    if (t.matches('[data-tpl]')) {
      const id = t.dataset.tpl;
      t.checked ? M.sel.add(id) : M.sel.delete(id);
      t.closest('.drf-chip').classList.toggle('on', t.checked);
      drawForm(M); drawCalc(M); drawAsk(M); showProblems(M); dirty(M);
      return;
    }
    if (t.tagName === 'SELECT' && t.dataset.k) { setVal(M, t.dataset.k, t.value); if (t.dataset.k === 'dep_kind') drawCalc(M); }
  }
  async function onClick(M, e) {
    const t = e.target;
    const pa = t.closest('[data-padd]');
    if (pa) { const list = pa.dataset.padd === 'S' ? M.d.sellers : M.d.buyers; if (list.length < 4) { list.push({}); drawForm(M); showProblems(M); dirty(M); } return; }
    const pr = t.closest('[data-prm]');
    if (pr) {
      const p = pr.dataset.prm[0], i = +pr.dataset.prm.slice(1), list = p === 'S' ? M.d.sellers : M.d.buyers;
      if (list[i]?.name && !confirm(`Убрать «${list[i].name}» из документа?`)) return;
      list.splice(i, 1);
      for (const k of Object.keys(M.d.from)) if (k.startsWith(p)) delete M.d.from[k];   // номера сместились — значки источника по людям сбрасываем
      drawForm(M); showProblems(M); dirty(M); return;
    }
    if (t.closest('[data-fill]')) return fill(M, t.closest('[data-fill]'));
    if (t.closest('[data-refresh]')) return refresh(M, t.closest('[data-refresh]'));
    if (t.closest('[data-make]')) return make(M, t.closest('[data-make]'));
    const g = t.closest('[data-get]');
    if (g) return getFile(M, g.dataset.get, g.dataset.fmt);
    if (t.closest('[data-amic]')) { H.voice(M.el.querySelector('[data-aq]'), t.closest('[data-amic]')); return; }
    if (t.closest('[data-ask]')) return ask(M, t.closest('[data-ask]'));
  }
  const busyBtn = (b, text) => { const old = b.textContent; b.disabled = true; b.textContent = text; return () => { b.disabled = false; b.textContent = old; }; };
  async function fill(M, b) {
    if (!M.sel.size) { H.toast('Сначала отметьте документы'); return; }
    const done = busyBtn(b, '⏳ ИИ читает документы — до 1,5 минуты…');
    try {
      await save(M);
      const r = await H.call('law_drf_fill', { id: M.d.id }, { signal: AbortSignal.timeout?.(170000) });
      const filled = r.filled ?? [];
      reload(M, r.draft, filled);
      H.toast(filled.length ? `ИИ заполнил ${filled.length} ${plural(filled.length, 'поле', 'поля', 'полей')} — проверьте жёлтые` : 'ИИ не нашёл в документах данных для пустых полей — заполните их сами', 5000);
      M.el.querySelector('.drf-f.filled')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (er) { fail(er); }
    done();
  }
  async function refresh(M, b) {
    const done = busyBtn(b, '⏳ Подставляем…');
    try {
      await save(M);
      const before = JSON.stringify([M.d.vals, M.d.sellers, M.d.buyers]);
      const r = await H.call('law_drf_get', { batch: M.opt.batch || undefined, deal_id: M.opt.deal_id || undefined, role: M.opt.role || 'lawyer', refresh: true });
      const filled = Object.keys(r.draft.from ?? {}).filter(k => ['docs', 'deal'].includes(r.draft.from[k]) && !['docs', 'deal'].includes(M.d.from[k]));
      reload(M, r.draft, filled);
      H.toast(before === JSON.stringify([r.draft.vals, r.draft.sellers, r.draft.buyers]) ? 'Новых данных в документах нет — заполненные поля не трогали' : 'Подставили данные из документов в пустые поля', 4000);
    } catch (er) { fail(er); }
    done();
  }
  function emptyCount(M) {
    const v = M.d.vals, used = usedFields(M);
    let n = used.filter(k => !String(v[k] ?? '').trim() && !['special', 'g_text', 'dop_text', 'items', 'credit_doc', 'seller_acc', 'o_share', 'l_cad', 'l_area', 'l_kind', 'mc_cert', 'sp_marriage'].includes(k)).length;
    for (const [p, list] of [['S', M.d.sellers], ['B', M.d.buyers]]) if (needParty(M, p)) for (const x of list) n += ['name', 'birth', 'pass', 'pass_by', 'pass_date', 'addr'].filter(k => !String(x?.[k] ?? '').trim()).length;
    return n;
  }
  async function make(M, b) {
    const ts = selTpls(M);
    if (!ts.length) { H.toast('Отметьте документы, которые составить'); return; }
    const errs = M.el.querySelectorAll('.drf-f.err');
    if (errs.length) { errs[0].scrollIntoView({ behavior: 'smooth', block: 'center' }); if (!confirm(`В ${errs.length} ${plural(errs.length, 'поле', 'полях', 'полях')} ошибка (красным). Составить всё равно?`)) return; }
    const n = emptyCount(M);
    if (n > 5 && !confirm(`Не заполнено ${n} ${plural(n, 'поле', 'поля', 'полей')}. Пустые поля будут строкой «____» — заполните их от руки или в Word. Составить?`)) return;
    const done = busyBtn(b, '⏳ Составляем…'), prog = M.el.querySelector('[data-prog]');
    prog.hidden = false;
    let ok = 0;
    try {
      await save(M);
      for (const [i, t] of ts.entries()) {
        prog.textContent = `⏳ ${i + 1} из ${ts.length}: ${t.name}…`;
        try {
          const r = await H.call('law_drf_make', { id: M.d.id, tpl: t.id }, { signal: AbortSignal.timeout?.(120000) });
          M.res[t.id] = r; M.d.files[t.id] = { at: new Date().toISOString(), name: r.name, empty: r.empty ?? [] }; ok++;
          drawRes(M);
          M.el.querySelector(`[data-tpl="${CSS.escape(t.id)}"]`)?.closest('.drf-chip')?.classList.add('done');
        } catch (er) { if (er.code === 'limit' || er.status === 402) { fail(er); break; } H.toast(`«${t.name}» не составился: ${er.message}`, 6000); }
      }
      prog.textContent = ok ? `✓ Готово: ${ok} из ${ts.length}. Нажмите PDF или Word.` : '⚠️ Не составилось — попробуйте ещё раз через минуту';
      if (ok) M.el.querySelector('[data-res]').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } finally { done(); }
  }
  async function getFile(M, tpl, fmt_) {
    const r = M.res[tpl], direct = r?.[fmt_];
    const w = window.open('', '_blank');   // окно сразу — иначе после ожидания браузер заблокирует
    try {
      const url = direct && Date.now() - (Date.parse(M.d.files[tpl]?.at) || 0) < 50 * 60e3 ? direct : (await H.call('law_drf_url', { id: M.d.id, tpl, fmt: fmt_ })).url;
      if (w) w.location = url; else location.href = url;
    } catch (er) { w?.close(); fail(er); }
  }
  async function ask(M, b) {
    const box = M.el.querySelector('[data-askbox]'), q = box.querySelector('[data-aq]'), text = q.value.trim(), tpl = box.querySelector('[data-at]').value;
    if (text.length < 10) { H.toast('Напишите вопрос подробнее'); q.focus(); return; }
    const done = busyBtn(b, '⏳ Думаю… до 2 минут'), out = box.querySelector('[data-ans]');
    try {
      await save(M);
      const r = await H.call('law_ask', { role: M.opt.role || 'lawyer', text, draft_id: M.d.id, tpl }, { signal: AbortSignal.timeout?.(150000) });
      out.insertAdjacentHTML('beforeend', `<div class="hub-msg user">${esc(text)}</div><div class="hub-msg ai">${H.md(r.answer)}</div>`);
      q.value = '';
      out.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      if (r.quota) document.dispatchEvent(new CustomEvent('law-quota', { detail: r.quota }));
    } catch (er) { fail(er); }
    done();
  }

  window.DRAFT = { mount, rub, words };
})();
