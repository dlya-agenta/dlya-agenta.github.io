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
    location.href = url;
    setTimeout(() => {
      removeEventListener('blur', off); document.removeEventListener('visibilitychange', off);
      if (!left && !document.hidden) toast(`Приложение ${SV[svc]} не открылось — похоже, оно не установлено.${svc === 'max' ? ' Номер уже скопирован.' : ''}
        ${web ? `<a class="btn primary sm ma-web" href="${esc(web)}" target="_blank" rel="noopener" data-web data-ma-web="${svc}">Открыть веб-версию ${SV[svc]}</a>` : ''}`, 12000);
    }, 1600);
  }
  // v5.67: расширение на связи? (в этом браузере — метка data-da-ext; иначе — сервер: компьютер отметился за 3 минуты); кэш на минуту
  const here = () => !!document.documentElement.dataset.daExt;
  const tok = () => { try { return JSON.parse(localStorage.getItem('token') || 'null'); } catch { return null; } };
  const AUTO = () => String(window.API || '').replace(/\/web$/, '/auto');
  async function auto(action, extra = {}) {
    const r = await fetch(AUTO(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, auth: { token: tok() }, ...extra }) });
    const j = await r.json().catch(() => ({ error: 'server', message: 'Сервер не ответил' }));
    if (!r.ok || j.error) throw new Error(j.message || j.error || 'Не получилось');
    return j;
  }
  let extC = (() => { try { return JSON.parse(sessionStorage.getItem('daExtC') || 'null'); } catch { return null; } })();
  async function extState() {
    if (!tok() || !window.API) return null;
    if (extC && Date.now() - extC.t < 3 * 60e3) return extC.v;
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
        <button type="button" class="ma-way" data-way="ext"><b>💻 Через мой браузер</b><small>Уйдёт само из вашего ${SV[svc]} Web на компьютере с расширением — сразу, без копирования</small></button>
        <button type="button" class="ma-way" data-way="app"><b>📱 Открыть приложение</b><small>Текст уже в поле — останется нажать «Отправить»</small></button>
      </div>
      <p class="ma-pv">${esc(text.length > 220 ? text.slice(0, 220) + '…' : text)}</p>
      <div class="ma-btns"><button type="button" class="btn ghost" data-x>Отмена</button></div></div>`;
    document.body.appendChild(d);
    d.addEventListener('click', async e => {
      if (e.target === d || e.target.closest('[data-x]')) return d.remove();
      const w = e.target.closest('[data-way]'); if (!w) return;
      if (w.dataset.way === 'app') { d.remove(); return app(); }
      w.disabled = true; w.querySelector('small').textContent = 'Ставлю в очередь…';
      try {
        const r = await auto('own_ext_msg', { svc, phone, text });
        if (here()) window.postMessage({ da: 'sendPoll' }, location.origin);
        d.remove();
        toast(r.on ? `💻 Сообщение уходит из вашего ${SV[svc]} в браузере — 10–40 секунд.` : `💻 Сообщение в очереди: уйдёт, когда компьютер с расширением будет на связи.`, 6000);
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
.ma-toast .ma-web{display:inline-flex;margin:8px 0 0;min-height:36px}.ma-toast .link{color:inherit;text-decoration:underline;background:none;border:0;padding:0;font:inherit;cursor:pointer}`;
  document.head.appendChild(st);
  return { warn, open, appUrl, webUrl, isBot, text: TEXT, extState, chooseWay };
})();
