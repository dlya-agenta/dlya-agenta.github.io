// Тарифы на сайте (ТЗ v2, шаг 2.1): счётчик номеров в шапке, окно «Что даёт PRO», закрытые разделы (Архив, Реклама, Рассылки),
// отказ по лимиту с кнопкой «Докупить», плашка «Ещё N объявлений старше 6 месяцев — в PRO» (тарифы в админке — site/admin.js).
// Цены, лимиты и доступы считает только сервер (web/plans.ts) — здесь показ. Оплата — страница pay.html (шаг 2.2); пока её нет — через администратора.
window.PLANS = (() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const day = s => s ? new Date(s).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' }) : '';
  let ui = null;     // { call, sheet, toast } главной или архива
  let info = null;   // { plans: [{id, name, usd, …, free}], pack, my, seat }

  function use(deps, meta) {
    ui = deps;
    if (meta?.plans) info = { plans: meta.plans, pack: meta.pack, my: meta.me?.plan, seat: meta.seat ?? [] };
  }
  const plan = id => info?.plans.find(p => p.id === id);
  const packText = () => info?.pack ? `${info.pack.qty} номеров за ${info.pack.usd} $` : '100 номеров за 20 $';

  // счётчик в шапке: «Сегодня 7 из 20 · В месяц 43 из 100», на телефоне «7/20 · 43/100»; у админа и без лимита — не виден
  function counter(used) {
    const el = $('#quota');
    if (!el) return;
    if (!used || (used.day_lim == null && used.month_lim == null)) { el.hidden = true; return; }
    const parts = [used.day_lim != null && [`Сегодня ${used.day} из ${used.day_lim}`, `${used.day}/${used.day_lim}`],
      used.month_lim != null && [`В месяц ${used.month} из ${used.month_lim}`, `${used.month}/${used.month_lim}`]].filter(Boolean);
    el.innerHTML = `<span class="q-long">${parts.map(p => p[0]).join(' · ')}</span><span class="q-short">${parts.map(p => p[1]).join(' · ')}</span>`;
    el.title = `Открыто номеров собственников. Новые на день — с 00:00 МСК, месяц — до ${day(used.month_end)}.${used.packs ? ` С пакетами: +${used.packs}.` : ''} Повтор того же номера — бесплатно.`;
    el.classList.toggle('warn', (used.day_lim != null && used.day >= used.day_lim) || (used.month_lim != null && used.month >= used.month_lim));
    el.hidden = false;
  }

  // оплата — pay.html (шаг 2.2): pay.html?plan=pro | ?plan=max | ?pack=1. Пока страницы нет — тариф подключает администратор
  let payPage = null;
  async function pay(q) {
    if (payPage === null) { try { payPage = (await fetch('pay.html', { method: 'HEAD', cache: 'no-store' })).ok; } catch { payPage = false; } }
    if (payPage) { location.href = 'pay.html?' + new URLSearchParams(q); return; }
    ui.sheet('Оплата', `<p>Оплата ${q.pack ? `пакета (${esc(packText())})` : `тарифа ${esc(plan(q.plan)?.name ?? 'PRO')}`} на сайте откроется в ближайшие дни.</p>
      <p class="hint">Сейчас ${q.pack ? 'пакет' : 'тариф'} подключает администратор сервиса — напишите ему, через кого получали доступ.</p>`);
  }

  // окно «Что даёт PRO»: три тарифа рядом (значения — из app_settings.plans, свободные места — с сервера)
  const ROWS = [
    ['Цена в месяц', p => `<b>${p.usd} $</b>`],
    ['Номеров в день', p => p.phones_day],
    ['Номеров в месяц', p => p.phones_month],
    ['Устройств одновременно', p => p.devices],
    ['Докупить номера', () => esc(packText())],
    ['Архив за 2 года и объявления старше 6 месяцев', p => p.opts.arch ? '✓' : '—'],
    ['Черновики для рекламы на площадках', p => p.opts.rk_month ? `${p.opts.rk_month} в месяц` : '—'],
    ['Готовые черновики реальных квартир', p => p.opts.rk_daily ? `${p.opts.rk_daily} в день` : '—'],
    ['Рассылки в Telegram, WhatsApp и MAX', p => p.opts.mail_items ? `до ${p.opts.mail_items} объявлений` : '—'],
    ['Поиск по домовым чатам Сочи', p => p.opts.house_chats ? 'скоро' : '—'],
    ['Продающие ролики из фото', p => p.opts.video ? 'скоро' : '—'],
    ['Скидка за 3 / 12 месяцев', p => p.disc_m3 || p.disc_m12 ? `${p.disc_m3}% / ${p.disc_m12}%` : '—'],
    ['Мест', p => p.seats == null ? 'без ограничений' : p.free == null ? p.seats : p.free ? `свободно ${p.free} из ${p.seats}` : `мест нет (из ${p.seats})`],
  ];
  async function pro(why) {
    ui.sheet('Что даёт PRO', '<p class="muted">Загрузка…</p>');
    try { info = { ...(await ui.call('plans')) }; } catch (e) { if (!info) { $('#sheet-body').innerHTML = `<p class="err">${esc(e.message)}</p>`; return; } }
    const my = info.my, waits = new Set((info.seat ?? []).map(w => w.plan));
    const btn = p => p.id === my ? '<span class="tag ok">Ваш тариф</span>'
      : p.id === 'sub' && my ? '' : p.free === 0 ? (waits.has(p.id) ? '<span class="tag grey">Вы в очереди</span>' : `<button class="btn soft" data-wait="${p.id}">Встать в очередь</button>`)
      : `<button class="btn primary" data-pay="${p.id}">Оформить ${esc(p.name)}</button>`;
    $('#sheet-body').innerHTML = `${why ? `<p>${esc(why)}</p>` : ''}
      <div class="ptable-wrap"><table class="ptable"><thead><tr><th></th>${info.plans.map(p => `<th class="${p.id === my ? 'my' : ''}">${esc(p.name)}</th>`).join('')}</tr></thead>
        <tbody>${ROWS.map(([t, f]) => `<tr><th>${t}</th>${info.plans.map(p => `<td class="${p.id === my ? 'my' : ''}">${f(p)}</td>`).join('')}</tr>`).join('')}</tbody>
        <tfoot><tr><th></th>${info.plans.map(p => `<td class="${p.id === my ? 'my' : ''}">${btn(p)}</td>`).join('')}</tr></tfoot></table></div>
      <p class="hint">Номера считаются по МСК: день — с 00:00, месяц — от даты оплаты. Повтор того же номера — бесплатно. Пакет ${esc(packText())} добавляется к дню и месяцу до конца периода.</p>`;
    $('#sheet-body').onclick = async e => {
      const p = e.target.closest('[data-pay]'), w = e.target.closest('[data-wait]');
      if (p) pay({ plan: p.dataset.pay });
      if (w) {
        w.disabled = true;
        try { const r = await ui.call('seat_wait', { plan: w.dataset.wait }); ui.toast(r.ok ? `Вы в очереди: ${r.pos}-й. Освободится место — пришлём сообщение` : r.message, 5000); pro(why); }
        catch (err) { w.disabled = false; ui.toast(err.message); }
      }
    };
  }

  // закрытый раздел: вместо содержимого — короткое описание и «Оформить PRO» (окно с тем, что даёт PRO)
  const ABOUT = {
    arch: ['🗂 Архив за 2 года', 'Объявления собственников за 2 года — в продаже и снятые, с причиной снятия, на карте и списком. И объявления старше 6 месяцев внизу общей выдачи.'],
    rk: ['📣 Реклама на площадках', 'Объекты переносятся в черновики вашего рекламного кабинета: фото, адрес, цена, описание. Публикуете вы — после проверки.'],
    mail: ['✉️ Рассылки в мессенджеры', 'Объявления из «Избранного» уходят в ваши группы Telegram, WhatsApp и MAX по расписанию — не чаще раза в 3 часа в группу.'],
  };
  const lockedHtml = what => `<div class="locked"><b>${ABOUT[what][0]}</b><p>${ABOUT[what][1]}</p><p class="muted">Доступно в тарифах PRO и MAX.</p>
    <button class="btn primary" data-pro-open>Оформить PRO</button></div>`;
  const locked = what => ui.sheet(ABOUT[what][0].replace(/^\S+\s/, ''), lockedHtml(what));
  // Рассылки для PRO и MAX — следующим шагом (окно В, шаг 4.2)
  const soon = what => ui.sheet(ABOUT[what][0].replace(/^\S+\s/, ''), `<div class="locked"><b>${ABOUT[what][0]}</b><p>${ABOUT[what][1]}</p><p class="muted">Скоро: раздел подключается — сообщим, когда заработает.</p></div>`);

  // отказ по лимиту номеров: текст сервера и кнопка «Докупить» (у дневного и месячного лимита)
  const limitHtml = (msg, st) => `<span class="err">${esc(msg)}</span>${st === 'day' || st === 'month' ? ` <button class="btn soft" data-pack>Докупить ${esc(packText())}</button>` : ''}`;
  document.addEventListener('click', e => { if (e.target.closest('[data-pack]')) { e.preventDefault(); pay({ pack: 1 }); } if (e.target.closest('[data-pro-open]')) { e.preventDefault(); pro(); } });

  // внизу выдачи у тарифа без Архива: сколько объявлений старше 6 месяцев нашлось бы
  const oldBanner = n => `<div class="pro-line"><span>Ещё ${Number(n).toLocaleString('ru-RU')} ${n % 10 === 1 && n % 100 !== 11 ? 'объявление' : 'объявлений'} старше 6 месяцев — в PRO</span><button class="btn soft" data-pro-open>Что даёт PRO</button></div>`;

  // место освободилось (очередь) — плашка на сайте сутки после сообщения
  function seatNote() {
    const w = (info?.seat ?? []).find(x => x.notified_at && Date.now() - Date.parse(x.notified_at) < 864e5);
    if (w) ui.toast(`Освободилось место в тарифе ${plan(w.plan)?.name ?? w.plan} — оформите, пока оно свободно`, 8000);
  }

  return { use, counter, pro, locked, lockedHtml, soon, pay, limitHtml, oldBanner, seatNote, plan };
})();
