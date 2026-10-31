// Партнёрская программа (ТЗ v2, шаг 3.1, окно Б). Код партнёра есть у тех, кто оплатил любую подписку, и у администраторов (решение Алексея 30.10.2026).
// Три места: блок в профиле (mount — код, ссылка, коротко цифры, кошелёк), страница partner.html (ссылка с QR, статистика, кошелёк с кодом в Telegram,
// история, инструкция «Как получать выплаты», условия) и хеш canvas для отпечатка браузера (cv — app.js добавляет его в fp при входе).
// Всё считает сервер (функция pay: ref_my, ref_wallet_code, ref_wallet_set); админка — partner.admin.js (partner.html#admin).
window.PARTNER = (() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PAY = () => String(window.API).replace(/\/web$/, '/pay');
  const tokenOf = () => { try { return JSON.parse(localStorage.getItem('token')); } catch { return null; } };
  const money = v => `${Number(v || 0).toLocaleString('ru-RU', { minimumFractionDigits: Number.isInteger(Number(v || 0)) ? 0 : 2, maximumFractionDigits: 2 })} $`;
  const day = s => s ? new Date(s).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
  const when = s => s ? new Date(s).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  const ST = { hold: ['в ожидании', 'warn'], check: ['на проверке', 'warn'], ready: ['к выплате', 'ok'], payout: ['в заявке', ''], paid: ['выплачено', 'ok'], cancel: ['отменено', 'bad'] };
  const PST = { new: ['ждёт решения', 'warn'], ok: ['одобрена, перевод', 'warn'], paid: ['выплачено', 'ok'], rejected: ['отклонена', 'bad'] };
  // предупреждение ТЗ — дословно
  const WARN = '❗ Если адрес указан неточно или выбрана сеть, которую наш сервис не поддерживает, вернуть средства невозможно. Проверьте реквизиты, криптовалюту и сеть';

  async function call(action, extra = {}) {
    const r = await fetch(PAY(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, auth: { token: tokenOf() }, ...extra }) });
    const data = await r.json().catch(() => ({ error: 'server', message: `Ошибка сервера (HTTP ${r.status})` }));
    if (!r.ok || data.error) throw Object.assign(new Error(data.message || data.error || `HTTP ${r.status}`), { data, status: r.status });
    return data;
  }
  async function copy(v, toast) {
    try { await navigator.clipboard.writeText(v); toast?.('Скопировано'); }
    catch { const ta = document.createElement('textarea'); ta.value = v; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast?.('Скопировано'); } catch { toast?.(v, 8000); } ta.remove(); }
  }

  // хеш картинки canvas: у одинаковых браузеров на одном устройстве совпадает, у разных устройств обычно разный (защита партнёрки, Часть 0, п. 12)
  function cv() {
    try {
      const c = document.createElement('canvas'); c.width = 220; c.height = 40;
      const x = c.getContext('2d'); if (!x) return '';
      x.textBaseline = 'top'; x.font = '15px Arial'; x.fillStyle = '#f60'; x.fillRect(100, 1, 62, 20);
      x.fillStyle = '#069'; x.fillText('Для Агента 30% ✓', 2, 15); x.fillStyle = 'rgba(102,204,0,.7)'; x.fillText('Для Агента 30% ✓', 4, 17);
      let h = 0; const s = c.toDataURL();
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
      return (h >>> 0).toString(16);
    } catch { return ''; }
  }

  // ---------- блок в профиле ----------
  async function mount(el, toast) {
    if (!el) return;
    let r;
    try { r = await call('ref_my'); } catch { r = null; }
    if (!r) { el.hidden = true; return; }
    const left = r.left == null ? '' : r.left ? `Осталось приглашений: ${r.left}.` : 'Приглашения пока закончились.';
    const first = r.first_end && Date.parse(r.first_end) > Date.now() ? ` В первый месяц после оплаты — ограничение до ${day(r.first_end)}.` : '';
    const s = r.stats ?? {};
    el.innerHTML = `<div class="group">Партнёрская программа · ${Number(r.settings?.pct ?? 30)}%</div>${r.can && r.code ? `<p><code class="ref-code">${esc(r.code)}</code></p>
      <div class="sheet-foot"><button type="button" class="btn soft" data-ref="${esc(r.code)}">Скопировать код</button><button type="button" class="btn ghost" data-ref="${esc(r.link)}">Скопировать ссылку</button></div>
      <p class="hint">Регистрация на сайте — только по коду партнёра. ${esc(left + first)} Приглашено: ${s.invited ?? r.invited}, оплатили: ${s.paid ?? 0}, начислено: ${money(s.accrued)}, выплачено: ${money(s.paid_out)}.</p>`
      : '<p class="muted">Код партнёра появится после оплаты любой подписки. По нему друзья регистрируются на сайте, а вы получаете 30% с их оплат.</p>'}
      <div class="group">Кошелёк для выплат</div>
      <p class="${r.wallet ? '' : 'muted'}">${r.wallet ? `${esc(r.wallet.name)}: <code>${esc(r.wallet.address)}</code>` : 'Не указан.'}</p>
      <p><a class="btn soft" href="partner.html">🤝 Партнёрская программа: ссылка, выплаты, кошелёк →</a></p>`;
    el.onclick = e => { const b = e.target.closest('[data-ref]'); if (b) copy(b.dataset.ref, toast); };
  }

  // ---------- страница partner.html ----------
  let R = null, step = null;
  const toast = (t, ms = 3000) => { const el = $('#toast'); if (!el) return; el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, ms); };
  function gate(html) { $('#gate').innerHTML = html; $('#gate').hidden = false; $('#app').hidden = true; }
  let qrLib = null;
  const loadQr = () => qrLib ??= new Promise((ok, bad) => { const sc = document.createElement('script');
    sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'; sc.onload = ok; sc.onerror = bad; document.head.appendChild(sc); });

  async function start() {
    if (!tokenOf()) return gate('<h2>Партнёрская программа</h2><p>Войдите на сайте — страница откроется после входа.</p><a class="btn primary" href="./">Войти</a>');
    try { R = await call('ref_my'); }
    catch (e) { return e.status === 401 || e.status === 403 ? gate(`<h2>Партнёрская программа</h2><p>${esc(e.message)}</p><a class="btn primary" href="./">Войти</a>`)
      : gate(`<h2>Ошибка</h2><p>${esc(e.message)}</p><a class="btn ghost" href="./">На главную</a>`); }
    $('#gate').hidden = true; $('#app').hidden = false;
    $('#who').textContent = R.me?.name || R.me?.login || '';
    $('#go-adm').hidden = !R.me?.admin;
    route();
    window.addEventListener('hashchange', route);
  }
  function route() {
    if (location.hash === '#admin' && R.me?.admin && window.PARTNERADM) return window.PARTNERADM.open({ call, esc, money, when, day, toast, copy: v => copy(v, toast) });
    document.title = 'Партнёрская программа — Для Агента';
    render();
    if (location.hash === '#wallet') $('#r-wallet')?.scrollIntoView({ block: 'start' });
  }

  function render() {
    const pct = Number(R.settings?.pct ?? 30), s = R.stats ?? {}, min = money(R.settings?.min_usd ?? 20);
    const income = 645 * pct / 100;   // пример ТЗ: 5 × PRO 99 $ + 5 × Подписчик 30 $
    $('#ref').innerHTML = `
      <section class="pcard rhero"><span class="r30">${pct}%</span><h1>Получайте ${pct}% с каждой оплаты приглашённых коллег</h1>
        <p>Поделитесь своей ссылкой. Когда приглашённый оплачивает подписку или пакет номеров, ${pct}% от суммы поступают на ваш криптокошелёк в USDT. Так — с каждого продления, пока действует программа. Ограничений по числу приглашённых нет.</p>
        <p class="pnote">Пример: вы пригласили 10 человек. 5 оформили PRO (99 $), 5 — «Подписчик» (30 $). Ваш доход — ${money(income)} в месяц, пока они продлевают подписку.</p>
        ${s.ban ? '<p class="pnote bad">Участие в программе для вас закрыто: нарушены условия. Начисления и выплаты остановлены.</p>' : ''}
        ${R.settings?.enabled === false ? '<p class="pnote warn">Начисления сейчас приостановлены администратором. Уже начисленное сохраняется.</p>' : ''}</section>
      <section class="pcard" id="r-link"><h2>Ваша ссылка</h2>${R.can && R.code ? `
        <div class="rlink"><input readonly value="${esc(R.link)}" aria-label="Ссылка на регистрацию"><button type="button" class="btn primary" data-copy="${esc(R.link)}">Скопировать</button></div>
        <div class="rlink"><input readonly value="${esc(R.bot_link)}" aria-label="Ссылка через Telegram-бот"><button type="button" class="btn soft" data-copy="${esc(R.bot_link)}">Скопировать</button></div>
        <div class="rqr"><div id="rqr" aria-label="QR-код ссылки"></div><p class="hint">Первая ссылка — регистрация на сайте, вторая — через Telegram-бот. Код партнёра <b>${esc(R.code)}</b> уже вписан.
          Коллега закрепляется за вами навсегда при регистрации.${R.left == null ? '' : R.left ? ` Осталось приглашений: ${R.left}.` : ' Приглашения пока закончились.'}${R.first_end && Date.parse(R.first_end) > Date.now() ? ` В первый месяц после оплаты — 1 приглашение, до ${day(R.first_end)}.` : ''}</p></div>`
        : '<p>Ссылка появится после оплаты любой подписки.</p><a class="btn primary" href="pay.html">Оформить подписку</a>'}</section>
      <section class="pcard"><h2>Статистика</h2>
        <div class="rstats">${[['Приглашено', s.invited ?? 0], ['Оплатили', s.paid ?? 0], ['Начислено', money(s.accrued)], ['Выплачено', money(s.paid_out)]].map(([t, v]) => `<div><b>${v}</b><span>${t}</span></div>`).join('')}</div>
        <p class="rsum"><span>В ожидании <b>${money(s.hold)}</b></span>${Number(s.check) ? `<span>На проверке <b>${money(s.check)}</b></span>` : ''}<span>К выплате <b>${money(s.ready)}</b></span>${Number(s.payout) ? `<span>В заявке <b>${money(s.payout)}</b></span>` : ''}</p>
        <p class="hint">Начисление становится «к выплате» через ${R.settings?.hold_days ?? 1} дн. после оплаты друга. Заявка на выплату создаётся раз в неделю — по понедельникам в 10:00 МСК, от ${min}. Ближайшая — ${day(R.next_run)}.</p>
        ${hist()}</section>
      <section class="pcard" id="r-wallet"><h2>Кошелёк для выплат</h2>${wallet()}</section>
      <section class="pcard"><h2>Как получать выплаты</h2>${howto()}</section>
      <section class="pcard"><h2>Условия программы</h2><ul class="rterms">
        <li>вознаграждение начисляется после подтверждения оплаты друга;</li>
        <li>выплаты — раз в неделю, по понедельникам, от ${min}; начисление становится «к выплате» через ${R.settings?.hold_days ?? 1} день после оплаты друга;</li>
        <li>приглашать самого себя и создавать подставные аккаунты нельзя. Автофильтр по IP, устройству и браузеру — заблокирует навсегда, без права выплат;</li>
        <li>условия могут меняться с уведомлением за 30 дней, уже начисленное сохраняется.</li></ul></section>`;
    if (R.can && R.code) loadQr().then(() => new window.QRCode($('#rqr'), { text: R.link, width: 148, height: 148 })).catch(() => $('#rqr')?.remove());
  }

  function hist() {
    const acc = R.accruals ?? [], pays = R.payouts ?? [];
    if (!acc.length && !pays.length) return '<p class="muted">Начислений пока нет.</p>';
    return `${acc.length ? `<h3>Начисления</h3><div class="rlist">${acc.map(a => `<div class="rrow"><span class="muted">${day(a.at)}</span>
        <span class="rwhat">${esc(a.name)}<small class="muted">${esc(a.what)} · ${Number(a.pct)}% от ${money(a.base_usd)}${a.status === 'hold' ? ` · к выплате с ${when(a.ready_at)}` : ''}</small></span>
        <b>${money(a.usd)}</b><span class="tag ${ST[a.status]?.[1] ?? ''}">${ST[a.status]?.[0] ?? esc(a.status)}</span></div>`).join('')}</div>` : ''}
      ${pays.length ? `<h3>Выплаты</h3><div class="rlist">${pays.map(p => `<div class="rrow"><span class="muted">${day(p.paid_at || p.created_at)}</span>
        <span class="rwhat">№${p.id} · ${esc(p.net_name)}<small class="muted">${esc(p.address)}</small></span><b>${money(p.usd)}</b>
        <span class="tag ${PST[p.status]?.[1] ?? ''}">${PST[p.status]?.[0] ?? esc(p.status)}</span>${p.tx_url ? `<a class="small" href="${esc(p.tx_url)}" target="_blank" rel="noopener">транзакция</a>` : ''}</div>`).join('')}</div>` : ''}`;
  }

  function wallet() {
    const w = R.wallet, nets = R.nets ?? [];
    const cur = w ? `<p>${esc(w.name)}</p><p class="raddr"><code>${esc(w.address)}</code></p>
      ${w.ready_at ? `<p class="pnote warn">Адрес изменён ${when(w.confirmed_at)}. Выплаты на него — не раньше ${when(w.ready_at)} МСК.</p>` : `<p class="hint">Подтверждён кодом ${when(w.confirmed_at)}.</p>`}` : '<p class="muted">Кошелёк не указан — выплаты не создаются, начисления копятся «к выплате».</p>';
    if (!R.tg) return `${cur}<p class="pnote warn">Указать или сменить адрес можно только с кодом в Telegram-бот. Сначала привяжите Telegram: на главной странице нажмите своё имя вверху → «Привязать Telegram».</p>
      <a class="btn soft" href="./">Открыть сайт →</a>`;
    if (step === 'code') return `${cur}<form class="rform" id="r-code"><p>Код отправлен в Telegram-бот. Введите его, чтобы сохранить адрес.</p>
      <label>Код из Telegram<input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></label>
      <div class="sheet-foot"><button class="btn primary">Сохранить кошелёк</button><button type="button" class="btn ghost" data-step="">Отмена</button></div></form>`;
    if (w && step !== 'form') return `${cur}<button type="button" class="btn soft" data-step="form">Сменить кошелёк</button>`;
    return `${cur}<form class="rform" id="r-form">
      <label>Сеть<select name="network">${nets.map(n => `<option value="${esc(n.id)}"${w?.network === n.id ? ' selected' : ''}>USDT · ${esc(n.name)}</option>`).join('')}</select></label>
      <label>Адрес кошелька USDT<input name="address" autocomplete="off" autocapitalize="off" spellcheck="false" required placeholder="${nets[0]?.id === 'TRC20' ? 'T…' : ''}"></label>
      <p class="warn-red">${esc(WARN)}</p>
      <p class="hint">Адрес без «мемо» и «комментария»: если кошелёк или биржа просят указать мемо для пополнения, такой адрес не подойдёт. После смены адреса выплата на него — не раньше чем через ${R.settings?.wallet_hours ?? 24} часа.</p>
      <div class="sheet-foot"><button class="btn primary">Получить код в Telegram</button>${w ? '<button type="button" class="btn ghost" data-step="">Отмена</button>' : ''}</div></form>`;
  }

  // схемы экранов: данные размыты, как на снимках инструкции оплаты
  const mock = (title, rows) => `<figure class="rmock" aria-hidden="true"><div class="rm-top">${title}</div>${rows.map(([t, cls = '']) => `<div class="rm-row ${cls}">${t}</div>`).join('')}</figure>`;
  const BLUR = '<span class="rm-blur">TQ7x8Lm2Vb9kPz4Hd6Ws1Ny3Rc5Fg0Ju</span>';
  function howto() {
    return `<details class="rhow" open><summary>Кошелёк в @CryptoBot (Telegram)</summary><div class="rsteps">
      ${mock('@CryptoBot · Кошелёк', [['USDT <span class="rm-blur">125,40</span>'], ['➕ Пополнить', 'hl'], ['➖ Вывести'], ['🔄 Обменять']])}
      ${mock('Пополнение USDT', [['Сеть: TRON (TRC-20)', 'hl'], [BLUR], ['📋 Копировать адрес', 'hl']])}
      <ol><li>Откройте @CryptoBot в Telegram → «Кошелёк».</li><li>Нажмите «Пополнить» и выберите USDT.</li>
        <li>Выберите сеть — ту же, что выберете на этой странице (обычно TRON, TRC-20).</li><li>Скопируйте адрес целиком: у TRC-20 он начинается с буквы T.</li>
        <li>Вставьте адрес в «Кошелёк для выплат», выберите ту же сеть → «Получить код в Telegram» → введите код.</li></ol></div></details>
      <details class="rhow"><summary>Trust Wallet</summary><div class="rsteps">
      ${mock('Trust Wallet · Получить', [['🔍 USDT'], ['USDT · Tron (TRC-20)', 'hl'], ['USDT · BNB Smart Chain (BEP-20)'], ['USDT · TON']])}
      ${mock('Получить USDT · Tron', [['<span class="rm-qr"></span>'], [BLUR], ['📋 Копировать', 'hl']])}
      <ol><li>Откройте Trust Wallet → «Получить».</li><li>Найдите USDT в нужной сети: «Tron» — это TRC-20, «BNB Smart Chain» — BEP-20. Если строки нет — найдите USDT через поиск и включите.</li>
        <li>Нажмите «Копировать» под QR-кодом.</li><li>Вставьте адрес в «Кошелёк для выплат», выберите ту же сеть → «Получить код в Telegram» → введите код.</li></ol></div></details>
      <p class="hint">Сети для выплат: ${(R.nets ?? []).map(n => esc(n.name)).join(', ') || '—'}. Выплаты переводит администратор после проверки заявки; о каждой выплате придёт сообщение со ссылкой на транзакцию.</p>`;
  }

  document.addEventListener('click', e => {
    if (!document.body.classList.contains('refpage')) return;
    const t = e.target.closest('[data-copy], [data-step]');
    if (!t || location.hash === '#admin') return;
    if (t.dataset.copy) return copy(t.dataset.copy, toast);
    step = t.dataset.step || null; $('#r-wallet').innerHTML = `<h2>Кошелёк для выплат</h2>${wallet()}`;
  });
  document.addEventListener('submit', async e => {
    const f = e.target;
    if (!['r-form', 'r-code'].includes(f.id)) return;
    e.preventDefault();
    const b = f.querySelector('.btn.primary'); b.disabled = true;
    try {
      if (f.id === 'r-form') { await call('ref_wallet_code', { network: f.network.value, address: f.address.value.trim() }); step = 'code'; toast('Код отправлен в Telegram'); }
      else { const r = await call('ref_wallet_set', { code: f.code.value }); R.wallet = r.wallet; step = null; toast('Кошелёк сохранён'); }
      $('#r-wallet').innerHTML = `<h2>Кошелёк для выплат</h2>${wallet()}`;
      $('#r-wallet input')?.focus();
    } catch (err) { toast(err.message, 6000); b.disabled = false; if (err.data?.error === 'no_tg') { R.tg = false; $('#r-wallet').innerHTML = `<h2>Кошелёк для выплат</h2>${wallet()}`; } }
  });

  if (document.body?.classList.contains('refpage')) start();
  return { mount, cv, call };
})();
