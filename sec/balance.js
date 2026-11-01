// Личный баланс в рублях (v5.15, п. 6): остаток, партнёрское вознаграждение, история; «Пополнить», «Улучшить подписку» (оплата с баланса —
// на странице оплаты), «Партнёрские — на баланс», «Вывести на свой кошелёк» (партнёрская программа). Перед деньгами — правила.
(() => {
  const H = window.HUB, esc = H.esc;
  const KIND = { topup: 'Пополнение', spend: 'Оплата с баланса', ref: 'Партнёрское вознаграждение', refund: 'Возврат', adjust: 'Корректировка', unpay: 'Отмена пополнения' };
  async function open(arg, ctx) {
    const el = ctx.el, r = await H.call('bal_get');
    const fx = r.fx?.rub, usd = v => `${Number(v).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} $`;
    el.innerHTML = `<h2>💰 Баланс</h2>
      <section class="hub-sec bal-top"><div><small class="muted">На балансе</small><b class="bal-sum">${fx ? H.rub(r.balance.usd, fx) : usd(r.balance.usd)}</b><small class="muted">${usd(r.balance.usd)} · ${esc(r.fx?.label ?? '')}</small></div>
        <div class="hub-inline"><a class="btn primary" href="pay.html?topup=1" data-rules>＋ Пополнить</a><a class="btn soft" href="pay.html" data-rules>⬆ Улучшить подписку</a></div></section>
      <section class="hub-sec"><h3>🤝 Партнёрская программа</h3>
        <p>К выплате: <b>${H.rub(r.ref.ready, fx) || usd(r.ref.ready)}</b> · в ожидании: ${H.rub(r.ref.hold, fx) || usd(r.ref.hold)}${r.ref.payout ? ` · в заявке: ${H.rub(r.ref.payout, fx)}` : ''}</p>
        <p class="hub-inline"><button class="btn soft" data-ref${r.ref.ready ? '' : ' disabled'}>Перевести на баланс</button><a class="btn ghost" href="partner.html" data-rules>Вывести на свой кошелёк</a></p>
        <p class="hint">Вознаграждение — 30 % от суммы, которую фактически заплатил приглашённый (со скидкой, если она была). Вывод — раз в неделю на подтверждённый кошелёк.</p></section>
      <section class="hub-sec"><h3>История</h3>${r.history.length ? `<div class="hub-rows">${r.history.map(x => `<div class="hub-row"><b>${x.usd > 0 ? '+' : ''}${fx ? H.rub(x.usd, fx) : usd(x.usd)}</b><small>${esc(KIND[x.kind] ?? x.kind)} · ${H.when(x.at)} · ${usd(x.usd)}</small></div>`).join('')}</div>` : '<p class="muted">Движений пока нет.</p>'}</section>
      <p class="hint">Курс ЦБ обновляется 2 раза в день. USDT считаем равным доллару. ${r.rules_ok ? 'Правила приняты.' : 'Перед первой операцией попросим прочитать правила.'} <button class="btn ghost" data-rules-read>Прочитать правила</button></p>`;
    el.onclick = async e => {
      const a = e.target.closest('[data-rules]');
      if (a && !r.rules_ok) { e.preventDefault(); if (await H.rules()) location.href = a.href; return; }
      if (e.target.closest('[data-rules-read]')) { H.rules(true); return; }
      if (e.target.closest('[data-ref]')) {
        if (!r.rules_ok && !(await H.rules())) return;
        try { const x = await H.call('bal_ref'); H.toast(`На баланс зачислено ${H.rub(x.moved, fx) || usd(x.moved)}`); open('', ctx); } catch (er) { H.toast(er.message, 5000); }
      }
    };
  }
  window.SEC = window.SEC || {};
  window.SEC.balance = { title: 'Баланс', open };
})();
