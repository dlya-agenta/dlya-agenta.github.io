// «Юрист» и «Ипотечный брокер» (v5.16, п. 4; v5.24b — пп. 4–5 Алексея 03.11): окно компактнее (до 760 px), три раздела —
// «💬 Вопрос» (текстом или голосом 🎤, история, примеры), «📎 Документы и проверка» (любой формат, несколько файлов сразу перетаскиванием или кнопкой →
// ИИ определяет документы, чего не хватает, наводящие вопросы → «🔎 Проверить объект» → отчёт: проверено → найдено → не хватает → вывод, риск, документы, шаги),
// «👥 Группа» (подключённый мессенджер: читает и пишет только по нажатию, отвечает только на сайте). Квоты в месяц — счётчики вверху и у кнопок.
// Сервер — hub/law.ts (law_*), рендер отчёта — sec/docs.js (window.LAWR). Ответ ИИ — 30–120 с.
(() => {
  const H = window.HUB, esc = H.esc;
  const R = {
    lawyer: { icon: '⚖️', title: 'Юрист', other: ['broker', '🏦 Ипотечный брокер'], ph: 'Например: продавец получил квартиру по наследству 2 года назад, второй наследник отказался у нотариуса. Что проверить и какие документы нужны?',
      ex: ['Как проверить собственника перед задатком?', 'Квартира куплена в браке, супруг в другом городе — как оформить согласие?', 'Дети прописаны в продаваемой квартире — что нужно от опеки?', 'Налог продавца: квартира в собственности 3 года, единственное жильё'] },
    broker: { icon: '🏦', title: 'Ипотечный брокер', other: ['lawyer', '⚖️ Юрист'], ph: 'Например: клиент — ИП, доход 250 тыс. в месяц, первый взнос 30 %, хочет 2к на вторичке в Сочи за 14 млн. Какие программы и банки подойдут?',
      ex: ['Семейная ипотека на вторичку в Сочи — можно ли?', 'Ипотека на апартаменты — какие условия и какие банки дают?', 'Как посчитать платёж: 12 млн, 20 лет, ставка 18 %?', 'Как оплатить маткапиталом часть первого взноса?'] },
  };
  const Q = { q: 'Вопросы', docs: 'Документы', check: 'Проверки', ctx: 'Чтение группы' };
  const SVC = { tg: 'Telegram', wa: 'WhatsApp', max: 'MAX' };
  const kb2 = n => n > 1048576 ? `${(n / 1048576).toFixed(1).replace('.0', '')} МБ` : `${Math.max(1, Math.round(n / 1024))} КБ`;
  const L = () => window.LAWR;
  const fail = e => L().fail(e);
  let S = null;   // состояние окна: {role, el, st, tab, batch, ans, kind, quota}

  // ---------- квоты ----------
  const left = k => { const x = S.quota?.[k]; return !x || x.lim == null ? null : Math.max(0, x.lim - x.used); };
  const leftTxt = k => { const n = left(k); return n == null ? 'без лимита' : `осталось ${n} из ${S.quota[k].lim}`; };
  function setQ(q) {
    if (q) S.quota = q;
    const box = S.el.querySelector('#lw-q');
    if (box) box.innerHTML = Object.entries(Q).map(([k, t]) => { const x = S.quota?.[k]; const n = left(k);
      return `<span class="lw-qc${n === 0 ? ' end' : ''}" title="${esc(t)} в этом месяце">${esc(t)} <b>${!x ? '—' : x.lim == null ? '∞' : `${x.used} из ${x.lim}`}</b></span>`; }).join('')
      + (S.quota?.month_end ? `<small class="muted">обновятся ${H.day(S.quota.month_end)}</small>` : '');
    S.el.querySelectorAll('[data-left]').forEach(s => { s.textContent = leftTxt(s.dataset.left); });
  }

  async function open(role, ctx, arg) {
    const c = R[role];
    ctx.el.innerHTML = '<p class="muted">Загрузка…</p>';
    const st = await H.call('law_init', { role });
    S = { role, el: ctx.el, st, tab: ['docs', 'grp'].includes(arg) ? arg : 'ask', batch: st.batch ?? null, ans: {}, kind: 'object', quota: st.quota };
    ctx.el.innerHTML = `<div class="law-wrap">
      <div class="dl-head law-head"><h2>${c.icon} ${c.title}</h2><a class="btn ghost" href="#${c.other[0]}">${c.other[1]}</a></div>
      <div class="lw-q" id="lw-q" aria-label="Лимиты в этом месяце"></div>
      <div class="lw-tabs" role="tablist">${[['ask', '💬 Вопрос'], ['docs', '📎 Документы и проверка'], ['grp', '👥 Группа']].map(([k, t]) =>
        `<button type="button" role="tab" class="lw-tab${S.tab === k ? ' on' : ''}" data-tab="${k}" aria-selected="${S.tab === k}">${t}</button>`).join('')}</div>
      <div id="lw-p"></div>${H.star()}</div>`;
    setQ();
    ctx.el.querySelector('.lw-tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) tab(b.dataset.tab); };
    tab(S.tab);
  }
  function tab(k) {
    S.tab = k;
    S.el.querySelectorAll('.lw-tab').forEach(b => { b.classList.toggle('on', b.dataset.tab === k); b.setAttribute('aria-selected', b.dataset.tab === k); });
    const p = S.el.querySelector('#lw-p');
    p.onclick = null; p.onchange = null;
    (k === 'docs' ? docsTab : k === 'grp' ? grpTab : askTab)(p);
    setQ();
  }

  // ---------- 💬 вопрос ----------
  function askTab(p) {
    const c = R[S.role], st = S.st;
    p.innerHTML = `<section class="hub-sec dl-sec law">
        <div class="hub-msgs law-msgs" id="l-msgs">${st.msgs.length ? st.msgs.map(m => msg(m.who, m.text)).join('') : `<p class="muted">Задайте вопрос текстом или голосом 🎤 — ИИ ответит как ${c.title === 'Юрист' ? 'юрист по сделкам с недвижимостью' : 'ипотечный брокер'}. Пишите подробно: цифры, сроки, кто собственники.</p>`}</div>
        <div class="law-ex">${c.ex.map(x => `<button type="button" class="chip" data-ex="${esc(x)}">${esc(x)}</button>`).join('')}</div>
        <div class="law-in"><textarea id="l-q" rows="3" maxlength="6000" placeholder="${esc(c.ph)}"></textarea>
          ${H.voiceOk() ? '<button type="button" class="btn soft law-mic" id="l-mic" title="Сказать голосом" aria-label="Сказать голосом">🎤</button>' : ''}</div>
        <p class="hub-actions"><button class="btn primary" id="l-go">Спросить <small data-left="q"></small></button>${st.msgs.length ? '<button class="btn ghost" id="l-clear">Очистить историю</button>' : ''}
          <a class="btn ghost" href="#kb">📚 База знаний</a></p>
        <p class="hint" id="l-wait" hidden>⏳ Думаю… до минуты. Не закрывайте страницу.</p>
        <p class="hint">Ответ ИИ — справка, не юридическая консультация.</p></section>`;
    const box = p.querySelector('#l-msgs'), q = p.querySelector('#l-q'), go = p.querySelector('#l-go');
    box.scrollTop = box.scrollHeight;
    async function ask() {
      const text = q.value.trim();
      if (text.length < 10) { H.toast('Напишите или скажите вопрос подробнее'); q.focus(); return; }
      go.disabled = true; go.firstChild.textContent = 'Думаю… до минуты '; p.querySelector('#l-wait').hidden = false;
      if (!box.querySelector('.hub-msg')) box.innerHTML = '';
      box.insertAdjacentHTML('beforeend', msg('user', text) + '<div class="hub-msg ai law-typing"><span></span><span></span><span></span></div>');
      box.scrollTop = box.scrollHeight;
      try {
        const r = await H.call('law_ask', { role: S.role, text }, { signal: AbortSignal.timeout?.(150000) });
        box.querySelector('.law-typing')?.remove();
        box.insertAdjacentHTML('beforeend', msg('ai', r.answer));
        S.st.msgs.push({ who: 'user', text }, { who: 'ai', text: r.answer });
        box.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
        q.value = ''; setQ(r.quota);
      } catch (e) {
        box.querySelector('.law-typing')?.remove(); box.lastElementChild?.remove();
        fail(e);
      } finally { go.disabled = false; go.firstChild.textContent = 'Спросить '; p.querySelector('#l-wait').hidden = true; }
    }
    go.onclick = ask;
    q.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) ask(); });
    p.querySelector('#l-mic')?.addEventListener('click', e => H.voice(q, e.currentTarget));
    p.querySelectorAll('[data-ex]').forEach(b => b.onclick = () => { q.value = b.dataset.ex; q.focus(); });
    p.querySelector('#l-clear')?.addEventListener('click', async () => { if (!confirm('Очистить историю вопросов?')) return; await H.call('law_clear', { role: S.role }); S.st.msgs = []; askTab(p); setQ(); });
  }
  const msg = (who, text) => `<div class="hub-msg ${who === 'ai' ? 'ai' : 'user'}">${who === 'ai' ? H.md(text) : esc(text).replace(/\n/g, '<br>')}</div>`;

  // ---------- 📎 документы и проверка ----------
  function docsTab(p) {
    const b = S.batch, broker = S.role === 'broker';
    p.innerHTML = `<section class="hub-sec dl-sec lw-docs">
        <label class="lw-drop" id="lw-drop"><input type="file" multiple accept="*/*" data-files>
          <b>📎 ${b ? 'Догрузить документы в этот пакет' : 'Перетащите документы сюда или нажмите, чтобы выбрать'}</b>
          <small>Любой формат: PDF, фото (JPG, PNG, HEIC), DOC/DOCX, XLS — до 20 МБ файл. ${b ? 'Догрузка в тот же пакет — без новой загрузки из лимита.' : `Загрузка — <span data-left="docs"></span>.`}</small></label>
        <p class="lw-tip">💡 Загрузите все документы сразу — проверка считается одной. ${broker ? 'Для ипотеки: ЕГРН, основание права, техплан, паспорт и доход покупателя.' : 'ЕГРН, основание права, паспорта, согласие супруга, справки — сколько есть.'}</p>
        <p class="hint" id="lw-prog" hidden></p>
        <div id="lw-batch">${b ? batchHtml(b) : ''}</div>
        <div id="lw-rep"></div></section>
      ${S.st.reports?.length ? `<section class="hub-sec dl-sec lw-old"><h3>🗂 Прошлые проверки</h3><div class="lw-reps">${S.st.reports.map(repRow).join('')}</div></section>` : ''}`;
    const drop = p.querySelector('#lw-drop');
    ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('on'); }));
    ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('on'); }));
    drop.addEventListener('drop', e => { if (e.dataTransfer?.files?.length) upload(e.dataTransfer.files); });
    p.onchange = e => { if (e.target.matches('[data-files]') && e.target.files?.length) { upload(e.target.files); e.target.value = ''; } };
    p.onclick = onDocsClick;
  }
  const repRow = x => `<button class="lw-rep" data-rep="${esc(x.id)}"><span class="lr-dot ${esc(x.risk ?? 'mid')}" aria-hidden="true"></span>
    <span><b>${x.kind === 'owner' ? 'Собственник' : 'Объект'} · ${esc((L().RISK[x.risk] ?? L().RISK.mid)[0])} риск</b><small>${esc((x.summary ?? '').slice(0, 140))}</small></span>
    <small class="muted">${H.when(x.at)}${x.deal_id ? ' · в сделке' : ''}</small></button>`;
  function batchHtml(b) {
    const qs = b.questions ?? [];
    return `<div class="lw-files">${(b.docs ?? []).map(d => `<div class="lw-file" data-doc="${d.id}">
        <span class="lw-fi" aria-hidden="true">${/^image\//.test(d.mime ?? '') ? '🖼' : '📄'}</span>
        <span class="lw-fn"><b>${esc(d.kind || d.name)}</b><small>${esc(d.kind ? d.name : '')}${d.size ? ` · ${kb2(d.size)}` : ''}</small></span>
        <span class="lw-rd ${d.read ? 'ok' : 'no'}">${d.read ? '✓ прочитан ИИ' : '— не прочитан (формат)'}</span>
        <span class="lw-fb"><button class="btn ghost" data-open="${d.id}">Открыть</button><button class="btn ghost bad" data-del="${d.id}" aria-label="Удалить ${esc(d.name)}">✕</button></span></div>`).join('')}</div>
      ${b.summary ? `<p class="lw-sum">${esc(b.summary)}</p>` : ''}
      ${b.found?.length ? `<div class="lw-found"><b>✓ Есть:</b> ${b.found.map(x => `<span class="lw-ok">${esc(x)}</span>`).join('')}</div>` : ''}
      ${b.missing?.length ? `<div class="lw-miss"><b>⚠️ Не хватает:</b><ul>${b.missing.map(m => `<li><b>${esc(m.name ?? m)}</b>${m.why ? ` — ${esc(m.why)}` : ''}</li>`).join('')}</ul>
        <small>Догрузите их в этот пакет кнопкой выше — проверка увидит.</small></div>` : ''}
      ${qs.length ? `<div class="lw-qs"><b>❓ Ответьте, чтобы проверка была точнее:</b>${qs.map(q => `<div class="lw-qq"><span>${esc(q.q)}</span>
        <span class="lw-opts">${(q.opts?.length ? q.opts : ['Да', 'Нет', 'Не знаю']).map(o => `<button type="button" class="chip${S.ans[q.id] === o ? ' on' : ''}" data-q="${esc(q.id)}" data-a="${esc(o)}">${esc(o)}</button>`).join('')}</span></div>`).join('')}</div>` : ''}
      <div class="lw-go">
        <div class="lw-kind" role="radiogroup" aria-label="Что проверить">${[['object', '🏠 Объект'], ['owner', '🧑 Собственника']].map(([k, t]) =>
          `<button type="button" class="lw-tab${S.kind === k ? ' on' : ''}" data-kind="${k}" role="radio" aria-checked="${S.kind === k}">${t}</button>`).join('')}</div>
        <button class="btn primary lw-check" data-check>🔎 Проверить ${S.kind === 'owner' ? 'собственника' : 'объект'} <small data-left="check">${esc(leftTxt('check'))}</small></button>
        <button class="btn ghost" data-newb>Новый пакет</button></div>
      <p class="hint">Проверка по документам и открытым источникам — 1–2 минуты. Где нужна капча или плата (ФССП, суды, выписка ЕГРН) — дадим ссылку, проверьте сами.</p>`;
  }
  const drawBatch = () => { const box = S.el.querySelector('#lw-batch'); if (box) box.innerHTML = S.batch ? batchHtml(S.batch) : ''; setQ(); };

  // фото больше 3 МБ или не JPEG/PNG/WEBP (HEIC) — в JPEG до 2200 px, если браузер умеет; остальное — как есть
  async function prep(f) {
    if (f.type.startsWith('image/') && (f.size > 3e6 || !/jpeg|png|webp/.test(f.type))) {
      try {
        const bmp = await createImageBitmap(f), k = Math.min(1, 2200 / Math.max(bmp.width, bmp.height));
        const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
        cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
        const blob = await new Promise(ok => cv.toBlob(ok, 'image/jpeg', 0.85));
        if (blob) return { blob, name: f.name.replace(/\.\w+$/, '') + '.jpg', mime: 'image/jpeg' };
      } catch { /* не вышло — как есть */ }
    }
    return { blob: f, name: f.name, mime: f.type || 'application/octet-stream' };
  }
  async function upload(files) {
    const prog = S.el.querySelector('#lw-prog'), drop = S.el.querySelector('#lw-drop');
    const big = [...files].filter(f => f.size > 20 * 1048576);
    if (big.length) H.toast(`Больше 20 МБ — не загрузим: ${big.map(f => f.name).join(', ')}`, 7000);
    const ok = [...files].filter(f => f.size <= 20 * 1048576).slice(0, 30);
    if (!ok.length) return;
    drop.classList.add('busy'); prog.hidden = false; prog.textContent = '⏳ Готовим файлы…';
    try {
      const ready = []; for (const f of ok) ready.push(await prep(f));
      const up = await H.call('law_doc_up', { role: S.role, batch: S.batch?.id, files: ready.map(x => ({ name: x.name, size: x.blob.size, mime: x.mime })) });
      let n = 0;
      for (const [i, it] of (up.items ?? []).entries()) {
        prog.textContent = `⏳ Загружаем ${i + 1} из ${up.items.length}: ${it.name}`;
        const x = ready[i];
        const r = await fetch(it.url, { method: 'PUT', headers: { 'content-type': x.mime }, body: x.blob }).catch(() => null);
        if (r?.ok) n++; else H.toast(`«${it.name}» не загрузился — попробуйте ещё раз`, 6000);
      }
      prog.textContent = `🤖 Загружено ${n} из ${up.items?.length ?? 0}. ИИ читает документы — до минуты…`;
      S.batch = await H.call('law_doc_done', { batch: up.batch }, { signal: AbortSignal.timeout?.(170000) });
      if (S.batch.quota) setQ(S.batch.quota);
      else H.call('law_quota').then(setQ).catch(() => {});
      prog.hidden = true;
      docsTab(S.el.querySelector('#lw-p'));
      S.el.querySelector('#lw-batch')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) { prog.hidden = true; fail(e); }
    finally { drop?.classList.remove('busy'); }
  }
  async function onDocsClick(e) {
    const t = e.target;
    const qa = t.closest('[data-q]');
    if (qa) { S.ans[qa.dataset.q] = qa.dataset.a; qa.parentElement.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === qa)); return; }
    const k = t.closest('[data-kind]');
    if (k) { S.kind = k.dataset.kind; drawBatch(); return; }
    const op = t.closest('[data-open]');
    if (op) { try { const r = await H.call('law_doc_url', { id: +op.dataset.open }); window.open(r.url, '_blank', 'noopener'); } catch (er) { fail(er); } return; }
    const dl = t.closest('[data-del]');
    if (dl) { if (!confirm('Удалить документ? Файл удалится из хранилища.')) return; try { S.batch = await H.call('law_doc_del', { id: +dl.dataset.del }); if (!S.batch?.docs?.length) S.batch = null; docsTab(S.el.querySelector('#lw-p')); } catch (er) { fail(er); } return; }
    if (t.closest('[data-newb]')) { if (!confirm('Начать новый пакет документов? Это новая загрузка из лимита месяца.')) return; S.batch = null; S.ans = {}; docsTab(S.el.querySelector('#lw-p')); return; }
    const rp = t.closest('[data-rep]');
    if (rp) { try { const r = await H.call('law_report', { id: rp.dataset.rep }); showRep(r.id ?? rp.dataset.rep, r.report); } catch (er) { fail(er); } return; }
    const ck = t.closest('[data-check]');
    if (ck) {
      const qs = S.batch?.questions ?? [], miss = qs.filter(q => !S.ans[q.id]);
      if (miss.length && !confirm(`Без ответа ${miss.length} из ${qs.length} вопросов — проверить так («Не знаю»)?`)) return;
      ck.disabled = true; ck.firstChild.textContent = '⏳ Проверяем — 1–2 минуты ';
      try {
        const r = await H.call('law_check', { batch: S.batch.id, kind: S.kind, answers: { ...Object.fromEntries(qs.map(q => [q.id, 'Не знаю'])), ...S.ans }, role: S.role }, { signal: AbortSignal.timeout?.(170000) });
        if (r.quota) setQ(r.quota);
        S.st.reports = [{ id: r.id, at: r.report.at ?? new Date().toISOString(), kind: S.kind, risk: r.report.risk, summary: r.report.summary, deal_id: null }, ...(S.st.reports ?? [])].slice(0, 10);
        showRep(r.id, r.report);
      } catch (er) { fail(er); }
      ck.disabled = false; ck.firstChild.textContent = `🔎 Проверить ${S.kind === 'owner' ? 'собственника' : 'объект'} `;
    }
  }
  function showRep(id, rep) {
    const box = S.el.querySelector('#lw-rep');
    L().report(box, rep, { id });
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- 👥 группа ----------
  function grpTab(p) {
    const conn = S.st.conn ?? {}, any = Object.values(conn).some(Boolean), gs = S.st.groups ?? [];
    p.innerHTML = `<section class="hub-sec dl-sec lw-grp">
      <p class="lw-tip">🔒 ${R[S.role].title} читает и пишет группу <b>только по вашему нажатию</b>, отвечает <b>только здесь, на сайте</b> — в группу сам ничего не пишет. Чтение группы — <span data-left="ctx"></span>.</p>
      ${any ? `<div class="lw-link"><select id="lw-svc" aria-label="Мессенджер">${Object.entries(SVC).map(([k, t]) => `<option value="${k}"${conn[k] ? '' : ' disabled'}>${t}${conn[k] ? '' : ' — не подключён'}</option>`).join('')}</select>
          <input id="lw-chat" maxlength="120" placeholder="Название группы — точно как в мессенджере"><button class="btn primary" data-link>Подключить к группе</button></div>
          ${Object.values(conn).every(Boolean) ? '' : '<p class="hint">Другие мессенджеры — <a href="hub.html#msg">🔗 Мессенджеры</a>.</p>'}`
        : `<div class="lw-noconn"><b>Сначала подключите мессенджер</b><p>Войдите в Telegram, WhatsApp или MAX в разделе «🔗 Мессенджеры» — после этого юриста можно подключить к группе сделки.</p>
          <a class="btn primary" href="hub.html#msg">🔗 Подключить мессенджер</a></div>`}
      <div class="lw-gs">${gs.map(grpHtml).join('') || (any ? '<p class="muted">Групп пока нет — укажите название группы выше.</p>' : '')}</div></section>`;
    if (!any) window.CONN?.warn?.('law');
    p.onclick = onGrpClick;
  }
  const grpHtml = g => `<div class="lw-g" data-g="${g.id}"><div class="lw-gh"><b>${esc(SVC[g.svc] ?? g.svc)} · ${esc(g.chat)}</b>
      <small class="muted">${g.last_read_at ? `прочитана ${H.when(g.last_read_at)}` : 'ещё не читали'}</small><button class="btn ghost bad" data-unlink="${g.id}">Отключить</button></div>
    <div class="lw-gi"><input data-gq maxlength="500" placeholder="Что выяснить (по желанию): например, какие документы обещал продавец"><button class="btn soft" data-read="${g.id}">📖 Прочитать группу</button></div>
    <details class="lw-gw"><summary>✍️ Написать в группу</summary><textarea data-gt rows="3" maxlength="2000" placeholder="Текст сообщения в группу"></textarea>
      <p><button class="btn soft" data-preview="${g.id}">Показать перед отправкой</button></p></details>
    <div class="lw-gout" data-out></div></div>`;
  const JOB = { wait: '⏳ Ждём сервер мессенджеров — до 3 минут…', run: '📖 Читаем группу…', read: '🤖 ИИ разбирает переписку…', done: '✓ Готово', fail: '⚠️ Не получилось' };
  async function poll(job, out, kind) {
    const t0 = Date.now();
    for (;;) {
      let j;
      try { j = await H.call('law_grp_job', { job }); } catch (e) { out.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
      if (j.status === 'done') {
        out.innerHTML = kind === 'write' ? '<p class="lw-okmsg">✓ Сообщение отправлено в группу</p>' : `<div class="hub-msg ai">${H.md(j.answer ?? 'Пусто')}</div>${j.n ? `<small class="muted">Прочитано сообщений: ${j.n}</small>` : ''}`;
        H.call('law_quota').then(setQ).catch(() => {});
        return;
      }
      if (j.status === 'fail') { out.innerHTML = `<p class="err">⚠️ ${esc(j.error || 'Не получилось')}</p>`; return; }
      out.innerHTML = `<p class="hint lw-wait">${JOB[j.status] ?? JOB.wait} <small>${Math.round((Date.now() - t0) / 1000)} с</small></p>`;
      if (Date.now() - t0 > 15 * 60e3) { out.innerHTML = '<p class="err">Сервер мессенджеров не ответил за 15 минут — попробуйте позже.</p>'; return; }
      if (!document.body.contains(out)) return;   // ушли из раздела
      await new Promise(ok => setTimeout(ok, 5000));
    }
  }
  async function onGrpClick(e) {
    const t = e.target, p = S.el.querySelector('#lw-p');
    if (t.closest('[data-link]')) {
      const svc = p.querySelector('#lw-svc').value, chat = p.querySelector('#lw-chat').value.trim();
      if (chat.length < 2) { H.toast('Напишите название группы'); return; }
      try { const r = await H.call('law_grp_link', { svc, chat, role: S.role }); S.st.groups = [r.group, ...(S.st.groups ?? [])]; grpTab(p); H.toast('Группа подключена'); }
      catch (er) { if (er.code === 'no_conn') { H.toast(er.message, 6000); location.hash = 'msg'; } else fail(er); }
      return;
    }
    const ul = t.closest('[data-unlink]');
    if (ul) { if (!confirm('Отключить юриста от группы?')) return; try { await H.call('law_grp_unlink', { id: +ul.dataset.unlink }); S.st.groups = S.st.groups.filter(g => g.id !== +ul.dataset.unlink); grpTab(p); } catch (er) { fail(er); } return; }
    const g = t.closest('[data-g]'); if (!g) return;
    const out = g.querySelector('[data-out]');
    const rd = t.closest('[data-read]');
    if (rd) {
      rd.disabled = true;
      try { const r = await H.call('law_grp_read', { id: +rd.dataset.read, question: g.querySelector('[data-gq]').value.trim() || undefined }); await poll(r.job, out, 'read'); }
      catch (er) { fail(er); }
      rd.disabled = false; return;
    }
    const pv = t.closest('[data-preview]');
    if (pv) {
      const text = g.querySelector('[data-gt]').value.trim();
      if (text.length < 2) { H.toast('Напишите текст сообщения'); return; }
      const gr = (S.st.groups ?? []).find(x => x.id === +pv.dataset.preview);
      const s = L().sheet('Отправить в группу?', `<p class="hint">${esc(SVC[gr?.svc] ?? '')} · <b>${esc(gr?.chat ?? '')}</b> — уйдёт ровно этот текст от вашего имени:</p>
        <div class="lw-pre">${esc(text).replace(/\n/g, '<br>')}</div><p class="hub-actions"><button class="btn primary" data-send>Отправить</button><button class="btn ghost" data-x>Изменить</button></p>`);
      s.box.querySelector('[data-send]').onclick = async ev => {
        ev.currentTarget.disabled = true;
        try { const r = await H.call('law_grp_write', { id: +pv.dataset.preview, text }); s.close(); g.querySelector('[data-gt]').value = ''; g.querySelector('details').open = false; await poll(r.job, out, 'write'); }
        catch (er) { s.close(); fail(er); }
      };
    }
  }

  window.SEC = window.SEC || {};
  window.SEC.lawyer = { title: 'Юрист', open: (a, ctx) => open('lawyer', ctx, a) };
  window.SEC.broker = { title: 'Ипотечный брокер', open: (a, ctx) => open('broker', ctx, a) };
  // отчёт по ссылке «Поделиться» (7 дней) — без входа: hub.html#law-report=<t>
  window.SEC['law-report'] = { title: 'Отчёт проверки', public: true, open: async (t, ctx) => {
    const r = await H.call('law_public', { t });
    ctx.el.innerHTML = '<div class="law-wrap"><div id="lw-pub"></div><p class="hint">Отчёт подготовлен сервисом «Для Агента». Ссылка действует 7 дней.</p></div>';
    L().report(ctx.el.querySelector('#lw-pub'), r.report, { share: false, attach: false });
  } };
})();
