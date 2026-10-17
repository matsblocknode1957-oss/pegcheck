const CACHE_NAME = 'pegcheck-v3';

const PRECACHE_URLS = [
  '/',
  '/favicon.svg',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // Never intercept API routes or Supabase/external requests
  if (
    url.pathname.startsWith('/api/') ||
    !url.origin.startsWith(self.location.origin)
  ) {
    return;
  }

  // Cache-first for hashed Next.js bundles (content hash = new URL on every change)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
      )
    );
    return;
  }

  // Stale-while-revalidate for coin icons and same-origin images —
  // serve the cached copy instantly, then refresh the cache in the background
  // so updated icons are picked up on the next load without any user action.
  if (
    url.pathname.startsWith('/icons/') ||
    /\.(svg|png|jpg|jpeg|webp|woff2?|ico)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        const networkFetch = fetch(request).then((response) => {
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        });

        // Keep the SW alive until the background refresh settles
        event.waitUntil(networkFetch.catch(() => {}));

        // Return cached copy immediately; if nothing cached, await the network
        // (natural network error if offline with no cache — same as before)
        return cache.match(request).then((cached) => cached ?? networkFetch);
      })
    );
    return;
  }

  // Network-first for HTML navigation — fall back to cached page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/'))
        )
    );
  }
});
