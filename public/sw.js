// API responses, user data, and Next assets are never cached.
const CACHE_NAME = 'mgldrama-static-v5';
const ASSETS = ['/icon-192.png', '/icon-512.png', '/manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k.startsWith('mgldrama-') && k !== CACHE_NAME).map(k => caches.delete(k))
  )));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !ASSETS.includes(url.pathname)) return;
  event.respondWith(fetch(event.request).catch(async () => (await caches.match(event.request)) || new Response('Offline', { status: 503 })));
});

self.addEventListener('push', event => {
  event.waitUntil(self.registration.showNotification('ТАЗА САЙТ', {
    body: 'Админаас шинэ мессеж ирлээ.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'taza-admin-chat',
    renotify: true,
    data: { url: '/?chat=1' },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/?chat=1', self.location.origin).href;
  event.waitUntil((async()=>{
    const windows = await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.focus();
        if ('navigate' in client) await client.navigate(target);
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
