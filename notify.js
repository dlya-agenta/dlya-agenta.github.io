// Уведомления (ТЗ v2, шаг 3.2): в профиле — «Привязать Telegram» и push в этом браузере; окно уведомлений на сайте (подборки, задачи);
// «Добавить на главный экран» (PWA) после первой подборки ссылкой и первой задачи (шаг 3.4 зовёт NOTIFY.offerInstall('task'));
// в админке — токен бота. Разрешение на уведомления браузер спрашивает только по нажатию кнопки.
// Сервер — функция web: tg_link | tg_state | tg_unlink | push_key | push_sub | push_unsub | push_test | notes | notes_seen | admin_bot | admin_bot_token.
window.NOTIFY = (() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* приватный режим */ } },
  };
  const tgApp = window.Telegram?.WebApp, inTg = !!tgApp?.initData;
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const pushOk = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  let ui = null, meta = null, installEv = null;

  // service worker: оболочка для главного экрана и приём push; данные не кэшируются (sw.js). В Telegram не нужен — там уведомления от бота
  const swReady = !inTg && 'serviceWorker' in navigator ? navigator.serviceWorker.register('sw.js').catch(() => null) : Promise.resolve(null);
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEv = e; });
  navigator.serviceWorker?.addEventListener('message', e => { if (e.data?.type === 'push') poll(); });   // пришёл push, пока сайт открыт — обновить окно

  const b64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
  async function subscription() {
    if (!pushOk()) return null;
    const reg = await swReady;
    return reg ? reg.pushManager.getSubscription().catch(() => null) : null;
  }
  // по нажатию: разрешение → подписка браузера → сервер
  async function subscribe() {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error(perm === 'denied' ? 'Уведомления запрещены — разрешите их в настройках браузера для этого сайта' : 'Вы не разрешили уведомления');
    const reg = (await swReady) ?? await navigator.serviceWorker.register('sw.js');
    await navigator.serviceWorker.ready;
    const { key } = await ui.call('push_key');
    let sub = await reg.pushManager.getSubscription();
    if (sub && b64u(key).join() !== new Uint8Array(sub.options?.applicationServerKey ?? []).join()) { await sub.unsubscribe(); sub = null; }
    sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(key) });
    await ui.call('push_sub', { sub: sub.toJSON() });
  }

  // ---------- профиль: Telegram ----------
  async function tgBox(el, linked) {
    if (!el) return;
    if (meta?.ntf && !meta.ntf.tg) { el.innerHTML = '<p class="muted">Уведомления в Telegram выключены администратором.</p>'; return; }
    let st = { tg: linked, locked: false, bot: meta?.bot };
    try { st = await ui.call('tg_state'); } catch { /* покажем по профилю */ }
    const bot = st.bot ? `@${esc(st.bot)}` : 'сайта';
    el.innerHTML = st.tg
      ? `<p>✅ Telegram привязан — бот ${bot} присылает уведомления: просмотры и отметки клиентов в подборках, оплата, задачи.</p>
        ${st.locked ? '<p class="hint">Telegram администратора нужен для кода входа — отвязать его здесь нельзя.</p>' : '<div class="sheet-foot"><span></span><button class="btn ghost" data-tg-off>Отвязать</button></div>'}`
      : `<p class="muted">Привяжите Telegram — бот ${bot} будет присылать уведомления: просмотры и отметки клиентов в подборках, оплата, задачи.</p>
        <div class="sheet-foot" id="tg-act"><span></span><button class="btn primary" data-tg-on>Привязать Telegram</button></div>`;
    el.onclick = async e => {
      const on = e.target.closest('[data-tg-on]'), off = e.target.closest('[data-tg-off]'), go = e.target.closest('[data-tg-go]');
      if (go && inTg && tgApp.openTelegramLink) { e.preventDefault(); tgApp.openTelegramLink(go.href); }
      if (off) {
        if (!confirm('Отвязать Telegram? Уведомления в бот приходить перестанут.')) return;
        off.disabled = true;
        try { await ui.call('tg_unlink'); ui.toast('Telegram отвязан'); tgBox(el, false); } catch (err) { off.disabled = false; ui.toast(err.message, 5000); }
      }
      if (on) {
        on.disabled = true;
        try {
          const r = await ui.call('tg_link');
          // ссылкой, а не window.open после ожидания: Safari такие окна блокирует
          $('#tg-act').innerHTML = `<span class="hint">Откройте бота и нажмите «Запустить» (Start). Ссылка действует 10 минут.</span>
            <a class="btn primary" data-tg-go href="${esc(r.url)}" target="_blank" rel="noopener">Открыть Telegram</a>`;
          wait(el, Date.parse(r.until));
        } catch (err) { on.disabled = false; ui.toast(err.message, 5000); }
      }
    };
  }
  // пока открыт профиль — раз в 3 секунды: бот привязал?
  function wait(el, until) {
    clearInterval(wait.t);
    wait.t = setInterval(async () => {
      if (!el.isConnected || Date.now() > until) return clearInterval(wait.t);
      if (document.hidden) return;
      try { const st = await ui.call('tg_state'); if (st.tg) { clearInterval(wait.t); ui.toast('Telegram привязан'); tgBox(el, true); } } catch { /* следующая попытка */ }
    }, 3000);
  }

  // ---------- профиль: push в этом браузере ----------
  async function pushBox(el) {
    if (!el) return;
    if (meta?.ntf && !meta.ntf.push) { el.innerHTML = '<p class="muted">Уведомления в браузере выключены администратором.</p>'; return; }
    if (inTg) { el.innerHTML = '<p class="muted">В Telegram уведомления присылает бот — привяжите его выше.</p>'; return; }
    if (!pushOk() || (ios && !standalone())) {
      el.innerHTML = ios && !standalone()
        ? `<p class="muted">На iPhone уведомления работают только после «На экран Домой»: Safari → «Поделиться» → «На экран Домой», затем откройте сайт с главного экрана.</p>
          <div class="sheet-foot"><span></span><button class="btn soft" data-pwa>Как добавить</button></div>`
        : '<p class="muted">Этот браузер не поддерживает уведомления сайта. Подойдут Chrome, Edge, Firefox, Яндекс Браузер; на iPhone — после «На экран Домой».</p>';
      el.onclick = e => { if (e.target.closest('[data-pwa]')) offerInstall('profile', true); };
      return;
    }
    const sub = await subscription();
    const denied = Notification.permission === 'denied';
    el.innerHTML = sub && Notification.permission === 'granted'
      ? `<p>✅ Уведомления включены в этом браузере.</p><div class="sheet-foot"><button class="btn ghost" data-push-off>Выключить</button><button class="btn soft" data-push-test>Проверить</button></div>`
      : denied ? '<p class="muted">Уведомления для этого сайта запрещены в настройках браузера — разрешите их там (значок замка рядом с адресом), затем обновите страницу.</p>'
      : `<p class="muted">Уведомления на этот телефон или компьютер — даже когда сайт закрыт: клиент открыл подборку, поставил ✓ или ✗, напоминания о задачах.</p>
        <div class="sheet-foot"><span></span><button class="btn primary" data-push-on>Включить уведомления</button></div>`;
    el.onclick = async e => {
      const b = e.target.closest('[data-push-on], [data-push-off], [data-push-test]');
      if (!b) return;
      b.disabled = true;
      try {
        if (b.matches('[data-push-on]')) { await subscribe(); ui.toast('Уведомления включены'); }
        if (b.matches('[data-push-off]')) { const s = await subscription(); if (s) { await ui.call('push_unsub', { endpoint: s.endpoint }); await s.unsubscribe(); } ui.toast('Уведомления выключены'); }
        if (b.matches('[data-push-test]')) { const r = await ui.call('push_test'); ui.toast(r.ok ? 'Отправлено — уведомление придёт через несколько секунд' : 'Служба уведомлений не приняла сообщение — выключите и включите снова', 5000); }
      } catch (err) { ui.toast(err.message, 5000); }
      pushBox(el);
    };
  }

  // ---------- «Добавить на главный экран» ----------
  // reason — по какому поводу (первая подборка ссылкой, первая задача): каждое предложение один раз; force — по кнопке
  function offerInstall(reason, force = false) {
    if (!ui || inTg || standalone()) return false;
    const k = `pwa_${reason}`;
    if (!force && store.get(k, false)) return false;
    store.set(k, true);
    const tips = {
      ios: '<b>iPhone:</b> Safari → «Поделиться» (квадрат со стрелкой) → «На экран Домой». Уведомления на iPhone работают только после этого.',
      android: '<b>Android:</b> Chrome → меню ⋮ → «Установить приложение» (или «Добавить на главный экран»).',
      pc: '<b>Компьютер:</b> Chrome или Edge → значок установки в адресной строке (⊕) или меню → «Установить приложение».',
    };
    const mine = ios ? 'ios' : android ? 'android' : 'pc';
    ui.sheet('Добавьте сайт на главный экран', `
      <p>Сайт откроется одним нажатием, как приложение, и сможет присылать уведомления: клиент открыл подборку, поставил ✓ или ✗, напоминания о задачах.</p>
      <p>${tips[mine]}</p>
      ${installEv ? '<div class="sheet-foot"><span></span><button class="btn primary" data-install>Установить</button></div>' : ''}
      <details class="pwa-more"><summary>Другие устройства</summary>${Object.entries(tips).filter(([x]) => x !== mine).map(([, t]) => `<p>${t}</p>`).join('')}</details>
      <div class="sheet-foot"><span></span><button class="btn ghost" data-close>Понятно</button>${pushOk() && !(ios && !standalone()) && Notification.permission === 'default' && meta?.ntf?.push !== false ? '<button class="btn soft" data-push-now>Включить уведомления</button>' : ''}</div>`);
    $('#sheet-body').onclick = async e => {
      if (e.target.closest('[data-install]') && installEv) { installEv.prompt(); installEv = null; e.target.closest('.sheet-foot').remove(); }
      const p = e.target.closest('[data-push-now]');
      if (p) { p.disabled = true; try { await subscribe(); ui.toast('Уведомления включены'); p.remove(); } catch (err) { p.disabled = false; ui.toast(err.message, 5000); } }
    };
    return true;
  }

  // ---------- окно уведомлений на сайте ----------
  let shown = new Set();
  async function poll() {
    if (!ui || document.hidden || meta?.ntf?.site === false) return;
    let r;
    try { r = await ui.call('notes'); } catch { return; }
    const box = $('#notes') ?? Object.assign(document.createElement('div'), { id: 'notes', className: 'notes agent-only' });
    if (!box.isConnected) { box.setAttribute('aria-live', 'polite'); document.body.append(box); }
    for (const n of (r.items ?? []).reverse()) {
      if (shown.has(n.id)) continue;
      shown.add(n.id);
      const c = document.createElement('div');
      c.className = 'note-card'; c.dataset.id = n.id;
      c.innerHTML = `<p>${esc(n.text)}</p><div class="note-foot">${n.url ? `<a class="btn soft" href="${esc(n.url)}" target="_blank" rel="noopener" data-seen>Открыть</a>` : ''}<button class="btn ghost" data-seen>Понятно</button></div>`;
      box.prepend(c);
    }
    box.onclick = e => {
      const b = e.target.closest('[data-seen]');
      if (!b) return;
      const c = b.closest('.note-card');
      ui.call('notes_seen', { ids: [+c.dataset.id] }).catch(() => {});
      c.remove();
    };
  }
  function start(deps, m) {
    ui = deps; meta = m;
    if (meta?.me?.guest) return;
    poll();
    clearInterval(start.t); start.t = setInterval(poll, 180e3);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
  }

  // ---------- админка: токен бота ----------
  async function adminPanel(el, deps) {
    if (!el) return;
    const u = deps ?? ui;
    let r;
    try { r = await u.call('admin_bot'); } catch (e) { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    el.innerHTML = `<p>Бот: <b>@${esc(r.name)}</b> · ${r.webhook_ok ? '<span class="tag ok">принимает сообщения</span>' : `<span class="tag warn">вебхук: ${esc(r.webhook_error ?? 'не настроен')}</span>`}</p>
      <p class="hint">Токен: ${r.token_saved ? 'свой, сохранён ••••' : 'из настроек функции (как при запуске)'}. Значение токена сайт не показывает.</p>
      <div class="u-grid"><label class="field">Новый токен бота (от @BotFather)<input type="password" id="a-bot-tok" autocomplete="off" placeholder="123456789:AA…"></label></div>
      <div class="sheet-foot">${r.token_saved ? '<button type="button" class="btn ghost" id="a-bot-reset">Вернуть токен из настроек функции</button>' : '<span></span>'}
        <button type="button" class="btn soft" id="a-bot-save">Проверить и сохранить токен</button></div>`;
    const go = async t => {
      try {
        const x = await u.call('admin_bot_token', { token: t });
        u.toast(`Бот @${x.name ?? '?'}: ${x.webhook ? 'вебхук перенастроен' : 'вебхук НЕ перенастроен'}${x.menu ? ', кнопка «Сайт» на месте' : ''}`, 6000);
        adminPanel(el, u);
      } catch (e) { u.toast(e.message, 6000); }
    };
    $('#a-bot-save').onclick = () => { const t = $('#a-bot-tok').value.trim(); if (t) go(t); else u.toast('Вставьте токен'); };
    $('#a-bot-reset')?.addEventListener('click', () => { if (confirm('Вернуть токен из настроек функции?')) go(''); });
  }

  return { use: deps => { ui = deps; }, start, tgBox, pushBox, offerInstall, adminPanel, subscribe };
})();
