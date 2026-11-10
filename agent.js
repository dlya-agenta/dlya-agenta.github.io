// v5.48 F (п. 21, 20, 12): ИИ-Агент на каждой странице — всплывающее окно, как служба поддержки; кнопки рядом с «Помощь».
// ✨ — окно готово к запросу; 🎤 — сразу слушает (до 1 минуты) и отправляет запрос ИИ. Окно — рамка hub.html?agent=1#helper
// (тот же раздел Помощника: карточки, подборки, CRM). Переход на другую страницу: окно запоминает, что открыто и какой диалог
// (sessionStorage 'agent'), и открывается так же; ответ, который ИИ готовит в фоне, дожидается (hub help_turn).
// Голосовые команды без ИИ (мгновенно, лимит не тратят): «открой 150017», «позвони собственнику 150017», «150017 в избранное»,
// «добавь 150017 в подборку». Ещё: оценка подборки 1–5 (AGENT.rate), опрос раз в 14 дней и голосование за идеи (fb_poll),
// «ищет одно и то же» → подбор с размышлением (AGENT.searched). Сервер — hub fb.ts, helper.ts, speech.ts.
(() => {
  if (window.parent !== window || window.AGENT) return;   // внутри рамок (окно объявления, само окно Агента) — не нужен
  const token = () => { try { return JSON.parse(localStorage.getItem('token')); } catch { return null; } };
  if (!token()) return;
  const API = () => String(window.API || 'https://arojogajdamsyrrpcmso.supabase.co/functions/v1/web');
  async function call(fn, action, body = {}) {
    const r = await fetch(API().replace(/\/web$/, '/' + fn), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, auth: { token: token() }, ...body }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) { const e = new Error(j.message || 'Нет связи — попробуйте ещё раз'); e.code = j.error; throw e; }
    return j;
  }
  const hub = (a, b) => call('hub', a, b);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (t, ms) => { if (window.HUB?.toast) return window.HUB.toast(t, ms); let d = document.getElementById('v-toast'); if (!d) { d = document.createElement('div'); d.id = 'v-toast'; document.body.appendChild(d); } d.textContent = t; d.hidden = false; clearTimeout(d._t); d._t = setTimeout(() => { d.hidden = true; }, ms || 3500); };
  const S = { get() { try { return JSON.parse(sessionStorage.getItem('agent')) || {}; } catch { return {}; } }, set(v) { try { sessionStorage.setItem('agent', JSON.stringify({ ...S.get(), ...v })); } catch { /* */ } } };
  const SPARK = '<svg class="ag-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 4.9L19 9.7l-5.2 1.8L12 16.4l-1.8-4.9L5 9.7l5.2-1.8z"/><path d="M18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/></svg>';
  const MIC = window.VOICE?.MIC || '🎤';

  let fabs = null, box = null, frame = null, ready = false, queue = [], mic = null, live = null, scratch = null;
  function shell() {
    if (fabs) return;
    fabs = document.createElement('div'); fabs.id = 'ag-fabs'; fabs.className = 'agent-only';
    fabs.innerHTML = `<button type="button" class="ag-fab ag-mic" aria-label="Спросить ИИ-Агента голосом" title="Голосом — Агент слушает, окно не открывается; ответ — карточкой «Посмотреть»">${MIC}</button>
      <button type="button" class="ag-fab ag-open" aria-label="ИИ-Агент" title="ИИ-Агент: напишите или скажите, что сделать">${SPARK}<b>ИИ-Агент</b><i class="ag-dot" hidden></i></button>`;
    document.body.appendChild(fabs);
    mic = fabs.querySelector('.ag-mic');
    fabs.querySelector('.ag-open').onclick = () => (box && !box.hidden ? minimize() : open());
    mic.onclick = () => listen();
    if (!window.VOICE?.ok) mic.hidden = true;
  }
  function panel() {
    if (box) return;
    box = document.createElement('section'); box.id = 'ag'; box.className = 'ag agent-only'; box.hidden = true;
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'ИИ-Агент');
    box.innerHTML = `<header class="ag-head">${SPARK}<b>ИИ-Агент</b>
        <button type="button" class="ag-hb" data-ag="new" title="Новый запрос" aria-label="Новый запрос">＋</button>
        <a class="ag-hb" data-ag="full" href="hub.html#helper" title="Открыть на всю страницу" aria-label="Открыть на всю страницу">⤢</a>
        <button type="button" class="ag-hb" data-ag="min" title="Свернуть" aria-label="Свернуть">—</button></header>
      <div class="ag-live"></div>
      <div class="ag-wait"><span class="ag-spin"></span>Открываю ИИ-Агента…</div>`;
    document.body.appendChild(box);
    live = box.querySelector('.ag-live');
    scratch = document.createElement('textarea'); scratch.hidden = true; scratch.setAttribute('data-novoice', ''); box.appendChild(scratch);
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-ag]'); if (!b) return;
      if (b.dataset.ag === 'min') minimize();
      if (b.dataset.ag === 'new') send({ type: 'new' });
      if (b.dataset.ag === 'reload') { const w = box.querySelector('.ag-wait'); if (w) w.innerHTML = '<span class="ag-spin"></span>Открываю ИИ-Агента…'; frame.src = frame.src; }
      if (b.dataset.ag === 'full') { e.preventDefault(); const d = S.get().dlg; S.set({ open: false }); location.href = `hub.html#helper${d ? '=' + d : ''}`; }
    });
    addEventListener('keydown', e => { if (e.key === 'Escape' && !box.hidden && matchMedia('(min-width: 761px)').matches) minimize(); });
  }
  function load() {
    if (frame) return;
    const d = S.get().dlg;
    frame = document.createElement('iframe');
    frame.title = 'ИИ-Агент'; frame.setAttribute('allow', 'microphone; clipboard-write');
    frame.src = `hub.html?agent=1#helper${d ? '=' + d : ''}`;
    box.appendChild(frame);
    // v5.49: рамка не загрузилась за 20 с (слабая связь) — честно сказать и дать «Ещё раз», а не висеть
    setTimeout(() => { const w = box.querySelector('.ag-wait'); if (!ready && w) w.innerHTML = 'ИИ-Агент не загрузился — слабая связь. <button type="button" class="btn soft" data-ag="reload">Ещё раз</button> <button type="button" class="btn ghost" data-ag="min">Закрыть</button>'; }, 20000);
  }
  function open(o = {}) {
    shell(); panel(); load();
    document.getElementById('ag-note')?.remove();
    box.hidden = false; document.documentElement.classList.add('ag-on');
    fabs.querySelector('.ag-dot').hidden = true;
    S.set({ open: true });
    if (o.focus !== false) setTimeout(() => ready && frame?.contentWindow?.document.querySelector('#h-q')?.focus({ preventScroll: true }), 50);
  }
  function minimize() { if (!box) return; box.hidden = true; document.documentElement.classList.remove('ag-on'); S.set({ open: false }); }
  function send(m) {
    if (!ready) { queue.push(m); return; }
    frame.contentWindow.postMessage({ agent: 1, ...m }, location.origin);
  }
  // что сейчас на экране: страница, открытое объявление, строка поиска — Агент понимает «это», «этот объект»
  function page() {
    const num = +(/#o=(\d+)/.exec(location.hash)?.[1] || document.querySelector('#sheet:not([hidden]) [data-num]')?.dataset.num || 0) || null;
    const q = document.querySelector('#q')?.value?.trim() || '';
    return { path: location.pathname.split('/').pop() + location.hash.slice(0, 30), num, q };
  }
  function ask(q, o = {}) {
    q = String(q || '').trim(); if (!q) return;
    open({ focus: false });
    if (command(q)) return;
    send({ type: 'ask', q, mode: o.mode, page: page(), fresh: !!o.fresh });
  }
  // 🎤 (v5.49, п. 4): окно НЕ раскрывается — полоска «Слушаю…» внизу, запрос уходит Агенту в фоне (окно грузится скрыто),
  // ответ — карточкой «✨ Готово · Посмотреть» (нажали — открылось окно с ответом). Окно уже открыто — слушает в нём.
  // Раньше на телефоне окно сразу закрывало весь экран; если рамка долго грузилась, казалось, что сайт завис (нельзя даже «Обновить»).
  function listen() {
    shell(); panel(); load();
    if (mic._rec) { window.VOICE.start(scratch, mic); return; }   // второе нажатие — закончить
    const inBox = !box.hidden;
    scratch.value = '';
    window.VOICE?.start(scratch, mic, { live: inBox ? live : undefined, onDone: t => { scratch.value = ''; inBox || !box.hidden ? ask(t) : bg(t); } });
  }
  let pend = null;
  function bg(q) {
    if (command(q)) return;
    pend = q; card('wait', q);
    send({ type: 'ask', q, page: page() });
    clearTimeout(bg._t); bg._t = setTimeout(() => { if (pend) card('err', 'ИИ-Агент долго не отвечает — откройте окно, ответ придёт туда'); }, 150e3);
  }
  // карточка над кнопками: ждём / готово / ошибка — не закрывает страницу, ничего не блокирует
  function card(kind, text, n) {
    let d = document.getElementById('ag-note');
    if (!d) { d = document.createElement('div'); d.id = 'ag-note'; d.className = 'ag-card ag-note agent-only'; d.setAttribute('role', 'status'); d.setAttribute('aria-live', 'polite'); document.body.appendChild(d); }
    d.dataset.k = kind;
    d.innerHTML = `<button type="button" class="ag-x" aria-label="Закрыть">✕</button>`
      + (kind === 'wait' ? `<b><span class="ag-spin"></span> ИИ-Агент работает…</b><p>«${esc(text.slice(0, 120))}»</p><div class="ag-row"><button type="button" class="btn ghost" data-look>Открыть окно</button></div>`
        : kind === 'ok' ? `<b>${SPARK} Готово${n ? ` · объектов: ${n}` : ''}</b><p>${esc(text || 'Ответ готов')}${text?.length >= 180 ? '…' : ''}</p><div class="ag-row"><button type="button" class="btn primary" data-look>Посмотреть</button></div>`
          : `<b>⚠️ ИИ-Агент</b><p>${esc(text)}</p><div class="ag-row"><button type="button" class="btn primary" data-look>Открыть окно</button></div>`);
    d.onclick = e => {
      if (e.target.closest('[data-look]')) { d.remove(); pend = null; open(); }
      else if (e.target.closest('.ag-x')) { d.remove(); if (kind !== 'wait') pend = null; }
    };
    if (kind === 'ok') { fabs.querySelector('.ag-dot').hidden = false; }
  }

  // ---------- голосовые команды без ИИ (п. 12 b) ----------
  const NUM = '№?\\s*(\\d{6,7})';
  function openObj(n) { if (window.OBJPOP?.open) { if (matchMedia('(max-width: 760px)').matches) minimize(); window.OBJPOP.open(n); } else location.href = `./#o=${n}`; }
  function command(q) {
    const t = q.toLowerCase().replace(/ё/g, 'е').replace(/[.,!]/g, ' ').replace(/\s+/g, ' ').trim();
    let m;
    if ((m = new RegExp(`^(?:открой|покажи|открыть)\\s+(?:объявление|объект|номер)?\\s*${NUM}$`).exec(t)) || (m = new RegExp(`^${NUM}$`).exec(t))) { openObj(+m[1]); toast(`Открываю № ${m[1]}`); return true; }
    if ((m = new RegExp(`^(?:позвони|набери|связаться|связаться с|позвонить)\\s+(?:собственник\\w*|владельц\\w*|хозя\\w*)?\\s*(?:по|объекта|объявления|номер)?\\s*${NUM}$`).exec(t))) { openObj(+m[1]); toast('Окно объявления открыто — нажмите «📞 Связаться» (номер откроется по тарифу)', 5000); return true; }
    if ((m = new RegExp(`^(?:добавь|положи)?\\s*${NUM}\\s+в избранное$`).exec(t)) || (m = new RegExp(`^(?:добавь\\s+)?в избранное\\s+${NUM}$`).exec(t))) {
      call('web', 'fav', { num: +m[1], on: true }).then(() => toast(`№ ${m[1]} — в Избранном ★`), e => toast(e.message)); return true;
    }
    if ((m = new RegExp(`^(?:добавь|положи)\\s+${NUM}\\s+в подборку$`).exec(t)) || (m = new RegExp(`^(?:добавь\\s+)?в подборку\\s+${NUM}$`).exec(t))) {
      const n = +m[1];
      if (window.APP_SEL_ADD) { const k = window.APP_SEL_ADD(n); toast(k < 0 ? 'В подборке уже 20 объектов — больше нельзя' : `№ ${n} — в подборке (${k})`); }
      else { let a = []; try { a = JSON.parse(localStorage.getItem('sel')) || []; } catch { /* */ } if (!a.includes(n)) a.push(n); localStorage.setItem('sel', JSON.stringify(a.slice(0, 20))); toast(`№ ${n} — в подборке (${Math.min(20, a.length)}). Собрать — на главной`); }
      return true;
    }
    return false;
  }

  // ---------- сообщения из окна ----------
  addEventListener('message', e => {
    if (e.origin !== location.origin || !e.data?.agent || e.source !== frame?.contentWindow) return;
    const m = e.data;
    if (m.type === 'ready') { ready = true; box.querySelector('.ag-wait')?.remove(); const q2 = queue; queue = []; q2.forEach(send); }
    if (m.type === 'dlg') S.set({ dlg: m.dlg || null });
    if (m.type === 'go') { if (/^https?:/.test(m.href) && new URL(m.href).origin === location.origin) { const u = new URL(m.href), same = u.pathname === location.pathname && u.search === location.search;
      if (same) minimize(); else if (matchMedia('(max-width: 760px)').matches) S.set({ open: false });
      // та же страница, другой хвост (#rk, #crm, #task=…): страница читает его только при загрузке — перезагрузить (#selmake, #sels, #o= — понимает сразу)
      const reload = same && !!u.hash && !/^#(selmake|sels|o=)/.test(u.hash);
      location.href = m.href;
      if (reload) location.reload();
    } }   // v5.49: та же страница (#selmake, #crm) — окно сворачивается, иначе закрывает результат
    if (m.type === 'obj') openObj(m.num);
    if (m.type === 'answer') {
      clearTimeout(bg._t);
      if (box.hidden && (pend || document.getElementById('ag-note'))) card(m.err ? 'err' : 'ok', m.err || m.text, m.n);
      else document.getElementById('ag-note')?.remove();
      pend = null;
    }
  });

  // ---------- «ищет одно и то же» → подбор с размышлением (п. 20) ----------
  // похожие поиски: тот же тип/комнаты/район и цена ±25 %; 3 похожих за 20 минут или 2 подряд почти пустых → предложение (раз в 30 минут)
  const sig = s => { const f = s.f || {}; return [f.kind || f.kinds || '', f.rooms || '', f.district || f.sub || f.zk || '', String(s.text || '').toLowerCase().replace(/[^а-яa-z ]/g, '').split(' ').filter(w => w.length > 3).sort().slice(0, 4).join(' ')].join('|'); };
  const price = s => Number(s.f?.pmax || s.f?.pmin || 0);
  function searched(s) {
    if (!s || (!s.text && !Object.keys(s.f || {}).length)) return;
    let L = []; try { L = JSON.parse(sessionStorage.getItem('ag_srch')) || []; } catch { /* */ }
    const now = Date.now(), k = sig(s), p = price(s);
    L = L.filter(x => now - x.at < 20 * 60e3).concat([{ at: now, k, p, n: s.count, t: s.understood || s.text || '' }]).slice(-12);
    try { sessionStorage.setItem('ag_srch', JSON.stringify(L)); } catch { /* */ }
    const same = L.filter(x => x.k === k && (!p || !x.p || Math.abs(x.p - p) / Math.max(x.p, p) <= 0.25));
    const empty = L.slice(-2).length === 2 && L.slice(-2).every(x => x.n <= 3);
    if (same.length < 3 && !empty) return;
    if (now - Number(sessionStorage.getItem('ag_offer') || 0) < 30 * 60e3) return;
    sessionStorage.setItem('ag_offer', String(now));
    hub('fb_event', { kind: 'repeat_search', data: { text: s.understood || s.text, times: Math.max(same.length, 2), found: s.count } }).catch(() => {});
    offer(s);
  }
  function offer(s) {
    document.getElementById('ag-offer')?.remove();
    const d = document.createElement('div'); d.id = 'ag-offer'; d.className = 'ag-card agent-only'; d.setAttribute('role', 'status');
    d.innerHTML = `<button type="button" class="ag-x" aria-label="Закрыть">✕</button><b>${SPARK} Не находится то, что нужно?</b>
      <p>Давайте подберу вместе: ИИ-Агент задаст 2–3 вопроса, подумает, что мешает, и поищет шире.</p>
      <div class="ag-row"><button type="button" class="btn primary" data-go>Подобрать с ИИ-Агентом</button><button type="button" class="btn ghost" data-no>Не сейчас</button></div>`;
    document.body.appendChild(d);
    d.onclick = e => {
      if (e.target.closest('[data-go]')) { d.remove(); ask(`Помоги подобрать: ${s.understood || s.text || 'объект'}. Обычным поиском найдено ${s.count}.`, { mode: 'think', fresh: true }); }
      else if (e.target.closest('[data-no], .ag-x')) d.remove();
    };
  }

  // ---------- оценка подборки 1–5 (п. 20): не чаще 2 раз в неделю ----------
  async function rate(selId) {
    let r; try { r = await hub('fb_rate_ask', { sel_id: selId }); } catch { return; }
    if (!r.ask) return;
    const d = document.createElement('div'); d.className = 'ag-card ag-rate agent-only'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Оцените подборку');
    d.innerHTML = `<button type="button" class="ag-x" aria-label="Закрыть">✕</button><b>Оцените подборку</b><p>Насколько хорошо сервис помог её собрать? Это учит ИИ-Агента.</p>
      <div class="ag-stars" role="radiogroup">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-st="${n}" aria-label="${n} из 5">★</button>`).join('')}</div>
      <textarea rows="2" maxlength="1000" placeholder="Что было не так или что понравилось (необязательно)"></textarea>
      <div class="ag-row"><button type="button" class="btn primary" data-send disabled>Отправить</button></div>`;
    document.body.appendChild(d);
    let st = 0;
    d.onclick = async e => {
      const s = e.target.closest('[data-st]');
      if (s) { st = +s.dataset.st; d.querySelectorAll('[data-st]').forEach(b => b.classList.toggle('on', +b.dataset.st <= st)); d.querySelector('[data-send]').disabled = false; return; }
      if (e.target.closest('.ag-x')) return d.remove();
      if (e.target.closest('[data-send]') && st) {
        try { await hub('fb_rate', { sel_id: selId, stars: st, note: d.querySelector('textarea').value }); d.remove(); toast('Спасибо! Оценка учтена'); } catch (er) { toast(er.message); }
      }
    };
  }

  // ---------- опрос раз в 14 дней и голосование за идеи (п. 20) ----------
  async function poll() {
    if (sessionStorage.getItem('ag_poll')) return;
    sessionStorage.setItem('ag_poll', '1');
    let r; try { r = await hub('fb_poll'); } catch { return; }
    if (!r.survey && !r.votes?.length) return;
    const d = document.createElement('div'); d.className = 'ag-card ag-poll agent-only'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Опрос');
    d.innerHTML = `<button type="button" class="ag-x" aria-label="Закрыть">✕</button>
      ${r.votes?.length ? `<b>🗳 Что сделать на сайте? Голосуйте</b>${r.votes.map(v => `<div class="ag-vote" data-v="${v.id}"><span><b>${esc(v.title)}</b>${v.summary ? `<small>${esc(v.summary)}</small>` : ''}</span>
        <button type="button" class="btn soft" data-yes aria-label="За">👍</button><button type="button" class="btn soft" data-nope aria-label="Против">👎</button></div>`).join('')}` : ''}
      ${r.survey ? `<b>💡 Какой функции вам не хватает?</b><p>Раз в 2 недели собираем идеи. Самые частые выносим на общее голосование.</p>
        <textarea rows="3" maxlength="1000" placeholder="Например: уведомлять, когда собственник снизил цену"></textarea>
        <div class="ag-row"><button type="button" class="btn primary" data-send>Отправить</button><button type="button" class="btn ghost" data-no>Не сейчас</button></div>` : ''}`;
    document.body.appendChild(d);
    d.onclick = async e => {
      if (e.target.closest('.ag-x, [data-no]')) return d.remove();
      const v = e.target.closest('[data-v]');
      if (v && e.target.closest('[data-yes], [data-nope]')) {
        try { await hub('fb_vote', { id: +v.dataset.v, vote: e.target.closest('[data-yes]') ? 1 : -1 }); v.innerHTML = '<span>Голос учтён — спасибо!</span>'; } catch (er) { toast(er.message); }
        if (!d.querySelector('[data-yes]') && !d.querySelector('textarea')) setTimeout(() => d.remove(), 1200);
        return;
      }
      if (e.target.closest('[data-send]')) {
        const t = d.querySelector('textarea').value.trim(); if (t.length < 3) return toast('Напишите или скажите пару слов');
        try { await hub('fb_survey', { text: t }); d.remove(); toast('Спасибо! Идея записана'); } catch (er) { toast(er.message); }
      }
    };
  }

  window.AGENT = { open, ask, listen, minimize, rate, searched, command, bg: q => { shell(); panel(); load(); bg(q); } };   // bg — запрос в фоне, ответ карточкой (п. 4)
  // кнопки не мешают вводу: на странице Помощника (там своё поле с 🎤) — скрыты; пока печатают в поле (на телефоне клавиатура) или
  // открыто окно «Помощь» — тоже скрыты
  const H = document.documentElement;
  const onHelper = () => /(^|\/)hub\.html$/.test(location.pathname) && /^#?(helper(=|$)|$)/.test(location.hash.replace(/^#/, '#'));
  const sync = () => H.classList.toggle('ag-here', onHelper());
  addEventListener('hashchange', sync);
  const typing = el => el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|range|file|color)$/i.test(el.type))) && !el.closest('#ag');
  document.addEventListener('focusin', e => { if (typing(e.target)) H.classList.add('ag-typing'); });
  document.addEventListener('focusout', () => setTimeout(() => { if (!typing(document.activeElement)) H.classList.remove('ag-typing'); }, 150));
  // телефон: листают вниз — кнопки уезжают за край, вверх — возвращаются (не закрывают карточки при прокрутке)
  let lastY = scrollY;
  addEventListener('scroll', () => { const y = scrollY, d = y - lastY; if (Math.abs(d) < 12) return; H.classList.toggle('ag-down', d > 0 && y > 200); lastY = y; }, { passive: true });
  function boot() {
    if (document.documentElement.classList.contains('embed')) return;
    sync();
    shell();
    const s = S.get();
    if (s.open) open({ focus: false });   // был открыт на прошлой странице — открыт и здесь, тот же диалог
    // v5.49 (п. 11): «виджет без приложения» — ярлыки иконки (manifest shortcuts), «Команды» iPhone/Mac с Siri:
    // ?agent=open — окно Агента; ?agent=voice — кнопка «Нажмите и говорите» (микрофон браузер включает только по нажатию);
    // ?agent=ask&q=<текст> — сразу запрос (в фоне, ответ карточкой «Посмотреть»). Параметры убираются из адреса.
    const u = new URLSearchParams(location.search), how = u.get('agent');
    if (how && !document.documentElement.classList.contains('agent')) {
      const qv = (u.get('q') || '').slice(0, 1000).trim();
      u.delete('agent'); u.delete('q'); history.replaceState(null, '', location.pathname + (u.toString() ? '?' + u : '') + location.hash);
      if (how === 'ask' && qv) setTimeout(() => { shell(); panel(); load(); bg(qv); }, 600);
      else if (how === 'voice' && window.VOICE?.ok) setTimeout(() => {
        const d = document.createElement('div'); d.id = 'ag-voice'; d.className = 'ag-card ag-note agent-only';
        d.innerHTML = `<button type="button" class="ag-x" aria-label="Закрыть">✕</button><b>${SPARK} ИИ-Агент слушает по нажатию</b><p>Скажите задачу: «подбери 2к до 15 млн у моря», «поставь показ на завтра в 15:00».</p><div class="ag-row"><button type="button" class="btn primary" data-go>🎤 Нажмите и говорите</button></div>`;
        document.body.appendChild(d); d.onclick = e => { if (e.target.closest('[data-go]')) { d.remove(); listen(); } else if (e.target.closest('.ag-x')) d.remove(); };
      }, 600);
      else open();
    }
    setTimeout(poll, 6000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
