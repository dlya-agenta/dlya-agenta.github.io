// Скрипт Telegram Mini App нужен только внутри Telegram. Раньше он грузился всегда и синхронно в <head>: если telegram.org
// не отвечает (бывает в России и у части провайдеров), страница висела на «Загрузка…» до ошибки соединения (v5.16).
// Внутри Telegram: в адресе #tgWebAppData=…, сохранённые параметры запуска, мост TelegramWebviewProxy или окно во фрейме (Telegram Web).
(() => {
  let inTg = false;
  try { inTg = /tgWebAppData|tgWebAppPlatform/.test(location.hash) || !!sessionStorage.getItem('__telegram__initParams') || !!window.TelegramWebviewProxy || window.parent !== window; } catch { inTg = true; }
  if (inTg) document.write('<script src="https://telegram.org/js/telegram-web-app.js?59"><\/script>');
})();
