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
  const TIPS = ['Подбери 3 лучшие студии до 7 млн у моря и сравни с рынком', 'Проанализируй отмеченные объекты: что выгоднее и почему', 'Что у меня в очереди рекламы?',
    'Поставь задачу: показ завтра в 15:00', 'Сделай подборку из отмеченных', 'Какие документы нужны при продаже по наследству?'];

  const card = x => `<label class="hub-card${picked.has(x.num) ? ' on' : ''}" data-num="${x.num}">
    <span class="hub-ph">${photo(x) ? `<img src="${esc(photo(x))}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<span class="hub-noph">🏠</span>'}</span>
    <input type="checkbox" data-pick="${x.num}"${picked.has(x.num) ? ' checked' : ''} aria-label="Отметить № ${x.num}">
    <b>${esc(H.mln(x.price))}</b><small>${esc(title(x))}</small><small class="muted">${esc(place(x))} · № ${x.num}</small>
    <a class="hub-open" href="./#o=${x.num}" target="_blank" rel="noopener">Открыть</a></label>`;

  function quotaLine(q) {
    if (!q) return '';
    return q.trial ? `Пробных запросов: осталось <b>${q.left}</b> из ${q.lim}. В PRO — 10 в месяц, в MAX — 30.` : `Запросов в этом месяце: осталось <b>${q.left}</b> из ${q.lim}.`;
  }
  async function open(arg, ctx) {
    el = ctx.el;
    st = await H.call('help_init');
    cur = arg ? +arg : null;
    audience = null; clientId = null; clientContext = null; picked.clear();
    draw();
    const q0 = store.get('helper_q', '');   // голос из строки поиска на главной
    if (q0) { localStorage.removeItem('helper_q'); cur = null; el.querySelector('#h-q').value = q0; }
    if (cur) loadDialog(cur);
  }
  function draw() {
    const voice = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    el.innerHTML = `<div class="hub-two">
      <aside class="hub-side"><button class="btn primary" data-new>＋ Новый диалог</button>
        <div class="hub-list">${st.dialogs.map(d => `<button class="hub-li${d.id === cur ? ' on' : ''}" data-dlg="${d.id}"><b>${esc(d.title || 'Новый диалог')}</b><small>${H.when(d.updated_at)}</small></button>`).join('') || '<p class="muted">Диалогов пока нет</p>'}</div>
        <a class="hint" href="help-helper.html" target="_blank">📘 Как пользоваться помощником</a></aside>
      <section class="hub-body">
        <h2>🤖 Мой помощник</h2><div id="h-context"></div>
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
    box.innerHTML = `<section class="h-context"><b>Для кого подбираем?</b><div class="hub-tips">
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
        <button type="button" class="btn primary" data-memory-save>Запомнить для этого клиента</button></details>` : ''}</section>`;
  }
  async function loadDialog(id) {
    const box = el.querySelector('#h-turns');
    box.innerHTML = '<p class="muted">Загрузка…</p>';
    try {
      const r = await H.call('help_hist', { dialog_id: id });
      clientContext = r.context; audience = r.context?.audience ?? 'new'; clientId = r.context?.client?.id ?? null; renderContext();
      const byNum = new Map(r.items.map(x => [x.num, x]));
      box.innerHTML = r.turns.map(t => turnHtml({ q: t.q, via: t.via, understood: t.note, alt: t.alt, count: t.total, reply: t.reply, actions: t.actions, steps: t.steps, items: t.ids.map(n => byNum.get(n)).filter(Boolean) })).join('') || '<p class="muted">Напишите или скажите, что нужно сделать.</p>';
      box.lastElementChild?.scrollIntoView({ block: 'start' });   // v5.42A п. 5
    } catch (e) { box.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  }
  const actHtml = (a, i) => a.type === 'owners' ? `<button class="btn primary" data-act="${i}">${esc(a.label)}</button>`
    : a.type === 'selection' ? `<button class="btn primary" data-act="${i}">${esc(a.label)}</button>`
    : a.type === 'link' && /^(\.\/|hub\.html|mail\.html|arch\.html|pay\.html|partner\.html)/.test(a.href ?? '') ? `<a class="btn soft" href="${esc(a.href)}">${esc(a.label)}</a>` : '';
  const turnHtml = (r, offer) => `<article class="hub-turn"><p class="hub-q">🗣 ${esc(r.q)}</p>
    ${r.steps?.length ? `<details class="hub-steps"${r.reply ? '' : ' open'}><summary>Что сделал помощник (${r.steps.length})</summary><ul>${r.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>` : ''}
    ${r.reply ? `<div class="hub-reply">${H.md(r.reply)}</div>` : `<p class="hint">${r.understood ? `Понял так: ${esc(r.understood)} · ` : ''}найдено <b>${r.count}</b></p>`}
    ${r.actions?.length ? `<p class="hub-acts" data-acts='${esc(JSON.stringify(r.actions))}'>${r.actions.map(actHtml).join('')}</p>` : ''}
    ${r.alt ? `<p class="hub-alt">💡 ${esc(r.alt.label)} ${r.alt.more ? `<b>+${r.alt.more}</b>` : ''} ${r.alt.q?.length ? `<button class="btn soft" data-alt="${esc(JSON.stringify(r.alt.q))}">Показать</button>` : ''}</p>` : ''}
    ${(r.items ?? []).length ? `<div class="hub-grid">${r.items.slice(0, 30).map(card).join('')}</div>${nextHtml(r)}` : ''}
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
    if (!audience || (audience === 'crm' && !clientId)) return H.toast('Сначала выберите: новый клиент или клиент из CRM');
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
      const r = await H.call('help_ask', { dialog_id: cur, q, picked: [...picked] });
      st.quota = r.quota;
      const box = el.querySelector('#h-turns');
      box.querySelector('.hub-pending')?.remove();
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
    if (ask.busy && t.closest('[data-new],[data-dlg],[data-audience],[data-memory-save]')) return H.toast('Дождитесь завершения запроса');
    if (t.closest('[data-new]')) { cur = null; audience = null; clientId = null; clientContext = null; picked.clear(); draw(); history.replaceState(null, '', '#helper'); el.querySelector('#h-turns').innerHTML = '<p class="muted">Напишите или скажите, что нужно сделать.</p>'; el.querySelector('#h-q').focus(); return; }
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
      if (a.type === 'selection') { store.set('sel', a.nums); if (a.cm) store.set('sel_cm', a.cm); location.href = './#selmake'; return; }
      if (a.type === 'owners') { ownersOut(a.items, a.text); return; }
    }
    const nums = [...picked];
    if (t.closest('[data-go-rk]')) { if (!nums.length) return H.toast('Отметьте объекты галочками'); store.set('sel', nums); location.href = './#rk'; return; }
    if (t.closest('[data-go-video]')) { if (!nums.length) return H.toast('Отметьте объекты галочками'); location.hash = `video=${nums.join(',')}`; return; }
    if (t.closest('[data-go-mail]')) {   // рассылка берёт объекты из «Избранного»
      if (!nums.length) return H.toast('Отметьте объекты галочками');
      for (const num of nums) await H.web('fav', { num, on: true }).catch(() => {});
      H.toast('Объекты добавлены в «Избранное» — рассылка возьмёт их оттуда'); setTimeout(() => location.href = 'mail.html', 1200); return;
    }
  }
  async function onChange(e) {
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
    c.closest('.hub-card').classList.toggle('on', c.checked);
  }
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
  window.SEC.helper = { title: 'Мой помощник', open };
})();
