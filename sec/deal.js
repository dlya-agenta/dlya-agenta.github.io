// «Сделка» (v5.15, п. 1; вид — v5.16, п. 3): список сделок карточками с полоской этапа; карточка сделки — разделы-карточки:
// этапы степпером (клик — сменить этап), основное, документы и проверки тремя колонками (Продавец / Покупатель / Проверка собственника)
// со счётчиком «собрано N из M» и автосохранением галочек, участники, компактный опрос перед чатом, ИИ-юрист и брокер (голос — HUB.voice).
// База знаний с поиском — sec/kb.js (window.KB), отдельно — hub.html#kb. На каждом экране — красная звёздочка. Сервер — hub/deal.ts, hub/kb.ts.
// v5.19 (Алексей: «ВКЛЮЧИ Проверку документов, ипотечника, юриста. в сделке тоже все включи!»): «Сделка» во всех тарифах; документы сделки — загрузка
// (PDF и фото, большие фото сжимаются в браузере), проверка ИИ-юристом с замечаниями, открыть/удалить; позвать юриста или ипотечного брокера ссылкой.
(() => {
  const H = window.HUB, esc = H.esc;
  let kb = null, el = null, cur = null, saveT = null;
  const FLOW = ['prep', 'check', 'docs', 'bank', 'deposit', 'sign', 'reg', 'calc', 'done'];
  const opt = (list, v) => list.map(x => `<option value="${x.id}"${x.id === v ? ' selected' : ''}>${esc(x.name)}</option>`).join('');
  const optMap = (m, v) => Object.entries(m).map(([k, t]) => `<option value="${k}"${k === v ? ' selected' : ''}>${esc(t)}</option>`).join('');
  const kb2 = n => n > 1048576 ? `${(n / 1048576).toFixed(1).replace('.0', '')} МБ` : `${Math.max(1, Math.round(n / 1024))} КБ`;
  // стили блока документов — здесь, чтобы не трогать общий hub.css (его правят и другие разделы)
  if (!document.getElementById('dl-docs-css')) document.head.insertAdjacentHTML('beforeend', `<style id="dl-docs-css">
    .dl-docs { display: grid; gap: 10px; margin: 10px 0; }
    .dl-doc { border: 1px solid var(--line, rgba(127,127,127,.25)); border-radius: 12px; padding: 10px 12px; background: var(--card, transparent); }
    .dl-doc-h { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
    .dl-doc-h b { flex: 1 1 220px; min-width: 0; overflow-wrap: anywhere; }
    .dl-doc-h small { opacity: .75; }
    .dl-badge { font-size: 12.5px; font-weight: 700; border-radius: 999px; padding: 2px 9px; white-space: nowrap; }
    .dl-badge.ok { background: rgba(22,163,74,.15); color: #15803d; } .dl-badge.warn { background: rgba(234,88,12,.15); color: #c2410c; } .dl-badge.none { background: rgba(127,127,127,.15); }
    html[data-theme="dark"] .dl-badge.ok { color: #4ade80; } html[data-theme="dark"] .dl-badge.warn { color: #fb923c; }
    .dl-doc-b { display: flex; flex-wrap: wrap; gap: 6px; }
    .dl-doc details { margin-top: 8px; } .dl-doc details summary { cursor: pointer; font-weight: 600; }
    .dl-doc .dl-note { margin-top: 6px; line-height: 1.5; }
    .dl-up { position: relative; cursor: pointer; } .dl-up input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; }
    .dl-up.busy { opacity: .6; pointer-events: none; }
    .dl-invite { display: flex; flex-wrap: wrap; gap: 8px; }
    @media (max-width: 600px) { .dl-doc-b .btn { flex: 1 1 auto; } }
  </style>`);
  const pct = st => st === 'lost' ? 100 : Math.round((Math.max(0, FLOW.indexOf(st)) + 1) / FLOW.length * 100);

  async function open(arg, ctx) {
    el = ctx.el;
    kb ??= await H.call('deal_kb');
    if (!kb.can) { el.innerHTML = H.locked('Сделка', 'Вкладка «Сделка» — во всех тарифах и в пробном периоде: карточка сделки, документы и их проверка ИИ-юристом, проверки по виду сделки, чаты с участниками, помощь ИИ-юриста и ипотечного брокера. Продлите доступ, чтобы открыть.') + '<div id="d-kb"></div>'; window.KB?.render(el.querySelector('#d-kb'), kb); return; }
    if (arg?.startsWith('new')) { const num = arg.split(':')[1]; const r = await H.call('deal_save', { title: num ? `Объект № ${num}` : 'Новая сделка', num: num ? +num : undefined }); location.hash = `deal=${r.deal.id}`; return; }
    if (arg) return card(+arg);
    const r = await H.call('deal_list');
    el.innerHTML = `<div class="dl-head"><h2>📑 Сделки</h2><button class="btn primary" data-new>＋ Новая сделка</button></div>${H.star()}
      <p class="hint">Объект можно отправить в сделку и с карточки объявления — кнопка «📑 В сделку». Вопрос без сделки — <a href="#lawyer">⚖️ юристу</a> или <a href="#broker">🏦 ипотечному брокеру</a>.</p>
      <div class="dl-list">${r.deals.map(d => `<a class="dl-item${d.stage === 'lost' ? ' lost' : d.stage === 'done' ? ' done' : ''}" href="#deal=${d.id}">
        <b>${esc(d.title)}</b><small>${esc(kb.kinds.find(k => k.id === d.kind)?.name ?? '')}</small>
        <span class="dl-bar" aria-hidden="true"><i style="width:${pct(d.stage)}%"></i></span>
        <small class="dl-meta"><span class="dl-st">${esc(r.stages[d.stage])}</span><span>${H.when(d.updated_at)}</span></small></a>`).join('') || '<p class="muted">Сделок пока нет — нажмите «＋ Новая сделка».</p>'}</div>
      <section class="hub-sec dl-sec"><h3>📚 База знаний: виды сделок, расчёты, проверка собственника</h3><div id="d-kb"></div></section>`;
    window.KB?.render(el.querySelector('#d-kb'), kb);
    el.onclick = e => { if (e.target.closest('[data-new]')) location.hash = 'deal=new'; };
    el.onchange = null;
  }

  function stepper(d, k) {
    const at = FLOW.indexOf(d.stage), lost = d.stage === 'lost';
    return `<ol class="dl-steps${lost ? ' lost' : ''}">${FLOW.map((s, i) => `<li class="${!lost && i < at ? 'past' : ''}${!lost && i === at ? ' now' : ''}">
      <button type="button" data-stage="${s}" title="${esc(kb.hints?.[s] ?? '')}"${i === at ? ' aria-current="step"' : ''}><span class="dl-n">${!lost && i < at ? '✓' : i + 1}</span><b>${esc(kb.stages[s])}</b></button></li>`).join('')}</ol>
      <p class="dl-hint">${lost ? '⛔ <b>Сделка сорвалась.</b> ' + esc(kb.hints?.lost ?? '') : `<b>Сейчас: ${esc(kb.stages[d.stage] ?? '')}.</b> ${esc(kb.hints?.[d.stage] ?? '')}`}
        <button type="button" class="btn ghost dl-lost" data-stage="${lost ? 'prep' : 'lost'}">${lost ? '↺ Вернуть в работу' : 'Сделка сорвалась'}</button></p>
      <details class="dl-plan"><summary>План для вида «${esc(k.name)}» (${k.stages.length} шагов)</summary><ol>${k.stages.map(s => `<li>${esc(s)}</li>`).join('')}</ol></details>`;
  }

  async function card(id) {
    const r = await H.call('deal_get', { id });
    cur = r;
    const d = r.deal, k = kb.kinds.find(x => x.id === d.kind) ?? kb.kinds[0], ch = d.checklist ?? {}, pay = kb.pay.find(x => x.id === d.pay);
    const box = (key, text) => `<label class="hub-chk"><input type="checkbox" data-ck="${esc(key)}"${ch[key] ? ' checked' : ''}> <span>${esc(text)}</span></label>`;
    const col = (icon, title, keys) => `<div class="dl-col" data-col><div class="dl-col-h"><b>${icon} ${title}</b><span class="dl-cnt" data-cnt></span></div>${keys.join('')}</div>`;
    const o = r.object;
    el.innerHTML = `<p class="dl-back"><a class="btn ghost" href="#deal">‹ Все сделки</a></p>
      <div class="dl-head"><h2>📑 ${esc(d.title)}</h2></div>${H.star()}

      <section class="hub-sec dl-sec"><h3>🧭 Этапы сделки</h3>${stepper(d, k)}</section>

      <section class="hub-sec dl-sec"><h3>📋 Основное</h3><div class="hub-form">
        <label class="field">Название<input id="d-title" value="${esc(d.title)}" maxlength="120"></label>
        <label class="field">Вид сделки<select id="d-kind">${opt(kb.kinds, d.kind)}</select></label>
        <label class="field">Расчёт<select id="d-pay">${opt(kb.pay, d.pay)}</select></label>
        <label class="field hub-wide">Заметки<textarea id="d-note" rows="2" maxlength="4000">${esc(d.note ?? '')}</textarea></label></div>
        <p class="dl-obj">🏠 ${o ? `${esc([o.rooms ? `${o.rooms}-комн.` : '', o.kind ?? o.type_name ?? '', o.area ? `${o.area} м²` : '', o.complex ?? '', o.sub ?? o.district ?? '', o.address ?? ''].filter(Boolean).join(', '))}${o.num ? ` · № ${o.num}` : ''}` : 'Объект не выбран — отправьте его в сделку с карточки объявления или эксклюзива'}</p>
        ${pay ? `<details class="dl-plan"><summary>💳 Как проходит расчёт «${esc(pay.name)}»</summary><p class="hint">${esc(pay.how)}</p>${pay.risks?.length ? `<p class="hint">⚠️ ${pay.risks.map(esc).join('; ')}</p>` : ''}</details>` : ''}
        <p class="hub-actions"><button class="btn primary" data-save>Сохранить</button>
          ${o?.num ? `<a class="btn soft" href="./#o=${o.num}" target="_blank">Открыть объект</a><button class="btn soft" data-rk="${o.num}">📣 В рекламу</button>` : ''}
          <button class="btn soft" data-invite="lawyer">⚖️ Позвать юриста</button><button class="btn soft" data-invite="broker">🏦 Позвать ипотечного брокера</button><button class="btn ghost bad" data-del>Удалить сделку</button></p></section>

      <section class="hub-sec dl-sec"><h3>✅ Документы и проверки — ${esc(k.name)}</h3>
        <div class="dl-cols">${col('🧑‍💼', 'Продавец', k.seller.map((s, i) => box(`s${i}`, s)))}${col('🧑', 'Покупатель', k.buyer.map((s, i) => box(`b${i}`, s)))}${col('🔎', 'Проверка собственника', kb.checks.map(c => box(`c_${c.id}`, `${c.name} — ${c.where}`)))}</div>
        <p class="hint">⚠️ Риски: ${k.risks.map(esc).join('; ')}. Галочки сохраняются сразу.</p>
      </section>

      ${r.docs_on ? docsSec(r) : ''}

      <section class="hub-sec dl-sec"><h3>👥 Участники</h3><div id="d-people">${(r.people.length ? r.people : [{ role: 'agent', name: '' }]).map(personRow).join('')}</div>
        <p class="hub-actions"><button class="btn ghost" data-add-p>＋ Участник</button> <button class="btn soft" data-save-p>Сохранить участников</button></p></section>

      <section class="hub-sec dl-sec dl-compact"><h3>💬 Чат по сделке</h3><p class="hint">Коротко ответьте на вопросы — по ним составим список необходимого и первое сообщение для чатов.</p>
        <div class="dl-qs">${kb.questions.map(q => `<label class="dl-q"><span>${esc(q.q)}</span><input data-q="${q.id}" maxlength="1000" value="${esc(d.answers?.[q.id] ?? '')}"></label>`).join('')}</div>
        <p><button class="btn primary" data-chat>Создать 2 чата: с клиентом и без</button></p><div id="d-chat"></div></section>

      <section class="hub-sec dl-sec dl-compact"><h3>🧑‍⚖️ ИИ: юрист и ипотечный брокер по этой сделке</h3>
        <p class="hint">${r.ai.used} из ${r.ai.lim} за сегодня. Опишите подробно: что обсудили, какие вопросы остались, какие документы есть. Отдельный чат без лимита сделки — <a href="#lawyer">⚖️ Юрист</a> · <a href="#broker">🏦 Ипотечный брокер</a>.</p>
        ${r.msgs.length ? `<div class="hub-msgs">${r.msgs.map(m => `<div class="hub-msg ${m.role}">${m.role === 'ai' ? H.md(m.text) : esc(m.text).replace(/\n/g, '<br>')}</div>`).join('')}</div>` : ''}
        <div class="law-in"><textarea id="d-ai" rows="3" maxlength="6000" placeholder="Например: продавец получил квартиру по наследству 2 года назад, есть второй наследник-брат… Покупатель берёт ипотеку… Что проверить и какие документы собрать?"></textarea>
          ${H.voiceOk() ? '<button type="button" class="btn soft law-mic" data-mic title="Сказать голосом" aria-label="Сказать голосом">🎤</button>' : ''}</div>
        <p><button class="btn primary" data-ai>Спросить</button></p>${H.star()}</section>`;
    el.onclick = onClick;
    el.onchange = onChange;
    counts();
  }
  // документы сделки: список с отметкой проверки, загрузка (несколько файлов сразу), проверка ИИ-юристом
  const docRow = x => `<div class="dl-doc" data-doc="${x.id}"><div class="dl-doc-h"><b>📄 ${esc(x.name)}</b>
      <span class="dl-badge ${x.check_ok == null ? 'none' : x.check_ok ? 'ok' : 'warn'}">${x.check_ok == null ? 'не проверен' : x.check_ok ? '✓ без существенных замечаний' : '⚠️ есть замечания'}</span>
      <small>${x.size ? kb2(x.size) + ' · ' : ''}${H.when(x.at)}</small></div>
      <div class="dl-doc-b"><button class="btn soft" data-doc-open="${x.id}">Открыть</button><button class="btn soft" data-doc-check="${x.id}">${x.check_ok == null ? '🔎 Проверить' : '🔎 Проверить снова'}</button><button class="btn ghost bad" data-doc-del="${x.id}">Удалить</button></div>
      ${x.check_note ? `<details${x.check_ok === false ? ' open' : ''}><summary>Заключение ИИ-юриста</summary><div class="dl-note">${H.md(x.check_note)}</div></details>` : ''}</div>`;
  const docsSec = r => `<section class="hub-sec dl-sec" id="d-docs"><h3>📎 Документы сделки — проверка ИИ-юристом</h3>
      <p class="hint">Загрузите выписку ЕГРН, договор-основание, свидетельство о наследстве, справки, согласия, одобрение банка — ИИ-юрист прочитает документ и напишет риски и что сделать.
        Проверок сегодня: <b>${r.doc_ai.used} из ${r.doc_ai.lim}</b>. PDF или фото до 10 МБ. Файлы видите вы и приглашённые юрист или брокер; удаляются вместе со сделкой и через 30 дней после её закрытия.</p>
      <div class="dl-docs">${r.docs.map(docRow).join('') || '<p class="muted">Документов пока нет.</p>'}</div>
      <p class="hub-actions"><label class="btn primary dl-up" id="d-up">📎 Загрузить документ<input type="file" accept=".pdf,application/pdf,image/jpeg,image/png,image/webp,image/heic" multiple data-doc-file></label>
        <label class="hub-chk"><input type="checkbox" id="d-autocheck" checked> <span>Сразу проверить ИИ-юристом</span></label></p>
      ${r.docs.length ? `<div class="dl-lawchk"><p class="hub-actions"><button class="btn primary" data-law-check="object">⚖️ Проверка юриста: объект</button><button class="btn soft" data-law-check="owner">⚖️ Проверка юриста: собственник</button></p>
        <p class="hint">Юрист читает все документы сделки, сервис проверяет паспорт по базе МВД, банкротство и ФНС. Итог — отчёт на экране и два PDF в документах сделки: «Отчёт сервиса» и «Заключение юриста». Считается из «Проверок» тарифа в месяц.</p>
        <div id="d-lawrep"></div></div>` : ''}</section>`;
  // фото больше 3 МБ — уменьшаем до 2200 px по длинной стороне (JPEG), PDF — как есть
  async function fileData(f) {
    if (f.type.startsWith('image/') && (f.size > 3e6 || !/jpeg|png|webp/.test(f.type))) {
      try {
        const bmp = await createImageBitmap(f), k = Math.min(1, 2200 / Math.max(bmp.width, bmp.height));
        const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
        cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
        return { data: cv.toDataURL('image/jpeg', 0.85), name: f.name.replace(/\.\w+$/, '') + '.jpg' };
      } catch { /* не вышло — отправим как есть */ }
    }
    return { data: await new Promise((ok, no) => { const rd = new FileReader(); rd.onload = () => ok(rd.result); rd.onerror = () => no(new Error('Файл не прочитался')); rd.readAsDataURL(f); }), name: f.name };
  }
  async function upload(files) {
    const lab = el.querySelector('#d-up'), check = el.querySelector('#d-autocheck')?.checked !== false, id = cur.deal.id;
    lab.classList.add('busy');
    let last = null;
    for (const [i, f] of [...files].entries()) {
      if (f.size > 25e6) { H.toast(`«${f.name}» больше 25 МБ — сожмите файл`, 6000); continue; }
      lab.firstChild.textContent = `⏳ ${files.length > 1 ? `${i + 1} из ${files.length}: ` : ''}${check ? 'загружаем и проверяем — до минуты' : 'загружаем'}`;
      try {
        const { data, name } = await fileData(f);
        last = await H.call('deal_doc_add', { deal_id: id, name, data, check }, { signal: AbortSignal.timeout?.(170000) });
        if (last.check?.error) H.toast(last.check.error, 6000);
      } catch (er) { H.toast(er.name === 'TimeoutError' ? 'Проверка идёт дольше обычного — обновите страницу через минуту' : er.message, 6000); }
    }
    await card(id);
    if (last) { el.querySelector(`[data-doc="${last.added}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); H.toast(last.check?.ok === false ? 'Документ загружен — есть замечания юриста' : 'Документ загружен', 3000); }
  }
  const personRow = p => `<div class="hub-person"><input placeholder="Имя" data-pn value="${esc(p.name ?? '')}" maxlength="80"><input placeholder="Телефон" data-pp value="${esc(p.phone ? '+' + p.phone : '')}" inputmode="tel" maxlength="20">
    <select data-pr>${optMap(kb.roles, p.role ?? 'client')}</select><button class="btn ghost" data-rm-p aria-label="Убрать">✕</button></div>`;
  const checklist = () => Object.fromEntries([...el.querySelectorAll('[data-ck]')].map(x => [x.dataset.ck, x.checked]));
  function counts() {
    el.querySelectorAll('[data-col]').forEach(c => {
      const all = c.querySelectorAll('[data-ck]').length, on = c.querySelectorAll('[data-ck]:checked').length;
      const n = c.querySelector('[data-cnt]'); n.textContent = `собрано ${on} из ${all}`; n.classList.toggle('full', on === all && all > 0);
    });
  }
  function onChange(e) {
    if (e.target.matches('[data-doc-file]')) { if (e.target.files?.length) upload(e.target.files); return; }
    if (!e.target.matches('[data-ck]')) return;
    counts();
    clearTimeout(saveT);
    saveT = setTimeout(() => H.call('deal_save', { id: cur.deal.id, checklist: checklist() }).then(() => H.toast('Отмечено', 1200)).catch(er => H.toast(er.message, 5000)), 600);
  }

  async function onClick(e) {
    const t = e.target, d = cur.deal;
    const st = t.closest('[data-stage]');
    if (st) {
      if (st.dataset.stage === 'lost' && !confirm('Отметить, что сделка сорвалась?')) return;
      try { await H.call('deal_save', { id: d.id, stage: st.dataset.stage }); H.toast(`Этап: ${kb.stages[st.dataset.stage]}`); card(d.id); } catch (er) { H.toast(er.message, 5000); }
      return;
    }
    if (t.closest('[data-save]')) {
      try { await H.call('deal_save', { id: d.id, title: el.querySelector('#d-title').value, kind: el.querySelector('#d-kind').value, pay: el.querySelector('#d-pay').value,
        note: el.querySelector('#d-note').value, checklist: checklist() }); H.toast('Сохранено'); card(d.id); } catch (er) { H.toast(er.message, 5000); }
      return;
    }
    if (t.closest('[data-del]')) { if (!confirm('Удалить сделку? Участники, заметки и ответы ИИ удалятся.')) return; await H.call('deal_del', { id: d.id }); location.hash = 'deal'; return; }
    if (t.closest('[data-add-p]')) { el.querySelector('#d-people').insertAdjacentHTML('beforeend', personRow({ role: 'client' })); return; }
    if (t.closest('[data-rm-p]')) { t.closest('.hub-person').remove(); return; }
    if (t.closest('[data-save-p]')) {
      const people = [...el.querySelectorAll('.hub-person')].map(x => ({ name: x.querySelector('[data-pn]').value, phone: x.querySelector('[data-pp]').value, role: x.querySelector('[data-pr]').value }));
      try { await H.call('deal_people', { deal_id: d.id, people }); H.toast('Участники сохранены'); } catch (er) { H.toast(er.message, 5000); } return;
    }
    if (t.closest('[data-rk]')) { try { localStorage.setItem('sel', JSON.stringify([+t.closest('[data-rk]').dataset.rk])); } catch { /* */ } location.href = './#rk'; return; }
    if (t.closest('[data-mic]')) { H.voice(el.querySelector('#d-ai'), t.closest('[data-mic]')); return; }
    const dop = t.closest('[data-doc-open]');
    if (dop) { try { const r = await H.call('deal_doc_url', { id: +dop.dataset.docOpen }); window.open(r.url, '_blank', 'noopener'); } catch (er) { H.toast(er.message, 5000); } return; }
    const dck = t.closest('[data-doc-check]');
    if (dck) {
      dck.disabled = true; dck.textContent = '⏳ Проверяем — до минуты';
      try { await H.call('deal_doc_check', { id: +dck.dataset.docCheck }, { signal: AbortSignal.timeout?.(170000) }); await card(d.id); el.querySelector(`[data-doc="${dck.dataset.docCheck}"]`)?.scrollIntoView({ block: 'center' }); }
      catch (er) { H.toast(er.name === 'TimeoutError' ? 'Проверка идёт дольше обычного — обновите страницу через минуту' : er.message, 6000); dck.disabled = false; dck.textContent = '🔎 Проверить'; }
      return;
    }
    const lc = t.closest('[data-law-check]');
    if (lc) {   // v5.24b: проверка объекта/собственника по документам сделки (hub law_check, отчёт — sec/docs.js)
      const label = lc.textContent; lc.disabled = true; lc.textContent = '⏳ Проверяем — 1–2 минуты';
      // v5.35: сначала юрист читает документы сделки (пакет юриста: ФИО, паспорт, кадастр), потом проверка + сервис + 2 PDF в документы сделки
      try { lc.textContent = '⏳ Юрист читает документы — до 2 минут';
        const bt = await H.call('law_deal_read', { deal_id: d.id, role: 'lawyer' }, { signal: AbortSignal.timeout?.(170000) });
        lc.textContent = '⏳ Проверяем по сервису и документам — до минуты';
        const r = await H.call('law_check', { batch: bt.id, kind: lc.dataset.lawCheck, role: 'lawyer' }, { signal: AbortSignal.timeout?.(170000) });
        lc.textContent = '⏳ Собираем PDF в документы сделки';
        await H.call('law_pdf_make', { id: r.id }, { signal: AbortSignal.timeout?.(120000) }).then(x => { r.report.pdf = x.pdf; }).catch(() => H.toast('PDF не собрались — откройте их кнопкой в отчёте', 5000));
        await card(d.id);
        const box = el.querySelector('#d-lawrep'); window.LAWR?.report(box, r.report, { id: r.id, attach: false }); box.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      catch (er) { (window.LAWR?.fail ?? (x => H.toast(x.message, 6000)))(er); }
      lc.disabled = false; lc.textContent = label; return;
    }
    const ddl = t.closest('[data-doc-del]');
    if (ddl) { if (!confirm('Удалить документ из сделки? Файл удалится навсегда.')) return; try { await H.call('deal_doc_del', { id: +ddl.dataset.docDel }); await card(d.id); el.querySelector('#d-docs')?.scrollIntoView({ block: 'start' }); } catch (er) { H.toast(er.message, 5000); } return; }
    if (t.closest('[data-invite]')) {
      const role = t.closest('[data-invite]').dataset.invite === 'lawyer' ? 'lawyer' : 'broker';
      try { const r = await H.call('deal_invite', { deal_id: d.id, role });
        el.querySelector('#d-chat').insertAdjacentHTML('afterbegin', `<div class="hub-note"><b>Ссылка для ${role === 'lawyer' ? 'юриста' : 'ипотечного брокера'}</b> (14 дней): <input readonly value="${esc(r.link)}"> <button class="btn soft" data-copy="${esc(r.text)}">Скопировать с текстом</button><p class="hint">${esc(r.note)}</p></div>`);
        el.querySelector('#d-chat').scrollIntoView({ behavior: 'smooth' }); } catch (er) { H.toast(er.message, 5000); } return;
    }
    const cp = t.closest('[data-copy]'); if (cp) return H.copy(cp.dataset.copy);
    if (t.closest('[data-chat]')) {
      const answers = Object.fromEntries([...el.querySelectorAll('[data-q]')].map(x => [x.dataset.q, x.value]));
      try {
        await H.call('deal_save', { id: d.id, answers });
        const r = await H.call('deal_chat', { deal_id: d.id });
        const chatBox = c => `<div class="hub-note"><b>${esc(c.title)}</b><textarea rows="6" readonly>${esc(c.text)}</textarea>
          <p class="hub-actions"><button class="btn soft" data-copy="${esc(c.text)}">Скопировать первое сообщение</button> <a class="btn soft" href="${esc(c.tg)}" target="_blank" rel="noopener">Telegram</a></p>
          ${c.people.length ? `<p class="hint">Участники: ${c.people.map(p => `${esc(p.name)} (${esc(p.role)})${p.wa ? ` <a href="${esc(p.wa)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}`).join(' · ')}</p>` : '<p class="hint">Добавьте участников с телефонами — появятся кнопки.</p>'}</div>`;
        el.querySelector('#d-chat').innerHTML = `<div class="dl-chats">${chatBox(r.client) + chatBox(r.inner)}</div><p class="hint">${esc(r.note)}</p>`;
      } catch (er) { H.toast(er.message, 5000); } return;
    }
    if (t.closest('[data-ai]')) {
      const b = t.closest('[data-ai]'), text = el.querySelector('#d-ai').value;
      b.disabled = true; b.textContent = 'Думаю… до минуты';
      try {
        const r = await H.call('deal_ai', { deal_id: d.id, text }, { signal: AbortSignal.timeout?.(150000) });
        let box = el.querySelector('.dl-compact .hub-msgs');
        if (!box) { el.querySelector('.law-in').insertAdjacentHTML('beforebegin', '<div class="hub-msgs"></div>'); box = el.querySelector('.dl-compact .hub-msgs'); }
        box.insertAdjacentHTML('beforeend', `<div class="hub-msg user">${esc(text)}</div><div class="hub-msg ai">${H.md(r.answer)}</div>`);
        box.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        el.querySelector('#d-ai').value = '';
      } catch (er) { H.toast(er.name === 'TimeoutError' ? 'ИИ думает слишком долго — попробуйте ещё раз' : er.message, 6000); }
      b.disabled = false; b.textContent = 'Спросить'; return;
    }
  }
  // гость по ссылке — ипотечный брокер или юрист (без входа): hub.html#deal-guest=<токен>
  async function guest(token, ctx) {
    const r = await H.call('deal_guest', { t: token });
    ctx.el.innerHTML = `<h2>📑 ${esc(r.title)}</h2><p class="hint">Вы приглашены как ${esc(r.role)}. Этап: ${esc(r.stage)}.</p>${H.star()}
      <div class="dl-cols"><div class="dl-col"><div class="dl-col-h"><b>🧑‍💼 Документы продавца</b></div><ul>${r.kind.seller.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>
      <div class="dl-col"><div class="dl-col-h"><b>🧑 Документы покупателя</b></div><ul>${r.kind.buyer.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>
      <div class="dl-col"><div class="dl-col-h"><b>🧭 Этапы</b></div><ol>${r.kind.stages.map(s => `<li>${esc(s)}</li>`).join('')}</ol></div></div>
      ${r.docs?.length ? `<section class="hub-sec dl-sec"><h3>📎 Документы сделки</h3><div class="dl-docs">${r.docs.map(x => `<div class="dl-doc"><div class="dl-doc-h"><b>📄 ${esc(x.name)}</b>
        <span class="dl-badge ${x.check_ok == null ? 'none' : x.check_ok ? 'ok' : 'warn'}">${x.check_ok == null ? 'не проверен' : x.check_ok ? '✓ без существенных замечаний' : '⚠️ есть замечания'}</span>
        ${x.url ? `<a class="btn soft" href="${esc(x.url)}" target="_blank" rel="noopener">Открыть</a>` : ''}</div>
        ${x.check_note ? `<details><summary>Заключение ИИ-юриста</summary><div class="dl-note">${H.md(x.check_note)}</div></details>` : ''}</div>`).join('')}</div>
        <p class="hint">Ссылки на файлы действуют 1 час — обновите страницу, если не открываются.</p></section>` : ''}
      <p class="hint">С банком сервис не связан — документы в банк загружаете вы.</p>`;
  }
  window.SEC = window.SEC || {};
  window.SEC.deal = { title: 'Сделки', open };
  window.SEC['deal-guest'] = { title: 'Сделка', open: guest, public: true };
})();
