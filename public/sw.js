const isLocalhost =
  self.location.hostname === 'localhost' ||
  self.location.hostname === '127.0.0.1' ||
  self.location.hostname.endsWith('.local');

if (isLocalhost) {
  self.addEventListener('install', () => {
    self.skipWaiting();
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      self.registration.unregister()
        .then(() => self.clients.matchAll())
        .then((clients) => {
          clients.forEach((client) => {
            if (client.url && 'navigate' in client) {
              client.navigate(client.url);
            }
          });
        })
    );
  });
} else {
  const CACHE_NAME = 'eurtisan-v2';
  const STATIC_ASSETS = [
    '/',
    '/favicon.ico',
    '/logo192.png',
    '/logo512.png',
  ];

  self.addEventListener('install', (event) => {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(STATIC_ASSETS);
      }),
    );
    self.skipWaiting();
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys().then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        );
      }),
    );
    self.clients.claim();
  });

  self.addEventListener('fetch', (event) => {
    // Only handle same-origin GET requests
    if (
      event.request.method !== 'GET' ||
      !event.request.url.startsWith(self.location.origin)
    ) {
      return;
    }

    // Never cache API routes or server function calls
    const url = new URL(event.request.url);
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/__')) {
      return;
    }

    // Network-first for navigation, cache-first for static assets
    const isNavigation = event.request.mode === 'navigate';

    event.respondWith(
      isNavigation
        ? fetch(event.request)
            .then((response) => {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, clone);
              });
              return response;
            })
            .catch(() => {
              return caches.match(event.request);
            })
        : caches.match(event.request).then((cached) => {
            if (cached) {
              return cached;
            }
            return fetch(event.request).then((response) => {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, clone);
              });
              return response;
            });
          }),
    );
  });
}

