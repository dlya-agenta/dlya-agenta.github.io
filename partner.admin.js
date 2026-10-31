// Админка партнёрской программы (partner.html#admin; ТЗ v2, шаг 3.1): настройки (процент, срок «к выплате», минимум, сети для выплат), заявки на выплату
// («Одобрить» / «Отклонить», txid → «выплачено»; то же кнопками в боте), карточки проверки накруток («Всё в порядке» / «Заблокировать навсегда без выплат»),
// партнёры и начисления («Отменить» — например, при возврате денег). Всё решает сервер (функция pay: adm_ref*), решения — в журнале админа.
window.PARTNERADM = (() => {
  const $ = s => document.querySelector(s);
  let U = null, R = null, tab = 'pay';
  const KIND = { ip: 'один IP', device: 'одно устройство и браузер', phone: 'общий телефон', tg: 'общий Telegram', wallet: 'общий кошелёк', fast: 'оплата сразу после регистрации с одного устройства' };
  const AST = { hold: 'в ожидании', check: 'на проверке', ready: 'к выплате', payout: 'в заявке', paid: 'выплачено', cancel: 'отменено' };
  const PST = { new: 'ждёт решения', ok: 'одобрена — переведите', paid: 'выплачено', rejected: 'отклонена' };
  const who = l => { const x = R.users[l]; return `${U.esc(x?.name || l)} <span class="muted">(${U.esc(l)})</span>`; };

  async function open(ui) {
    U = ui;
    document.title = 'Партнёры — настройки — Для Агента';
    $('#ref').innerHTML = '<p class="muted">Загрузка…</p>';
    try { R = await U.call('adm_ref'); } catch (e) { $('#ref').innerHTML = `<p class="err">${U.esc(e.message)}</p>`; return; }
    paint();
  }
  function paint() {
    const { esc, money, when } = U, s = R.settings;
    const open = R.payouts.filter(p => ['new', 'ok'].includes(p.status)), flagged = Object.entries(R.flags.reduce((m, f) => ((m[f.login] ??= []).push(f), m), {}));
    const waiting = flagged.filter(([, fs]) => fs.some(f => f.status === 'new'));
    $('#ref').innerHTML = `
      <section class="pcard"><h2>Партнёрская программа</h2>
        <form class="ra-set" id="ra-set">
          <label class="ra-nets" style="grid-column: 1 / -1"><input type="checkbox" name="enabled"${s.enabled ? ' checked' : ''}> Начисления включены</label>
          <label>Процент с оплаты<input name="pct" type="number" min="0" max="100" step="0.5" value="${s.pct}"></label>
          <label>«К выплате» через, дней<input name="hold_days" type="number" min="0" max="60" value="${s.hold_days}"></label>
          <label>Минимум выплаты, $<input name="min_usd" type="number" min="1" step="1" value="${s.min_usd}"></label>
          <label>После смены кошелька, часов<input name="wallet_hours" type="number" min="0" max="720" value="${s.wallet_hours}"></label>
          <label>«Сразу после регистрации», минут<input name="fast_min" type="number" min="0" max="1440" value="${s.fast_min}"></label>
          <div class="ra-nets" style="grid-column: 1 / -1"><span class="muted">Сети для выплат:</span>${Object.entries(R.net_names).map(([id, n]) =>
            `<label><input type="checkbox" name="net" value="${id}"${s.nets.includes(id) ? ' checked' : ''}> ${esc(n)}</label>`).join('')}</div>
          <div class="ra-act" style="grid-column: 1 / -1"><button class="btn primary">Сохранить</button>
            <button type="button" class="btn soft" data-run>Создать заявки сейчас</button>
            <span class="hint">Заявки создаются сами по понедельникам в 10:00 МСК, ближайшие — ${U.day(R.next_run)}.</span></div>
        </form></section>
      <div class="ra-tabs">${[['pay', `Заявки (${open.length})`], ['flags', `На проверке (${waiting.length})`], ['partners', `Партнёры (${R.partners.length})`], ['acc', 'Начисления']]
        .map(([k, t]) => `<button type="button" class="chip${tab === k ? ' on' : ''}" data-tab="${k}">${t}</button>`).join('')}</div>
      <section class="pcard">${tab === 'pay' ? pays(open) : tab === 'flags' ? flags(flagged) : tab === 'partners' ? partners() : accruals()}</section>`;
  }
  function pays(open) {
    const { esc, money, when } = U, done = R.payouts.filter(p => !['new', 'ok'].includes(p.status)).slice(0, 30);
    const card = p => `<div class="ra-card"><h3>№${p.id} · ${money(p.usd)} · ${who(p.partner)} <span class="tag ${p.status === 'paid' ? 'ok' : p.status === 'rejected' ? 'bad' : 'warn'}">${PST[p.status] ?? esc(p.status)}</span></h3>
      <p>${esc(p.net_name)}: <code>${esc(p.address)}</code> <button type="button" class="btn ghost" data-copy="${esc(p.address)}">Копировать</button></p>
      <p class="muted">Создана ${when(p.created_at)}${p.decided_at ? ` · решение ${when(p.decided_at)} (${esc(p.decided_by)})` : ''}${p.note ? ` · ${esc(p.note)}` : ''}</p>
      ${['new', 'ok'].includes(p.status) ? `<div class="ra-act">${p.status === 'new' ? `<button type="button" class="btn primary" data-po="${p.id}" data-do="ok">✅ Одобрить</button>` : ''}
        <button type="button" class="btn ghost" data-po="${p.id}" data-do="no">✖ Отклонить</button></div>
        <div class="ra-act"><input placeholder="txid перевода" data-txid="${p.id}" autocomplete="off" spellcheck="false"><button type="button" class="btn soft" data-po="${p.id}" data-do="paid">Выплачено</button></div>`
        : p.tx_url ? `<p><a href="${esc(p.tx_url)}" target="_blank" rel="noopener">Транзакция</a></p>` : ''}</div>`;
    return `<h2>Заявки на выплату</h2><p class="hint">Сервер деньги не отправляет: одобрите заявку, переведите USDT сами и вставьте txid — партнёру придёт сообщение «выплачено».</p>
      ${open.length ? open.map(card).join('') : '<p class="muted">Открытых заявок нет.</p>'}${done.length ? `<h3>Последние</h3>${done.map(card).join('')}` : ''}`;
  }
  function flags(list) {
    const { esc, money, when } = U;
    const card = ([login, fs]) => { const partner = fs[0]?.detail?.partner, acc = R.accruals.filter(a => a.invitee === login && a.status === 'check'), wait = fs.some(f => f.status === 'new');
      const ban = fs.some(f => f.status === 'ban'), u = R.users[login];
      return `<div class="ra-card"><h3>${who(login)} ← пригласил ${partner ? who(partner) : '—'} ${ban ? '<span class="tag bad">заблокирован</span>' : wait ? '<span class="tag warn">ждёт решения</span>' : '<span class="tag ok">в порядке</span>'}</h3>
        <p class="muted">Регистрация ${when(u?.created_at)} · на проверке ${money(acc.reduce((t, a) => t + Number(a.usd), 0))}</p>
        <ul class="ra-sig">${fs.map(f => `<li>${esc(KIND[f.kind] ?? f.kind)}${f.status === 'info' ? ' — к сведению' : ''}${f.detail?.matches ? ` · совпадений ${f.detail.matches}` : ''}${f.detail?.phone ? ` · ${esc(f.detail.phone)}` : ''}${f.detail?.minutes != null ? ` · через ${f.detail.minutes} мин` : ''}${f.detail?.last ? ` · последнее ${when(f.detail.last)}` : ''}</li>`).join('')}</ul>
        ${wait ? `<div class="ra-act"><button type="button" class="btn primary" data-flag="${esc(login)}" data-do="ok">Всё в порядке</button>
          <button type="button" class="btn ghost" data-flag="${esc(login)}" data-do="ban">Заблокировать навсегда без выплат</button></div>` : ''}</div>`; };
    return `<h2>Проверка накруток</h2><p class="hint">Один IP — не повод для бана: коллеги из одного офиса сидят с одного IP. «Заблокировать» закрывает программу партнёру навсегда: его начисления и заявки отменяются, код больше не действует.</p>
      ${list.length ? list.map(card).join('') : '<p class="muted">Совпадений нет.</p>'}`;
  }
  function partners() {
    const { esc, money } = U;
    return `<h2>Партнёры</h2><div class="ra-wrap"><table class="ra-table"><thead><tr><th>Партнёр</th><th>Код</th><th>Пригл.</th><th>Оплат.</th><th>Начислено</th><th>К выплате</th><th>Выплачено</th><th>Кошелёк</th></tr></thead>
      <tbody>${R.partners.map(p => `<tr><td>${esc(p.name || p.login)}<br><span class="muted">${esc(p.login)}${p.ban ? ' · заблокирован' : ''}${p.tg ? '' : ' · без Telegram'}</span></td><td>${esc(p.code)}</td>
        <td>${p.invited}</td><td>${p.paid}</td><td>${money(p.accrued)}${p.check ? `<br><span class="muted">на проверке ${money(p.check)}</span>` : ''}</td><td>${money(p.ready)}</td><td>${money(p.paid_out)}</td>
        <td>${p.wallet ? `${esc(p.wallet.name)}<br><code>${esc(p.wallet.address.slice(0, 6))}…${esc(p.wallet.address.slice(-6))}</code>` : '—'}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function accruals() {
    const { esc, money, day } = U;
    return `<h2>Начисления</h2><div class="ra-wrap"><table class="ra-table"><thead><tr><th>Дата</th><th>Партнёр</th><th>Оплатил</th><th>Сумма</th><th>Статус</th><th></th></tr></thead>
      <tbody>${R.accruals.map(a => `<tr><td>${day(a.created_at)}</td><td>${who(a.partner)}</td><td>${who(a.invitee)}<br><span class="muted">счёт №${a.payment_id} · ${money(a.base_usd)}</span></td>
        <td>${money(a.usd)}<br><span class="muted">${Number(a.pct)}%</span></td><td>${AST[a.status] ?? esc(a.status)}${a.note ? `<br><span class="muted">${esc(a.note)}</span>` : ''}</td>
        <td>${['hold', 'check', 'ready'].includes(a.status) ? `<button type="button" class="btn ghost" data-cancel="${a.id}">Отменить</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Начислений пока нет.</td></tr>'}</tbody></table></div>`;
  }

  async function act(t) {
    const { call, toast } = U;
    t.disabled = true;
    try {
      if (t.dataset.tab) tab = t.dataset.tab;
      else if ('run' in t.dataset) { const r = await call('adm_ref_run'); toast(`Заявок создано: ${r.made.length}${r.skip.length ? `, пропущено: ${r.skip.length}` : ''}`, 5000); R = await call('adm_ref'); }
      else if (t.dataset.copy) U.copy(t.dataset.copy);
      else if (t.dataset.po) {
        const d = t.dataset.do, txid = d === 'paid' ? document.querySelector(`[data-txid="${t.dataset.po}"]`)?.value.trim() : undefined;
        if (d === 'paid' && !txid) throw new Error('Вставьте txid перевода');
        const note = d === 'no' ? prompt('Причина (партнёр увидит её в сообщении), можно пусто:') : null;
        if (d === 'no' && note === null) { t.disabled = false; return; }
        await call('adm_ref_payout', { id: +t.dataset.po, do: d, txid, note: note || undefined });
        toast(d === 'ok' ? 'Одобрено — переведите и вставьте txid' : d === 'paid' ? 'Выплачено, партнёру отправлено сообщение' : 'Отклонено'); R = await call('adm_ref');
      } else if (t.dataset.flag) {
        if (t.dataset.do === 'ban' && !confirm('Заблокировать партнёра навсегда? Его начисления и заявки отменятся, код перестанет работать.')) { t.disabled = false; return; }
        R = await call('adm_ref_flag', { login: t.dataset.flag, do: t.dataset.do }); toast(t.dataset.do === 'ban' ? 'Партнёр заблокирован' : 'Начисления пойдут дальше по сроку');
      } else if (t.dataset.cancel) {
        const note = prompt('Отменить начисление? Причина:', 'возврат оплаты');
        if (note === null) { t.disabled = false; return; }
        R = await call('adm_ref_cancel', { id: +t.dataset.cancel, note }); toast('Начисление отменено');
      }
      paint();
    } catch (e) { toast(e.message, 6000); t.disabled = false; }
  }
  document.addEventListener('click', e => {
    if (location.hash !== '#admin' || !R) return;
    const t = e.target.closest('[data-tab], [data-run], [data-po], [data-flag], [data-cancel], #ref [data-copy]');
    if (t) act(t);
  });
  document.addEventListener('submit', async e => {
    if (e.target.id !== 'ra-set') return;
    e.preventDefault();
    const f = e.target, b = f.querySelector('.btn.primary');
    b.disabled = true;
    try {
      R = await U.call('adm_ref_set', { ref: { enabled: f.enabled.checked, pct: f.pct.value, hold_days: f.hold_days.value, min_usd: f.min_usd.value, wallet_hours: f.wallet_hours.value,
        fast_min: f.fast_min.value, nets: [...f.querySelectorAll('[name=net]:checked')].map(x => x.value) } });
      U.toast('Сохранено'); paint();
    } catch (err) { U.toast(err.message, 6000); b.disabled = false; }
  });
  return { open };
})();
