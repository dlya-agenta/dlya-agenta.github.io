// Страница оплаты «Для Агента» (ТЗ v2, шаг 2.2): что оплачиваем (тариф и срок или пакет номеров) → способ (@CryptoBot или перевод USDT)
// → счёт: сумма крупно, адрес, QR, таймер, «Ждём платёж → Получен → Подписка активна»; история платежей.
// Цены, зачёт, места и проверку оплаты считает только сервер (функция pay); здесь — показ. Вход — токен сайта (localStorage token, как у главной)
// или pay-токен со страницы входа (sessionStorage pay_token: доступ истёк или заявка не одобрена).
// Пока не включена «боевая» оплата (pay.live), обычным участникам — прежняя оплата доступа через функцию web (pay_info | pay_create | pay_check).
// Адреса: pay.html?plan=sub|pro|max&months=1|3|12, ?pack=1, ?id=<счёт> (возврат из CryptoBot), #admin — настройки оплаты (pay.admin.js).
window.PAYUI = (() => {
  const tg = window.Telegram?.WebApp;
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } } };
  const PAY = String(window.API ?? '').replace(/\/web$/, '/pay');
  const token = store.get('token', null);
  let payTok = null;
  try { payTok = sessionStorage.getItem('pay_token'); } catch { /* приватный режим */ }
  const who = () => token ? { auth: { token } } : payTok ? { pay: payTok } : {};
  const money = v => `${Number(v).toLocaleString('ru-RU', { minimumFractionDigits: Number.isInteger(+v) ? 0 : 2, maximumFractionDigits: 2 })} $`;
  const num = v => Number(v).toFixed(2).replace(/\.00$/, '');   // сумма к переводу — как в кошельках: «99.07»
  const day = s => s ? new Date(s).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' }) : '';
  const when = s => s ? new Date(s).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  const fixed = s => { const d = new Date(s), o = { timeZone: 'Europe/Moscow' };   // «30.10 в 10:00»
    return `${d.toLocaleDateString('ru-RU', { ...o, day: '2-digit', month: '2-digit' })} в ${d.toLocaleTimeString('ru-RU', { ...o, hour: '2-digit', minute: '2-digit' })}`; };
  const RANK = { sub: 1, pro: 2, max: 3 };
  const coin = a => a === 'TON' ? 'Gram (TON)' : a;   // Toncoin с 15.06.2026 называется Gram; код валюты у CryptoBot остался TON
  const CLOSED = 'Оплата тарифов PRO и MAX и пакетов номеров на сайте откроется в ближайшие дни. Сейчас их подключает администратор — напишите ему, через кого получали доступ.';
  // предупреждения ТЗ — дословно
  const WARN1 = '❗ Переведите сумму точно до цента. Учтите, что некоторые биржи и кошельки списывают комиссию из суммы перевода — до нас должна дойти ровно указанная сумма';
  const WARN2 = '❗ Если адрес кошелька, валюта или сеть указаны неверно, средства вернуть невозможно. Проверьте реквизиты, валюту и сеть перед отправкой';

  async function call(action, extra = {}, api = PAY) {
    const r = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...who(), ...extra }) });
    const data = await r.json().catch(() => ({ error: 'server', message: `Ошибка сервера (HTTP ${r.status})` }));
    if (!r.ok || data.error) throw Object.assign(new Error(data.message || data.error || `HTTP ${r.status}`), { data, status: r.status });
    return data;
  }
  function toast(t, ms = 3000) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, ms); }
  async function copy(v, msg = 'Скопировано') {
    try { await navigator.clipboard.writeText(v); }
    catch { const ta = document.createElement('textarea'); ta.value = v; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch { /* старый браузер */ } ta.remove(); }
    toast(msg);
  }
  let qrLib = null;
  const loadQr = () => qrLib ??= new Promise((ok, bad) => { const sc = document.createElement('script');
    sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'; sc.onload = ok; sc.onerror = bad; document.head.appendChild(sc); });
  function gate(html) { $('#gate').innerHTML = html; $('#gate').hidden = false; $('#app').hidden = true; }
  const needLogin = msg => gate(`<h2>Оплата</h2><p>${esc(msg || 'Войдите на сайте — оплата откроется после входа.')}</p><a class="btn primary" href="./">Войти</a>`);

  let I = null;                                        // ответ info: я, тарифы, способы, курс, история
  let sel = { kind: 'plan', plan: 'pro', months: 1 };   // что оплачиваем
  let way = null;                                      // { method: cryptobot | direct, x: USDT | TON | TRC20 | BEP20 }
  let Q = null, qn = 0;                                // расшифровка цены с сервера
  const main = () => $('#pay');
  const plan = id => I.plans.find(p => p.id === id);
  // по умолчанию — свой тариф (продлить), у админа и без тарифа — PRO
  const defPlan = () => I.me.role !== 'admin' && I.me.status === 'active' && I.me.plan ? I.me.plan : 'pro';

  async function start() {
    tg?.ready(); tg?.expand();
    if (!token && !payTok) return needLogin();
    try { I = await call('info'); }
    catch (e) { return e.status === 401 || e.status === 403 ? needLogin(e.message) : gate(`<h2>Ошибка</h2><p>${esc(e.message)}</p><a class="btn ghost" href="./">На главную</a>`); }
    $('#gate').hidden = true; $('#app').hidden = false;
    $('#who').textContent = I.me.name || I.me.login;
    $('#until').textContent = I.me.role === 'admin' ? 'администратор' : `${I.me.plan_name}${I.me.expires_at ? ` · до ${day(I.me.expires_at)}` : ''}`;
    $('#go-home').hidden = I.me.via === 'pay';   // с pay-токеном главная не откроется — сначала оплата
    $('#go-adm').hidden = I.me.role !== 'admin';
    if (location.hash === '#admin' && I.me.role === 'admin' && window.PAYADM) return PAYADM.open();
    const q = new URLSearchParams(location.search);
    sel = q.get('pack') ? { kind: 'pack' } : { kind: 'plan', plan: RANK[q.get('plan')] ? q.get('plan') : defPlan(), months: [1, 3, 12].includes(+q.get('months')) ? +q.get('months') : 1 };
    if (!I.can) return legacy(q);
    render();
    if (+q.get('id')) openInvoice(+q.get('id'));
  }
  addEventListener('hashchange', () => location.reload());

  // ---------- выбор: что оплачиваем и как ----------
  function render() {
    const m = I.me, notes = [];
    if (m.guest) notes.push(['warn', 'У вас гостевой доступ: адреса, цены и телефоны скрыты. Оформите подписку — всё откроется сразу после оплаты.']);
    else if (m.status === 'pending') notes.push(['warn', 'Заявка ещё не одобрена — доступ откроется сразу после оплаты.']);
    else if (!m.active && m.role !== 'admin') notes.push(['warn', `Ваша подписка закончилась${m.expires_at ? ` ${day(m.expires_at)}` : ''}. Продлите её или перейдите на PRO — сравнение тарифов ниже.`]);
    if (!I.live) notes.push(['', 'Оплата на сайте пока включена только для проверки: счета создают администраторы и тестовые логины.']);
    if (I.methods.cryptobot?.test) notes.push(['', `🧪 CryptoBot в тестовом режиме: счёт откроется в @${I.methods.cryptobot.bot}, настоящие деньги не списываются.`]);
    main().innerHTML = `${notes.map(([c, t]) => `<p class="pnote ${c}">${esc(t)}</p>`).join('')}
      ${I.open.length ? `<section class="pcard" id="p-open"><h2>Незавершённый счёт</h2>${I.open.map(x => `<div class="prow"><span>${esc(x.what)} · <b>${num(x.amount)} ${esc(coin(x.asset))}</b>
        <small class="muted">до ${when(x.expires_at)}</small></span><button class="btn soft" data-inv="${x.id}">Открыть</button></div>`).join('')}</section>` : ''}
      <section class="pcard" id="p-what"><h2>1. Что оплачиваем</h2>
        <div class="segs"><button type="button" class="chip ${sel.kind === 'plan' ? 'on' : ''}" data-kind="plan">Тариф</button><button type="button" class="chip ${sel.kind === 'pack' ? 'on' : ''}" data-kind="pack">Пакет номеров</button></div>
        <div id="p-body"></div><div id="p-quote" class="quote" aria-live="polite"></div></section>
      <section class="pcard" id="p-way"><h2>2. Способ оплаты</h2><div id="p-ways"></div>
        <button type="button" class="btn primary pgo" id="p-go" disabled>Перейти к оплате</button>
        <p class="hint"><a href="help-pay.html" target="_blank">Как оплатить — пошаговая инструкция со снимками</a></p></section>
      <section class="pcard" id="p-inv" hidden></section>
      <section class="pcard"><h2>История платежей</h2><div id="p-hist"></div></section>`;
    body(); ways(); hist(); requote();
  }
  const FEAT = p => [`${p.phones_day} номеров в день · ${p.phones_month} в месяц`,
    `${p.devices} ${p.devices === 1 ? 'устройство' : p.devices < 5 ? 'устройства' : 'устройств'} одновременно`,
    p.opts?.arch && 'Архив за 2 года и объявления старше 6 месяцев', p.opts?.rk_month && `Черновики для рекламы: ${p.opts.rk_month} в месяц`,
    p.opts?.mail_items && `Рассылки в мессенджеры: до ${p.opts.mail_items} объявлений`, p.opts?.house_chats && 'Поиск по домовым чатам Сочи (скоро)'].filter(Boolean);
  function body() {
    const el = $('#p-body');
    if (sel.kind === 'pack') {
      el.innerHTML = `<p>Пакет <b>${I.pack.qty} номеров за ${money(I.pack.usd)}</b> добавляется к лимиту на день и на месяц до конца вашего месяца${I.quota?.month_end ? ` (до ${day(I.quota.month_end)})` : ''}. Повтор уже открытого номера — бесплатно.</p>`;
      return;
    }
    const cur = I.me.plan, act = I.me.active, adm = I.me.role === 'admin', gst = I.me.guest;
    el.innerHTML = `<div class="plans">${I.plans.map(p => {
      const low = act && !adm && RANK[p.id] < RANK[cur], mine = p.id === cur && !adm && !gst;
      const seat = p.seats == null ? '' : p.free === 0 && !(mine && act) ? '<span class="tag grey">мест нет</span>' : `<span class="muted small">свободно мест: ${p.free} из ${p.seats}</span>`;
      return `<button type="button" class="plan-card ${sel.plan === p.id ? 'on' : ''}" data-plan="${p.id}" ${low ? 'disabled title="Тариф ниже — после окончания текущего"' : ''}>
        <span class="pc-top"><b class="pc-name">${esc(p.name)}</b><span class="pc-price"><b>${money(p.usd)}</b> <small>/ мес</small></span></span>
        ${mine ? `<span class="tag ${act ? 'ok' : 'grey'}">Ваш тариф${act ? (I.me.expires_at ? ` до ${day(I.me.expires_at)}` : '') : ' · закончился'}</span>`
          : !adm && !gst && RANK[p.id] > RANK[cur] ? `<span class="tag">Перейти на ${esc(p.name)}${act ? ' — неиспользованные дни в зачёт' : ''}</span>` : ''}
        <ul>${FEAT(p).map(t => `<li>${esc(t)}</li>`).join('')}</ul>${seat}${low ? '<span class="muted small">Тариф ниже — можно после окончания текущего</span>' : ''}</button>`; }).join('')}</div>
      <div class="segs">${[1, 3, 12].map(mo => { const d = mo === 3 ? plan(sel.plan)?.disc_m3 : mo === 12 ? plan(sel.plan)?.disc_m12 : 0;
        return `<button type="button" class="chip ${sel.months === mo ? 'on' : ''}" data-months="${mo}">${{ 1: '1 месяц', 3: '3 месяца', 12: '12 месяцев' }[mo]}${d ? ` <small>−${d}%</small>` : ''}</button>`; }).join('')}</div>`;
  }
  async function requote() {
    const el = $('#p-quote'), n = ++qn;
    Q = null; goBtn(); el.innerHTML = '<span class="muted">Считаем…</span>';
    try {
      const r = await call('quote', sel.kind === 'pack' ? { kind: 'pack' } : { kind: 'plan', plan: sel.plan, months: sel.months });
      if (n !== qn) return;
      Q = r; el.innerHTML = quoteHtml(r);
    } catch (e) {
      if (n !== qn) return;
      el.innerHTML = `<p class="err">${esc(e.message)}</p>${e.data?.error === 'no_seats' && token ? `<button type="button" class="btn soft" data-wait="${sel.plan}">Встать в очередь</button>` : ''}`;
    }
    goBtn(); rateLine();
  }
  function quoteHtml(q) {
    const rows = q.kind === 'pack' ? [[`Пакет ${q.qty} номеров`, money(q.price)]]
      : [[`${plan(q.plan).name} × ${q.months} мес.`, money(q.price)], q.disc && [`Скидка ${q.disc_pct}% за ${q.months} мес.`, `−${money(q.disc)}`],
        q.credit && [`Зачёт: ${q.credit_days} дн. тарифа ${plan(q.from).name}`, `−${money(q.credit)}`]].filter(Boolean);
    const note = q.kind === 'upgrade' ? `Переход на ${plan(q.plan).name}: неиспользованные дни засчитаны, новый период — с даты оплаты.`
      : q.renew ? `Продление: ${q.months} мес. добавятся к текущему сроку.` : q.kind === 'plan' ? 'Период начнётся с даты оплаты.' : '';
    return `${rows.map(([a, b]) => `<div class="qrow"><span>${esc(a)}</span><span>${b}</span></div>`).join('')}
      <div class="qrow total"><span>К оплате</span><span>${money(q.total)}</span></div>${note ? `<p class="hint">${esc(note)}</p>` : ''}`;
  }
  function ways() {
    const m = I.methods, el = $('#p-ways'), chips = list => `<div class="segs">${list.map(([mt, x, label]) =>
      `<button type="button" class="chip ${way?.method === mt && way?.x === x ? 'on' : ''}" data-way="${mt}" data-x="${x}">${esc(label)}</button>`).join('')}</div>`;
    const cb = m.cryptobot ? m.cryptobot.assets.map(a => ['cryptobot', a, coin(a)]) : [], nets = m.nets.map(n => ['direct', n.id, n.name]), all = [...nets, ...cb];
    if (!all.length) { el.innerHTML = '<p class="muted">Способы оплаты ещё не подключены — напишите администратору.</p>'; way = null; return; }
    if (!way || !all.some(([mt, x]) => mt === way.method && x === way.x)) way = { method: all[0][0], x: all[0][1] };   // по умолчанию — USDT в сети TRON (TRC-20), она первая в списке сетей
    const main = nets.length ? `<div class="way main"><div class="lbl">Перевод USDT с кошелька или биржи</div>${chips(nets)}</div>` : '';
    const label = cb.length ? `Через @${m.cryptobot.bot}${m.cryptobot.test ? ' (тест)' : ''} в Telegram` : '';
    const other = !cb.length ? '' : nets.length ? `<details class="way" ${way.method === 'cryptobot' ? 'open' : ''}><summary>Другой способ: ${esc(label)}</summary>${chips(cb)}</details>`
      : `<div class="way"><div class="lbl">${esc(label)}</div>${chips(cb)}</div>`;
    el.innerHTML = `${main}${other}<p class="hint" id="p-rate"></p>`;
    rateLine(); goBtn();
  }
  function rateLine() {
    const el = $('#p-rate'), r = I.rate?.TON;
    if (!el) return;
    el.textContent = way?.method === 'cryptobot' && way.x === 'TON' ? (r ? `1 Gram (TON) = ${r.usd.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $ · курс зафиксирован ${fixed(r.fixed_at)} МСК`
        + (Q ? ` · к оплате ${num(Math.ceil(Math.round(Q.total / r.usd * 1e6) / 1e4) / 100)} Gram` : '') : 'Курс Gram обновляется — сумма будет в счёте.')
      : way?.method === 'direct' ? 'В счёте будет своя сумма с центами (например, 99.07) — по ней мы находим ваш перевод.'
      : way?.method === 'cryptobot' ? 'Сумма и валюта будут в счёте @CryptoBot — останется нажать «Оплатить».' : '';
  }
  function goBtn() {
    const b = $('#p-go');
    if (!b) return;
    b.disabled = !Q || !way;
    b.textContent = Q ? `Перейти к оплате — ${money(Q.total)}` : 'Перейти к оплате';
  }
  async function createInv(btn) {
    btn.disabled = true;
    try {
      const r = await call('create', { ...(sel.kind === 'pack' ? { kind: 'pack' } : { kind: 'plan', plan: sel.plan, months: sel.months }),
        method: way.method, ...(way.method === 'cryptobot' ? { asset: way.x } : { network: way.x }) });
      showInvoice(r.invoice);
    } catch (e) { toast(e.message, 6000); btn.disabled = false; }
  }
  async function openInvoice(id) {
    try { const r = await call('check', { id }); showInvoice(r.invoice, false, r.me); }
    catch (e) { toast(e.message, 5000); }
  }
  async function seatWait(b) {
    b.disabled = true;
    try { const r = await call('seat_wait', { plan: b.dataset.wait }, window.API); toast(r.ok ? `Вы в очереди: ${r.pos}-й. Освободится место — пришлём сообщение` : r.message, 6000); }
    catch (e) { b.disabled = false; toast(e.message); }
  }

  // ---------- счёт ----------
  let tick = null, poll = null;
  const STEPS = ['Ждём платёж', 'Получен', 'Подписка активна'];
  const waiting = x => x.status === 'wait' || x.status === 'pending';
  function showInvoice(inv, legacy = false, me = null) {
    clearInterval(tick); clearInterval(poll);
    document.onvisibilitychange = null;
    for (const s of ['#p-what', '#p-way', '#p-open']) if ($(s)) $(s).hidden = true;
    const box = $('#p-inv');
    box.hidden = false;
    paint(box, inv, legacy, me);
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (!waiting(inv)) return;
    const check = async () => {
      if (document.hidden) return;
      try {
        const r = legacy ? await call('pay_check', { id: inv.id }, window.API) : await call('check', { id: inv.id });
        const x = legacy ? fromOld(r.invoice) : r.invoice;
        if (x.status !== inv.status) { inv = x; paint(box, x, legacy, r.me ?? { expires_at: r.expires_at }); }
        if (!waiting(x)) { clearInterval(poll); document.onvisibilitychange = null; }
      } catch { /* сеть — проверим в следующий раз */ }
    };
    poll = setInterval(check, 30000);   // пока открыт экран оплаты — каждые 30 с (и сразу, когда вернулись из кошелька или бота)
    document.onvisibilitychange = () => { if (!document.hidden) check(); };
  }
  function paint(box, x, legacy, me) {
    const st = x.status, paid = st === 'paid', rev = st === 'review', over = !paid && !rev && !waiting(x);
    const cls = i => paid ? 'done' : rev ? ['done', 'on', ''][i] : over ? '' : ['on', '', ''][i];
    const head = `<div class="inv-head"><h2>${esc(x.what)}</h2><span class="muted">Счёт №${x.id}${x.test ? ' · тест' : ''}${x.amount_usd != null ? ` · ${money(x.amount_usd)}` : ''}</span></div>
      <ol class="psteps">${STEPS.map((t, i) => `<li class="${cls(i)}">${i === 1 && rev ? 'Получен — проверяем' : t}</li>`).join('')}</ol>`;
    let html;
    if (paid) {
      const what = x.kind === 'pack' ? `Пакет ${x.qty} номеров добавлен` : x.kind === 'test' ? 'Тестовый платёж получен' : `Подписка активна${me?.plan_name ? `: ${me.plan_name}` : ''}${me?.expires_at ? ` до ${day(me.expires_at)}` : ''}`;
      html = `<p class="pok">✅ ${esc(what)}</p>${x.tx_url ? `<a class="small" href="${esc(x.tx_url)}" target="_blank" rel="noopener">Транзакция в сети</a>` : ''}
        ${I?.me.via === 'pay' ? '<p class="hint">Войдите на сайте снова — доступ уже открыт.</p><a class="btn primary" href="./">Войти</a>' : '<a class="btn primary" href="./">Продолжить</a>'}`;
    } else if (rev) {
      html = `<p class="pnote warn">Платёж получен, но ${esc(x.review || 'его нужно проверить')}. Мы передали его администратору — он проверит и подключит вручную.</p>`;
    } else if (over) {
      html = `<p class="pnote warn">${st === 'rejected' ? 'Счёт отклонён. Если вы его оплатили — напишите администратору.'
        : 'Время счёта вышло. Если вы уже перевели — платёж найдётся автоматически в течение 2 часов, иначе его проверит администратор. Если не переводили — создайте новый счёт.'}</p>
        <button type="button" class="btn primary" data-new>Новый счёт</button>`;
    } else if (x.method === 'cryptobot') {
      html = `<div class="lbl">Сумма в счёте @CryptoBot</div><div class="amt">${num(x.amount)} <small>${esc(coin(x.asset))}</small></div>
        ${x.asset === 'TON' && x.rate ? `<p class="hint">1 Gram (TON) = ${Number(x.rate).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $ · курс зафиксирован ${fixed(x.rate_at)} МСК</p>` : ''}
        <a class="btn primary cbbtn" href="${esc(x.pay_url)}" target="_blank" rel="noopener" data-tglink>Оплатить в @${x.test ? 'CryptoTestnetBot' : 'CryptoBot'}</a>
        <p class="hint">Откроется бот в Telegram: нажмите «Оплатить» — валюта и сумма уже в счёте. Потом вернитесь сюда, статус обновится сам.</p>
        <p class="timer">Счёт действует ещё <b id="left"></b></p><p class="muted small" id="inv-st">Проверяем оплату каждые 30 секунд — страницу можно не закрывать.</p>
        <button type="button" class="btn ghost" data-new>← Выбрать другой способ</button>`;
    } else {
      html = `<div class="inv-grid direct">
          <div class="inv-grid"><div class="lbl">Сумма к переводу · USDT, сеть ${esc(x.net_name)}</div><div class="amt">${num(x.amount)} <small>USDT</small></div>
            <p class="warn-red">${esc(WARN1)}</p>
            <div class="inv-actions"><button type="button" class="btn soft" data-copy="${num(x.amount)}" data-msg="Сумма скопирована">Скопировать сумму</button></div></div>
          <div class="inv-grid"><div class="lbl">Адрес кошелька · сеть ${esc(x.net_name)}</div><code class="addr">${esc(x.address)}</code>
            <div class="inv-actions"><button type="button" class="btn soft" data-copy="${esc(x.address)}" data-msg="Адрес скопирован">Скопировать адрес</button></div></div>
          <div class="pqr" id="pqr" aria-label="QR-код адреса"></div>
        </div>
        <p class="warn2">${esc(WARN2)}</p>
        <p class="timer">Счёт действует ещё <b id="left"></b></p><p class="muted small" id="inv-st">Проверяем поступление каждые 30 секунд — страницу можно не закрывать.</p>
        <button type="button" class="btn ghost" data-new>← Выбрать другой способ</button>`;
    }
    box.innerHTML = head + html;
    if (box.querySelector('#pqr')) loadQr().then(() => new window.QRCode(box.querySelector('#pqr'), { text: x.address, width: 168, height: 168 })).catch(() => box.querySelector('#pqr')?.remove());
    const until = Date.parse(x.expires_at), left = box.querySelector('#left');
    clearInterval(tick);
    if (left) {
      const t = () => { const s = Math.max(0, Math.round((until - Date.now()) / 1000)); left.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; if (!s) clearInterval(tick); };
      t(); tick = setInterval(t, 1000);
    }
  }

  // ---------- история ----------
  const ST = { wait: ['ждём оплату', ''], pending: ['ждём оплату', ''], paid: ['оплачен', 'ok'], timeout: ['истёк', 'grey'], expired: ['истёк', 'grey'],
    review: ['проверяется', 'warn'], rejected: ['отклонён', 'bad'] };
  const how = x => x.method === 'cryptobot' ? `CryptoBot${x.test ? ' (тест)' : ''}` : x.method === 'manual' ? 'вручную' : `перевод · ${x.net_name ?? 'TRC-20'}`;
  function hist() {
    const el = $('#p-hist'), list = I.history ?? [];
    el.innerHTML = list.length ? `<div class="phist">${list.map(x => `<div class="ph"><span class="ph-what"><b>${esc(x.what)}</b><small class="muted">${when(x.created_at)} · ${esc(how(x))}</small></span>
      <span class="ph-sum">${num(x.amount)} ${esc(coin(x.asset ?? 'USDT'))}${x.amount_usd != null && x.asset !== 'USDT' ? `<small class="muted">${money(x.amount_usd)}</small>` : ''}</span>
      <span class="tag ${ST[x.status]?.[1] ?? ''}">${ST[x.status]?.[0] ?? esc(x.status)}</span>
      <span class="ph-act">${waiting(x) && Date.parse(x.expires_at) > Date.now() && x.kind ? `<button type="button" class="btn ghost" data-inv="${x.id}">Открыть</button>` : ''}${x.tx_url ? `<a class="small" href="${esc(x.tx_url)}" target="_blank" rel="noopener">транзакция</a>` : ''}</span></div>`).join('')}</div>`
      : '<p class="muted">Платежей пока нет.</p>';
  }

  // ---------- прежняя оплата доступа (функция web), пока не включена «боевая» ----------
  const OLD = { m1: 'Доступ на 1 месяц', m3: 'Доступ на 3 месяца', y1: 'Доступ на 1 год' };
  const fromOld = p => ({ id: p.id, what: OLD[p.tariff] ?? `Доступ на ${p.days} дн.`, amount: p.amount, asset: 'USDT', method: 'direct', network: 'TRC20', net_name: 'TRON (TRC-20)',
    address: p.address, status: p.status, expires_at: p.expires_at, tx_url: p.txid ? `https://tronscan.org/#/transaction/${p.txid}` : null });
  async function legacy(q) {
    const want = (q.get('plan') && q.get('plan') !== I.me.plan) || q.get('pack');
    main().innerHTML = `${want ? `<p class="pnote">${esc(CLOSED)}</p>` : ''}
      ${!I.me.active && I.me.status === 'active' ? `<p class="pnote warn">Ваша подписка закончилась${I.me.expires_at ? ` ${day(I.me.expires_at)}` : ''}. Продлите доступ:</p>` : ''}
      <section class="pcard" id="p-what"><h2>Продлить доступ</h2><div id="p-body"><p class="muted">Загрузка…</p></div></section>
      <section class="pcard" id="p-inv" hidden></section>
      <section class="pcard"><h2>История платежей</h2><div id="p-hist"></div></section>`;
    hist();
    if (!I.legacy) { $('#p-body').innerHTML = '<p>Оплата на сайте сейчас выключена — продлить доступ поможет администратор.</p>'; return; }
    try {
      const r = await call('pay_info', {}, window.API);
      $('#p-body').innerHTML = !r.enabled ? '<p>Оплата на сайте сейчас выключена — продлить доступ поможет администратор.</p>'
        : `${r.expires_at ? `<p class="muted">Доступ сейчас: до ${day(r.expires_at)}</p>` : ''}
        <div class="plans">${r.tariffs.map(t => `<button type="button" class="plan-card" data-old="${esc(t.id)}"><span class="pc-top"><b class="pc-name">${esc(t.name)}</b>
          <span class="pc-price"><b>${t.usdt} USDT</b></span></span><span class="muted">${t.days} дн. доступа</span></button>`).join('')}</div>
        <p class="hint">Перевод USDT в сети TRON (TRC-20) с любого кошелька или биржи. После перевода доступ продлится сам — обычно за 1–3 минуты.</p>`;
    } catch (e) { $('#p-body').innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  }

  document.addEventListener('click', async e => {
    const t = e.target.closest('button, a');
    if (!t || !$('#pay').contains(t)) return;
    if (t.dataset.kind) { sel = t.dataset.kind === 'pack' ? { kind: 'pack' } : { kind: 'plan', plan: defPlan(), months: 1 }; render(); }
    else if (t.dataset.plan) { sel.plan = t.dataset.plan; body(); requote(); }
    else if (t.dataset.months) { sel.months = +t.dataset.months; body(); requote(); }
    else if (t.dataset.way) { way = { method: t.dataset.way, x: t.dataset.x }; ways(); }
    else if (t.id === 'p-go') createInv(t);
    else if (t.dataset.inv) openInvoice(+t.dataset.inv);
    else if (t.dataset.wait) seatWait(t);
    else if (t.dataset.copy) copy(t.dataset.copy, t.dataset.msg);
    else if ('new' in t.dataset) { clearInterval(tick); clearInterval(poll); document.onvisibilitychange = null; history.replaceState(null, '', 'pay.html' + location.hash); location.reload(); }
    else if (t.dataset.old) {
      t.disabled = true;
      try { const r = await call('pay_create', { tariff: t.dataset.old }, window.API); showInvoice(fromOld(r.invoice), true); }
      catch (err) { toast(err.message, 5000); t.disabled = false; }
    } else if ('tglink' in t.dataset && tg?.openTelegramLink && /^https:\/\/t\.me\//.test(t.href)) { e.preventDefault(); tg.openTelegramLink(t.href); }
  });

  start();
  return { call, toast, copy, esc, money, num, day, when, fixed, showInvoice, info: () => I };
})();
