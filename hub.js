// Общее для новых разделов v5.15 (window.HUB): вызов функции hub, вход, уведомления, деньги в рублях, правила, «на сайте» (ping),
// закрытое по тарифу. Подключают index.html (ping, рубли, голос), hub.html (разделы), admin.html, pay.html, partner.html.
window.HUB = (() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const URL_ = () => String(window.API).replace(/\/web$/, '/hub');
  const token = () => { try { return JSON.parse(localStorage.getItem('token')); } catch { return null; } };
  async function call(action, extra = {}, opt = {}) {
    const r = await fetch(URL_(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, auth: { token: token() }, ...extra }), signal: opt.signal });
    const data = await r.json().catch(() => ({ error: 'server', message: `Ошибка сервера (HTTP ${r.status})` }));
    if (!r.ok || data.error) throw Object.assign(new Error(data.message || data.error || `HTTP ${r.status}`), { code: data.error, data, status: r.status });
    return data;
  }
  async function web(action, extra = {}) {
    const r = await fetch(window.API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, auth: { token: token() }, ...extra }) });
    const data = await r.json().catch(() => ({ error: 'server', message: `Ошибка сервера (HTTP ${r.status})` }));
    if (!r.ok || data.error) throw Object.assign(new Error(data.message || data.error), { code: data.error, data, status: r.status });
    return data;
  }
  function toast(t, ms = 3000) {
    let el = $('#toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
    el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, ms);
  }
  async function copy(v, msg = 'Скопировано') {
    try { await navigator.clipboard.writeText(v); toast(msg); }
    catch { const ta = document.createElement('textarea'); ta.value = v; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast(msg); } catch { toast(v, 8000); } ta.remove(); }
  }

  // ---------- рубли: курс ЦБ, 2 раза в день; USDT ≈ USD ----------
  let fx = null;
  async function rate() {
    if (fx) return fx;
    try { const s = JSON.parse(sessionStorage.getItem('fx') || 'null'); if (s && Date.now() - s.t < 30 * 60e3) return fx = s.v; } catch { /* нет */ }
    try { fx = await call('fx_public'); sessionStorage.setItem('fx', JSON.stringify({ t: Date.now(), v: fx })); } catch { fx = { rub: null }; }
    return fx;
  }
  const rubNum = (usd, r) => Math.round(usd * r / 10) * 10;
  const rub = (usd, r = fx?.rub) => r ? `${rubNum(Number(usd), r).toLocaleString('ru-RU')} ₽` : '';
  // «30 $ ≈ 2 790 ₽» — в тексте всегда рубли (решение Алексея), доллары — рядом
  const both = (usd, r = fx?.rub) => r ? `${rub(usd, r)} <small class="muted">(${Number(usd).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} $)</small>` : `${Number(usd).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} $`;
  const fxNote = () => fx?.label ? `<small class="muted">≈ по ${esc(fx.label)}; USDT ≈ доллар</small>` : '';
  // подставить рубли во все элементы с data-usd (prices.html, plans.js, pay.js, offer.js — где цена в $)
  async function rubify(root = document) {
    const r = (await rate()).rub;
    if (!r) return;
    root.querySelectorAll('[data-usd]:not([data-rub-done])').forEach(el => {
      const v = Number(el.dataset.usd);
      if (!Number.isFinite(v)) return;
      el.insertAdjacentHTML('afterend', ` <span class="rub">≈ ${rub(v, r)}</span>`);
      el.dataset.rubDone = 1;
    });
  }

  // ---------- правила: прочитать до конца → «Принимаю» ----------
  async function rules(force = false) {
    const st = await call('rules_state').catch(() => ({ ok: false, ver: 1 }));
    if (st.ok && !force) return true;
    let html = '';
    try { const t = await (await fetch('rules.html')).text(); html = (new DOMParser().parseFromString(t, 'text/html').querySelector('main, .doc, article, body')?.innerHTML) ?? ''; } catch { html = '<p>Не удалось загрузить правила — откройте <a href="rules.html" target="_blank">rules.html</a>.</p>'; }
    return new Promise(res => {
      const d = document.createElement('div');
      d.className = 'sheet hub-rules';
      d.innerHTML = `<div class="sheet-box" role="dialog" aria-modal="true" aria-label="Правила площадки"><div class="sheet-head"><b>Правила площадки</b><button class="btn ghost" data-x aria-label="Закрыть">✕</button></div>
        <p class="hint">Перед пополнением, выводом и первой покупкой прочитайте правила до конца — кнопка «Принимаю» станет активной.</p>
        <div class="sheet-body hub-rules-text">${html}</div>
        <div class="sheet-foot"><button class="btn ghost" data-x>Позже</button><button class="btn primary" data-ok disabled>Принимаю</button></div></div>`;
      document.body.appendChild(d);
      const box = d.querySelector('.hub-rules-text'), ok = d.querySelector('[data-ok]');
      const end = () => { if (box.scrollTop + box.clientHeight >= box.scrollHeight - 24) ok.disabled = false; };
      box.addEventListener('scroll', end); setTimeout(end, 300);
      d.addEventListener('click', async e => {
        if (e.target === d || e.target.closest('[data-x]')) { d.remove(); res(false); }
        if (e.target.closest('[data-ok]') && !ok.disabled) {
          try { await call('rules_accept', { ver: st.ver, read: true }); d.remove(); toast('Спасибо, правила приняты'); res(true); } catch (er) { toast(er.message, 5000); }
        }
      });
    });
  }

  // ---------- «на сайте»: раз в минуту, пока вкладка видима (сводка админки: онлайн, устройства) ----------
  function dev() {
    const ua = navigator.userAgent, w = Math.min(screen.width, screen.height);
    return { dev: /iPad|Tablet/i.test(ua) || (w >= 600 && /Android/i.test(ua) && !/Mobile/i.test(ua)) ? 'tablet' : /Mobi|iPhone|Android/i.test(ua) ? 'phone' : 'desktop',
      os: /iPhone|iPad|iPod/i.test(ua) ? 'ios' : /Android/i.test(ua) ? 'android' : /Mac OS X/i.test(ua) ? 'mac' : /Windows/i.test(ua) ? 'windows' : /Linux/i.test(ua) ? 'linux' : 'other',
      br: window.Telegram?.WebApp?.initData ? 'telegram' : /YaBrowser/i.test(ua) ? 'yandex' : /Edg\//i.test(ua) ? 'edge' : /Firefox/i.test(ua) ? 'firefox' : /Chrome|CriOS/i.test(ua) ? 'chrome' : /Safari/i.test(ua) ? 'safari' : 'other',
      pwa: matchMedia('(display-mode: standalone)').matches || navigator.standalone === true };
  }
  let pingT = null;
  function ping() {
    if (pingT || !token()) return;
    const go = () => { if (document.visibilityState === 'visible' && token()) call('ping', dev()).catch(() => {}); };
    go(); pingT = setInterval(go, 60_000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') go(); });
  }

  // ---------- закрыто по тарифу: что даёт и как открыть ----------
  const locked = (title, text, plan = 'pro') => `<div class="hub-lock"><b>🔒 ${esc(title)}</b><p>${esc(text)}</p>
    <a class="btn primary" href="pay.html?plan=${plan}">Оформить ${plan === 'max' ? 'MAX' : 'PRO'}</a> <a class="btn ghost" href="prices.html" target="_blank">Что входит в тарифы</a></div>`;
  const STAR = '* Перед сделкой обязательна проверка реального юриста и ипотечного брокера';
  const star = () => `<p class="hub-star"><b>*</b> ${esc(STAR.slice(2))}</p>`;
  const when = s => s ? new Date(s).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  const day = s => s ? new Date(s).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' }) : '';
  const mln = v => v ? `${(v / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} млн ₽` : '—';
  // ссылки мессенджеров: телефон — приложение, компьютер — веб-версия (MAX — web.max.ru)
  const mobile = () => /Mobi|iPhone|Android/i.test(navigator.userAgent);
  const msgLinks = (phone, text = '') => {
    const d = String(phone ?? '').replace(/\D/g, '');
    if (!d) return '';
    return `<a class="btn soft" href="https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ''}" target="_blank" rel="noopener">WhatsApp</a>
      <a class="btn soft" href="https://t.me/+${d}" target="_blank" rel="noopener">Telegram</a>
      <a class="btn soft" href="${mobile() ? 'max://' : 'https://web.max.ru/'}" target="_blank" rel="noopener" data-max="${esc(d)}" title="MAX: найдите контакт по номеру +${esc(d)}">MAX</a>`;
  };
  // MAX: ссылки на чат по номеру нет — копируем номер и текст, открываем MAX
  document.addEventListener('click', e => { const m = e.target.closest('[data-max]'); if (m && m.dataset.max) copy(`+${m.dataset.max}`, 'Номер скопирован — найдите контакт в MAX'); });

  return { call, web, toast, copy, esc, rate, rub, both, rubNum, fxNote, rubify, rules, ping, dev, locked, star, STAR, when, day, mln, msgLinks, token, mobile };
})();
