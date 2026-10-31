// Скидка на PRO (ТЗ v2, шаг 2.3): окно «PRO за 69,30 $ вместо 99 $ на первый месяц» с таймером и плашка, пока предложение действует.
// Кому и когда — решает сервер (функция pay, действие offer, SQL offer_pick): 14+ дней без PRO, не чаще раза в 7 дней; по поводу — сразу
// (кончились номера, закрытый Архив / Реклама / Рассылки, окно «Что даёт PRO»), без повода — в случайный момент недели. Цену считает сервер.
// Точки входа — site/plans.js (PLANS.use, pro, lockedHtml, limitHtml). В режиме «С клиентом» не показывается (agent-only).
window.OFFER = (() => {
  const PAY = String(window.API ?? '').replace(/\/web$/, '/pay');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = v => `${Number(v).toLocaleString('ru-RU', { minimumFractionDigits: Number.isInteger(+v) ? 0 : 2, maximumFractionDigits: 2 })} $`;
  const token = () => { try { return JSON.parse(localStorage.getItem('token')); } catch { return null; } };
  const LEAD = { limit: 'Номера на сегодня закончились — в PRO их больше.', arch: 'Архив за 2 года открыт в PRO.', rk: 'Реклама на площадках — в PRO.',
    mail: 'Рассылки в мессенджеры — в PRO.' };
  let me = null, cur = null, pro = null, why = '', busy = false, tick = 0;
  let seen = [];   // окно по поводу — один раз за вкладку на предложение (без повода — только плашка)
  try { seen = JSON.parse(sessionStorage.getItem('offer_seen')) || []; } catch { /* приватный режим */ }
  // заведомо не для скидки: админ, гость, действующий PRO/MAX (на странице архива участник неизвестен — решает сервер)
  const skip = () => !token() || document.body.classList.contains('client') || (me && (me.role === 'admin' || me.guest || ['pro', 'max'].includes(me.plan)));

  function use(meta) { if (meta?.me) me = meta.me; hit('visit'); }
  async function hit(reason) {
    if (busy || skip()) return;
    busy = true;
    try {
      const r = await (await fetch(PAY, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'offer', reason, auth: { token: token() } }) })).json();
      cur = r?.offer && Date.parse(r.offer.expires_at) > Date.now() ? r.offer : null;
      if (r?.pro) pro = r.pro;
      if (cur && (cur.new || (reason !== 'visit' && !seen.includes(cur.id)))) { why = LEAD[reason] ?? ''; show(); }
      paint();
    } catch { /* нет сети — без окна */ } finally { busy = false; }
  }

  const left = () => { const s = Math.max(0, Math.round((Date.parse(cur?.expires_at) - Date.now()) / 1000));
    return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  const feats = p => [`${p.phones_day} номеров в день и ${p.phones_month} в месяц`, `${p.devices} ${p.devices < 5 ? 'устройства' : 'устройств'} одновременно`,
    p.opts?.arch && 'Архив за 2 года и объявления старше 6 месяцев', p.opts?.rk_month && `Черновики для рекламы на площадках: ${p.opts.rk_month} в месяц`,
    p.opts?.mail_items && `Рассылки в Telegram, WhatsApp и MAX: до ${p.opts.mail_items} объявлений`].filter(Boolean);

  function show() {
    if (!cur || !pro) return;
    if (!seen.includes(cur.id)) { seen.push(cur.id); try { sessionStorage.setItem('offer_seen', JSON.stringify(seen)); } catch { /* приватный режим */ } }
    let el = document.getElementById('offer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'offer'; el.className = 'sheet offer agent-only';
      el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-offer-close]')) hide(); });
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && !el.hidden) hide(); });
      document.body.appendChild(el);
    }
    const name = esc(pro.name), price = money(cur.price);
    el.innerHTML = `<div class="sheet-box offer-box" role="dialog" aria-modal="true" aria-labelledby="offer-t">
      <div class="sheet-head"><span class="offer-badge">−${cur.pct} %</span><button class="x" type="button" data-offer-close aria-label="Закрыть">✕</button></div>
      ${why ? `<p class="offer-lead">${esc(why)}</p>` : ''}
      <h2 id="offer-t">${name} за ${price} вместо ${money(cur.usd)} на первый месяц</h2>
      <ul class="offer-list">${feats(pro).map(t => `<li>${esc(t)}</li>`).join('')}</ul>
      <div class="offer-timer">Предложение действует ещё <b data-offer-left>${left()}</b></div>
      <a class="btn primary offer-go" href="pay.html?offer=${cur.id}">Оформить ${name} за ${price}</a>
      <button class="btn ghost" type="button" data-offer-close>Не сейчас</button>
      <p class="hint">Скидка — на первый месяц, дальше ${money(cur.usd)} в месяц. Предложение ваше и действует до ${new Date(cur.expires_at).toLocaleString('ru-RU',
        { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' в')} МСК.</p></div>`;
    el.hidden = false;
    el.querySelector('.offer-go').focus({ preventScroll: true });
  }
  function hide() { const el = document.getElementById('offer'); if (el) el.hidden = true; }

  // плашка «🎁 PRO −30 % · 47:12:05», пока предложение действует: нажатие открывает окно снова
  function paint() {
    let chip = document.getElementById('offer-chip');
    if (!cur) { chip?.remove(); hide(); clearInterval(tick); tick = 0; return; }
    if (!chip) {
      chip = document.createElement('button');
      chip.id = 'offer-chip'; chip.type = 'button'; chip.className = 'offer-chip agent-only';
      chip.onclick = () => { why = ''; show(); };
      document.body.appendChild(chip);
    }
    const upd = () => {
      if (Date.parse(cur?.expires_at) <= Date.now()) { cur = null; return paint(); }
      chip.innerHTML = `🎁 ${esc(pro?.name ?? 'PRO')} −${cur.pct} % · <span>${left()}</span>`;
      chip.setAttribute('aria-label', `Скидка ${cur.pct} % на ${pro?.name ?? 'PRO'}, осталось ${left()}`);
      const t = document.querySelector('[data-offer-left]');
      if (t) t.textContent = left();
    };
    upd();
    if (!tick) tick = setInterval(upd, 1000);
  }

  return { use, hit, show };
})();
