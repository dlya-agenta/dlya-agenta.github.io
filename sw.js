// Service worker сайта (ТЗ v2, шаг 3.2): «На экран Домой» (PWA) и push-уведомления.
// Кэш — только оболочка сайта (страницы, скрипты, стили, иконки) на случай без сети: всегда сначала сеть, поэтому новая версия видна сразу.
// Данные (функция web), фото и карты идут с других адресов — их service worker не трогает и не кэширует.
const CACHE = 'shell-v1';
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', 'manifest.json', 'icons/192.png'])).catch(() => {})); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  const shell = r.mode === 'navigate' || ['script', 'style', 'manifest'].includes(r.destination) || u.pathname.includes('/icons/');
  if (!shell) return;
  e.respondWith(fetch(r).then(res => {
    if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); }
    return res;
  }).catch(() => caches.match(r).then(m => m ?? (r.mode === 'navigate' ? caches.match('./') : undefined)).then(m => m ?? Response.error())));
});

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
