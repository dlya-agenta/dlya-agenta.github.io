// Админка v5.15 (admin.html, п. 14 и 20): тёмная панель разделов слева, первым экраном — «Сводка» с цифрами, стрелками к прошлой неделе,
// графиками (выручка, регистрации, онлайн по часам, тепловая карта «день × час»), устройствами и таблицами. Участники и прежние настройки —
// раздел «Участники и настройки» (тот же admin.js). «Ключи, API и ИИ» — какой ключ и модель у каждой функции, запасные ключи, ключи сервисов.
// Доступ проверяет сервер (admin_* в web, adm_* в hub — только role = admin).
(() => {
  const $ = s => document.querySelector(s);
  const H = window.HUB, esc = H.esc;
  const TITLES = { dash: 'Сводка', sales: 'Продажи и оплаты', users: 'Участники и настройки', listings: 'Объявления и выгрузка', support: 'Поддержка', ai: 'Ключи, API и ИИ', pxpool: 'Прокси сервиса (Россия)', ref: 'Партнёрка', mod: 'Модерация', content: 'Новостройки и тексты', design: 'Стиль сайта', system: 'Система' };
  let S = null, fx = null;
  const usd = v => `${Number(v || 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} $`;
  const money = v => fx ? `${H.rub(v, fx)}<small> · ${usd(v)}</small>` : usd(v);
  const n = v => Number(v || 0).toLocaleString('ru-RU');
  const arrow = (a, b) => { if (!b && !a) return ''; const d = b ? Math.round((a - b) / b * 100) : 100; return `<span class="adm-ar ${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(d)} %</span>`; };
  const tile = (label, value, sub = '', hint = '') => `<div class="adm-tile"${hint ? ` title="${esc(hint)}"` : ''}><small>${esc(label)}</small><b>${value}</b>${sub ? `<span>${sub}</span>` : ''}</div>`;

  async function start() {
    if (!H.token()) { location.href = './'; return; }
    try { S = await H.call('adm_stats'); } catch (e) { $('#gate').innerHTML = `<p class="err">${esc(e.status === 403 ? 'Только для администратора' : e.message)}</p><a class="btn primary" href="./">На сайт</a>`; return; }
    fx = (await H.rate()).rub;
    ADMIN.use({ call: H.web, sheet: (t, html) => { $('#adm-body').innerHTML = `<div id="sheet-body" class="adm-panel">${html}</div>`; }, closeSheet: () => {}, toast: H.toast, saved: () => {} });
    $('#gate').hidden = true; $('#app').hidden = false;
    $('#adm-burger').onclick = () => $('#adm-side').classList.toggle('open');
    addEventListener('hashchange', route); route(); window.CMPADM?.count();   // v5.24a: счётчик новых жалоб у «Модерации»
  }
  function route() {
    const s = ((location.hash.slice(1) || 'dash').split('=')[0]).replace(/^complaints$/, 'mod');   // v5.24a: ссылка из бота admin.html#complaints
    document.querySelectorAll('.adm-side [data-s]').forEach(a => a.classList.toggle('on', a.dataset.s === s));
    $('#adm-title').textContent = TITLES[s] ?? 'Сводка';
    $('#adm-at').textContent = S?.at ? `данные на ${H.when(S.at)}` : '';
    $('#adm-side').classList.remove('open');
    $('#adm-body').onclick = null; $('#adm-body').onchange = null;   // обработчик прошлого раздела
    ({ dash, sales, users, listings, support, ai, pxpool, ref, mod, content, design, system }[s] ?? dash)();
  }
  const body = h => { $('#adm-body').innerHTML = h; };

  // ---------- графики (свой SVG) ----------
  function line(pts, { fmt = v => v, h = 160, bars = false } = {}) {
    if (!pts.length) return '<p class="muted">Нет данных</p>';
    const w = 600, p = 30, vs = pts.map(x => Number(x[1])), max = Math.max(1, ...vs) * 1.1;
    const x = i => p + i * (w - 2 * p) / Math.max(1, pts.length - 1), y = v => h - p - v / max * (h - 2 * p), bw = Math.max(3, (w - 2 * p) / pts.length - 3);
    return `<svg viewBox="0 0 ${w} ${h}" class="adm-svg">${[0, .5, 1].map(t => `<line x1="${p}" x2="${w - p}" y1="${y(max * t)}" y2="${y(max * t)}" class="mk-grid"/><text x="0" y="${y(max * t) + 4}" class="mk-t">${esc(fmt(Math.round(max * t)))}</text>`).join('')}
      ${bars ? pts.map((q, i) => `<rect x="${x(i) - bw / 2}" y="${y(q[1])}" width="${bw}" height="${h - p - y(q[1])}" class="mk-bar"><title>${esc(q[0])}: ${esc(fmt(q[1]))}</title></rect>`).join('')
        : `<path d="${pts.map((q, i) => `${i ? 'L' : 'M'}${x(i)},${y(q[1])}`).join('')}" class="mk-line"/>`}
      <text x="${p}" y="${h - 6}" class="mk-t">${esc(String(pts[0][0]).slice(5))}</text><text x="${w - p}" y="${h - 6}" text-anchor="end" class="mk-t">${esc(String(pts.at(-1)[0]).slice(5))}</text></svg>`;
  }
  // последние 30 дней по дням — пустые дни нулями
  const days30 = arr => { const m = new Map(arr), out = []; for (let i = 29; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5).toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' }); out.push([d, Number(m.get(d) ?? 0)]); } return out; };
  function heat(cells) {
    const m = new Map(cells.map(([d, h, v]) => [`${d}:${h}`, Number(v)])), max = Math.max(1, ...cells.map(c => Number(c[2])));
    const D = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    return `<div class="adm-heat"><span></span>${Array.from({ length: 24 }, (_, h) => `<small>${h % 3 ? '' : h}</small>`).join('')}
      ${D.map((dn, i) => `<small>${dn}</small>${Array.from({ length: 24 }, (_, h) => { const v = m.get(`${i + 1}:${h}`) ?? 0; return `<i style="opacity:${(0.08 + 0.92 * v / max).toFixed(2)}" title="${dn} ${h}:00 — в среднем ${v} на сайте"></i>`; }).join('')}`).join('')}</div>`;
  }
  const bars = (obj, names = {}) => { const e = Object.entries(obj ?? {}).sort((a, b) => b[1] - a[1]), t = e.reduce((s, x) => s + Number(x[1]), 0) || 1;
    return e.length ? e.map(([k, v]) => `<div class="adm-bar"><span>${esc(names[k] ?? k)}</span><i style="width:${Math.round(v / t * 100)}%"></i><b>${n(v)}</b></div>`).join('') : '<p class="muted">Нет данных</p>'; };

  // ---------- разделы ----------
  function dash() {
    const m = S.money, u = S.users, o = S.online, l = S.listings, w = S.work;
    const DEV = { phone: '📱 Телефон', desktop: '💻 Компьютер', tablet: 'Планшет', other: 'Другое' };
    body(`<div class="adm-tiles">
        ${tile('Выручка за 7 дней', money(m.d7), arrow(m.d7, m.prev7) + ' к прошлой неделе')}
        ${tile('Выручка за 30 дней', money(m.d30), `${n(m.count30)} оплат · ${n(m.payers30)} плательщиков`)}
        ${tile('MRR (в месяц по подпискам)', money(m.mrr), `ARPU ${m.payers30 ? usd(m.d30 / m.payers30) : '—'}`)}
        ${tile('Регистрации за 7 дней', n(u.new7), arrow(u.new7, u.prev7) + ' к прошлой неделе')}
        ${tile('Новых платящих за 7 дней', n(u.paid_new7), `гость → платный за 30 дн.: ${u.guest_conv30?.guests ? Math.round(u.guest_conv30.paid / u.guest_conv30.guests * 100) : 0} %`)}
        ${tile('Активных подписок', n(u.active), `гостей ${n(u.guests)} · заявок ${n(u.pending)}`)}
        ${tile('Сейчас на сайте', n(o.now), `пик за 7 дней: ${n(o.peak7)}${o.peak_at ? ` (${esc(o.peak_at)})` : ''}`)}
        ${tile('В среднем на сайте', `${n(o.avg_min)} мин`, `в день на человека · ${n(o.dau7)} человек в день`)}
        ${tile('Активных объявлений', n(l.active), `новых за 7 дн.: ${n(l.new7)} · снято: ${n(l.gone7)}`)}
        ${tile('Открыто телефонов за 7 дней', n(w.phones7), `подборок: ${n(w.sels7)} · пустых поисков: ${n(w.miss7)}`)}
        ${tile('Расходы ИИ за 30 дней', usd(S.ai.d30 + S.ai.support30), `сегодня ${usd(S.ai.today)} · по ценам Anthropic`)}
        ${tile('Неудачных оплат за 7 дней', n(m.failed7), `разобрать вручную: ${n(m.review)}`)}
      </div>
      <div class="adm-grid2">
        <section class="hub-sec"><h3>Выручка по дням, 30 дней</h3>${line(days30(m.series), { fmt: v => `${v} $`, bars: true })}</section>
        <section class="hub-sec"><h3>Регистрации по дням, 30 дней</h3>${line(days30(u.series), { bars: true })}</section>
        <section class="hub-sec"><h3>Пик одновременно на сайте по часам (МСК), 7 дней</h3>${line(Array.from({ length: 24 }, (_, h) => [`${h}:00`, (o.by_hour7.find(x => x[0] === h) ?? [h, 0])[1]]), { bars: true })}</section>
        <section class="hub-sec"><h3>Когда на сайте (в среднем одновременно), 30 дней</h3>${heat(o.heat)}</section>
        <section class="hub-sec"><h3>Устройства (30 дней)</h3>${bars(o.dev, DEV)}<h3>Системы</h3>${bars(o.os)}<h3>Браузеры</h3>${bars(o.browser)}<p class="hint">С экрана «Домой» (PWA): ${n(o.pwa)}</p></section>
        <section class="hub-sec"><h3>Что ищут и не находят (7 дней)</h3>${w.miss_top.length ? `<ol>${w.miss_top.map(([q, c]) => `<li>${esc(q)} — ${c}</li>`).join('')}</ol>` : '<p class="muted">Пустых поисков нет</p>'}
          <h3>Тарифы активных</h3>${bars(u.by_plan, { sub: 'Подписчик', pro: 'PRO', max: 'MAX' })}</section>
      </div>
      <p class="hint">💡 Ещё полезно смотреть (мнение): отток — у кого подписка кончилась и не продлена (${n(u.ended30)} за 30 дней, продлили ${n(u.renew30)}), окупаемость скидки, расходы ИИ на одного платящего, место в хранилище (раздел «Система»).</p>`);
  }
  function sales() {
    const m = S.money;
    body(`<div class="adm-tiles">${tile('Сегодня', money(m.today))}${tile('7 дней', money(m.d7), arrow(m.d7, m.prev7))}${tile('30 дней', money(m.d30))}${tile('Скидка PRO за 30 дней', `${n(m.offers30.paid)} из ${n(m.offers30.shown)}`, `выручка ${usd(m.offers30.revenue)}`)}</div>
      <div class="adm-grid2"><section class="hub-sec"><h3>По тарифам, 30 дней</h3>${bars(m.by_plan30, { sub: 'Подписчик', pro: 'PRO', max: 'MAX', pack: 'Пакеты', topup: 'Пополнения', urgent: 'Срочные в чате' })}</section>
      <section class="hub-sec"><h3>По способам</h3>${bars(m.by_method30, { cryptobot: 'CryptoBot', direct: 'Перевод', manual: 'Вручную', balance: 'С баланса' })}</section></div>
      <p><a class="btn primary" href="pay.html#admin">⚙ Настройки оплаты, счета, «Разобрать вручную»</a></p>`);
  }
  function users() { ADMIN.open(); }
  function listings() {
    const l = S.listings;
    body(`<div class="adm-tiles">${tile('Активных', n(l.active))}${tile('Новых за 7 дней', n(l.new7))}${tile('Снято за 7 дней', n(l.gone7))}${tile('Без фото', n(l.no_photo))}${tile('Без телефона', n(l.no_phone))}${tile('С описанием ИИ', n(l.descr_ai))}</div>
      <div class="adm-grid2"><section class="hub-sec"><h3>По типам</h3>${bars(l.by_kind)}</section>
      <section class="hub-sec"><h3>Последние выгрузки</h3><div class="hub-rows">${l.runs.map(r => `<div class="hub-row"><b>${H.when(r.at)}${r.error ? ' · ⚠ ошибка' : ''}</b><small>${esc(Object.entries(r.stats ?? {}).map(([k, v]) => `${k}: ${v}`).join(' · '))}${r.error ? ` · ${esc(r.error)}` : ''}</small></div>`).join('')}</div></section></div>`);
  }
  function support() {
    const s = S.support;
    body(`<div class="adm-tiles">${tile('Новых за 7 дней', n(s.new7))}${tile('Открыто', n(s.open))}${tile('Ждут вас', n(s.wait_admin))}${tile('Первый ответ, в среднем', s.first_reply_min != null ? `${n(s.first_reply_min)} мин` : '—')}</div>
      <section class="hub-sec"><h3>Темы за 7 дней</h3>${bars(s.by_cat7, { pay: 'Оплата', access: 'Доступ', bug: 'Ошибка', idea: 'Предложение' })}</section>
      <p><a class="btn primary" href="support.html#admin">Открыть обращения</a></p>`);
  }
  function ref() {
    const r = S.ref;
    body(`<div class="adm-tiles">${tile('Начислено за 30 дней', money(r.accrued30))}${tile('К выплате', money(r.ready))}${tile('Выплачено всего', money(r.paid_all))}</div>
      <section class="hub-sec"><h3>Топ партнёров</h3>${r.top.length ? `<ol>${r.top.map(([l, s, c]) => `<li>${esc(l)} — ${usd(s)}, приглашено ${c}</li>`).join('')}</ol>` : '<p class="muted">Пока нет</p>'}</section>
      <p><a class="btn primary" href="partner.html#admin">Заявки на выплату и настройки</a></p>`);
  }
  function mod() { body(`<section class="hub-sec" id="complaints"><h3>⚠ Жалобы на объявления</h3><div id="cmp">Загрузка…</div></section><section class="hub-sec"><h3>📨 Объявления из Telegram</h3><div id="tz">Загрузка…</div></section>
    <section class="hub-sec"><h3>Чат подписчиков</h3><p>Жалобы, замечания и баны.</p><p><a class="btn primary" href="hub.html#chat">Открыть чат и модерацию</a></p></section>
    <section class="hub-sec"><h3>Эксклюзивы</h3><p>Подписчики размещают свою вторичку без документов (v5.19); срок размещения 30 дней с продлением.</p><p><a class="btn soft" href="excl.html">Открыть эксклюзивы</a></p></section>`);
    window.CMPADM?.render($('#cmp')); window.TGZKADM?.render($('#tz')); }   // v5.24a: жалобы (complaints.admin.js)
  function content() { body(`<section class="hub-sec"><h3>Новостройки</h3><p>Карточки ЖК: телефон отдела продаж, правила фиксации, кабинет партнёра, официальные фото, новости.</p><p><a class="btn primary" href="hub.html#newb">Открыть новостройки</a></p></section>
    <section class="hub-sec"><h3>Тарифы, цены и тексты</h3><p>Тарифы и что в них входит — в «Участники и настройки» (блок «Тарифы»). Документы: <a href="prices.html" target="_blank">тарифы</a>, <a href="oferta.html" target="_blank">оферта</a>, <a href="rules.html" target="_blank">правила</a>, <a href="privacy.html" target="_blank">политика</a>.</p></section>`); }
  // ---------- Стиль сайта (v5.16; v5.17 — логотип и значки меню; v5.21 — «Небо» и «Дюна» вместо «Резиденции»): выбор админа — по умолчанию для всех;
  // участник может выбрать себе другой стиль кнопкой «Стиль»; «Примерить у себя» меняет только этот экран ----------
  // v5.31c (Алексей 05.11): порядок Небо, Премиум, Лагуна, Сапфир, Классика; «Дюна» убрана из выбора (у кого была — «Небо»)
  const LOOKS = [
    { id: 'sky', name: 'Небо', text: 'Светлый и приятный: кремовый фон, белые карточки, светло-голубые кнопки и цены, песочные линии, бежевые плашки.' },
    { id: 'premium', name: 'Премиум', text: 'Тёмный и дорогой: графит и золото, блеск на кнопках, золотая рамка карточек — видно, что сервис стоит своих денег.' },
    { id: 'lagoon', name: 'Лагуна', text: 'Вариант «Неба» в бирюзе: мятный фон, белые карточки, бирюзовые кнопки и цены, песочные отметки; ночью — глубокая морская бирюза.' },
    { id: 'sapphire', name: 'Сапфир', text: 'Вариант «Неба» строже: белый с холодной дымкой, сапфировые кнопки и цены, золотые отметки; ночью — тёмно-синий с золотом.' },
    { id: 'classic', name: 'Классика', text: 'Как эта админка: тёмно-синяя шапка, белые карточки с синей полосой, спокойно и строго.' }];
  const ICON_DEMO = ['🏠 Объявления', '⭐ Моё', '📣 Продвижение', '🤖 Помощник', '💼 Кабинет', '🖥️ С клиентом'];
  async function design() {
    body('<p class="muted">Загрузка…</p>');
    const D = window.DESIGN;
    let cur = { default: 'classic', logo: 'keyhole', icons: 'lines' };
    try { cur = await H.call('adm_design'); } catch (e) { H.toast(e.message, 5000); }
    const tags = (on, mine) => `${on ? ' <span class="tag ok">для всех</span>' : ''}${mine ? ' <span class="tag">у вас сейчас</span>' : ''}`;
    const draw = () => {
      body(`<section class="hub-sec"><h3>🎨 Стиль сайта для всех участников</h3>
        <p class="hint">Выбранный стиль увидят все, кто не выбрал себе другой. Участник может сменить стиль у себя кнопкой «Стиль» справа в шапке — по кругу из шести; это меняет только его экран.</p>
        <div class="dz-grid">${LOOKS.map(l => `<article class="dz-card${l.id === cur.default ? ' on' : ''}" data-look="${l.id}">
          <div class="dz-prev dz-${l.id}" aria-hidden="true"><i class="dz-top"><b></b><s></s><s></s><s></s></i><span class="dz-t"><u></u><em></em></span><span class="dz-t"><u></u><em></em></span><span class="dz-t"><u></u><em></em></span><span class="dz-btn"></span></div>
          <h4>${esc(l.name)}${tags(l.id === cur.default, D?.get() === l.id)}</h4><p class="hint">${esc(l.text)}</p>
          <p class="dz-act"><button class="btn ghost" data-try="${l.id}">Примерить у себя</button>${l.id === cur.default ? '' : `<button class="btn primary" data-def="${l.id}">Сделать для всех</button>`}</p></article>`).join('')}</div></section>
      <section class="hub-sec"><h3>Логотип «Для Агента» — «Ключ-дом»</h3>
        <p class="hint">Знак один — «Ключ-дом»: в шапке всех страниц, на входе, в подборке клиенту. Выберите цвет знака (v5.47, просьба Алексея). «Примерить у себя» меняет только ваш экран.</p>
        <div class="lg-prev kc-prev">${D.brandHtml('key', undefined, true)}</div>
        <div class="kc-grid">${Object.entries(D?.keyColors ?? {}).map(([id, [name]], i) => `<article class="kc-card${id === (cur.keycolor ?? 'sky') ? ' on' : ''}">
          <span class="logo" data-fixed>${D.markSvg('key', id)}</span><b>${i + 1}. ${esc(name)}</b>${tags(id === (cur.keycolor ?? 'sky'), D.keyColor() === id)}
          <p class="dz-act"><button class="btn ghost" data-try-kc="${id}">Примерить</button>${id === (cur.keycolor ?? 'sky') ? '' : `<button class="btn primary" data-def-kc="${id}">Для всех</button>`}</p></article>`).join('')}</div></section>
      <section class="hub-sec"><h3>Значки в меню</h3>
        <p class="hint">Вместо эмодзи («смайликов») — рисованные значки в цвет текста. У «Кабинета» и «С клиентом» теперь разные значки: портфель и экран показа.</p>
        <div class="dz-grid">${Object.entries(D?.icons ?? {}).map(([id, name]) => `<article class="dz-card${id === cur.icons ? ' on' : ''}">
          <div class="ic-prev" data-icons-demo="${id}">${ICON_DEMO.map(t => `<span class="link">${t}</span>`).join('')}</div>
          <h4>${esc(name)}${tags(id === cur.icons, D.iconsSet() === id)}</h4>
          <p class="dz-act"><button class="btn ghost" data-try-icons="${id}">Примерить у себя</button>${id === cur.icons ? '' : `<button class="btn primary" data-def-icons="${id}">Сделать для всех</button>`}</p></article>`).join('')}</div>
        ${D?.mine() || D?.mineLogo() || D?.mineIcons() || D?.mineKc?.() ? `<p class="hint">У вас есть личный выбор (стиль, логотип или значки). <button class="btn ghost" data-mine-reset>Вернуть выбор «для всех»</button></p>` : ''}</section>`);
      // значки в образцах: те же, что в меню (nav.js), набор — свой у каждого образца
      document.querySelectorAll('.ic-prev .link').forEach(el => D?.iconizeEl(el));
    };
    draw();
    const save = async (btn, b, what) => {
      btn.disabled = true;
      try { cur = await H.call('adm_design_set', b); D?.setDefault(cur.default, cur.logo, cur.icons, cur.keycolor); H.toast(`${what} — теперь для всех`); draw(); } catch (er) { H.toast(er.message, 5000); btn.disabled = false; }
    };
    $('#adm-body').onclick = async e => {
      const t = e.target.closest('[data-try], [data-try-logo], [data-try-icons], [data-try-kc]');
      if (t) { if (t.dataset.try) D?.set(t.dataset.try); if (t.dataset.tryLogo) D?.setLogo(t.dataset.tryLogo); if (t.dataset.tryIcons) D?.setIcons(t.dataset.tryIcons); if (t.dataset.tryKc) D?.setKeyColor(t.dataset.tryKc); setTimeout(draw, 150); return; }
      if (e.target.closest('[data-mine-reset]')) { D?.reset(); setTimeout(draw, 150); return; }
      const d = e.target.closest('[data-def], [data-def-logo], [data-def-icons], [data-def-kc]');
      if (d?.dataset.def) return save(d, { default: d.dataset.def }, `Стиль «${LOOKS.find(x => x.id === d.dataset.def).name}»`);
      if (d?.dataset.defKc) return save(d, { keycolor: d.dataset.defKc, logo: 'key' }, `Цвет ключа «${D.keyColors[d.dataset.defKc][0]}»`);
      if (d?.dataset.defIcons) return save(d, { icons: d.dataset.defIcons }, `Значки «${D.icons[d.dataset.defIcons]}»`);
    };
  }
  function pxpool() { window.PXPOOL ? window.PXPOOL.open($('#adm-body')) : body('<p class="err">Блок прокси не загрузился — обновите страницу</p>'); }   // v5.40: пул российских прокси (pxpool.admin.js)
  function system() {
    const sp = S.space;
    body(`<div class="adm-tiles">${tile('База', `${n(sp.db_mb)} МБ`, 'из 500 МБ (Free)')}${Object.entries(sp.files ?? {}).map(([b, mb]) => tile(`Файлы: ${b}`, `${n(mb)} МБ`)).join('')}</div>
      <p class="hint">⚠ Файлы основного проекта больше лимита бесплатного тарифа (1 ГБ). Совет: Supabase Pro (25 $/мес) — 8 ГБ базы, 100 ГБ файлов, ежедневные копии базы.</p>
      <p><a class="btn soft" href="manager.html">🤖 Окно Управляющего</a></p>`);
  }

  // ---------- Ключи, API и ИИ ----------
  async function ai() {
    body('<p class="muted">Загрузка…</p>');
    const r = await H.call('adm_ai');
    const keyOpt = (v) => Object.keys(r.keys).map(k => `<option value="${k}"${k === v ? ' selected' : ''}>${esc(r.key_labels[k])}</option>`).join('');
    const modOpt = v => Object.entries(r.models).map(([k, t]) => `<option value="${k}"${k === v ? ' selected' : ''}>${esc(t)}</option>`).join('');
    const by = S.ai.by_feature30 ?? {};
    body(`<section class="hub-sec"><h3>Ключи ИИ</h3><p class="hint">Три ключа, у каждого свой адрес подключения API: посредник BetterToken (https://bettertoken.ai) или Anthropic напрямую (https://api.anthropic.com, пустое поле — тоже Anthropic). Если ключ не ответил, функция берёт запасной из своей строки ниже. Командовать Управляющим может только администратор — запасной ключ лишь выполняет ту же рутинную работу.</p>
        ${Object.entries(r.keys).map(([k, x]) => `<div class="adm-key"><b>${esc(x.label)}</b><span class="${x.set ? 'tag ok' : 'tag warn'}">${x.set ? (x.from === 'admin' ? 'задан здесь ••••' : 'из настроек функции') : 'не задан'}</span>
          <input type="password" data-key="${k}" placeholder="Вставьте новый ключ" autocomplete="off"><button class="btn soft" data-save-key="${k}">Сохранить</button><button class="btn ghost" data-test="${k}">Проверить</button>
          <label class="field adm-base">Адрес API<input data-base="${k}" value="${esc(r.base_urls?.[k] ?? '')}" placeholder="https://api.anthropic.com" list="ai-base-list" autocomplete="off"></label></div>`).join('')}
        <datalist id="ai-base-list"><option value="https://bettertoken.ai">BetterToken</option><option value="https://api.anthropic.com">Anthropic (Claude) напрямую</option></datalist>
        <p><button class="btn primary" data-save-base>Сохранить адреса API</button> <small class="muted">«Проверить» у ключа идёт через его сохранённый адрес.</small></p></section>
      <section class="hub-sec"><h3>Какая функция через какой ключ и модель</h3><p class="hint">«Цена = качество»: Haiku — короткие частые задачи, Sonnet — разбор, Opus — где ошибка дорога. Расходы — по ценам Anthropic (у посредника ~68 %).</p>
        <div class="adm-routes"><b>Функция</b><b>Ключ</b><b>Запасной</b><b>Модель</b><b>Усилие</b><b>Вкл.</b><b>30 дней</b>
        ${Object.entries(r.routes).map(([f, x]) => `<span title="${esc(x.hint)}">${esc(x.label)}</span><select data-r="${f}.key">${keyOpt(x.key)}</select>
          <select data-r="${f}.fb"><option value="">—</option>${keyOpt(x.fallback[0])}</select><select data-r="${f}.model">${modOpt(x.model)}</select>
          <select data-r="${f}.effort">${['low', 'medium', 'high'].map(e => `<option${e === x.effort ? ' selected' : ''}>${e}</option>`).join('')}</select>
          <input type="checkbox" data-r="${f}.on"${x.on ? ' checked' : ''}><small>${by[f] ? `${usd(by[f][0])} · ${by[f][1]} выз.${by[f][2] ? ` · ош. ${by[f][2]}` : ''}` : '—'}</small>`).join('')}</div>
        <div class="hub-form"><label class="field">Ночью описаний за раз<input type="number" id="n-descr" value="${r.night.descr}" min="0" max="5000"></label><label class="field">Ночью проверок фото<input type="number" id="n-repair" value="${r.night.repair}" min="0" max="5000"></label></div>
        <p><button class="btn primary" data-save-routes>Сохранить маршруты</button></p></section>
      <section class="hub-sec"><h3>🎬 Видеомонтаж</h3><p class="hint">Без ИИ ролик собирается по шаблону сам (переходы, титры, цифры). С ИИ-режиссёром (PRO и MAX): ИИ смотрит фото, ставит лучший порядок кадров внутри каждого объекта, подписи по тому, что видно на фото, переходы и цвет — по тому же шаблону. Порядок объектов не меняется. Расход — строка «Видеомонтаж» выше (~1–3 ₽ за ролик).</p>
        <label class="hub-chk"><input type="checkbox" id="vid-ai"${r.video?.ai ? ' checked' : ''}> Готовить ролики через ИИ (для PRO и MAX; у PRO должен быть включён «Ролики из фото» в тарифах)</label>
        <label class="field">Шаблон по умолчанию<select id="vid-tpl"><option value="motion"${r.video?.tpl !== 'classic' ? ' selected' : ''}>«Мотион» — динамичный (v5.26)</option><option value="classic"${r.video?.tpl === 'classic' ? ' selected' : ''}>«Классика» — плавный (как раньше)</option></select></label>
        <p><button class="btn primary" data-save-video>Сохранить</button></p></section>
      <section class="hub-sec adm-lawpaid" id="law-paid"><h3>⚖️ Сервис проверки для юриста — api-assist</h3><p class="muted">Загрузка…</p></section>
      <section class="hub-sec adm-night" id="night-sec"><h3>🌙 Ночная работа — выгрузка, номера, фото ИИ</h3><p class="muted">Загрузка…</p></section>
      <section class="hub-sec"><h3>Ключи сервисов и API</h3><p class="hint">Меняются здесь, без программиста. Значения не показываются — только «задан» или нет. Остальные секреты (вход в источник, токен бота, CryptoBot) — в своих разделах: бот — «Участники и настройки», CryptoBot — «Продажи и оплаты».</p>
        ${r.secrets.filter(x => !x.name.startsWith('ai_key') && x.name !== 'law_paid_key').map(x => `<div class="adm-key"><b>${esc(x.label)}</b><small class="muted">${esc(x.used_by)}</small><span class="${x.set ? 'tag ok' : 'tag'}">${x.set ? 'задан ••••' : x.env ? 'из настроек функции' : 'не задан'}</span>
          <input type="password" data-key="${esc(x.name)}" placeholder="Новое значение" autocomplete="off"><button class="btn soft" data-save-key="${esc(x.name)}">Сохранить</button>${x.name === 'photo_ai_key' ? '<button class="btn ghost" data-photo-test>Проверить</button>' : ''}${x.name === 'yandex_speech_key' ? `<button class="btn ghost" data-speech-test>Проверить</button>
          <details class="tip"><summary>Где взять ключ (5 минут)</summary><p class="hint">1. console.yandex.cloud → войти через Яндекс ID → создать платёжный аккаунт (карта, оплата по факту, ~0,6 ₽ за минуту; новым — стартовый грант).<br>
          2. «Сервисные аккаунты» → «Создать» → роль <b>ai.speechkit-stt.user</b>.<br>3. Открыть аккаунт → «Создать новый ключ» → «API-ключ» → скопировать секрет и вставить сюда → «Сохранить» → «Проверить».<br>
          После этого голосовые до 30 секунд в боте (режим «🤖 Помощник») превращаются в текст и уходят Помощнику. Расход видно в «Расходе ИИ» строкой speech.</p></details>` : ''}</div>`).join('')}</section>`
      + `<section class="hub-sec"><h3>Карта Яндекса</h3><p class="hint">Ключ «JavaScript API и HTTP Геокодер» из кабинета разработчика Яндекса (developer.tech.yandex.ru). С ключом все карты сайта — Яндекс, без ключа — OpenStreetMap.
        Ключ браузерный: его видно в коде страницы, это нормально. В кабинете Яндекса ограничьте его адресом dlya-agenta.github.io.</p>
        <div class="adm-key"><input id="ymap-key" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autocomplete="off"><button class="btn soft" id="ymap-save">Сохранить</button><button class="btn ghost" id="ymap-off">Убрать (OpenStreetMap)</button></div></section>`);
    const ymap = async v => { try {
        const r = await fetch(window.API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'admin_settings', map: { yandex: v }, auth: { token: JSON.parse(localStorage.getItem('token')) } }) });
        const d = await r.json(); if (!r.ok || d.error) throw new Error(d.message || d.error); H.toast(v ? 'Ключ сохранён — карты станут Яндекса (обновите страницу)' : 'Карты — снова OpenStreetMap');
      } catch (er) { H.toast(er.message, 6000); } };
    fetch(window.API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'public' }) }).then(r => r.json()).then(d => { if (d.map?.yandex) $('#ymap-key').value = d.map.yandex; }).catch(() => {});
    lawPaid(); night();
    $('#ymap-save').onclick = () => ymap($('#ymap-key').value.trim());
    $('#ymap-off').onclick = () => { $('#ymap-key').value = ''; ymap(''); };
    $('#adm-body').onclick = async e => {
      const sk = e.target.closest('[data-save-key]');
      if (sk) { const k = sk.dataset.saveKey, v = $(`[data-key="${k}"]`).value.trim(); if (!v && !confirm('Пустое значение удалит ключ. Удалить?')) return;
        try { await H.call('adm_secret_set', { name: k, value: v }); H.toast(v ? 'Ключ сохранён' : 'Ключ удалён'); ai(); } catch (er) { H.toast(er.message, 5000); } return; }
      if (e.target.closest('[data-lp-test]')) { lawPaid(true); return; }
      if (e.target.closest('[data-photo-test]')) { try { const x = await H.call('adm_photo_test'); H.toast(x.ok ? `Ключ BetterToken «${x.name}» работает · всего списано ${x.used_rub} ₽` : x.error, 8000); } catch (er) { H.toast(er.message, 5000); } return; }   // v5.50
      if (e.target.closest('[data-night-save]')) { const v = id => document.getElementById(id);
        try { await H.call('adm_night_set', { photo_ai: { on: v('na-on').checked, kinds: [...document.querySelectorAll('[data-na-kind]:checked')].map(x => x.dataset.naKind), days: v('na-days').value, max_rub: v('na-rub').value, parallel: v('na-par').value, min_sim: v('na-sim').value, check_marks: v('na-marks').checked },
          phones: { on: v('np-on').checked, target: v('np-target').value, max: v('np-max').value, until: v('np-until').value } }); H.toast('Настройки ночи сохранены — действуют со следующей ночи'); night(); } catch (er) { H.toast(er.message, 6000); } return; }
      if (e.target.closest('[data-speech-test]')) { try { const x = await H.call('adm_speech_test'); H.toast(x.ok ? 'Ключ SpeechKit принят — голосовые в боте работают' : x.error, 8000); } catch (er) { H.toast(er.message, 5000); } return; }   // v5.46a
      const lpOn = e.target.closest('[data-lp-on]');
      if (lpOn) { try { await H.call('adm_law_paid_set', { on: lpOn.dataset.lpOn === '1' }); H.toast(lpOn.dataset.lpOn === '1' ? 'Сервис включён — проверки юриста идут через него' : 'Сервис выключен — проверки без него'); lawPaid(); } catch (er) { H.toast(er.message, 5000); } return; }
      const t = e.target.closest('[data-test]');
      if (t) { t.disabled = true; try { const x = await H.call('adm_key_test', { key: t.dataset.test }); H.toast(x.ok ? `Ключ работает (${x.base}): «${x.text}»` : `Ключ не ответил (${x.base}): ${x.error}`, 8000); } catch (er) { H.toast(er.message, 5000); } t.disabled = false; return; }
      if (e.target.closest('[data-save-base]')) { const base_urls = {}; document.querySelectorAll('[data-base]').forEach(i => { base_urls[i.dataset.base] = i.value.trim(); });
        try { await H.call('adm_ai_set', { base_urls }); H.toast('Адреса API сохранены'); ai(); } catch (er) { H.toast(er.message, 5000); } return; }
      if (e.target.closest('[data-save-video]')) { try { await H.call('adm_ai_set', { video: { ai: $('#vid-ai').checked, tpl: $('#vid-tpl').value } }); H.toast('Видеомонтаж: сохранено'); } catch (er) { H.toast(er.message, 5000); } return; }
      if (e.target.closest('[data-save-routes]')) {
        const routes = {};
        for (const f of Object.keys(r.routes)) routes[f] = { key: $(`[data-r="${f}.key"]`).value, fallback: [$(`[data-r="${f}.fb"]`).value].filter(Boolean), model: $(`[data-r="${f}.model"]`).value,
          effort: $(`[data-r="${f}.effort"]`).value, on: $(`[data-r="${f}.on"]`).checked };
        try { await H.call('adm_ai_set', { routes, night: { descr: +$('#n-descr').value, repair: +$('#n-repair').value } }); H.toast('Сохранено'); } catch (er) { H.toast(er.message, 5000); }
      }
    };
  }
  // v5.36: блок «Сервис проверки для юриста» — ключ, вкл/выкл, расход лимита, адреса и инструкция (раскрывающийся список)
  // v5.50: «🌙 Ночная работа» — правила, настройки, итоги последних ночей (hub adm_night / adm_night_set)
  async function night() {
    const box = document.getElementById('night-sec');
    if (!box) return;
    let x;
    try { x = await H.call('adm_night'); } catch (er) { box.innerHTML = `<h3>🌙 Ночная работа</h3><p class="hint">${esc(er.message)}</p>`; return; }
    const p = x.photo_ai, f = x.phones, m = x.month;
    const when = t => new Date(t).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const logs = x.log.map(l => { const d = l.detail ?? {};
      const t = l.action === 'photo_ai' ? `фото ИИ: улучшено ${d.done ?? 0} из ${d.tried ?? 0}, со знаками ${d.marks ?? 0}, не прошли сверку ${d.rejected ?? 0}, ошибок ${d.errors ?? 0} · ${d.rub ?? 0} ₽`
        : l.action === 'fresh' ? `номера (${esc(l.target)}): новых ${d.new_phone ?? 0}/${d.new ?? 0}, старых ${d.old_phone ?? 0}/${d.old ?? 0}${d.stop ? ` · стоп: ${esc(d.stop)}` : ''}`
        : `ночь: ${esc(d.steps ?? '')}`;
      return `<li><small class="muted">${when(l.at)}</small> ${t}</li>`; }).join('');
    box.innerHTML = `<h3>🌙 Ночная работа — выгрузка, номера, фото ИИ</h3>
      <p class="hint">Каждую ночь в ${esc(x.start)} работу запускает Mac (пока GitHub Actions не оплачен). Ключ BetterToken для фото — в «Ключах сервисов» ниже («BetterToken — улучшение фото»): <span class="${x.key_set ? 'tag ok' : 'tag warn'}">${x.key_set ? 'задан ••••' : 'не задан'}</span> <button class="btn ghost" data-photo-test>Проверить ключ</button></p>
      <div style="display:flex;flex-direction:column;gap:6px;margin:10px 0">
        <label class="hub-chk"><input type="checkbox" id="na-on"${p.on !== false ? ' checked' : ''}> Улучшать фото ИИ (gpt-image-2.5-flare, 1K, ~0,86 ₽ за фото)</label>
        <span style="display:flex;flex-wrap:wrap;gap:4px 16px">Какие объекты: ${x.kinds.map(k => `<label class="hub-chk"><input type="checkbox" data-na-kind="${esc(k)}"${(p.kinds ?? []).includes(k) ? ' checked' : ''}> ${esc(k)}</label>`).join('')}</span>
        <label class="hub-chk"><input type="checkbox" id="na-marks"${p.check_marks !== false ? ' checked' : ''}> Фото с водяными знаками и логотипами не править</label>
      </div>
      <div class="hub-form">
        <label class="field">Новые — за последние, дней<input type="number" id="na-days" value="${esc(p.days ?? 3)}" min="1" max="14"></label>
        <label class="field">Не больше ₽ за ночь<input type="number" id="na-rub" value="${esc(p.max_rub ?? 600)}" min="0" max="10000"></label>
        <label class="field">Фото одновременно<input type="number" id="na-par" value="${esc(p.parallel ?? 4)}" min="1" max="8"></label>
        <label class="field">Порог похожести (0,5–0,95)<input id="na-sim" value="${esc(p.min_sim ?? 0.7)}"></label>
      </div>
      <div style="margin:14px 0 6px"><label class="hub-chk"><input type="checkbox" id="np-on"${f.on !== false ? ' checked' : ''}> Открывать номера старых объявлений ночью</label></div>
      <div class="hub-form">
        <label class="field">Цель за ночь<input type="number" id="np-target" value="${esc(f.target ?? 450)}" min="0" max="1000"></label>
        <label class="field">Максимум за ночь<input type="number" id="np-max" value="${esc(f.max ?? 500)}" min="0" max="1500"></label>
        <label class="field">Заканчивать до<input id="np-until" value="${esc(f.until ?? '07:30')}" placeholder="07:30"></label>
      </div>
      <p><button class="btn primary" data-night-save>Сохранить настройки ночи</button></p>
      <p class="hint">За 30 дней: улучшено ИИ ${m.used} фото из ${m.photos} отправленных (${m.objects} объектов), потрачено ${m.rub} ₽${m.errors ? `, ошибок ${m.errors}` : ''}. Номеров без проверки в очереди (кв., апарт., дома): ${x.phones_left}.</p>
      <details class="tip" open><summary>Правила ночи</summary><ol class="hint" style="overflow-wrap:anywhere">${x.rules.map(r => `<li>${esc(r)}</li>`).join('')}</ol></details>
      <details class="tip"><summary>Последние итоги</summary><ul class="hint">${logs || '<li>Пока нет</li>'}</ul></details>`;
  }
  async function lawPaid(toast) {
    const box = document.getElementById('law-paid');
    if (!box) return;
    let x;
    try { x = await H.call('adm_law_paid'); } catch (er) { box.innerHTML = `<h3>⚖️ Сервис проверки для юриста — api-assist</h3><p class="hint">${esc(er.message)}</p>`; return; }
    const link = (u, t) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t ?? u)}</a>`;
    const st = (x.stat ?? []).map(s => `<li><b>${esc(s.name)}</b>: за месяц ${esc(s.month)} из ${esc(s.month_limit)}, сегодня ${esc(s.day)} из ${esc(s.day_limit)} · оплачено до ${esc(H.day ? H.day(s.till) : s.till)}</li>`).join('');
    const ok = { operational: '🟢 работает', degraded_performance: '🟡 с перебоями', partial_outage: '🟠 частично', major_outage: '🔴 не работает' };
    box.innerHTML = `<h3>⚖️ Сервис проверки для юриста — api-assist</h3>
      <p class="hint">Юрист и ипотечный брокер проверяют через него паспорт продавца и супруга по базе МВД (действителен / недействителен / не найден). Итог — в «Отчёте сервиса» (PDF) и в заключении юриста. Одна проверка = 1–2 запроса.</p>
      <div class="adm-key"><b>Ключ API</b><span class="${x.set ? 'tag ok' : 'tag warn'}">${x.set ? 'задан ••••' : 'не задан'}</span>
        <input type="password" data-key="law_paid_key" placeholder="Вставьте новый ключ из кабинета api-assist" autocomplete="off"><button class="btn soft" data-save-key="law_paid_key">Сохранить</button><button class="btn ghost" data-lp-test>Проверить</button>
        <span class="adm-lp-addr">Адрес сервиса: ${link(x.base)} · кабинет: ${link('https://lk.api-assist.com')}</span></div>
      <p class="hub-actions"><span class="${x.on ? 'tag ok' : 'tag'}">${x.on ? 'включён' : 'выключен'}</span>
        ${x.on ? '<button class="btn ghost" data-lp-on="0">Выключить</button>' : `<button class="btn primary" data-lp-on="1"${x.set ? '' : ' disabled title="Сначала сохраните ключ"'}>Включить</button>`}
        <small class="muted">Подключено по ключу: ${esc((x.stat ?? []).map(s => s.name).join(', ') || '—')}. В проверку юриста идут: ИНН по паспорту, паспорт МВД, ФССП, банкротство, суды, арбитраж, ЕГРН — что подключено, то и работает.</small></p>
      ${x.error ? `<p class="hint">⚠️ Сервис ответил: ${esc(x.error)} — проверьте ключ в кабинете.</p>` : ''}
      ${st ? `<ul class="adm-lp-stat">${st}</ul>` : ''}
      ${x.status?.length ? `<p class="hint">Источники сейчас: ${x.status.map(s => `${esc(s.name)} — ${ok[s.status] ?? esc(s.status)}${s.rate != null ? ` (${esc(s.rate)} %)` : ''}`).join(' · ')}</p>` : ''}
      <details class="adm-lp-how"><summary>📖 Инструкция: как пользоваться и менять ключ</summary><ol>
        <li><b>Кабинет:</b> ${link('https://lk.api-assist.com')} — вход по ключу API, без пароля. Там расход по дням, подписки, последние запросы, счета (оплата по СБП, доступ — сразу после оплаты).</li>
        <li><b>Сменить ключ:</b> скопируйте новый ключ из кабинета или письма api-assist → вставьте в поле «Ключ API» выше → «Сохранить» → «Проверить» (появится расход лимита). Старый ключ перестаёт использоваться сразу.</li>
        <li><b>Включить / выключить:</b> кнопка рядом со статусом. Выключено — проверки юриста идут без сервиса (только документы и бесплатные источники).</li>
        <li><b>Лимит:</b> тест — 200 запросов в месяц. Когда лимит кончится, в отчёте будет «сервис не ответил» — проверка всё равно пройдёт. Увеличить лимит или продлить — в кабинете, «Счета». Уведомления об окончании — в кабинете или в боте ${link('https://t.me/api_assist_bot', '@api_assist_bot')}.</li>
        <li><b>Белый список IP</b> в кабинете не включайте: запросы идут с серверов Supabase, их адреса меняются — проверки перестанут работать.</li>
        <li><b>Новые источники:</b> в кабинете «Подключить сервис» → «Тестовый доступ» для <b>ФССП, Федресурс (банкротство), ГАС «Правосудие» (sudrf), kad.arbitr.ru, ЕГРН</b>. Программист не нужен: проверка юриста сама начнёт их использовать с тем же ключом. Здесь нажмите «Проверить» — сервис появится в «Подключено».</li>
        <li><b>Статус источников:</b> ${link('https://service.api-assist.com/status/')} · документация паспорта: ${link('https://api-assist.com/documentation/passport-api.txt')}.</li>
        <li>Ключ не показывается ни на сайте, ни в журналах — хранится в защищённом хранилище (Vault).</li></ol></details>`;
    if (toast) H.toast(x.error ? `Ключ не работает: ${x.error}` : x.stat ? `Ключ работает: ${x.stat.map(s => `${s.name} — ${s.month} из ${s.month_limit}`).join(', ')}` : 'Ключ не задан', 7000);
  }
  document.addEventListener('DOMContentLoaded', start);
})();
