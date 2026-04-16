// Pink Supermarket — Service Worker v1
const CACHE_NAME = 'pink-orders-v1';
const STATIC_ASSETS = [
  '/pink-counter/order.html',
  '/pink-counter/manifest.json',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap',
];

// ── INSTALL: cache static assets ─────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache what we can — some cross-origin may fail, that's ok
      return Promise.allSettled(
        STATIC_ASSETS.map(url => cache.add(url).catch(() => {}))
      );
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: clean old caches ────────────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: network-first for API, cache-first for assets ─────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go network for Supabase API calls
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Offline: return a JSON error so the app can handle gracefully
        return new Response(
          JSON.stringify({ error: 'offline', message: 'No internet connection' }),
          { headers: { 'Content-Type': 'application/json' }, status: 503 }
        );
      })
    );
    return;
  }

  // Cache-first for static assets (HTML, fonts, scripts)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache successful GET responses
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/pink-counter/order.html');
        }
      });
    })
  );
});

// ── BACKGROUND SYNC (for future use) ─────────────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-orders') {
    console.log('[SW] Background sync: orders');
  }
});

// ── PUSH NOTIFICATIONS (for future use) ──────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json().catch(() => ({ title: 'Pink Supermarket', body: event.data.text() }));
  event.waitUntil(
    data.then(d => self.registration.showNotification(d.title || 'Pink Supermarket', {
      body: d.body || '',
      icon: '/pink-counter/icons/icon-192.png',
      badge: '/pink-counter/icons/icon-72.png',
      vibrate: [200, 100, 200],
    }))
  );
});
