// Service worker сайта (ТЗ v2, шаг 3.2): «На экран Домой» (PWA) и push-уведомления.
// Кэш — только оболочка сайта (страницы, скрипты, стили, иконки) на случай без сети: всегда сначала сеть, поэтому новая версия видна сразу.
// Данные (функция web), фото и карты идут с других адресов — их service worker не трогает и не кэширует.
const CACHE = 'shell-v2';   // v5.26: свои копии карты (vendor/) и навигация с таймаутом
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', 'manifest.json', 'icons/192.png'])).catch(() => {})); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// v5.26 (п. 5 задачи 04.11, «вечная загрузка» приложения с экрана «Домой»): страница — из сети, но не дольше 8 с, потом из кэша;
// ответ-перенаправление для навигации не отдаём как есть (Chrome отказывается показывать такой ответ) — строим чистый ответ
const timeout = (p, ms) => new Promise((ok, no) => { const t = setTimeout(() => no(new Error('timeout')), ms); p.then(v => { clearTimeout(t); ok(v); }, e => { clearTimeout(t); no(e); }); });
const clean = async res => res.redirected ? new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers }) : res;
const put = (r, res) => { if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)).catch(() => {}); } return res; };
const fromCache = r => caches.match(r, { ignoreSearch: r.mode === 'navigate' }).then(m => m ?? (r.mode === 'navigate' ? caches.match('./') : undefined));
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  const nav = r.mode === 'navigate';
  const shell = nav || ['script', 'style', 'manifest'].includes(r.destination) || u.pathname.includes('/icons/') || u.pathname.includes('/vendor/');
  if (!shell) return;
  const net = fetch(r).then(res => nav ? clean(res) : res).then(res => put(r, res));
  e.respondWith((nav ? timeout(net, 8000) : net).catch(async () => (await fromCache(r)) ?? (nav ? net : Response.error())).catch(() => Response.error()));
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
