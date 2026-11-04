// Скрипт Telegram Mini App нужен только внутри Telegram. Раньше он грузился всегда и синхронно в <head>: если telegram.org
// не отвечает (бывает в России и у части провайдеров), страница висела на «Загрузка…» до ошибки соединения (v5.16).
// Внутри Telegram: в адресе #tgWebAppData=…, сохранённые параметры запуска, мост TelegramWebviewProxy или окно во фрейме (Telegram Web).
(() => {
  let inTg = false;
  try { inTg = /tgWebAppData|tgWebAppPlatform/.test(location.hash) || !!sessionStorage.getItem('__telegram__initParams') || !!window.TelegramWebviewProxy || window.parent !== window; } catch { inTg = true; }
  if (inTg) document.write('<script src="https://telegram.org/js/telegram-web-app.js?59"><\/script>');
})();
// v5.26: страховка от «вечной загрузки» (приложение с экрана «Домой»): если через 15 с всё ещё «Загрузка…» — кнопка «Обновить»
setTimeout(() => {
  const g = document.getElementById('gate');
  if (!g || g.hidden || !/Загрузка/.test(g.textContent) || g.querySelector('[data-reload]')) return;
  g.insertAdjacentHTML('beforeend', '<p class="muted" style="margin-top:14px">Долго грузится — возможно, слабая связь.</p><button class="btn primary" data-reload type="button">Обновить</button>');
  g.querySelector('[data-reload]').onclick = () => location.reload();
}, 15000);
