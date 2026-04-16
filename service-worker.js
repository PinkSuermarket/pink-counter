// Pink Supermarket — Service Worker v2
const CACHE = 'pink-v2';
const OFFLINE_PAGE = './order.html';

const PRECACHE = [
  './order.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// INSTALL — precache shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(PRECACHE.map(u => c.add(u).catch(()=>{}))))
      .then(() => self.skipWaiting())
  );
});

// ACTIVATE — delete old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// FETCH strategy:
// - Supabase API → network only (never cache)
// - HTML/assets  → network first, fall back to cache
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Never cache Supabase or external API calls
  if (url.hostname.includes('supabase.co') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('jsdelivr.net')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({error:'offline'}),
          {status:503, headers:{'Content-Type':'application/json'}})
      )
    );
    return;
  }

  // Network first for everything else
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (e.request.method === 'GET' && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request)
        .then(cached => cached || caches.match(OFFLINE_PAGE))
      )
  );
});
