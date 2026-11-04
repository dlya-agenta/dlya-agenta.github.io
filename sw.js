// Service worker сайта (ТЗ v2, шаг 3.2): «На экран Домой» (PWA) и push-уведомления.
// Кэш — только оболочка сайта (страницы, скрипты, стили, иконки) на случай без сети: всегда сначала сеть, поэтому новая версия видна сразу.
// Данные (функция web), фото и карты идут с других адресов — их service worker не трогает и не кэширует.
// v5.26d (Алексей 04.11, iPhone iOS 26, приложение с экрана «Домой» — вечная «Загрузка…» только там, в Chrome на iPhone всё работает,
// а у Chrome на iPhone service worker'а нет): перехват загрузок убран совсем — страницы, скрипты и данные идут прямо из сети, как в обычной вкладке.
// Service worker остаётся только для push-уведомлений; старые кэши (shell-v1, shell-v2) удаляются.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))).then(() => self.clients.claim())); });

// push: {title, body, url, tag} от функции web (_shared/notify.ts). Открытые вкладки сайта узнают сразу и обновляют окно уведомлений
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(Promise.all([
    self.registration.showNotification(d.title || 'Для Агента', { body: d.body || '', tag: d.tag || undefined, renotify: !!d.tag,
      icon: 'icons/192.png', badge: 'icons/badge-72.png', data: { url: d.url || './' } }),
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => cs.forEach(c => c.postMessage({ type: 'push', title: d.title, body: d.body }))),
  ]));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const w = list.find(c => c.url === url);
    return w ? w.focus() : self.clients.openWindow(url);
  }));
});
