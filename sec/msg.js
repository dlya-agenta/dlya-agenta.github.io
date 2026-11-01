// «Мессенджеры и соцсети» (v5.15, п. 16): что подключено и как подключить. Telegram — вход по QR или номеру прямо со страницы
// (облачный пароль вводит сам пользователь, он уходит в Telegram и нигде не сохраняется) — это раздел «Рассылки» (mail.html, шаг 4.2).
// WhatsApp, MAX, YouTube, Rutube, VK, Instagram — после запуска нашего российского сервера; кнопки пока «Скоро».
(() => {
  const H = window.HUB, esc = H.esc;
  const LIST = [
    { id: 'tg', name: 'Telegram', how: 'Вход по QR-коду или номеру и коду, облачный пароль — на этой странице. Пароль уходит в Telegram и нигде не хранится.', href: 'mail.html', on: true },
    { id: 'wa', name: 'WhatsApp', how: 'Вход по QR-коду со страницы. ⚠ Неофициальное подключение WhatsApp может привести к блокировке номера — используйте отдельный рабочий номер.', soon: true },
    { id: 'max', name: 'MAX', how: 'Вход по QR-коду со страницы (веб-версия MAX).', soon: true },
    { id: 'yt', name: 'YouTube (Shorts)', how: 'Официальный вход Google — публикация роликов из «Видеомонтажа».', soon: true },
    { id: 'rt', name: 'Rutube', how: 'Официальный вход Rutube — публикация роликов.', soon: true },
    { id: 'vk', name: 'VK (Клипы)', how: 'Официальный вход VK ID — публикация роликов.', soon: true },
    { id: 'ig', name: 'Instagram (Reels)', how: 'Официальный вход Meta для бизнес-аккаунтов.', soon: true },
  ];
  async function open(arg, ctx) {
    ctx.el.innerHTML = `<h2>🔗 Мессенджеры и соцсети</h2>
      <p class="hint">Подключите мессенджеры и соцсети один раз — и сайт сможет создавать чаты по сделке, писать собственникам, делать рассылки и публиковать ролики от вашего имени.
      Сессии хранятся в зашифрованном виде на нашем сервере в России и используются только для ваших действий; отключить можно здесь в любой момент.</p>
      <div class="hub-rows">${LIST.map(x => `<div class="hub-row"><b>${esc(x.name)}</b><small>${esc(x.how)}</small>
        ${x.on ? `<a class="btn primary" href="${x.href}">Подключить</a>` : '<button class="btn soft" disabled>Скоро</button>'}</div>`).join('')}</div>
      <p class="hint">Пока мессенджер не подключён, сайт готовит текст и открывает чат в приложении на вашем телефоне или в веб-версии на компьютере (WhatsApp, Telegram, MAX).</p>`;
  }
  window.SEC = window.SEC || {};
  window.SEC.msg = { title: 'Мессенджеры и соцсети', open };
})();
