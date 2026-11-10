// «Мой помощник» (v5.16, п. 2): любая просьба словами или голосом — ИИ сам ищет, анализирует, готовит подборку, ставит задачи в CRM,
// отправляет в рекламу, готовит рассылку и ролик, создаёт сделку. Ответ: текст ИИ (HUB.md), шаги «что сделал», объекты карточками,
// кнопки-действия (подборка, разделы, сообщения собственникам). Отмеченные галочками объекты уходят в запрос (picked). Голос — HUB.voice
// (слушает, пока человек говорит; пауза 4 с или ⏹ — отправка). Каждый диалог — своё окно, слева — история. Сервер — hub/helper.ts.
(() => {
  const H = window.HUB, esc = H.esc;
  const PH = 'https://arojogajdamsyrrpcmso.supabase.co/storage/v1/object/public/photos/w', MEDIA = 'https://zpkqduhbymvadtwgcyhp.supabase.co/storage/v1/object/public/photos/w';
  const photo = x => x.pics ? x.pics[0] : x.web_photos ? (x.web_photos_v === 3 ? `${MEDIA}/${x.num}/0.jpg` : `${PH}/${x.num}/0.jpg`) : '';
  const title = x => [x.rooms === 0 ? 'Студия' : x.rooms ? `${x.rooms}-комн.` : '', x.type_name || x.kind || '', x.area ? `${x.area} м²` : '', x.floor ? `${x.floor}/${x.floors ?? '?'} эт.` : ''].filter(Boolean).join(' · ');
  const place = x => [x.zk || x.complex, x.sub || x.district].filter(Boolean).join(' · ');
  const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } } };
  let st = null, cur = null, picked = new Set(), el = null, audience = null, clientId = null, clientContext = null, clients = [];
  // v5.48 F (п. 21): ИИ-Агент — тот же раздел во всплывающем окне на любой странице (agent.js: рамка hub.html?agent=1#helper).
  // В окне: переходы по ссылкам — во всей вкладке, «Открыть» объявление — окно поверх страницы, номер диалога — родителю (переход по сайту без потери).
  const AG = new URLSearchParams(location.search).has('agent') && window.parent !== window;
  const up = m => { if (AG) parent.postMessage({ agent: 1, ...m }, location.origin); };
  const go = u => { if (AG) up({ type: 'go', href: new URL(u, location.href).href }); else location.href = u; };
  let poll = null, opts = {};
  if (AG) {
    document.documentElement.classList.add('agent');
    addEventListener('message', e => {
      if (e.origin !== location.origin || !e.data?.agent) return;
      const m = e.data;
      if (m.type === 'ask') { opts = { mode: m.mode, page: m.page }; if (m.fresh) newDialog(); ask(m.q); }
      if (m.type === 'page') opts.page = m.page;
      if (m.type === 'new') newDialog();
      if (m.type === 'fill') { const i = el?.querySelector('#h-q'); if (i) { i.value = m.q; i.focus(); } }
    });
    // ссылки и объявления — во всей вкладке, а не в маленьком окне
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href]');
      if (!a || a.target === '_blank' || /^(#|javascript:|tel:|mailto:|https?:\/\/(?!dlya-agenta))/.test(a.getAttribute('href'))) return;
      const ob = a.dataset.obj || /#o=(\d+)/.exec(a.getAttribute('href'))?.[1];
      e.preventDefault(); e.stopPropagation();
      if (ob) up({ type: 'obj', num: +ob }); else go(a.getAttribute('href'));
    }, true);
  }
  const openObj = n => AG ? up({ type: 'obj', num: +n }) : window.OBJPOP?.open(n);
  const TIPS = ['Подбери 3 лучшие студии до 7 млн у моря и сравни с рынком', 'Проанализируй отмеченные объекты: что выгоднее и почему', 'Что у меня в очереди рекламы?',
    'Поставь задачу: показ завтра в 15:00', 'Сделай подборку из отмеченных', 'Какие документы нужны при продаже по наследству?'];

  // v5.47 E (Алексей, п. 6): карточка как в обычном поиске — фото листаются (палец, стрелки), цена, ₽/м², ЖК, полный адрес, «Выбрать»,
  // «📞 Связаться» (номер — в меню, замок 🔒/🔓 у цены), «Открыть» — окно объявления поверх страницы (objpop.js), № — тоже ссылка
  const nPh = x => x.web_photos || x.pics?.length || 0;
  const phUrl = (x, k) => x.pics ? x.pics[k] : x.web_photos_v === 3 ? `${MEDIA}/${x.num}/${k}.jpg` : k < 4 ? `${PH}/${x.num}/${k}.jpg` : `${MEDIA}/${x.num}/${k}.webp`;
  const rub = v => `${Math.round(v).toLocaleString('ru-RU')} ₽`;
  const MSG = 'Здравствуйте! Я агент по недвижимости, у меня есть покупатель на ваш объект. Удобно обсудить показ?';
  const lock = x => `<i class="lk${x.phone || x.tg ? ' on' : ''}" title="${x.phone || x.tg ? 'Номер открыт' : 'Номер ещё не открыт'}">${x.phone || x.tg ? '🔓' : '🔒'}</i>`;
  const phoneHtml = (x, open = false) => {
    const btn = '📞 Связаться <i aria-hidden="true">▾</i>';
    if (!x.phone && !x.tg) return `<button type="button" class="btn soft ph-btn" data-hphone="${x.num}">${btn}</button>`;
    const d = String(x.phone ?? '').replace(/\D/g, '');
    return `<div class="phone"><details class="ph-dd"${open ? ' open' : ''}><summary class="btn soft ph-btn">${btn}</summary><div class="ph-menu">
      ${x.phone ? `<div><a class="num" href="tel:${esc(x.phone)}">${esc(x.phone)}</a>${x.owner ? ` — ${esc(x.owner)}` : ''} <small>может быть подменный</small></div>
      <div class="msgs"><a class="m-call" href="tel:${esc(x.phone)}">Позвонить</a><a class="m-wa" href="https://wa.me/${d}?text=${encodeURIComponent(MSG)}" target="_blank" rel="noopener">WhatsApp</a>
        <a class="m-max" href="${H.mobile() ? 'max://' : 'https://web.max.ru/'}" target="_blank" rel="noopener" data-max="${esc(d)}">MAX</a>
        ${x.tg ? `<a class="m-tg" href="https://t.me/${encodeURIComponent(x.tg)}" target="_blank" rel="noopener">Telegram</a>` : ''}<button type="button" class="m-copy" data-hcopy="${esc(x.phone)}">Копировать</button></div>`
      : `<div class="msgs"><a class="m-tg" href="https://t.me/${encodeURIComponent(x.tg)}" target="_blank" rel="noopener">Написать в Telegram</a></div>`}</div></details></div>`;
  };
  const card = x => {
    const n = nPh(x), on = picked.has(x.num);
    const where = [x.street || x.address, x.sub || x.district].filter(Boolean).join(' · ');
    return `<article class="card hub-fc${on ? ' picked' : ''}" data-num="${x.num}">
    <div class="gal" data-n="${n}"><div class="strip">${n ? Array.from({ length: n }, (_, k) => `<div class="ph"><img referrerpolicy="no-referrer" src="${esc(phUrl(x, k))}" alt="" loading="lazy"></div>`).join('') : '<div class="none">Фото нет</div>'}</div>
      ${n > 1 ? `<button type="button" class="nav l" data-hnav="-1" aria-label="Назад">‹</button><button type="button" class="nav r" data-hnav="1" aria-label="Вперёд">›</button>
      <div class="dots">${Array.from({ length: n }, (_, k) => `<i class="${k ? '' : 'on'}"></i>`).join('')}</div>` : ''}
      <label class="pick" title="Отметить для помощника, подборки, рекламы"><input type="checkbox" data-pick="${x.num}"${on ? ' checked' : ''}><i class="pk-box" aria-hidden="true"></i><span class="pk-t">${on ? 'Выбрано' : 'Выбрать'}</span></label></div>
    <div class="body">
      <div class="price"><b>${x.price ? rub(x.price) : 'Цена не указана'}</b><small>${x.price && x.area ? `${Math.round(x.price / x.area).toLocaleString('ru-RU')} ₽/м²` : ''}</small>${lock(x)}</div>
      ${x.zk || x.complex ? `<div class="zk">${esc(x.zk || x.complex)}</div>` : ''}
      <div class="title">${esc(title(x))}</div>
      <div class="addr">${esc(where)}</div>
      ${x.archived ? '<div class="tags"><span class="tag">Архив · требуется уточнить актуальность</span></div>' : ''}
      <div class="meta">№ ${x.num}</div>
      <div class="actions">${phoneHtml(x)}<button type="button" class="btn ghost" data-obj="${x.num}">Открыть</button></div>
    </div></article>`;
  };
  const items = new Map();   // объекты ответов — для телефона и перерисовки

  function quotaLine(q) {
    if (!q) return '';
    return q.trial ? `Пробных запросов: осталось <b>${q.left}</b> из ${q.lim}. В PRO — 10 в месяц, в MAX — 30.` : `Запросов в этом месяце: осталось <b>${q.left}</b> из ${q.lim}.`;
  }
  async function open(arg, ctx) {
    el = ctx.el;
    st = await H.call('help_init');
    cur = arg ? +arg : null;
    audience = 'new'; clientId = null; clientContext = null; picked.clear();   // v5.48 F: выбирать не нужно — по умолчанию новый запрос
    draw();
    up({ type: 'ready', dlg: cur });
    if (!cur) intro();
    const q0 = store.get('helper_q', '');   // голос из строки поиска на главной
    if (q0) { localStorage.removeItem('helper_q'); cur = null; el.querySelector('#h-q').value = q0; }
    if (cur) loadDialog(cur);
  }
  function draw() {
    const voice = H.voiceOk();
    el.innerHTML = `<div class="hub-two">
      <aside class="hub-side"><button class="btn primary" data-new>＋ Новый диалог</button>
        <div class="hub-list">${st.dialogs.map(d => `<button class="hub-li${d.id === cur ? ' on' : ''}" data-dlg="${d.id}"><b>${esc(d.title || 'Новый диалог')}</b><small>${H.when(d.updated_at)}</small></button>`).join('') || '<p class="muted">Диалогов пока нет</p>'}</div>
        <a class="hint" href="help-helper.html" target="_blank">📘 Как пользоваться помощником</a></aside>
      <section class="hub-body">
        ${AG ? `<div class="ag-bar"><button type="button" class="btn soft" data-new>＋ Новый запрос</button>${st.dialogs.length ? `<select data-dlgs aria-label="Прошлые запросы"><option value="">🕘 Прошлые запросы (${st.dialogs.length})</option>${st.dialogs.map(d => `<option value="${d.id}"${d.id === cur ? ' selected' : ''}>${esc((d.title || 'Новый диалог').slice(0, 60))}</option>`).join('')}</select>` : ''}</div>` : '<h2>✨ ИИ-Агент</h2>'}<div id="h-context"></div>
        <p class="hint">${quotaLine(st.quota)}</p>
        <div class="ex-box"><p class="ex-h">💡 Примеры просьб — нажмите, чтобы вставить</p><div class="hub-tips">${TIPS.map(t => `<button type="button" class="chip" data-tip="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>
        <p class="hint" id="h-wait" hidden>⏳ Помощник работает: ищет, сравнивает, выполняет — обычно 20–90 секунд (<b id="h-sec">0</b> с). Можно уйти со страницы — ответ придёт в бот.</p>
        <div id="h-turns"></div>
        <form class="hub-ask h-stick" id="h-ask"><textarea id="h-q" rows="2" placeholder="Что сделать? Например: подбери 2к до 15 млн у моря в Адлере, сравни цены и поставь задачу позвонить клиенту завтра в 10" aria-label="Просьба помощнику" maxlength="2000"></textarea>
          ${voice ? '<button type="button" class="btn soft" id="h-mic" title="Сказать голосом" aria-label="Сказать голосом">🎤</button>' : ''}
          <button class="btn primary" id="h-go">Отправить</button></form>
        </section></div>`;
    renderContext();
    el.onclick = onClick; el.onchange = onChange;
    el.querySelector('#h-ask').onsubmit = e => { e.preventDefault(); ask(); };
    el.querySelector('#h-q').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(); } });
    el.querySelector('#h-mic')?.addEventListener('click', e => H.voice(el.querySelector('#h-q'), e.currentTarget, { onDone: t => ask(t) }));
  }
  function renderContext() {
    const box = el.querySelector('#h-context'); if (!box) return;
    const w = clientContext?.wishes ?? {};
    box.innerHTML = `${AG ? `<details class="h-context ag-ctx"${audience === 'crm' ? ' open' : ''}><summary>👥 Для кого: <b>${audience === 'crm' ? esc(clientContext?.client?.name || 'клиент из CRM') : 'новый запрос'}</b> · изменить</summary>` : '<section class="h-context"><b>Для кого подбираем?</b>'}<div class="hub-tips">
      <button type="button" class="btn ${audience === 'new' ? 'primary' : 'soft'}" data-audience="new">Новый клиент</button>
      <button type="button" class="btn ${audience === 'crm' ? 'primary' : 'soft'}" data-audience="crm">Из CRM</button></div>
      <p class="hint">Для нового клиента учитываю только ваш запрос в этом диалоге. Для клиента из CRM использую его карточку и сохранённые пожелания, чтобы давать конкретные рекомендации. Вы можете посмотреть и изменить память.</p>
      ${audience === 'crm' ? `<label class="field">Клиент<select id="h-client"><option value="">Выберите клиента</option>${(clientContext?.client && !clients.some(c => c.id === clientId) ? [clientContext.client, ...clients] : clients).map(c => `<option value="${Number(c.id)}" ${c.id === clientId ? 'selected' : ''}>${esc(c.name || 'Клиент без имени')}</option>`).join('')}</select></label>` : ''}
      ${clientContext?.client ? `<details class="h-memory"><summary>Пожелания ${esc(clientContext.client.name || 'клиента')}</summary>
        <p class="hint">В карточке CRM: ${esc(clientContext.client.wish || 'пожелания пока не указаны')}. Сохраняйте только подтверждённое клиентом.</p>
        <label class="field">Бюджет до, млн ₽<input id="h-budget" type="number" min="0" step="0.1" value="${(w.budget_max || clientContext.client.budget_to || 0) / 1e6 || ''}"></label>
        <label class="field">Обязательно<textarea id="h-must" maxlength="1200">${esc(w.must || '')}</textarea></label>
        <label class="field">Желательно<textarea id="h-prefer" maxlength="1200">${esc(w.prefer || '')}</textarea></label>
        <label class="field">Не подходит<textarea id="h-avoid" maxlength="1200">${esc(w.avoid || '')}</textarea></label>
        <button type="button" class="btn primary" data-memory-save>Запомнить для этого клиента</button></details>` : ''}${AG ? '</details>' : '</section>'}`;
  }
  async function loadDialog(id) {
    const box = el.querySelector('#h-turns');
    box.innerHTML = '<p class="muted">Загрузка…</p>';
    try {
      const r = await H.call('help_hist', { dialog_id: id });
      clientContext = r.context; audience = r.context?.audience ?? 'new'; clientId = r.context?.client?.id ?? null; renderContext();
      const byNum = new Map(r.items.map(x => [x.num, x]));
      box.innerHTML = r.turns.map(t => turnHtml({ id: t.id, q: t.q, via: t.via, understood: t.note, alt: t.alt, count: t.total, reply: t.reply, actions: t.actions, steps: t.steps, items: t.ids.map(n => byNum.has(n)?{...byNum.get(n),archived:t.f?._archive_nums?.includes(n)}:null).filter(Boolean) })).join('') || '<p class="muted">Напишите или скажите, что нужно сделать.</p>';
      box.lastElementChild?.scrollIntoView({ block: 'start' });   // v5.42A п. 5
      const w = r.turns.find(t => t.via === 'wait');   // v5.48 F: ответ ещё готовится (запрос был на другой странице) — ждём здесь
      if (w && !ask.busy) resume(w);
    } catch (e) { box.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  }
  // v5.48 F: ход в фоне — опрос help_turn каждые 2,5 с (до 3 минут); готово — ход целиком с карточками
  async function waitTurn(id) {
    const t0 = Date.now();
    for (;;) {
      await new Promise(r => { poll = setTimeout(r, 2500); });
      const r = await H.call('help_turn', { id });
      if (!r.wait) {
        const byNum = new Map((r.items ?? []).map(x => [x.num, x])), t = r.turn;
        if (t.via === 'fail') throw new Error(t.reply || 'Не получилось — попробуйте ещё раз');
        return { q: t.q, via: t.via, understood: t.note, alt: t.alt, count: t.total, reply: t.reply, actions: t.actions, steps: t.steps, quota: r.quota,
          items: (t.ids ?? []).map(n => byNum.has(n) ? { ...byNum.get(n), archived: t.f?._archive_nums?.includes(n) } : null).filter(Boolean) };
      }
      if (Date.now() - t0 > 180000) throw new Error('Агент отвечает дольше обычного — ответ появится в этом диалоге и придёт в бот');
    }
  }
  async function resume(w) {
    const box = el.querySelector('#h-turns'), art = [...box.querySelectorAll('.hub-turn')].find(a => a.dataset.tid === String(w.id));
    if (!art) return;
    ask.busy = true;
    try {
      const r = await waitTurn(w.id);
      if (!art.isConnected) return;
      art.outerHTML = turnHtml(r);
    } catch (e) { if (art.isConnected) art.querySelector('.hint').textContent = e.message; }
    finally { ask.busy = false; }
  }
  function newDialog() {
    clearTimeout(poll); ask.busy = false;
    cur = null; audience = 'new'; clientId = null; clientContext = null; picked.clear(); draw(); history.replaceState(null, '', location.search + '#helper');
    up({ type: 'dlg', dlg: null }); intro();
  }
  // что открыто на экране (для «сравни это с рынком»): в окне — от родителя (opts.page), на странице раздела — нечего
  const pageNow = () => null;
  // v5.48 F (пп. 12 d, a, f): при новом запросе — 3 шага «как пользоваться» (первый раз) и сводка на сегодня
  async function intro() {
    const box = el?.querySelector('#h-turns'); if (!box || cur) return;
    const tips = store.get('agent_tips', 0) ? '' : `<section class="ag-tips"><b>Как пользоваться ИИ-Агентом</b><ol>
      <li><b>Скажите или напишите</b>, что нужно: «двушка до 15 млн в Адлере у моря», «сравни с рынком», «поставь задачу позвонить завтра в 10».</li>
      <li><b>Агент сам ищет и делает</b>: подборку, задачу в CRM, рекламу, сообщения собственникам — по вашему тарифу.</li>
      <li><b>Окно можно свернуть</b> и перейти на другую страницу — ответ дождётся вас здесь и придёт в бот.</li></ol>
      <button type="button" class="btn soft" data-tips-ok>Понятно</button></section>`;
    box.innerHTML = tips + '<div class="ag-brief-box"></div>';
    let b = null;
    try { const c = JSON.parse(sessionStorage.getItem('agent_brief') || 'null'); if (c && Date.now() - c.at < 30 * 60e3) b = c.v; } catch { /* */ }
    if (!b) { try { b = await H.call('fb_brief'); sessionStorage.setItem('agent_brief', JSON.stringify({ at: Date.now(), v: b })); } catch { b = null; } }
    const bx = el?.querySelector('.ag-brief-box'); if (!bx || cur || !b) return;
    const parts = [];
    if (b.tasks?.length) parts.push(`<p><b>📋 Задачи на сегодня:</b></p><ul>${b.tasks.map(t => `<li>${t.late ? '⚠️ ' : ''}${esc(t.text)}${t.due_at ? ` <small class="muted">${H.when(t.due_at)}</small>` : ''}</li>`).join('')}</ul>`);
    if (b.replies?.length) parts.push(`<p><b>👍 Отклики клиентов за сутки:</b> ${b.replies.map(r => `«${esc(r.title)}» — подходит ${r.yes}, нет ${r.no}`).join('; ')} · <a href="./#sels=fb">Открыть</a></p>`);
    for (const f of b.fresh ?? []) parts.push(`<p><b>🆕 ${esc(f.name)}:</b> новых за сутки по запросу «${esc(f.wish.slice(0, 60))}» — ${f.nums.length}. <button type="button" class="chip" data-ask="${esc(`Покажи новые за сутки объекты ${f.nums.join(', ')} для клиента ${f.name}: что подходит под его пожелания`)}">Показать</button></p>`);
    bx.innerHTML = parts.length ? `<section class="ag-brief"><div class="ag-brief-h"><b>☀️ Сводка на сегодня</b><button type="button" class="ag-x" data-brief-x aria-label="Скрыть">✕</button></div>${parts.join('')}</section>`
      : (tips ? '' : '<p class="muted">Напишите или скажите, что нужно сделать.</p>');
  }
  const actHtml = (a, i) => a.type === 'owners' ? `<button class="btn primary" data-act="${i}">${esc(a.label)}</button>`
    : a.type === 'selection' ? `<button class="btn primary" data-act="${i}">${esc(a.label)}</button>`
    : a.type === 'link' && /^(\.\/|hub\.html|mail\.html|arch\.html|pay\.html|partner\.html)/.test(a.href ?? '') ? `<a class="btn soft" href="${esc(a.href)}">${esc(a.label)}</a>` : '';
  const turnHtml = (r, offer) => r.via === 'wait' ? `<article class="hub-turn hub-pending" data-tid="${r.id}"><p class="hub-q">🗣 ${esc(r.q)}</p><p class="hint">⏳ Агент работает над этим запросом…</p></article>` : `<article class="hub-turn"><p class="hub-q">🗣 ${esc(r.q)}</p>
    ${r.steps?.length ? `<details class="hub-steps"${r.reply ? '' : ' open'}><summary>Что сделал агент (${r.steps.length})</summary><ul>${r.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>` : ''}
    ${r.reply ? `<div class="hub-reply">${H.md(r.reply)}</div>` : `<p class="hint">${r.understood ? `Понял так: ${esc(r.understood)} · ` : ''}найдено <b>${r.count}</b></p>`}
    ${r.actions?.length ? `<p class="hub-acts" data-acts='${esc(JSON.stringify(r.actions))}'>${r.actions.map(actHtml).join('')}</p>` : ''}
    ${r.alt ? `<p class="hub-alt">💡 ${esc(r.alt.label)} ${r.alt.more ? `<b>+${r.alt.more}</b>` : ''} ${r.alt.q?.length ? `<button class="btn soft" data-alt="${esc(JSON.stringify(r.alt.q))}">Показать</button>` : ''}</p>` : ''}
    ${(r.items ?? []).length ? `<div class="hub-grid hub-cards">${r.items.slice(0, 30).map(x => (items.set(x.num, x), card(x))).join('')}</div>${nextHtml(r)}` : ''}
    ${offer ? `<div class="hub-offer"><b>Что дальше?</b> Отметьте объекты галочками и попросите помощника или нажмите:
      <button class="btn soft" data-owners>✉️ Написать собственникам</button>
      <button class="btn soft" data-go-rk>📣 В рекламу</button><button class="btn soft" data-go-mail>📨 Рассылка</button>
      ${offer.video ? '<button class="btn soft" data-go-video>🎬 Ролик</button>' : ''}</div>` : ''}</article>`;


  // v5.42A п. 4: под ответом с объектами — следующий шаг одним нажатием (без набора текста) и действия группами, как в главном меню
  const NARROW = [['💸 Дешевле', 'То же самое, но дешевле на 10–15 %'], ['💎 Дороже', 'То же самое, но дороже на 10–20 % — что можно получить за эти деньги'],
    ['🗺 + соседние районы', 'Добавь соседние микрорайоны к этому запросу'], ['🎯 Только этот район', 'Оставь только выбранный район, без соседних'],
    ['🏢 + ЖК', 'Покажи варианты в ЖК в этом же месте'], ['➕ Комнат +1', 'То же, но на одну комнату больше'], ['➖ Комнат −1', 'То же, но на одну комнату меньше'],
    ['📐 Больше площадь', 'То же, но площадь больше на 20 %'], ['🌊 Ближе к морю', 'То же, но до моря не дальше 1 км'], ['🛠 С ремонтом', 'Только с современным ремонтом'],
    ['🏗 Новостройки', 'Только новостройки'], ['🏚 Вторичка', 'Только вторичка'], ['🚫 Не старый фонд', 'Без старого фонда (дома от 1990 года)'], ['⏬ Ещё 10', 'Покажи ещё 10 вариантов по этому запросу']];
  const nextHtml = r => {
    const nums = (r.items ?? []).map(x => x.num).slice(0, 30).join(','), asks = (r.actions ?? []).filter(a => a.type === 'ask');
    const g = (t, b) => `<div class="h-g"><b>${t}</b>${b}</div>`, ln = (h, l) => `<a class="chip" href="${h}">${l}</a>`, ak = (l, q) => `<button type="button" class="chip" data-ask="${esc(q)}">${esc(l)}</button>`;
    return `<div class="h-next">
      ${asks.length ? `<p class="ex-h">👉 Следующий шаг</p><div class="hub-tips">${asks.map(a => ak(a.label, a.q || a.label)).join('')}</div>` : ''}
      <p class="ex-h">🔎 Расширить или сузить</p><div class="hub-tips">${[['cheaper','Дешевле на 10 %'],['repair','С ремонтом'],['sea','Ближе к морю'],['more','Ещё варианты']].map(([op,label])=>`<button type="button" class="chip" data-refine="${op}">${label}</button>`).join('')}<span class="hint">Без расхода ИИ</span><details><summary>Другие уточнения</summary>${NARROW.slice(1,-1).map(([l,q])=>ak(l,q)).join('')}</details></div>
      <details class="h-groups"><summary>⚡ Что сделать с этими вариантами</summary>
      ${g('Объявления', ak('📊 Сравнить с рынком', `Сравни цены с рынком: ${nums}`) + ak('🔁 Найти похожие', `Найди похожие на ${nums.split(',').slice(0, 3).join(', ')}`) + ln(`./#favs`, '★ Избранное'))}
      ${g('Мои подборки', ak('📄 Сделать подборку', `Сделай подборку из объектов ${nums}`) + ln('./#sels=all', '📄 Мои подборки'))}
      ${g('Моё', ak('👥 Клиенту в CRM', `Прикрепи объекты ${nums} к клиенту`) + ak('✅ Задача-напоминание', `Поставь задачу: показать объекты ${nums.split(',').slice(0, 3).join(', ')} клиенту завтра в 12:00`))}
      ${g('Помощник', ln('hub.html#lawyer', '⚖️ Юрист') + ln('hub.html#broker', '🏦 Ипотека'))}
      ${g('Продвижение', ak('✉️ Написать собственникам', `Напиши собственникам объектов ${nums.split(',').slice(0, 10).join(', ')}: есть покупатель, удобно ли показать?`) + ak('📣 В рекламу', `Отправь в рекламу объекты ${nums}`) + ak('✉️ В рассылку', `Подготовь рассылку объектов ${nums}`) + ak('🎬 Ролик', `Сделай ролик по объектам ${nums.split(',').slice(0, 10).join(', ')}`))}
      ${g('Кабинет', ak('📑 В сделку', `Открой сделку по объекту ${nums.split(',')[0]}`))}
      </details></div>`;
  };
  if (!document.getElementById('h-css')) document.head.insertAdjacentHTML('beforeend', `<style id="h-css">
    .h-stick{position:sticky;bottom:0;z-index:5;background:var(--bg,#fff);padding:10px 0 calc(10px + env(safe-area-inset-bottom));margin-top:12px;border-top:1px solid color-mix(in srgb,currentColor 15%,transparent)}
    .h-next{margin-top:12px}.h-next .hub-tips{margin:6px 0 10px}.h-groups summary{cursor:pointer;font-weight:700;padding:8px 0}
    .h-g{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0}.h-g>b{min-width:120px;font-size:.9em;opacity:.8}
    @media (max-width:760px){.h-g>b{width:100%}.h-next .chip{min-height:40px}}</style>`);

  async function ask(text) {
    const inp = el.querySelector('#h-q'), q = (text ?? inp.value).trim();
    if (!q) return inp.focus();
    if (!audience) audience = 'new';
    if (audience === 'crm' && !clientId) return H.toast('Выберите клиента из CRM или нажмите «Новый клиент»');
    if (ask.busy) return H.toast('Помощник ещё работает над прошлой просьбой');
    ask.busy = true;
    const wait = el.querySelector('#h-wait'), go = el.querySelector('#h-go');
    let sec = 0; const tick = setInterval(() => { const s2 = el.querySelector('#h-sec'); if (s2) s2.textContent = ++sec; }, 1000);
    try {
      if (!cur) { const d = await H.call('help_new', { audience, client_id: clientId }); cur = d.dialog.id; clientContext = d.context; st.dialogs.unshift({ id: cur, title: q.slice(0, 80), updated_at: new Date().toISOString() }); draw(); history.replaceState(null, '', `#helper=${cur}`); }
      el.querySelector('#h-wait').hidden = false; el.querySelector('#h-go').disabled = true;
      const box0 = el.querySelector('#h-turns');
      if (!box0.querySelector('.hub-turn')) box0.innerHTML = '';
      box0.insertAdjacentHTML('beforeend', `<article class="hub-turn hub-pending"><p class="hub-q">🗣 ${esc(q)}</p><p class="hint">⏳ Работаю…</p></article>`);
      box0.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.querySelector('#h-q').value = '';
      up({ type: 'dlg', dlg: cur });
      const o = opts; opts = {};
      if (o.mode === 'think') H.call('fb_event', { kind: 'think', data: { text: q } }).catch(() => {});
      let r = await H.call('help_ask', { dialog_id: cur, q, picked: [...picked], bg: true, mode: o.mode, page: o.page ?? pageNow() });
      if (r.pending) r = await waitTurn(r.pending);   // v5.48 F: ИИ работает в фоне — окно можно свернуть или уйти на другую страницу
      st.quota = r.quota;
      const box = el.querySelector('#h-turns');
      box.querySelector('.hub-pending')?.remove();
      if (!el.isConnected || box !== el.querySelector('#h-turns')) return;
      box.insertAdjacentHTML('beforeend', turnHtml({ ...r, q }, r.offer));
      box.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => el.querySelector('#h-q')?.focus({ preventScroll: true }), 400);   // v5.42A п. 5: уточнить сразу, поле внизу
      el.querySelector('.hub-body .hint').innerHTML = quotaLine(st.quota);
    } catch (e) {
      el.querySelector('.hub-pending')?.remove();
      if (!el.querySelector('#h-q').value) el.querySelector('#h-q').value = q;
      H.toast(e.message, 6000); if (e.code === 'limit') el.querySelector('.hub-body .hint').innerHTML = `${esc(e.message)} <a href="pay.html?plan=pro">Оформить PRO</a>`;
    } finally { clearInterval(tick); ask.busy = false; const w = el.querySelector('#h-wait'), g = el.querySelector('#h-go'); if (w) w.hidden = true; if (g) g.disabled = false; }
  }
  async function onClick(e) {
    const t = e.target;
    const nv = t.closest('[data-hnav]'); if (nv) { const st2 = nv.closest('.gal').querySelector('.strip'); st2.scrollBy({ left: st2.clientWidth * +nv.dataset.hnav, behavior: 'smooth' }); return; }
    const cp = t.closest('[data-hcopy]'); if (cp) { H.copy(cp.dataset.hcopy, 'Номер скопирован'); return; }
    if (t.closest('.hub-fc .strip img')) { openObj(t.closest('.hub-fc').dataset.num); return; }
    const ob = t.closest('button[data-obj]'); if (ob && AG) { openObj(ob.dataset.obj); return; }
    if (t.closest('[data-tips-ok]')) { store.set('agent_tips', 1); t.closest('.ag-tips')?.remove(); return; }
    if (t.closest('[data-brief-x]')) { t.closest('.ag-brief')?.remove(); return; }
    const dsel = t.closest('[data-dlgs]'); if (dsel) return;
    const hp = t.closest('[data-hphone]'); if (hp) return phone(hp);
    if (ask.busy && t.closest('[data-new],[data-dlg],[data-audience],[data-memory-save]')) return H.toast('Дождитесь завершения запроса');
    if (t.closest('[data-new]')) { newDialog(); el.querySelector('#h-q').focus(); return; }
    const d = t.closest('[data-dlg]'); if (d) { cur = +d.dataset.dlg; history.replaceState(null, '', `#helper=${cur}`); draw(); loadDialog(cur); return; }
    const rf = t.closest('[data-refine]');
    if (rf) {
      if (ask.busy) return H.toast('Дождитесь завершения запроса');
      ask.busy = true; rf.disabled = true;
      try { const r = await H.call('help_refine', {dialog_id:cur,op:rf.dataset.refine});
        el.querySelector('#h-turns').insertAdjacentHTML('beforeend',turnHtml({...r,q:rf.textContent}));
        el.querySelector('#h-turns').lastElementChild.scrollIntoView({block:'start'});
      } catch(er) { H.toast(er.message); } finally {ask.busy=false;rf.disabled=false;} return;
    }
    const mode = t.closest('[data-audience]');
    if (mode) {
      cur = null; picked.clear(); clientId = null; clientContext = null; audience = mode.dataset.audience;
      el.querySelector('#h-turns').innerHTML = ''; history.replaceState(null, '', '#helper');
      if (audience === 'crm') try { clients = (await H.call('help_clients', {})).clients; } catch (er) { H.toast(er.message); }
      renderContext(); return;
    }
    if (t.closest('[data-memory-save]')) {
      try {
        if (!cur) { const r = await H.call('help_new', {audience, client_id:clientId}); cur = r.dialog.id; history.replaceState(null, '', `#helper=${cur}`); }
        const r = await H.call('help_memory_save', {dialog_id:cur, wishes:{must:el.querySelector('#h-must').value, prefer:el.querySelector('#h-prefer').value, avoid:el.querySelector('#h-avoid').value, budget_max: Number(el.querySelector('#h-budget').value) * 1e6 || null}});
        clientContext = r.context; renderContext(); H.toast('Пожелания сохранены для этого клиента');
      } catch (er) { H.toast(er.message); }
      return;
    }
    const ak = t.closest('[data-ask]'); if (ak) return ask(ak.dataset.ask);
    const a = t.closest('[data-alt]'); if (a) { const qs = JSON.parse(a.dataset.alt); ask(qs[0]); return; }
    if (t.closest('[data-owners]')) return owners();
    const tip = t.closest('[data-tip]'); if (tip) { const i = el.querySelector('#h-q'); i.value = tip.dataset.tip; i.focus(); return; }
    const ab = t.closest('[data-act]');
    if (ab) {
      const a = JSON.parse(ab.closest('[data-acts]').dataset.acts)[+ab.dataset.act];
      if (a.type === 'selection') { store.set('sel', a.nums); store.set('sel_arch',a.arch_nums||[]); if (a.cm) store.set('sel_cm', a.cm); go('./#selmake'); return; }
      if (a.type === 'owners') { ownersOut(a.items, a.text); return; }
    }
    const nums = [...picked];
    if (t.closest('[data-go-rk]')) { if (!nums.length) return H.toast('Отметьте объекты галочками'); store.set('sel', nums); go('./#rk'); return; }
    if (t.closest('[data-go-video]')) { if (!nums.length) return H.toast('Отметьте объекты галочками'); go(`hub.html#video=${nums.join(',')}`); return; }
    if (t.closest('[data-go-mail]')) {   // рассылка берёт объекты из «Избранного»
      if (!nums.length) return H.toast('Отметьте объекты галочками');
      const r=await fetch(window.API.replace(/\/web$/,'/auto'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'mail_list_add',auth:{token:store.get('token',null)},nums})});const d=await r.json();if(!r.ok||d.error)return H.toast(d.message||'Не удалось добавить в рассылку');
      H.toast('Объекты добавлены в список рассылки');go('mail.html');return;
    }
  }
  async function onChange(e) {
    if (e.target.matches?.('[data-dlgs]')) {
      const id = +e.target.value; if (!id) return;
      if (ask.busy) { e.target.value = String(cur || ''); return H.toast('Дождитесь завершения запроса'); }
      cur = id; up({ type: 'dlg', dlg: cur }); draw(); loadDialog(cur); return;
    }
    if (e.target.id === 'h-client') {
      if (ask.busy) { e.target.value = clientId || ''; return H.toast('Дождитесь завершения запроса'); }
      const id = Number(e.target.value); cur = null; picked.clear(); clientId = id || null; clientContext = null;
      el.querySelector('#h-turns').innerHTML = ''; history.replaceState(null, '', '#helper');
      if (clientId) try {
        const r = await H.call('help_new', {audience:'crm',client_id:clientId}); cur = r.dialog.id; clientContext = r.context;
        history.replaceState(null, '', `#helper=${cur}`);
      } catch (er) { clientId = null; H.toast(er.message); }
      renderContext(); return;
    }
    const c = e.target.closest('[data-pick]'); if (!c) return;
    const n = +c.dataset.pick; c.checked ? picked.add(n) : picked.delete(n);
    el.querySelectorAll(`.hub-fc[data-num="${n}"]`).forEach(k => { k.classList.toggle('picked', c.checked); const i = k.querySelector('[data-pick]'); if (i) i.checked = c.checked; const t = k.querySelector('.pk-t'); if (t) t.textContent = c.checked ? 'Выбрано' : 'Выбрать'; });
  }
  async function phone(b) {
    const num = +b.dataset.hphone; b.disabled = true; b.textContent = 'Узнаю номер…';
    b.parentElement.querySelectorAll('.err').forEach(x => x.remove());
    try {
      const p = await H.web('phone', { num });
      if (!p.phone && !p.tg) throw new Error(p.message || p.error || 'Номер не найден');
      const x = { ...(items.get(num) ?? { num }), phone: p.phone, tg: p.tg, owner: p.owner }; items.set(num, x);
      el.querySelectorAll(`.hub-fc[data-num="${num}"]`).forEach(k => { k.querySelector('[data-hphone]')?.replaceWith(Object.assign(document.createElement('div'), { innerHTML: phoneHtml(x, true) }).firstElementChild); const l = k.querySelector('.lk'); if (l) l.outerHTML = lock(x); });
    } catch (er) {
      b.disabled = false; b.innerHTML = '📞 Связаться <i aria-hidden="true">▾</i>';
      b.insertAdjacentHTML('afterend', `<span class="err">${esc(er.message)}</span>`);
    }
  }
  // точки под фото — по прокрутке ленты (палец или стрелки)
  document.addEventListener('scroll', e => { const s2 = e.target; if (!s2.classList?.contains('strip') || !s2.closest('.hub-fc')) return;
    const k = Math.round(s2.scrollLeft / s2.clientWidth); s2.parentElement.querySelectorAll('.dots i').forEach((d, i) => d.classList.toggle('on', i === k)); }, true);
  // «Написать собственникам»: спросить текст; телефоны открываются по тарифу (уже открытые — бесплатно)
  function owners() {
    const nums = [...picked];
    if (!nums.length) return H.toast('Отметьте объекты, собственникам которых написать');
    const d = document.createElement('div'); d.className = 'sheet';
    d.innerHTML = `<div class="sheet-box"><div class="sheet-head"><b>Написать собственникам (${nums.length})</b><button class="btn ghost" data-x>✕</button></div>
      <div class="sheet-body"><label class="field">Что написать<textarea id="o-text" rows="5" maxlength="1000">Здравствуйте! Я агент по недвижимости, у меня есть покупатель на ваш объект. Удобно обсудить показ?</textarea></label>
      <p class="hint">Уже открытые телефоны — бесплатно и без лимита. Новые откроются по вашему тарифу. Сообщение отправите вы — из своего WhatsApp, Telegram или MAX (кнопки ниже).</p>
      <div id="o-res"></div></div>
      <div class="sheet-foot"><button class="btn ghost" data-x>Закрыть</button><button class="btn primary" data-send>Открыть телефоны и подготовить</button></div></div>`;
    document.body.appendChild(d);
    d.onclick = async e => {
      if (e.target === d || e.target.closest('[data-x]')) return d.remove();
      if (!e.target.closest('[data-send]')) return;
      const b = e.target.closest('[data-send]'); b.disabled = true; b.textContent = 'Открываю телефоны…';
      try {
        const r = await H.call('help_owners', { nums, text: d.querySelector('#o-text').value });
        d.querySelector('#o-res').innerHTML = r.items.map(x => `<div class="hub-own"><b>№ ${x.num}</b> ${x.ok ? `${esc(x.name ?? '')} <a href="tel:${esc(x.phone)}">${esc(x.phone)}</a> ${H.msgLinks(x.phone, r.text)}` : `<span class="err">${esc(x.message ?? 'нет номера')}</span>`}</div>`).join('');
        b.textContent = 'Готово';
      } catch (er) { H.toast(er.message, 6000); b.disabled = false; b.textContent = 'Открыть телефоны и подготовить'; }
    };
  }
  function ownersOut(items, text) {
    const d = document.createElement('div'); d.className = 'sheet';
    d.innerHTML = `<div class="sheet-box"><div class="sheet-head"><b>Написать собственникам</b><button class="btn ghost" data-x>✕</button></div>
      <div class="sheet-body"><p class="hint">Текст: ${esc(text)}</p>${items.map(x => `<div class="hub-own"><b>№ ${x.num}</b> ${x.ok ? `${esc(x.name ?? '')} <a href="tel:${esc(x.phone)}">${esc(x.phone)}</a> ${H.msgLinks(x.phone, text)}` : `<span class="err">${esc(x.message ?? 'нет номера')}</span>`}</div>`).join('')}</div>
      <div class="sheet-foot"><button class="btn ghost" data-x>Закрыть</button></div></div>`;
    document.body.appendChild(d);
    d.onclick = e => { if (e.target === d || e.target.closest('[data-x]')) d.remove(); };
  }
  window.SEC = window.SEC || {};
  window.SEC.helper = { title: 'ИИ-Агент', open };
})();
