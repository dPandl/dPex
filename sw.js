const CACHE_NAME = 'dpex-shell-v4';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './favicon.png',
  './icon-192.png',
  './icon-512.png',
  './logo.png'
];

// Install Event: App-Shell cachen
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Alte Caches aufräumen
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && !key.startsWith('dpex-')) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Network-First mit Cache-Fallback für Shell-Assets
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Nur GET-Requests abfangen
  if (request.method !== 'GET') return;

  // Manifest-Requests immer unberührt lassen, damit der Browser es nativ lädt
  if (request.url.includes('manifest.json')) {
    return;
  }

  // Navigations-Requests (z. B. Neuladen der Seite)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match('./index.html') || await cache.match('./');
        return cachedResponse || new Response('Offline - Seite nicht im Cache', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      })
    );
    return;
  }

  // Für andere Anfragen: Stale-While-Revalidate bzw. Cache-Fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Frische Version im Hintergrund abrufen
        fetch(request).then(async (networkResponse) => {
          if (networkResponse.ok && request.url.startsWith(self.location.origin)) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse);
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(request);
    })
  );
});
