// Скрипт Telegram Mini App нужен только внутри Telegram. Раньше он грузился всегда и синхронно в <head>: если telegram.org
// не отвечает (бывает в России и у части провайдеров), страница висела на «Загрузка…» до ошибки соединения (v5.16).
// Внутри Telegram: в адресе #tgWebAppData=…, сохранённые параметры запуска, мост TelegramWebviewProxy или окно во фрейме (Telegram Web).
(() => {
  let inTg = false;
  try { inTg = /tgWebAppData|tgWebAppPlatform/.test(location.hash) || !!sessionStorage.getItem('__telegram__initParams') || !!window.TelegramWebviewProxy || window.parent !== window; } catch { inTg = true; }
  if (inTg) document.write('<script src="https://telegram.org/js/telegram-web-app.js?59"><\/script>');
})();
// v5.26e: диагностика «зависаний» (iPhone, приложение с экрана «Домой»): ошибки страницы и последние запросы (app.js → window.__calls) — на сервер, в журнал админки
window.__errs = [];
addEventListener('error', e => { window.__errs.push(String(e.message || e.type).slice(0, 160) + (e.filename ? ' @' + String(e.filename).split('/').pop() + ':' + e.lineno : '')); }, true);
addEventListener('unhandledrejection', e => { window.__errs.push('promise: ' + String(e.reason?.message || e.reason).slice(0, 160)); });
window.__diag = why => { try {
  let tok = null; try { tok = JSON.parse(localStorage.getItem('token')); } catch { /* нет */ }
  const now = Date.now(), d = { why, stage: window.__stage || 'скрипты', sw: !!navigator.serviceWorker?.controller, online: navigator.onLine, sa: matchMedia('(display-mode: standalone)').matches,
    up: Math.round(performance.now() / 1000), calls: (window.__calls || []).map(c => `${c.a}:${c.st}:${c.ms ?? Math.round((now - c.t0) / 1000) + 's…'}`), errs: window.__errs.slice(-5),
    loaded: ['L', 'MFA', 'PLANS', 'NOTIFY', 'CRM', 'HUB', 'NAV', 'start'].filter(k => k in window).join(','), vis: document.visibilityState };
  fetch(String(window.API || 'https://arojogajdamsyrrpcmso.supabase.co/functions/v1/web'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true, body: JSON.stringify({ action: 'diag', auth: tok ? { token: tok } : undefined, d }) }).catch(() => {});
  return d; } catch { return null; } };
// v5.26: страховка от «вечной загрузки» (приложение с экрана «Домой»): если через 15 с всё ещё «Загрузка…» — кнопка «Обновить»
const __slow = () => {
  if (document.visibilityState === 'hidden') return document.addEventListener('visibilitychange', () => setTimeout(__slow, 15000), { once: true });   // вкладка в фоне грузится медленно — это не зависание
  const g = document.getElementById('gate');
  if (!g || g.hidden || !/Загрузка/.test(g.textContent) || g.querySelector('[data-reload]')) return;
  g.insertAdjacentHTML('beforeend', `<p class="muted" style="margin-top:14px">Долго грузится — возможно, слабая связь.</p><p class="muted" style="font-size:12px;opacity:.6">этап: ${window.__stage || 'скрипты'} · sw: ${navigator.serviceWorker?.controller ? 'да' : 'нет'}${(window.__errs || []).length ? ' · ' + String(window.__errs.slice(-2).join(' | ')).replace(/[<>&]/g, '').slice(0, 200) : ''}</p><button class="btn primary" data-reload type="button">Обновить</button>`);
  g.querySelector('[data-reload]').onclick = () => location.reload();
  window.__diag?.('загрузка 15 с');
};
setTimeout(__slow, 15000);
