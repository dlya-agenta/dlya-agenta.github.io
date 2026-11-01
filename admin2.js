// Админка v5.15 (admin.html, п. 14 и 20): тёмная панель разделов слева, первым экраном — «Сводка» с цифрами, стрелками к прошлой неделе,
// графиками (выручка, регистрации, онлайн по часам, тепловая карта «день × час»), устройствами и таблицами. Участники и прежние настройки —
// раздел «Участники и настройки» (тот же admin.js). «Ключи, API и ИИ» — какой ключ и модель у каждой функции, запасные ключи, ключи сервисов.
// Доступ проверяет сервер (admin_* в web, adm_* в hub — только role = admin).
(() => {
  const $ = s => document.querySelector(s);
  const H = window.HUB, esc = H.esc;
  const TITLES = { dash: 'Сводка', sales: 'Продажи и оплаты', users: 'Участники и настройки', listings: 'Объявления и выгрузка', support: 'Поддержка', ai: 'Ключи, API и ИИ', ref: 'Партнёрка', mod: 'Модерация', content: 'Новостройки и тексты', design: 'Стиль сайта', system: 'Система' };
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
    addEventListener('hashchange', route); route();
  }
  function route() {
    const s = (location.hash.slice(1) || 'dash').split('=')[0];
    document.querySelectorAll('.adm-side [data-s]').forEach(a => a.classList.toggle('on', a.dataset.s === s));
    $('#adm-title').textContent = TITLES[s] ?? 'Сводка';
    $('#adm-at').textContent = S?.at ? `данные на ${H.when(S.at)}` : '';
    $('#adm-side').classList.remove('open');
    $('#adm-body').onclick = null;   // обработчик прошлого раздела
    ({ dash, sales, users, listings, support, ai, ref, mod, content, design, system }[s] ?? dash)();
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
  function mod() { body(`<section class="hub-sec"><h3>Чат подписчиков</h3><p>Жалобы, замечания и баны.</p><p><a class="btn primary" href="hub.html#chat">Открыть чат и модерацию</a></p></section>
    <section class="hub-sec"><h3>Эксклюзивы</h3><p>Объекты видны коллегам только после проверки договора ИИ-юристом; договор не хранится.</p><p><a class="btn soft" href="hub.html#excl">Открыть эксклюзивы</a></p></section>`); }
  function content() { body(`<section class="hub-sec"><h3>Новостройки</h3><p>Карточки ЖК: телефон отдела продаж, правила фиксации, кабинет партнёра, официальные фото, новости.</p><p><a class="btn primary" href="hub.html#newb">Открыть новостройки</a></p></section>
    <section class="hub-sec"><h3>Тарифы, цены и тексты</h3><p>Тарифы и что в них входит — в «Участники и настройки» (блок «Тарифы»). Документы: <a href="prices.html" target="_blank">тарифы</a>, <a href="oferta.html" target="_blank">оферта</a>, <a href="rules.html" target="_blank">правила</a>, <a href="privacy.html" target="_blank">политика</a>.</p></section>`); }
  // ---------- Стиль сайта (v5.16): три оформления, выбор админа — по умолчанию для всех; участник может выбрать себе другой кнопкой «🎨 Стиль» ----------
  const LOOKS = [
    { id: 'classic', name: 'Классика', text: 'Как эта админка: тёмно-синяя шапка, белые карточки с синей полосой, спокойно и строго.' },
    { id: 'aurora', name: 'Аврора', text: 'Креатив и движение: переливающийся фон-сияние, стеклянные панели, блик на кнопках, мягкое появление карточек.' },
    { id: 'premium', name: 'Премиум', text: 'Тёмный и дорогой: графит и золото, блеск на кнопках, золотая рамка карточек — видно, что сервис стоит своих денег.' }];
  async function design() {
    body('<p class="muted">Загрузка…</p>');
    let cur = 'classic';
    try { cur = (await H.call('adm_design')).default; } catch (e) { H.toast(e.message, 5000); }
    const D = window.DESIGN;
    const draw = () => body(`<section class="hub-sec"><h3>🎨 Стиль сайта для всех участников</h3>
        <p class="hint">Выбранный стиль увидят все, кто не выбрал себе другой. Участник может сменить стиль у себя кнопкой «🎨 Стиль» в меню — по кругу из трёх; это меняет только его экран.</p>
        <div class="dz-grid">${LOOKS.map(l => `<article class="dz-card${l.id === cur ? ' on' : ''}" data-look="${l.id}">
          <div class="dz-prev dz-${l.id}" aria-hidden="true"><i class="dz-top"><b></b><s></s><s></s><s></s></i><span class="dz-t"><u></u><em></em></span><span class="dz-t"><u></u><em></em></span><span class="dz-t"><u></u><em></em></span><span class="dz-btn"></span></div>
          <h4>${esc(l.name)}${l.id === cur ? ' <span class="tag ok">для всех</span>' : ''}${D?.get() === l.id ? ' <span class="tag">у вас сейчас</span>' : ''}</h4><p class="hint">${esc(l.text)}</p>
          <p class="dz-act"><button class="btn ghost" data-try="${l.id}">Примерить у себя</button>${l.id === cur ? '' : `<button class="btn primary" data-def="${l.id}">Сделать для всех</button>`}</p></article>`).join('')}</div>
        ${D?.mine() ? `<p class="hint">У вас выбран личный стиль «${esc(D.names[D.mine()])}». <button class="btn ghost" data-mine-reset>Вернуть стиль «для всех»</button></p>` : ''}</section>`);
    draw();
    $('#adm-body').onclick = async e => {
      const t = e.target.closest('[data-try]'); if (t) { D?.set(t.dataset.try); draw(); return; }
      if (e.target.closest('[data-mine-reset]')) { D?.reset(); draw(); return; }
      const d = e.target.closest('[data-def]');
      if (d) { d.disabled = true; try { cur = (await H.call('adm_design_set', { default: d.dataset.def })).default; D?.setDefault(cur); H.toast(`Стиль «${LOOKS.find(x => x.id === cur).name}» — теперь для всех`); draw(); } catch (er) { H.toast(er.message, 5000); d.disabled = false; } }
    };
  }
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
    body(`<section class="hub-sec"><h3>Ключи ИИ</h3><p class="hint">Три ключа (посредник BetterToken или Anthropic). Если ключ не ответил, функция берёт запасной из своей строки ниже. Командовать Управляющим может только администратор — запасной ключ лишь выполняет ту же рутинную работу.</p>
        ${Object.entries(r.keys).map(([k, x]) => `<div class="adm-key"><b>${esc(x.label)}</b><span class="${x.set ? 'tag ok' : 'tag warn'}">${x.set ? (x.from === 'admin' ? 'задан здесь ••••' : 'из настроек функции') : 'не задан'}</span>
          <input type="password" data-key="${k}" placeholder="Вставьте новый ключ" autocomplete="off"><button class="btn soft" data-save-key="${k}">Сохранить</button><button class="btn ghost" data-test="${k}">Проверить</button></div>`).join('')}
        <label class="field">Адрес API<input id="ai-base" value="${esc(r.base_url)}" placeholder="https://bettertoken.ai"></label></section>
      <section class="hub-sec"><h3>Какая функция через какой ключ и модель</h3><p class="hint">«Цена = качество»: Haiku — короткие частые задачи, Sonnet — разбор, Opus — где ошибка дорога. Расходы — по ценам Anthropic (у посредника ~68 %).</p>
        <div class="adm-routes"><b>Функция</b><b>Ключ</b><b>Запасной</b><b>Модель</b><b>Усилие</b><b>Вкл.</b><b>30 дней</b>
        ${Object.entries(r.routes).map(([f, x]) => `<span title="${esc(x.hint)}">${esc(x.label)}</span><select data-r="${f}.key">${keyOpt(x.key)}</select>
          <select data-r="${f}.fb"><option value="">—</option>${keyOpt(x.fallback[0])}</select><select data-r="${f}.model">${modOpt(x.model)}</select>
          <select data-r="${f}.effort">${['low', 'medium', 'high'].map(e => `<option${e === x.effort ? ' selected' : ''}>${e}</option>`).join('')}</select>
          <input type="checkbox" data-r="${f}.on"${x.on ? ' checked' : ''}><small>${by[f] ? `${usd(by[f][0])} · ${by[f][1]} выз.${by[f][2] ? ` · ош. ${by[f][2]}` : ''}` : '—'}</small>`).join('')}</div>
        <div class="hub-form"><label class="field">Ночью описаний за раз<input type="number" id="n-descr" value="${r.night.descr}" min="0" max="5000"></label><label class="field">Ночью проверок фото<input type="number" id="n-repair" value="${r.night.repair}" min="0" max="5000"></label></div>
        <p><button class="btn primary" data-save-routes>Сохранить маршруты</button></p></section>
      <section class="hub-sec"><h3>Ключи сервисов и API</h3><p class="hint">Меняются здесь, без программиста. Значения не показываются — только «задан» или нет. Остальные секреты (вход в источник, токен бота, CryptoBot) — в своих разделах: бот — «Участники и настройки», CryptoBot — «Продажи и оплаты».</p>
        ${r.secrets.filter(x => !x.name.startsWith('ai_key')).map(x => `<div class="adm-key"><b>${esc(x.label)}</b><small class="muted">${esc(x.used_by)}</small><span class="${x.set ? 'tag ok' : 'tag'}">${x.set ? 'задан ••••' : x.env ? 'из настроек функции' : 'не задан'}</span>
          <input type="password" data-key="${esc(x.name)}" placeholder="Новое значение" autocomplete="off"><button class="btn soft" data-save-key="${esc(x.name)}">Сохранить</button></div>`).join('')}</section>`);
    $('#adm-body').onclick = async e => {
      const sk = e.target.closest('[data-save-key]');
      if (sk) { const k = sk.dataset.saveKey, v = $(`[data-key="${k}"]`).value.trim(); if (!v && !confirm('Пустое значение удалит ключ. Удалить?')) return;
        try { await H.call('adm_secret_set', { name: k, value: v }); H.toast(v ? 'Ключ сохранён' : 'Ключ удалён'); ai(); } catch (er) { H.toast(er.message, 5000); } return; }
      const t = e.target.closest('[data-test]');
      if (t) { t.disabled = true; try { const x = await H.call('adm_key_test', { key: t.dataset.test }); H.toast(x.ok ? `Ключ работает: «${x.text}»` : `Ключ не ответил: ${x.error}`, 6000); } catch (er) { H.toast(er.message, 5000); } t.disabled = false; return; }
      if (e.target.closest('[data-save-routes]')) {
        const routes = {};
        for (const f of Object.keys(r.routes)) routes[f] = { key: $(`[data-r="${f}.key"]`).value, fallback: [$(`[data-r="${f}.fb"]`).value].filter(Boolean), model: $(`[data-r="${f}.model"]`).value,
          effort: $(`[data-r="${f}.effort"]`).value, on: $(`[data-r="${f}.on"]`).checked };
        try { await H.call('adm_ai_set', { routes, base_url: $('#ai-base').value, night: { descr: +$('#n-descr').value, repair: +$('#n-repair').value } }); H.toast('Сохранено'); } catch (er) { H.toast(er.message, 5000); }
      }
    };
  }
  document.addEventListener('DOMContentLoaded', start);
})();
