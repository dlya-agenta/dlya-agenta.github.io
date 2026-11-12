// «Мессенджеры и соцсети» (v5.16, пп. 5–6): живой вход — на нашем сервере открывается настоящий браузер, вы видите его экран здесь и входите сами
// (QR-код, номер и код, пароль) — без ключей API. Сессия хранится на нашем сервере в зашифрованном виде и используется только для ваших действий
// (рассылки, чаты по сделке, сообщения собственникам, публикация роликов). Окно входа — conn.js, сервер — auto/conn.ts и worker/conn.ts.
// Реклама (кабинет партнёра) — свой вход по СМС в разделе «📣 Реклама» (браузер-робот площадка не пускает).
(() => {
  const H = window.HUB, esc = H.esc;
  const USE = { tg: 'рассылки в группы, чаты по сделке, сообщения собственникам', max: 'чаты по сделке, сообщения собственникам', wa: 'сообщения собственникам и клиентам, чаты по сделке',
    ig: 'публикация роликов (Reels)', yt: 'публикация роликов (Shorts)', vk: 'публикация роликов (Клипы) и постов' };
  // как войти — по сервисам (все способы, которые показывает страница входа)
  const HOW = {
    tg: ['QR-код или номер и код', ['Нажмите «Войти» — откроется страница входа Telegram.', 'Быстрее всего — QR: на телефоне Telegram → Настройки → Устройства → «Подключить устройство» → наведите камеру на код на экране.',
      'Или по номеру: «Войти по номеру телефона» → номер → код придёт в Telegram на телефоне (не СМС).', 'Если включён облачный пароль (двухэтапная проверка) — введите его.']],
    max: ['QR-код или номер и код из СМС', ['Нажмите «Войти» — откроется MAX.', 'QR: в приложении MAX на телефоне → Профиль → Устройства → «Подключить» → наведите камеру на код.', 'Или номер телефона и код из СМС.']],
    wa: ['QR-код или код по номеру', ['Нажмите «Войти» — откроется WhatsApp Web.', 'QR: WhatsApp на телефоне → Настройки → «Связанные устройства» → «Привязка устройства» → наведите камеру на код.',
      'Или «Войти по номеру телефона» — на экране появится 8-значный код, введите его в WhatsApp на телефоне (Связанные устройства).', 'Телефон должен быть в сети первые минуты после входа.']],
    vk: ['телефон, пароль и код', ['Нажмите «Войти» — откроется ВКонтакте.', 'Введите телефон или почту и пароль; код подтверждения придёт в СМС или в приложение VK.', 'Можно войти QR-кодом из приложения VK (Сервисы → QR-сканер).']],
    ig: ['логин, пароль и код', ['Нажмите «Войти» — откроется Instagram.', 'Логин (имя, телефон или почта) и пароль.', 'Код подтверждения — из СМС, почты или приложения-генератора кодов, если включена защита.', 'Лучше рабочий аккаунт: Instagram не любит вход с новых устройств.']],
    yt: ['аккаунт Google', ['Нажмите «Войти» — откроется вход Google.', 'Почта Gmail и пароль.', 'Подтвердите вход на телефоне («Да, это я») или кодом из СМС.']],
    dc: ['номер и код из СМС', ['Нажмите «Войти» — откроется кабинет для рекламы.', 'Номер телефона кабинета и код из СМС.']],
    av: ['номер и код из СМС', ['Нажмите «Войти» — откроется Авито.', 'Номер телефона и код из СМС (иногда — пароль от аккаунта).']],
    cian: ['номер и код или почта и пароль', ['Нажмите «Войти» — откроется Циан.', 'Номер телефона и код из СМС или почта и пароль.']],
  };
  let el = null;
  async function open(arg, ctx) {
    el = ctx.el;
    el.innerHTML = '<p class="muted">Загрузка…</p>';
    let r;
    try { r = await CONN.call('conn_init'); } catch (e) { el.innerHTML = e.code === 'need_pro' ? H.locked('Подключения', 'Подключение мессенджеров, соцсетей и рекламы — для участников с действующим доступом') : `<p class="err">${esc(e.message)}</p>`; return; }
    const st = x => x.status === 'ok' ? `<span class="st ok">✅ Подключено${x.acc_name ? `: ${esc(x.acc_name)}` : ''}${x.ok_at ? ` · ${H.when(x.ok_at)}` : ''}</span>`
      : x.status === 'need' ? '<span class="st err">⚠ Вход закончился — войдите снова</span>'
      : x.status === 'error' ? `<span class="st err">${esc(x.message ?? 'Вход не удался')}</span>`
      : ['start', 'live'].includes(x.status) ? '<span class="st">⏳ Идёт вход…</span>' : '<span class="st muted">Не подключено</span>';
    // v5.54 (Алексей 11.11): «🔌 Подключения» — всё внешнее в одной вкладке: мессенджеры, соцсети, реклама и площадки, прокси; у каждого — «Как войти»
    const GR = [['m', '💬 Мессенджеры', ['tg', 'max', 'wa']], ['s', '📱 Соцсети', ['vk', 'ig', 'yt']], ['r', '📣 Реклама и площадки', ['dc', 'av', 'cian']], ['p', '🌐 Прокси', []]];
    const tab = GR.some(g => g[0] === arg) ? arg : (GR.find(g => g[2].includes(arg))?.[0] ?? ((() => { try { return JSON.parse(localStorage.getItem('conn_tab')); } catch { return null; } })() || 'm'));
    // v5.69: «сначала свой компьютер» — у сервисов, где нужен вход для работы сервиса, сверху состояние компьютера агента и галочка облака (WAYS);
    // ниже — вход на сервере сервиса (запасной путь, работает, когда компьютер выключен)
    const WY = new Set(['tg', 'max', 'wa', 'dc', 'av', 'cian']);
    const wyBox = id => WY.has(id) ? `<div class="conn-wy" data-wy-svc="${id}"></div><small class="muted conn-cl">☁️ Вход на сервере сервиса — запасной путь:</small>` : '';
    const card = x => `<div class="conn-card"><h3>${x.icon} ${esc(x.name)}</h3>${wyBox(x.id)}${st(x)}
        <small class="muted">Для чего: ${esc(USE[x.id] ?? '')}</small><small>${esc(x.note)}</small>
        ${HOW[x.id] ? `<details class="conn-how"><summary>Как войти — ${HOW[x.id][0]}</summary><ol>${HOW[x.id][1].map(t => `<li>${t}</li>`).join('')}</ol></details>` : ''}
        <div class="row">${x.status === 'ok' ? `<button class="btn soft" data-in="${x.id}">Войти заново</button><button class="btn ghost bad" data-out="${x.id}">Отключить</button>`
          : `<button class="btn primary" data-in="${x.id}"${r.online ? '' : ' disabled'}>Войти</button>`}${x.id === 'tg' && x.status === 'ok' ? '<a class="btn soft" href="mail.html">✉️ Рассылки</a>' : ''}</div></div>`;
    const rkCard = `<div class="conn-card"><h3>📣 Реклама</h3>${wyBox('dc')}<span class="st muted">Вход по СМС</span><small class="muted">Для чего: черновики объявлений в вашем кабинете партнёра</small>
          <details class="conn-how"><summary>Как войти — номер и код из СМС</summary><ol><li>Нажмите «Войти» — откроется раздел «📣 Реклама».</li><li>Введите номер телефона кабинета и код из СМС.</li><li>Дальше черновики объявлений создаются из выбранных объектов кнопкой «📣 В рекламу».</li></ol></details>
          <div class="row"><a class="btn primary" href="./#rk=login">Войти</a></div></div>`;
    const pxBox = `<div class="conn-list"><div class="conn-card"><h3>🌐 Свой прокси</h3><span class="st muted">Постоянный адрес для ваших входов</span>
        <small class="muted">Для чего: WhatsApp, Telegram, MAX, соцсети и реклама открываются на нашем сервере с одного и того же адреса — вход не слетает.</small>
        <details class="conn-how" open><summary>Как настроить</summary><ol><li>Купите у любого продавца <b>постоянный</b> (не меняющийся) прокси HTTP или SOCKS5, лучше российский — для Рекламы и MAX.</li>
          <li>Скопируйте строку прокси целиком: <code>адрес:порт:логин:пароль</code> или <code>http://логин:пароль@адрес:порт</code>.</li>
          <li>Нажмите «Настроить прокси», вставьте строку, отметьте, для каких сервисов он нужен, и нажмите «Проверить» — увидите, какие сервисы открываются.</li>
          <li>Сохраните. Пароль прокси хранится зашифрованным, на сайте показывается только маска адреса.</li></ol></details>
        <div class="row"><button type="button" class="btn primary" data-proxy>⚙️ Настроить прокси</button></div></div></div>`;
    const pane = g => g[0] === 'p' ? pxBox : `<div class="conn-list">${r.items.filter(x => g[2].includes(x.id)).map(card).join('')}${g[0] === 'r' && !r.items.some(x => x.id === 'dc') ? rkCard : ''}</div>`;
    const cnt = g => r.items.filter(x => g[2].includes(x.id) && x.status === 'ok').length;
    el.innerHTML = `<h2>🔌 Подключения</h2>
      <p class="hint conn-pc">💻 <b>Сначала — ваш компьютер.</b> Сообщения, реклама и проверки идут с вашего компьютера: Chrome с расширением «Для Агента» (<a href="ext.html" target="_blank" rel="noopener">установить</a>) и вход в веб-версию сервиса в нём. Вход на нашем сервере ниже — запасной путь: он работает, только если вы разрешили его галочкой «☁️ Можно через сервер сервиса».</p>
      <p class="hint">Всё внешнее — в одном месте: мессенджеры, соцсети, реклама и прокси. Вход — как в обычном браузере: на нашем сервере открывается настоящая страница сервиса, вы видите её здесь и входите сами (QR-код, номер и код, пароль). Ключи API не нужны.
      Сессия хранится на нашем сервере <b>в зашифрованном виде</b> и используется только для ваших действий. Отключить — кнопкой «Отключить».</p>
      ${window.MSGAPP?.warn() ?? ''}
      <p class="conn-srv${r.online ? ' on' : ''}"><i></i>${r.online ? '☁️ Сервер сервиса на связи — запасной путь, когда ваш компьютер выключен' : '☁️ Сервер сервиса сейчас не работает — вход на сервере недоступен. Ваш компьютер с расширением работает без него'}</p>
      <nav class="conn-tabs" role="tablist">${GR.map(g => `<button type="button" role="tab" class="conn-tab${g[0] === tab ? ' on' : ''}" data-ctab="${g[0]}" aria-selected="${g[0] === tab}">${g[1]}${cnt(g) ? ` <b>${cnt(g)}</b>` : ''}</button>`).join('')}</nav>
      ${GR.map(g => `<section class="conn-pane" data-cpane="${g[0]}"${g[0] === tab ? '' : ' hidden'}>${pane(g)}</section>`).join('')}
      <p class="hint">⚠ WhatsApp и Instagram официально не разрешают сторонние программы — используйте рабочие аккаунты. Telegram: завершить сеанс можно и в самом Telegram (Настройки → Устройства).</p>`;
    el.querySelectorAll('[data-wy-svc]').forEach(b => window.WAYS?.box(b, b.dataset.wySvc, { title: '💻 Ваш компьютер — главный путь', manual: false }));
    if (!el._ct) el._ct = 1, el.addEventListener('click', e => { const t = e.target.closest('[data-ctab]'); if (!t) return; el.querySelectorAll('[data-ctab]').forEach(b => { const on = b === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
      el.querySelectorAll('[data-cpane]').forEach(p => { p.hidden = p.dataset.cpane !== t.dataset.ctab; }); try { localStorage.setItem('conn_tab', JSON.stringify(t.dataset.ctab)); } catch { /* приватный режим */ } });
    el.onclick = async e => {
      const i = e.target.closest('[data-in]'), o = e.target.closest('[data-out]');
      if (i) { const x = r.items.find(y => y.id === i.dataset.in); CONN.open(x.id, { title: `${x.icon} Вход: ${x.name}`, onOk: () => setTimeout(() => open(arg, ctx), 2600), onClose: () => open(arg, ctx) }); }
      if (o) { if (!confirm('Отключить и удалить сессию с нашего сервера?')) return; try { const z = await CONN.call('conn_logout', { svc: o.dataset.out }); H.toast(z.note ?? 'Отключено', 7000); open(arg, ctx); } catch (er) { H.toast(er.message, 5000); } }
    };
    if (arg && r.items.some(x => x.id === arg) && !r.items.find(x => x.id === arg && x.status === 'ok') && r.online) el.querySelector(`[data-in="${arg}"]`)?.click();
  }
  window.SEC = window.SEC || {};
  window.SEC.msg = { title: 'Подключения', open };
})();
