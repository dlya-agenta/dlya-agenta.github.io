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
  function use(me) {
    if (on) return;
    on = true;
    document.body.classList.add('guest');
    document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="guest.css?v=5.6">');
    const d = me.expires_at ? new Date(me.expires_at).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' }) : '';
    document.querySelector('main').insertAdjacentHTML('afterbegin', `<div class="guest-bar"><span><b>Гостевой доступ${d ? ` до ${d}` : ''}.</b>
      Можно искать и смотреть фото. Адреса, цены, площади и телефоны — с подпиской.</span><a class="btn primary" href="pay.html">Оформить подписку</a></div>`);
    document.addEventListener('click', stop, true);
  }
  return { use };
})();
