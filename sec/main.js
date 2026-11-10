// hub.html (v5.15): разделы по адресу #helper, #deal, #lawyer, #broker, #kb (v5.16), #newb, #fix, #excl, #chat, #video, #market, #taxes, #balance, #msg
// (и #раздел=параметр — открыть сразу нужное: #deal=12, #helper=5, #video=7). Каждый раздел — window.SEC.<имя> = {title, open(arg, ctx)}.
(() => {
  const $ = s => document.querySelector(s);
  const H = window.HUB;
  let caps = null;
  async function start() {
    const pub = location.hash.match(/^#(deal-guest|law-report)=/)?.[1];   // по ссылке агента без входа: брокер/юрист в сделке, отчёт проверки (v5.24b)
    if (pub) {
      $('#gate').hidden = true; $('#app').hidden = false; $('#hub-nav').hidden = true;
      return window.SEC[pub].open(location.hash.split('=')[1], { el: $('#hub') }).catch(e => { $('#hub').innerHTML = `<p class="err">${H.esc(e.message)}</p>`; });
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
  // v5.48 F: hub.html?agent=1 — раздел ИИ-Агента внутри всплывающего окна (agent.js): только он, другие разделы — во всей вкладке
  const AGENT = new URLSearchParams(location.search).has('agent') && window.parent !== window;
  if (AGENT) document.documentElement.classList.add('agent');
  function route() {
    const [sec, arg] = (location.hash.slice(1) || 'helper').split('=');
    if (AGENT && sec !== 'helper') { parent.postMessage({ agent: 1, type: 'go', href: new URL('hub.html' + location.hash, location.href).href }, location.origin); history.replaceState(null, '', '?agent=1#helper'); return; }
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
