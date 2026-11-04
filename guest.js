// Гостевой доступ на сайте (решение Алексея 30.10.2026; сервер — web/guest.ts): новый участник, который зарегистрировался по коду партнёра и ещё не платил.
// Только посмотреть: поиск и фильтры работают, в выдаче — фото, тип и район (адрес, цену и площадь сервер не отдаёт). Карточки, карта и разделы не открываются —
// вместо них окно с тарифами. Настоящая защита — на сервере, здесь только показ.
window.GUEST = (() => {
  const NO = '.card, .map, .maplist, .selbar, #go-prof, [data-view="map"], .menu [data-go]:not([data-go="all"]):not([data-go="pay"])';
  let on = false;
  function stop(e) {
    if (!e.target.closest(NO)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    PLANS.pro('Адреса, цены, телефоны и карточки объявлений открываются с подпиской.');
  }
  // v5.25a: вход через Telegram-бота (привязка) → пробный доступ: 5 телефонов и всё, что у Подписчика (миграция 200, триггер web_users_trial)
  const token = () => { try { return JSON.parse(localStorage.getItem('token')); } catch { return null; } };
  const web = async action => { const r = await fetch(window.API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, auth: { token: token() } }) });
    const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.message || 'Не получилось, попробуйте ещё раз'); return j; };
  async function tgGo(e) {
    const b = e.currentTarget; b.disabled = true;
    try {
      const r = await web('tg_link');
      b.outerHTML = `<a class="btn primary" href="${String(r.url).replace(/"/g, '')}" target="_blank" rel="noopener">Открыть бота и нажать «Запустить»</a>`;
      const until = Date.parse(r.until) || Date.now() + 600e3, t = setInterval(async () => {
        if (Date.now() > until) return clearInterval(t);
        try { if ((await web('tg_state')).tg) { clearInterval(t); location.reload(); } } catch { /* следующая попытка */ }
      }, 3000);
    } catch (err) { b.disabled = false; alert(err.message); }
  }
  function use(me) {
    if (on) return;
    on = true;
    document.body.classList.add('guest');
    document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="guest.css?v=5.25a1">');
    const d = me.expires_at ? new Date(me.expires_at).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' }) : '';
    document.querySelector('main').insertAdjacentHTML('beforebegin', `<div class="guest-bar"><span><b>Гостевой доступ${d ? ` до ${d}` : ''}.</b>
      Войдите через Telegram-бота — откроются <b>5 телефонов собственников</b> и всё, что есть у Подписчика, до конца пробного срока.</span>
      <span class="guest-act"><button type="button" class="btn primary" id="guest-tg">Войти через Telegram</button><a class="btn ghost" href="pay.html">Оформить подписку</a></span></div>`);
    document.addEventListener('click', stop, true);
    document.getElementById('guest-tg')?.addEventListener('click', tgGo);
  }
  return { use };
})();
