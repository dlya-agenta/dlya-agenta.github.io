// v5.24 (п. 7 Алексея): писать собственникам и клиентам — через ПРИЛОЖЕНИЕ мессенджера на телефоне или компьютере, а не через веб-версию в браузере:
// веб-версия (web.whatsapp.com, web.max.ru, web.telegram.org) — тот же «привязанный браузер», что держит наш сервер для рассылок и проверки ответов,
// и второй такой вход в браузере агента сбивает вход сервера. Поэтому все ссылки wa.me / t.me / web.max.ru на сайте при нажатии открывают приложение
// (whatsapp://, tg://, max://), а в первый раз за день — окно с предупреждением (и про 30 незнакомых в день, и про не основной аккаунт).
// v5.25b (Алексей 04.11): приложение не установлено — веб-версия: кнопка «Открыть веб-версию» в подсказке; выбрал её — дальше этот мессенджер
// сразу открывается в веб-версии (localStorage msgappWeb:<svc>, «Снова через приложение» — сброс).
// v5.46a: ссылки на Telegram-ботов (MSGAPP.isBot) не перехватываются.
// v5.67 (п. 2 Алексея): есть расширение «Для Агента» (в этом браузере или на включённом компьютере агента) — у ссылки WhatsApp с текстом
// выбор из двух: «📱 Открыть приложение» или «💻 Отправить через мой браузер» (auto own_ext_msg: сообщение уйдёт из WhatsApp Web агента сразу).
// window.MSGAPP.warn(where) — тот же текст строкой (для страниц рассылок и «Мессенджеров»); MSGAPP.open(svc, phone, text) — открыть приложение.
// v5.69: ways.js (window.WAYS — «сначала свой компьютер») подгружается отсюда на всех страницах, где есть msgapp.js
(() => { if (window.WAYS || document.querySelector('script[src^="ways.js"]')) return; const s = document.createElement('script'); s.src = 'ways.js?v=5.71q6'; s.defer = true; document.head.appendChild(s); })();
const waysReady = () => window.WAYS ? Promise.resolve(true) : new Promise(ok => { let n = 0; const t = setInterval(() => { if (window.WAYS || ++n > 40) { clearInterval(t); ok(!!window.WAYS); } }, 100); });
window.MSGAPP = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SV = { wa: 'WhatsApp', tg: 'Telegram', max: 'MAX' };
  const KEY = 'msgappWarn', day = () => new Date().toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' });
  const TEXT = {
    app: 'Пишите через <b>приложение</b> WhatsApp, Telegram или MAX на телефоне или компьютере. Если приложения нет — откроется веб-версия в браузере; она может сбить вход нашего сервера (рассылки и проверка ответов), если он подключён к тому же аккаунту, — тогда войдите на сервере заново. С <a href="ext.html" target="_blank">расширением «Для Агента»</a> веб-версия — ваш способ отправки «💻 Через мой браузер».',
    spam: '<b>Не больше 30 незнакомым людям в день</b> — иначе мессенджер посчитает это спамом и может заблокировать аккаунт. Лучше писать с <b>не основного</b> аккаунта.',
  };
  const warn = (where = '') => `<div class="ma-warn" role="note"><b class="ma-t">⚠️ Перед тем как писать${where ? ` ${esc(where)}` : ''}</b><p>${TEXT.app}</p><p>${TEXT.spam}</p></div>`;
  const digits = s => String(s ?? '').replace(/\D/g, '');
  // ссылка → {svc, url приложения}; не мессенджер — null
  function appUrl(href) {
    let u; try { u = new URL(href, location.href); } catch { return null; }
    const h = u.hostname.replace(/^www\./, '');
    if (h === 'wa.me' || h === 'api.whatsapp.com' || h === 'web.whatsapp.com') {
      const phone = digits(u.pathname.slice(1)) || digits(u.searchParams.get('phone'));
      const text = u.searchParams.get('text');
      return { svc: 'wa', url: `whatsapp://send?${phone ? `phone=${phone}` : ''}${text ? `${phone ? '&' : ''}text=${encodeURIComponent(text)}` : ''}` };
    }
    if (h === 't.me' || h === 'telegram.me' || h === 'web.telegram.org') {
      const p = decodeURIComponent(u.pathname.slice(1));
      if (/^\+\d{6,}$/.test(p)) return { svc: 'tg', url: `tg://resolve?phone=${digits(p)}` };
      if (/^[A-Za-z][\w]{3,}$/.test(p)) return { svc: 'tg', url: `tg://resolve?domain=${p}` };
      return { svc: 'tg', url: 'tg://' };
    }
    if (h === 'web.max.ru' || h === 'max.ru') return { svc: 'max', url: 'max://' };
    return null;
  }
  // v5.46a (часть A): ссылка на Telegram-бота (имя кончается на «bot») — не переписка с человеком: открываем как есть, без окна «30 незнакомых»
  // и с параметром start (код привязки учётки / код партнёра); раньше tg://resolve?domain=… терял start, и бот не узнавал человека
  function isBot(href) {
    let u; try { u = new URL(href, location.href); } catch { return false; }
    const h = u.hostname.replace(/^www\./, '');
    return (h === 't.me' || h === 'telegram.me') && /^\/[A-Za-z][\w]{2,}bot\/?$/i.test(u.pathname);
  }
  // веб-версия того же чата: WhatsApp — web.whatsapp.com с номером и текстом, Telegram — t.me (там «Открыть в веб-версии»), MAX — web.max.ru
  function webUrl(svc, phone = '', text = '') {
    const p = digits(phone);
    if (svc === 'wa') return `https://web.whatsapp.com/send?${p ? `phone=${p}` : ''}${text ? `${p ? '&' : ''}text=${encodeURIComponent(text)}` : ''}`;
    if (svc === 'tg') return p ? `https://t.me/+${p}` : 'https://web.telegram.org/k/';
    return 'https://web.max.ru/';
  }
  const WKEY = svc => `msgappWeb:${svc}`;
  const webOn = svc => { try { return localStorage.getItem(WKEY(svc)) === '1'; } catch { return false; } };
  const webSet = (svc, on) => { try { on ? localStorage.setItem(WKEY(svc), '1') : localStorage.removeItem(WKEY(svc)); } catch { /* приватный режим */ } };
  function toast(t, ms = 6000) {
    let el = document.querySelector('.ma-toast');
    if (!el) { el = document.createElement('div'); el.className = 'ma-toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.innerHTML = t; el.hidden = false; clearTimeout(el._t); el._t = setTimeout(() => { el.hidden = true; }, ms);
  }
  // приложение не открылось (страница осталась видна 1,6 с) — подсказка вместо веб-версии
  function go(svc, url, web = '') {
    if (web && webOn(svc)) {   // уже выбрали веб-версию для этого мессенджера
      window.open(web, '_blank', 'noopener');
      toast(`Открыта веб-версия ${SV[svc]}. <button type="button" class="link" data-ma-app="${svc}">Снова через приложение</button>`, 5000);
      return;
    }
    let left = false;
    const off = () => { left = true; };
    addEventListener('blur', off, { once: true }); document.addEventListener('visibilitychange', off, { once: true });
    // v5.67a: внутри окна ИИ-Агента (iframe) переход на whatsapp:// / tg:// / max:// браузер блокирует («Этот контент заблокирован») —
    // открываем приложение из главного окна сайта (тот же сайт — доступ есть)
    let top = window; try { if (window.top !== window && window.top.location.host === location.host) top = window.top; } catch { top = window; }
    top.location.href = url;
    setTimeout(() => {
      removeEventListener('blur', off); document.removeEventListener('visibilitychange', off);
      if (!left && !document.hidden) toast(`Приложение ${SV[svc]} не открылось — похоже, оно не установлено.${svc === 'max' ? ' Номер уже скопирован.' : ''}
        ${web ? `<a class="btn primary sm ma-web" href="${esc(web)}" target="_blank" rel="noopener" data-web data-ma-web="${svc}">Открыть веб-версию ${SV[svc]}</a>` : ''}`, 12000);
    }, 1600);
  }
  // v5.67: расширение на связи? (в этом браузере — метка data-da-ext; иначе — сервер: компьютер отметился за 3 минуты); кэш на минуту
  const here = () => { try { return !!(document.documentElement.dataset.daExt || (window.top !== window && window.top.document.documentElement.dataset.daExt)); } catch { return false; } };   // и в окне ИИ-Агента (iframe)
  const tok = () => { try { return JSON.parse(localStorage.getItem('token') || 'null'); } catch { return null; } };
  const AUTO = () => String(window.API || '').replace(/\/web$/, '/auto');
  async function auto(action, extra = {}) {
    const r = await fetch(AUTO(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, auth: { token: tok() }, ...extra }) });
    const j = await r.json().catch(() => ({ error: 'server', message: 'Сервер не ответил' }));
    if (!r.ok || j.error) throw Object.assign(new Error(j.message || j.error || 'Не получилось'), { code: j.error, status: r.status, data: j, howto: j.howto });   // v5.69: need_pc (409) — WAYS
    return j;
  }
  let extC = (() => { try { return JSON.parse(sessionStorage.getItem('daExtC') || 'null'); } catch { return null; } })();
  async function extState() {
    if (!tok() || !window.API) return null;
    if (extC && Date.now() - extC.t < (extC.v ? 3 * 60e3 : 20e3)) return extC.v;   // «нет расширения» помним 20 с: могли только что включить
    let v = null; try { v = (await auto('own_ext_state')).ext; } catch { v = null; }
    extC = { t: Date.now(), v: v && (v.on || Date.now() - Date.parse(v.seen_at) < 864e5) ? v : null };
    try { sessionStorage.setItem('daExtC', JSON.stringify(extC)); } catch { /* приватный режим */ }
    return extC.v;
  }
  function chooseWay(svc, phone, text, app) {
    const d = document.createElement('div');
    d.className = 'sheet ma-sheet';
    d.innerHTML = `<div class="sheet-box ma-box" role="dialog" aria-modal="true" aria-label="Как отправить">
      <b class="ma-t">Как отправить в ${SV[svc]}?</b>
      <div class="ma-ways">
        <button type="button" class="ma-way" data-way="ext"><b>💻 Отправить само</b><small>Сначала — с вашего компьютера (${SV[svc]} Web в Chrome с расширением), сервер — только если разрешили галочкой ниже</small></button>
        <button type="button" class="ma-way" data-way="app"><b>📱 Открыть приложение</b><small>Текст уже в поле — останется нажать «Отправить»</small></button>
      </div>
      <p class="ma-pv">${esc(text.length > 220 ? text.slice(0, 220) + '…' : text)}</p>
      <div class="ma-wyb"></div>
      <div class="ma-btns"><button type="button" class="btn ghost" data-x>Отмена</button></div></div>`;
    document.body.appendChild(d);
    waysNote(d.querySelector('.ma-wyb'), svc, 'ext', false);   // v5.68: как уйдёт и чего не хватает
    d.addEventListener('click', async e => {
      if (e.target === d || e.target.closest('[data-x]')) return d.remove();
      const w = e.target.closest('[data-way]'); if (!w) return;
      if (w.dataset.way === 'app') { d.remove(); return app(); }
      w.disabled = true; w.querySelector('small').textContent = 'Ставлю в очередь…';
      try {
        // v5.69: «сначала свой компьютер» — компьютер выключен и облако не разрешено → окно «Включите компьютер», молча не шлём
        if (await waysReady()) { const p = await window.WAYS.pick(svc, { action: 'отправить сообщение', mass: false }); if (p === 'off') { w.disabled = false; w.querySelector('small').textContent = 'Не отправлено — компьютер не на связи'; return; } }
        let r; try { r = await auto('own_ext_msg', { svc, phone, text }); }
        catch (e1) { if (!window.WAYS?.isNeedPc(e1) || await window.WAYS.needPc(svc, e1, { mass: false }) === 'off') throw e1; r = await auto('own_ext_msg', { svc, phone, text }); }
        if (here()) (window.top || window).postMessage({ da: 'sendPoll' }, location.origin);
        d.remove(); watch(r.id);
        toast(r.via === 'srv' ? `☁️ В браузере нет входа ${SV[svc]} — отправляю через сервер сервиса.` : r.on ? `💻 Сообщение уходит из вашего ${SV[svc]} в браузере — 10–40 секунд.` : `💻 Компьютер с расширением не на связи — жду 5 мин, потом ☁️ сервер или ✋ вручную.`, 6000);
      } catch (err) { w.disabled = false; w.querySelector('small').textContent = err.message; }
    });
  }
  function confirmOnce(svc, then) {
    let seen = null; try { seen = localStorage.getItem(KEY); } catch { /* приватный режим */ }
    if (seen === day()) return then();
    const d = document.createElement('div');
    d.className = 'sheet ma-sheet';
    d.innerHTML = `<div class="sheet-box ma-box" role="dialog" aria-modal="true" aria-label="Перед тем как писать">
      ${warn(`в ${SV[svc]}`)}
      <div class="ma-btns"><button type="button" class="btn primary" data-ok>Понятно, открыть ${SV[svc]}</button><button type="button" class="btn ghost" data-x>Отмена</button></div></div>`;
    document.body.appendChild(d);
    const close = () => d.remove();
    d.addEventListener('click', e => {
      if (e.target === d || e.target.closest('[data-x]')) return close();
      if (e.target.closest('[data-ok]')) { try { localStorage.setItem(KEY, day()); } catch { /* приватный режим */ } close(); then(); }
    });
    d.querySelector('[data-ok]').focus();
  }
  const open = (svc, phone = '', text = '') => {
    const url = svc === 'wa' ? `whatsapp://send?phone=${digits(phone)}${text ? `&text=${encodeURIComponent(text)}` : ''}` : svc === 'tg' ? `tg://resolve?phone=${digits(phone)}` : 'max://';
    confirmOnce(svc, () => go(svc, url, webUrl(svc, phone, text)));
  };
  // кнопки в подсказке: «Открыть веб-версию» — запомнить выбор; «Снова через приложение» — забыть
  document.addEventListener('click', e => {
    const w = e.target.closest?.('[data-ma-web]'); if (w) { webSet(w.dataset.maWeb, true); w.closest('.ma-toast').hidden = true; return; }
    const a = e.target.closest?.('[data-ma-app]'); if (a) { webSet(a.dataset.maApp, false); a.closest('.ma-toast').hidden = true; }
  });
  // все ссылки на мессенджеры на странице: в окне клиента (s.html без входа агента) — не трогаем, клиент пишет агенту как ему удобно
  document.addEventListener('click', e => {
    const a = e.target.closest?.('a[href]');
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || a.dataset.web != null) return;
    if (/\/s\.html$/.test(location.pathname) && !document.body.classList.contains('sa')) return;
    if (isBot(a.getAttribute('href'))) return;   // бот — открыть как есть
    const m = appUrl(a.getAttribute('href'));
    if (!m) return;
    e.preventDefault();
    // MAX: номер в ссылке не передаётся — копируем его (как раньше data-cp / data-max)
    const ph = a.dataset.max || (m.svc === 'max' ? a.closest('[data-num]')?.querySelector('[href^="tel:"]')?.getAttribute('href')?.slice(4) : '');
    if (m.svc === 'max' && ph) navigator.clipboard?.writeText(ph).catch(() => {});
    // веб-версия того же чата: номер и текст — из исходной ссылки (wa.me/<номер>?text=…, t.me/+<номер>)
    let wph = '', wtx = '';
    try { const u = new URL(a.getAttribute('href'), location.href); wph = m.svc === 'tg' ? (/^\/\+(\d{6,})$/.exec(u.pathname)?.[1] ?? '') : digits(u.pathname.slice(1)) || digits(u.searchParams.get('phone')); wtx = u.searchParams.get('text') ?? ''; } catch { /* нет */ }
    const web = m.svc === 'tg' && !wph ? a.getAttribute('href') : webUrl(m.svc, wph, wtx);
    const app = () => confirmOnce(m.svc, () => go(m.svc, m.url, /^https:/.test(web) ? web : ''));
    // v5.67: номер и готовый текст есть (WhatsApp) и расширение на связи — два способа; проверка без ожидания: состояние уже в кэше или метка браузера
    if (m.svc === 'wa' && wph.length >= 10 && wtx.trim().length > 1 && (here() || extC?.v)) return chooseWay('wa', wph, wtx, app);
    app();
  }, true);
  // ---------- v5.68 (п. 2 Алексея): какими способами уйдёт сообщение и запасной путь ----------
  // Порядок: 💻 расширение в браузере агента → (5 мин без отправки) ☁️ сервер сервиса, если там подключён вход → ✋ вручную (окно со списком).
  // Переключает сервер (auto own_fb, раз в минуту); сайт только показывает: waysNote перед отправкой, watch(id) — следит, manual(id) — список «вручную».
  let wayC = null;
  async function ways(force = false) {
    if (!tok() || !window.API) return null;
    if (!force && wayC && Date.now() - wayC.t < 60e3) return wayC.v;
    let v = null; try { v = await auto('own_ways'); } catch { v = null; }
    wayC = { t: Date.now(), v }; return v;
  }
  const hAgo = t => { const m = Math.round((Date.now() - Date.parse(t)) / 60e3); return m < 60 ? `${m} мин` : m < 1440 ? `${Math.round(m / 60)} ч` : `${Math.round(m / 1440)} дн`; };
  // строка «Как уйдёт» для мессенджера svc; first — с чего начнём ('ext' | 'srv'); mass — «всем сразу» (сервер в MAX всем не пишет)
  function waysHtml(w, svc, first = 'ext', mass = true) {
    const W = w?.svcs?.[svc]; if (!W) return '';
    const S = SV[svc], M = w.wait_min ?? 5, rows = [];
    const host = svc === 'wa' ? 'web.whatsapp.com' : svc === 'tg' ? 'web.telegram.org' : 'web.max.ru';
    const e = W.ext, eOk = !!(e && e.on && e.login === 'ok');
    const eTxt = !e ? `нет расширения — <a href="ext.html" target="_blank" rel="noopener">установить</a>` : !e.on ? `компьютер с расширением не на связи (был ${hAgo(e.seen_at)} назад) — включите его`
      : e.login === 'auth' ? `нет входа — откройте ${host} в этом браузере и войдите` : e.login === 'ok' ? `вход ${S} есть` : `вход ${S} не проверен — откройте ${host}`;
    const sOk = W.srv.ok && (W.srv.mass || !mass);
    const sTxt = !W.srv.ok ? `вход ${S} не подключён — <a href="hub.html#msg" target="_blank" rel="noopener">«🔌 Подключения» → ${S}</a>`
      : !sOk ? `в ${S} сервер всем сразу не пишет` : `вход${W.srv.name ? ` «${esc(W.srv.name)}»` : ''} подключён${w.srv_seen_h > 48 ? ` · сервер не отвечал ${w.srv_seen_h} ч — может не сработать` : ''}`;
    const ext = [eOk, `💻 Ваш браузер: ${eTxt}`], srv = [sOk, `☁️ Сервер сервиса: ${sTxt}`];
    (first === 'srv' ? [srv] : [ext, srv]).forEach(r => rows.push(r));
    rows.push([true, `✋ Вручную: не ушло за ${M} мин — пришлю список с кнопками «Открыть ${S}» и готовым текстом`]);
    const okAny = rows.slice(0, -1).some(r => r[0]);
    return `<div class="ma-wy${okAny ? '' : ' bad'}" role="note"><b class="ma-t">Как уйдёт${okAny ? '' : ' — автоматически не получится'}</b><ol>${rows.map(([ok, t]) => `<li class="${ok ? 'ok' : 'no'}"><i aria-hidden="true">${ok ? '✓' : '✗'}</i><span>${t}</span></li>`).join('')}</ol>
      ${okAny ? `<small>Каждый следующий способ — если предыдущий за ${M} мин ничего не отправил.</small>` : `<small>Сначала исправьте то, что отмечено ✗, — иначе через ${M} мин сообщения придётся отправить вручную.</small>`}</div>`;
  }
  // v5.69: блок «сначала свой компьютер» — общий модуль WAYS (ways.js); first больше не нужен (порядок решает правило), оставлен для старых вызовов
  async function waysNote(el, svc, first = 'ext', mass = true) {
    if (!el) return null;
    if (await waysReady()) return window.WAYS.box(el, svc, { mass });
    const w = await ways(); el.innerHTML = w ? waysHtml(w, svc, first, mass) : '';
    return w;
  }
  // следить за отправкой: переключение на сервер — подсказка, «вручную» — окно со списком. Список следимых — в localStorage (после перезагрузки тоже)
  const JK = 'maJobs';
  const jobsGet = () => { try { return JSON.parse(localStorage.getItem(JK) || '[]').filter(j => Date.now() - j.t < 864e5); } catch { return []; } };
  const jobsPut = v => { try { localStorage.setItem(JK, JSON.stringify(v.slice(-10))); } catch { /* приватный режим */ } };
  let wT = null;
  function watch(id) { if (!(+id > 0)) return; const v = jobsGet().filter(j => j.id !== +id); v.push({ id: +id, t: Date.now(), via: null }); jobsPut(v); wayC = null; clearTimeout(wT); wT = setTimeout(tick, 20e3); }
  async function tick() {
    const v = jobsGet(); if (!v.length || !tok()) return;
    const keep = [];
    for (const j of v) {
      let r = null; try { r = await auto('own_job', { id: j.id }); } catch { continue; }
      const S = SV[r.svc] ?? '';
      if (r.status === 'manual') { manual(j.id, r); continue; }
      if (!['new', 'run'].includes(r.status)) { if (j.via && r.sent) toast(`☁️ ${S}: отправлено ${r.sent} из ${r.total} через сервер сервиса.`, 6000); continue; }
      if (j.via && j.via !== r.via && r.via === 'srv') toast(`💻 Расширение за 5 мин не отправило — отправляю ☁️ через сервер (${S}).`, 8000);
      keep.push({ ...j, via: r.via });
    }
    jobsPut(keep);
    if (keep.length) wT = setTimeout(tick, document.hidden ? 60e3 : 20e3);
  }
  // окно «✋ Отправить вручную»: по каждому — «Открыть <мессенджер>» (текст уже в поле; Telegram и MAX — текст копируется), «✓ Отправил» — отметка на сервере
  async function manual(id, r) {
    if (document.querySelector(`.ma-man[data-id="${id}"]`)) return;
    if (!r) { try { r = await auto('own_job', { id }); } catch (e) { return toast(e.message); } }
    const S = SV[r.svc] ?? '', left = (r.items ?? []).filter(x => x.ok !== true && x.phone);
    if (!left.length) return toast(r.status === 'manual' ? 'Все сообщения уже отмечены как отправленные.' : 'Эта отправка ещё идёт автоматически.', 5000);
    const why = (r.fb ?? []).map(f => f.to === 'srv' ? `💻 браузер не отправил за 5 мин → ☁️ сервер` : `✋ ${esc(f.why)}`).join(' · ');
    const d = document.createElement('div');
    d.className = 'sheet ma-sheet ma-man'; d.dataset.id = id;
    d.innerHTML = `<div class="sheet-box ma-box" role="dialog" aria-modal="true" aria-label="Отправить вручную">
      <b class="ma-t">✋ Отправьте вручную — ${left.length} в ${S}</b>
      <p class="ma-sub">Автоматически не ушло${why ? `: ${why}` : ''}. Нажмите «Открыть ${S}»${r.svc === 'wa' ? ' — текст уже в поле' : ' — текст скопируется, вставьте его в чат'}, отправьте и отметьте «✓ Отправил».</p>
      <div class="ma-list">${left.map(x => `<div class="ma-it" data-num="${x.num}" data-ph="${esc(x.phone)}">
        <div class="ma-ih"><b>${esc(x.name || (x.num ? `№ ${x.num}` : 'Клиент'))}</b><span>${esc(x.phone)}</span></div>
        <p class="ma-pv">${esc(x.text.length > 260 ? x.text.slice(0, 260) + '…' : x.text)}</p>
        <div class="ma-btns"><button type="button" class="btn primary sm" data-mo>Открыть ${S}</button><button type="button" class="btn soft sm" data-mc>📋 Текст</button><button type="button" class="btn ghost sm" data-md>✓ Отправил</button></div></div>`).join('')}</div>
      <div class="ma-btns"><button type="button" class="btn ghost" data-x>Закрыть</button></div></div>`;
    document.body.appendChild(d);
    const T = new Map(left.map(x => [x.phone, x]));
    d.addEventListener('click', async e => {
      if (e.target === d || e.target.closest('[data-x]')) return d.remove();
      const it = e.target.closest('.ma-it'); if (!it) return;
      const x = T.get(it.dataset.ph); if (!x) return;
      if (e.target.closest('[data-mc]')) { const ok = await navigator.clipboard?.writeText(x.text).then(() => true, () => false); return toast(ok ? 'Текст скопирован' : 'Скопируйте текст из окна', 3000); }
      if (e.target.closest('[data-mo]')) { if (r.svc !== 'wa') navigator.clipboard?.writeText(r.svc === 'max' ? `${x.phone}\n${x.text}` : x.text).catch(() => {}); return open(r.svc, x.phone, r.svc === 'wa' ? x.text : ''); }
      const b = e.target.closest('[data-md]'); if (!b) return;
      b.disabled = true;
      try { await auto('own_manual', { id, num: x.num, phone: x.phone }); it.classList.add('done'); b.textContent = '✓ Отмечено';
        if (!d.querySelector('.ma-it:not(.done)')) { toast(`Готово: все ${left.length} отмечены. Ответы проверю, как обычно.`, 5000); setTimeout(() => d.remove(), 900); } }
      catch (err) { b.disabled = false; toast(err.message, 5000); }
    });
  }
  document.addEventListener('click', e => { const m = e.target.closest?.('[data-ma-manual]'); if (m) { e.preventDefault(); manual(+m.dataset.maManual); } });
  // ссылка из уведомления: …/#ownjob=<id> — сразу окно «вручную»
  const hj = /^#ownjob=(\d+)$/.exec(location.hash);
  if (hj && tok()) setTimeout(() => { history.replaceState(null, '', location.pathname + location.search); manual(+hj[1]); }, 1200);
  if (tok() && jobsGet().length) setTimeout(tick, 4000);
  if (tok()) setTimeout(() => extState(), 2500);   // заранее (раз в 3 минуты на вкладку): есть ли компьютер с расширением
  // стили — здесь же (файл подключается на всех страницах, в том числе s.html со своим s.css)
  const st = document.createElement('style');
  st.textContent = `.ma-warn{border:1px solid color-mix(in srgb,var(--warn,#9a5b00) 45%,transparent);background:color-mix(in srgb,var(--warn,#9a5b00) 9%,var(--card,#fff));color:var(--text,#1f2a33);border-radius:12px;padding:10px 12px;font-size:14px;line-height:1.4}
.ma-warn p{margin:6px 0 0}.ma-t{display:block;font-size:14.5px}
.ma-sheet{position:fixed;inset:0;z-index:5000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(10,16,24,.45)}
.ma-box{background:var(--card,#fff);color:var(--text,#1f2a33);border-radius:16px;padding:16px;max-width:460px;width:100%;box-shadow:0 20px 50px rgba(0,0,0,.3)}
.ma-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.ma-ways{display:grid;gap:8px;margin-top:10px}.ma-way{display:grid;gap:3px;text-align:left;padding:11px 13px;border-radius:12px;border:1.5px solid var(--line,#d8dee6);background:var(--card,#fff);color:inherit;font:inherit;cursor:pointer}
.ma-way:hover{border-color:var(--accent,#2563eb)}.ma-way b{font-size:15px}.ma-way small{font-size:12.5px;opacity:.75;line-height:1.35}.ma-way[data-way="ext"]{border-color:color-mix(in srgb,var(--accent,#2563eb) 55%,transparent)}
.ma-pv{margin:10px 0 0;padding:8px 10px;border-radius:10px;background:color-mix(in srgb,var(--text,#1f2a33) 5%,transparent);font-size:13px;line-height:1.4;white-space:pre-wrap;max-height:120px;overflow:auto}
.ma-toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:5001;max-width:min(520px,calc(100vw - 24px));background:var(--text,#1f2a33);color:var(--card,#fff);padding:10px 14px;border-radius:12px;font-size:14px;line-height:1.4;box-shadow:0 10px 30px rgba(0,0,0,.3)}
.ma-toast[hidden]{display:none}
.ma-wy{margin:10px 0 0;padding:9px 11px;border-radius:12px;border:1px solid var(--line,#d8dee6);font-size:13px;line-height:1.4}.ma-wy.bad{border-color:color-mix(in srgb,var(--warn,#9a5b00) 55%,transparent);background:color-mix(in srgb,var(--warn,#9a5b00) 8%,transparent)}
.ma-wy ol{list-style:none;margin:6px 0 4px;padding:0;display:grid;gap:4px}.ma-wy li{display:flex;gap:7px}.ma-wy li i{font-style:normal;font-weight:700;width:14px;flex:none}
.ma-wy li.ok i{color:var(--ok,#15803d)}.ma-wy li.no i{color:var(--bad,#c2410c)}.ma-wy li.no span{opacity:.85}.ma-wy small{opacity:.7;font-size:12px}.ma-wy a{color:var(--accent,#2563eb)}
.ma-man .ma-box{max-width:560px;max-height:calc(100vh - 32px);display:flex;flex-direction:column}.ma-sub{margin:6px 0 0;font-size:13px;opacity:.8;line-height:1.4}
.ma-list{display:grid;gap:8px;margin-top:10px;overflow:auto;min-height:0}.ma-it{border:1px solid var(--line,#d8dee6);border-radius:12px;padding:9px 11px}.ma-it.done{opacity:.55}
.ma-ih{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:14px}.ma-ih span{opacity:.75}.ma-it .ma-pv{max-height:72px;margin-top:6px}.ma-it .ma-btns{margin-top:8px}
.ma-toast .ma-web{display:inline-flex;margin:8px 0 0;min-height:36px}.ma-toast .link{color:inherit;text-decoration:underline;background:none;border:0;padding:0;font:inherit;cursor:pointer}`;
  document.head.appendChild(st);
  return { warn, open, appUrl, webUrl, isBot, text: TEXT, extState, chooseWay, auto, ways, waysHtml, waysNote, waysReady, watch, manual };
})();
