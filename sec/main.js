// hub.html (v5.15): разделы по адресу #helper, #deal, #lawyer, #broker, #kb (v5.16), #newb, #fix, #excl, #chat, #video, #market, #taxes, #balance, #msg
// (и #раздел=параметр — открыть сразу нужное: #deal=12, #helper=5, #video=7). Каждый раздел — window.SEC.<имя> = {title, open(arg, ctx)}.
(() => {
  const $ = s => document.querySelector(s);
  const H = window.HUB;
  let caps = null;
  async function start() {
    if (location.hash.startsWith('#deal-guest=')) {   // ипотечный брокер или юрист по ссылке агента — без входа
      $('#gate').hidden = true; $('#app').hidden = false; $('#hub-nav').hidden = true;
      return window.SEC['deal-guest'].open(location.hash.split('=')[1], { el: $('#hub') }).catch(e => { $('#hub').innerHTML = `<p class="err">${H.esc(e.message)}</p>`; });
    }
    if (!H.token()) { location.href = './#login'; return; }
    try { caps = await H.call('caps'); }
    catch (e) {
      if (e.status === 401) { location.href = './'; return; }
      $('#gate').innerHTML = `<p class="err">${H.esc(e.message)}</p><a class="btn primary" href="./">На главную</a>`; return;
    }
    await H.rate();
    $('#gate').hidden = true; $('#app').hidden = false;
    H.ping();
    addEventListener('hashchange', route);
    route();
  }
  function route() {
    const [sec, arg] = (location.hash.slice(1) || 'helper').split('=');
    const s = window.SEC?.[sec] ?? window.SEC.helper;
    window.NAV?.sync();   // подсветка раздела в общем меню группами (nav.js)
    document.title = `${s.title} — Для Агента`;
    $('#hub').innerHTML = '<p class="muted">Загрузка…</p>';
    Promise.resolve(s.open(arg ? decodeURIComponent(arg) : '', { caps, el: $('#hub') })).catch(e => {
      $('#hub').innerHTML = e.code === 'need_pro' || e.code === 'need_max' || e.code === 'need_plan'
        ? H.locked(s.title, e.message, e.code === 'need_max' ? 'max' : 'pro') : `<p class="err">${H.esc(e.message)}</p>`;
    });
  }
  window.SEC ??= {};
  window.HUBPAGE = { caps: () => caps, go: h => { location.hash = h; } };
  document.addEventListener('DOMContentLoaded', start);
})();
