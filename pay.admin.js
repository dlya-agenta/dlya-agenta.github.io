// Настройки оплаты для администратора (pay.html#admin; ТЗ v2, шаг 2.2): «боевая» оплата и тестовые логины, @CryptoBot (токены — только запись
// в Vault, сайт видит лишь «сохранён»; адрес вебхука; проверка токена и вебхука), сети прямого перевода (адрес, контракт USDT, включение,
// тестовый счёт на 1 $), курс TON, «Разобрать вручную», ручная активация (пишется в журнал админа), журнал всех платежей с фильтром по статусу.
window.PAYADM = (() => {
  const $ = s => document.querySelector(s);
  const U = () => window.PAYUI;
  let R = null, filter = 'all', find = '', offset = 0;
  const ST = { all: 'Все', wait: 'Ждём', paid: 'Оплачен', expired: 'Истёк', review: 'Разобрать', rejected: 'Отклонён' };
  const STL = { wait: 'ждём', pending: 'ждём (старый)', paid: 'оплачен', timeout: 'истёк', expired: 'истёк', review: 'разобрать', rejected: 'отклонён' };

  async function open() {
    const { call, esc } = U(), main = $('#pay');
    document.title = 'Настройки оплаты — Для Агента';
    main.innerHTML = '<p class="muted">Загрузка…</p>';
    try {
      R = await call('adm_get');
      if (!R.saved.hook) R = await call('adm_set', { hook_ensure: true });   // адрес вебхука появляется сразу
    } catch (e) { main.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    draw();
  }

  function draw() {
    const { esc, when } = U(), p = R.pay, cb = p.cryptobot, rate = R.rate;
    const saved = ok => ok ? '<span class="pa-ok">сохранён ••••</span>' : '<span class="muted">не задан</span>';
    $('#pay').innerHTML = `
      <section class="pcard"><div class="prow"><h2>⚙ Настройки оплаты</h2><a class="btn ghost" href="pay.html">← К странице оплаты</a></div>
        <p class="hint">Ждут оплаты: <b>${R.counts.wait}</b> · Разобрать вручную: <b>${R.counts.review}</b></p></section>
      <section class="pcard" id="p-inv" hidden></section>
      <section class="pcard"><h2>Режим</h2>
        <form id="pa-mode" class="pa-sec">
          <label class="chk opt"><input type="checkbox" name="live" ${p.live ? 'checked' : ''}><span><b>Боевая оплата для всех участников.</b> Включать после шага 2.4 (безопасность)
            и проверки на тесте. Пока выключено — счета создают только администраторы и тестовые логины ниже, остальным — прежнее «Продлить доступ» (TRC-20).</span></label>
          <label class="field">Тестовые логины (через запятую)<input name="testers" value="${esc(p.testers.join(', '))}" placeholder="например: test_sub, test_pro"></label>
          <label class="chk opt"><input type="checkbox" name="enabled" ${p.enabled ? 'checked' : ''}><span>Принимать оплату: кнопка «Продлить доступ» в меню и оплата при входе с истёкшим доступом или неодобренной заявкой</span></label>
          <label class="field">Сколько живёт счёт, минут<input name="minutes" type="number" min="15" max="180" value="${p.invoice_minutes}"></label>
          <button class="btn primary">Сохранить режим</button></form></section>
      <section class="pcard"><h2>Регистрация по коду партнёра</h2>
        <form id="pa-inv" class="pa-sec">
          <label class="chk opt"><input type="checkbox" name="required" ${R.invite.required ? 'checked' : ''}><span>Регистрация только по коду партнёра (выключено — заявка, которую одобряет администратор)</span></label>
          <div class="agrid"><label class="field">Гостевой доступ, дней<input name="guest_days" type="number" min="1" max="365" value="${R.invite.guest_days}"></label>
            <label class="field">Приглашений в первый месяц после оплаты<input name="first_month" type="number" min="0" value="${R.invite.first_month}"></label>
            <label class="field">Приглашений за 30 дней потом (пусто — без ограничения)<input name="per_month" type="number" min="0" value="${R.invite.per_month ?? ''}"></label></div>
          <button class="btn primary">Сохранить</button></form>
        <div class="pa-sec"><div class="lbl">Ваш код партнёра — с него начинаются приглашения: у администратора нет ограничений</div>
          <code class="addr">${esc(R.ref?.code ?? '—')}</code>
          <div class="pa-row"><button type="button" class="btn soft" data-copy="${esc(R.ref?.code ?? '')}" data-msg="Код скопирован">Скопировать код</button>
            <button type="button" class="btn ghost" data-copy="${esc(location.origin + '/?r=' + (R.ref?.code ?? ''))}" data-msg="Ссылка скопирована">Скопировать ссылку</button></div></div></section>
      <section class="pcard"><h2>@CryptoBot</h2>
        <form id="pa-cb" class="pa-sec">
          <label class="chk opt"><input type="checkbox" name="enabled" ${cb.enabled ? 'checked' : ''}><span>Принимать через CryptoBot (USDT и Gram, бывший TON)</span></label>
          <label class="chk opt"><input type="checkbox" name="test" ${cb.test ? 'checked' : ''}><span>Тестовый режим — счета в @CryptoTestnetBot (тестовые монеты; видят только админы и тестовые логины)</span></label>
          <div class="field">Токен приложения @CryptoBot (боевой): ${saved(R.saved.token)}
            <div class="pa-row"><input name="token" type="password" autocomplete="off" placeholder="вставьте новый токен, чтобы заменить"><button type="button" class="btn ghost" data-a="cb-check" data-test="">Проверить</button></div></div>
          <div class="field">Токен приложения @CryptoTestnetBot (тестовый): ${saved(R.saved.token_test)}
            <div class="pa-row"><input name="token_test" type="password" autocomplete="off" placeholder="вставьте новый токен, чтобы заменить"><button type="button" class="btn ghost" data-a="cb-check" data-test="1">Проверить</button></div></div>
          <button class="btn primary">Сохранить CryptoBot</button>
          <p class="hint">Токен: в боте — Crypto Pay → Create App → API Token. Сайт хранит токен в защищённом хранилище и больше его не показывает.</p></form>
        <div class="pa-sec"><div class="lbl">Адрес вебхука — вставьте в боте: Crypto Pay → My Apps → приложение → Webhooks → Enable Webhooks (и в боевом, и в тестовом)</div>
          <code class="addr">${esc(R.hook_url ?? '—')}</code>
          <div class="pa-row"><button type="button" class="btn soft" data-copy="${esc(R.hook_url ?? '')}" data-msg="Адрес вебхука скопирован">Скопировать</button>
            <button type="button" class="btn ghost" data-a="hook-new">Сменить адрес</button><button type="button" class="btn ghost" data-a="hook-test">Проверить вебхук</button></div>
          <div id="pa-hook" class="pa-res" hidden></div></div></section>
      <section class="pcard"><h2>Прямой перевод USDT</h2>
        <form id="pa-nets" class="pa-sec">${Object.entries(p.nets).map(([n, x]) => `<div class="pa-sec">
          <label class="chk opt"><input type="checkbox" name="${n}.enabled" ${x.enabled ? 'checked' : ''}><span><b>${esc(R.net_names[n])}</b></span></label>
          <label class="field">Адрес приёма (только адрес — приватные ключи и фразы держите у себя)<input name="${n}.address" value="${esc(x.address)}" autocomplete="off" spellcheck="false"></label>
          <label class="field">Контракт USDT в этой сети<input name="${n}.contract" value="${esc(x.contract)}" autocomplete="off" spellcheck="false"></label>
          <div class="pa-row"><button type="button" class="btn ghost" data-a="test-inv" data-net="${n}" ${x.enabled && x.address ? '' : 'disabled'}>Тестовый счёт на 1 $</button></div></div>`).join('')}
          <button class="btn primary">Сохранить сети</button>
          <p class="hint">Контракты TRC-20 и TON — с сайта Tether. В BNB Smart Chain Tether сам USDT не выпускает: там USDT от Binance (BEP-20), его контракт проверен в сети.
            Тестовый счёт — проверить приём маленьким переводом: переведите показанную сумму до цента, платёж появится в журнале.</p></form></section>
      <section class="pcard"><h2>Курс TON</h2>
        <div class="prow"><span>${rate ? `1 TON = <b>${Number(rate.usd).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} $</b> · зафиксирован ${when(rate.fixed_at)} МСК${rate.src ? ` (${esc(rate.src)})` : ''}` : 'курса пока нет'}</span>
          <button type="button" class="btn ghost" data-a="rate">Обновить сейчас</button></div>
        <p class="hint">Сам обновляется в 10:00 и 18:00 МСК (курс CryptoBot, запасной — CoinGecko). Сумма в TON = цена / курс, вверх до сотых.</p></section>
      <section class="pcard"><h2>Разобрать вручную</h2><div id="pa-review"><p class="muted">Загрузка…</p></div></section>
      <section class="pcard"><h2>Ручная активация</h2>
        <form id="pa-manual" class="agrid">
          <label class="field">Логин участника<input name="login" required autocapitalize="none"></label>
          <label class="field">Что<select name="kind"><option value="plan">Тариф</option><option value="pack">Пакет ${R.pack.qty} номеров</option></select></label>
          <label class="field">Тариф<select name="plan">${R.plans.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></label>
          <label class="field">Срок<select name="months"><option value="1">1 месяц</option><option value="3">3 месяца</option><option value="12">12 месяцев</option></select></label>
          <label class="field">Оплачено, $ (для зачёта при переходе)<input name="usd" type="number" min="0" step="any" value="0"></label>
          <label class="field">Комментарий<input name="note" placeholder="например: перевод на карту 30.10"></label>
          <button class="btn primary">Активировать</button></form>
        <p class="hint">Тот же тариф продлевается от конца срока, тариф выше — новый период с сегодня. Запись попадает в журнал администратора.</p></section>
      <section class="pcard"><h2>Журнал платежей</h2>
        <div class="segs">${Object.entries(ST).map(([k, t]) => `<button type="button" class="chip ${filter === k ? 'on' : ''}" data-f="${k}">${t}</button>`).join('')}</div>
        <input id="pa-find" type="search" placeholder="Поиск по логину" value="${esc(find)}">
        <div id="pa-list"><p class="muted">Загрузка…</p></div></section>`;
    bind(); list(); review();
  }

  const setNote = (el, text) => { el.hidden = false; el.textContent = text; };
  function bind() {
    const { call, toast } = U();
    const save = async (body, msg) => { try { R = await call('adm_set', body); toast(msg); draw(); } catch (e) { toast(e.message, 6000); } };
    $('#pa-mode').onsubmit = e => {
      e.preventDefault(); const f = e.target;
      if (f.live.checked && !R.pay.live && !confirm('Включить оплату тарифов для всех участников? Проверьте, что тестовый режим CryptoBot выключен и сети настроены.')) return;
      save({ pay: { live: f.live.checked, enabled: f.enabled.checked, invoice_minutes: f.minutes.value, testers: f.testers.value.split(/[\s,;]+/).filter(Boolean) } }, 'Режим сохранён');
    };
    $('#pa-inv').onsubmit = e => {
      e.preventDefault(); const f = e.target;
      save({ invite: { required: f.required.checked, guest_days: f.guest_days.value, first_month: f.first_month.value, per_month: f.per_month.value } }, 'Регистрация сохранена');
    };
    $('#pa-cb').onsubmit = e => {
      e.preventDefault(); const f = e.target, body = { pay: { cryptobot: { enabled: f.enabled.checked, test: f.test.checked } } };
      if (f.token.value.trim()) body.token = f.token.value.trim();
      if (f.token_test.value.trim()) body.token_test = f.token_test.value.trim();
      save(body, 'CryptoBot сохранён');
    };
    $('#pa-nets').onsubmit = e => {
      e.preventDefault(); const f = e.target, nets = {};
      for (const n of Object.keys(R.pay.nets)) nets[n] = { enabled: f[`${n}.enabled`].checked, address: f[`${n}.address`].value.trim(), contract: f[`${n}.contract`].value.trim() };
      save({ pay: { nets } }, 'Сети сохранены');
    };
    $('#pa-manual').onsubmit = async e => {
      e.preventDefault(); const f = e.target;
      const what = f.kind.value === 'pack' ? `пакет ${R.pack.qty} номеров` : `${f.plan.selectedOptions[0].text} на ${f.months.value} мес.`;
      if (!confirm(`Активировать участнику ${f.login.value}: ${what}?`)) return;
      try { const r = await call('adm_manual', Object.fromEntries(['login', 'kind', 'plan', 'months', 'usd', 'note'].map(k => [k, f[k].value])));
        toast(r.ok ? 'Активировано' : 'Не получилось', 5000); f.reset(); list(); }
      catch (err) { toast(err.message, 6000); }
    };
    $('#pa-find').oninput = () => { clearTimeout(bind.t); bind.t = setTimeout(() => { find = $('#pa-find').value.trim(); offset = 0; list(); }, 400); };
    $('#pay').onclick = async e => {
      const b = e.target.closest('[data-a], [data-f], [data-rv]');
      if (!b) return;
      if (b.dataset.f) { filter = b.dataset.f; offset = 0; document.querySelectorAll('[data-f]').forEach(x => x.classList.toggle('on', x === b)); list(); return; }
      if (b.dataset.rv) return reviewAct(b);
      const a = b.dataset.a;
      b.disabled = true;
      try {
        if (a === 'cb-check') { const r = await call('adm_cb_check', { test: !!b.dataset.test }); toast(`Токен работает: приложение «${r.app?.name ?? '—'}»`, 6000); }
        if (a === 'hook-new' && confirm('Сменить адрес вебхука? Новый адрес нужно будет вставить в боте заново.')) return save({ hook_new: true }, 'Адрес вебхука сменён');
        if (a === 'hook-test') {
          const r = await call('adm_hook_test');
          setNote($('#pa-hook'), `Счёт №${r.id}: 1-й вызов — ${r.first.status}, ${r.first.body?.result?.ok ? 'зачислено' : JSON.stringify(r.first.body)}; `
            + `повтор — ${r.second.status}, ${r.second.body?.result?.already ? 'ничего не изменилось' : JSON.stringify(r.second.body)}; поддельная подпись — ${r.forged.status}. Статус счёта: ${r.after?.status} (${r.after?.paid_by}).`);
        }
        if (a === 'rate') { R.rate = await call('adm_rate'); draw(); toast('Курс обновлён'); }
        if (a === 'test-inv') { const r = await call('adm_test', { network: b.dataset.net }); U().showInvoice(r.invoice); }
        if (a === 'more') { offset += 50; list(true); }
      } catch (err) { U().toast(err.message, 6000); }
      finally { b.disabled = false; }
    };
  }

  async function list(more = false) {
    const { call, esc, when, num, money } = U(), el = $('#pa-list');
    try {
      const r = await call('adm_list', { status: filter, q: find, offset });
      const rows = r.items.map(x => `<tr><td>${when(x.created_at)}</td><td><b>${esc(x.login)}</b>${x.name ? `<br><small class="muted">${esc(x.name)}</small>` : ''}</td>
        <td>${esc(x.what)}${x.test ? ' <span class="tag grey">тест</span>' : ''}</td><td>${num(x.amount)} ${esc(x.asset ?? 'USDT')}${x.amount_usd != null ? `<br><small class="muted">${money(x.amount_usd)}</small>` : ''}</td>
        <td>${esc(x.how)}</td><td>${STL[x.status] ?? esc(x.status)}${x.paid_by ? ` <small class="muted">(${esc(x.paid_by)})</small>` : ''}${x.review ? `<br><small class="muted">${esc(x.review)}</small>` : ''}</td>
        <td>${x.tx_url ? `<a href="${esc(x.tx_url)}" target="_blank" rel="noopener">TX</a>` : x.ext_id ? `<small class="muted">CB ${esc(x.ext_id)}</small>` : ''}</td></tr>`).join('');
      const table = `<div class="ascroll"><table class="atable"><thead><tr><th>Когда (МСК)</th><th>Участник</th><th>Что</th><th>Сумма</th><th>Способ</th><th>Статус</th><th></th></tr></thead><tbody id="pa-rows">${rows}</tbody></table></div>`;
      if (more && $('#pa-rows')) $('#pa-rows').insertAdjacentHTML('beforeend', rows);
      else el.innerHTML = r.items.length ? table : '<p class="muted">Платежей нет.</p>';
      el.querySelector('[data-a="more"]')?.remove();
      if (r.items.length === 50) el.insertAdjacentHTML('beforeend', '<button type="button" class="btn ghost" data-a="more">Показать ещё</button>');
    } catch (e) { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  }

  // «Разобрать вручную»: счета со статусом review и переводы без счёта
  async function review() {
    const { call, esc, when, num } = U(), el = $('#pa-review');
    try {
      const r = await call('adm_list', { status: 'review' }), txs = r.review.filter(t => !t.payment_id);
      const pays = r.items.map(x => `<div class="ph"><span class="ph-what"><b>${esc(x.login)} · ${esc(x.what)}</b><small class="muted">${when(x.created_at)} · ${esc(x.how)} · ${num(x.amount)} ${esc(x.asset ?? 'USDT')}</small>
          <small>${esc(x.review ?? '')}</small>${x.tx_url ? `<a class="small" href="${esc(x.tx_url)}" target="_blank" rel="noopener">транзакция</a>` : ''}</span>
        <span class="ph-act"><button type="button" class="btn soft" data-rv="activate" data-id="${x.id}">Активировать</button><button type="button" class="btn ghost" data-rv="reject" data-id="${x.id}">Отклонить</button></span></div>`);
      const free = txs.map(t => `<div class="ph"><span class="ph-what"><b>${esc(t.network)} · ${num(t.amount)} USDT</b><small class="muted">${when(t.at)} · от ${esc(String(t.from_addr ?? '').slice(0, 14))}…</small>
          <small>${esc(t.note ?? '')}</small><a class="small" href="${esc(t.tx_url)}" target="_blank" rel="noopener">транзакция</a></span>
        <span class="ph-act"><button type="button" class="btn soft" data-rv="bind" data-tx="${t.id}" data-amount="${t.amount}">Привязать…</button><button type="button" class="btn ghost" data-rv="reject" data-tx="${t.id}">Отклонить</button></span></div>`);
      el.innerHTML = pays.length + free.length ? `<div class="phist">${[...pays, ...free].join('')}</div>` : '<p class="muted">Нечего разбирать.</p>';
    } catch (e) { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  }
  async function reviewAct(b) {
    const { call, toast } = U(), d = b.dataset;
    let body = { do: d.rv === 'reject' ? 'reject' : 'activate', ...(d.id ? { id: +d.id } : {}), ...(d.tx ? { tx: +d.tx } : {}) };
    if (d.rv === 'reject' && !confirm('Отклонить? Участнику ничего не зачислится.')) return;
    if (d.rv === 'activate' && !confirm('Активировать этот платёж участнику?')) return;
    if (d.rv === 'bind') {
      const login = prompt('Логин участника, чей это перевод:'); if (!login) return;
      const what = prompt(`Что он оплатил? Впишите: pro 1 · max 3 · sub 12 · pack\n(тариф и месяцы или пакет ${R.pack.qty} номеров)`, 'pro 1'); if (!what) return;
      const [k, m] = what.trim().toLowerCase().split(/\s+/);
      body = { ...body, login, ...(k === 'pack' ? { kind: 'pack' } : { kind: 'plan', plan: k, months: +m || 1 }), usd: +d.amount };
    }
    b.disabled = true;
    try { const r = await call('adm_review', body); toast(r.ok ? (body.do === 'reject' ? 'Отклонено' : 'Активировано') : r.message, 5000); review(); list(); }
    catch (e) { toast(e.message, 6000); b.disabled = false; }
  }

  return { open };
})();
