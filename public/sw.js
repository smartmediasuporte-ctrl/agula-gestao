// Self-destructing service worker — unregisters itself and clears all caches
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    Promise.all([
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))),
      self.registration.unregister(),
      self.clients.matchAll().then(clients => {
        clients.forEach(c => c.navigate(c.url));
      })
    ])
  );
});

self.addEventListener('fetch', () => {
  // Do nothing — let the browser handle all requests directly
});
