const CACHE_NAME = 'colour-master-v2';

// Core assets to cache immediately on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/index.tsx',
  '/App.tsx',
  '/types.ts',
  '/db.ts',
  '/components/ColorCanvas.tsx',
  '/components/LeatherPreview.tsx',
  '/components/MixingCalculator.tsx',
  '/components/Library.tsx',
  '/components/ColorWheel.tsx',
  '/components/ConfirmDialog.tsx',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://i.postimg.cc/TdFZ8Kpq/Vector-Smart-Object.png',
  'https://i.postimg.cc/jRL3h8sN/Texture-v1.jpg'
];

// Install Event: Cache core files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

// Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Stale-While-Revalidate Strategy
// 1. Return from cache if available.
// 2. Fetch from network and update cache.
// 3. This ensures external CDNs (fonts, esm.sh) are cached as they are used.
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests or browser-sync/hot-reload noise
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          // Check if we received a valid response
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
           // Network failed
        });

        // Return cached response if found, otherwise wait for network
        return cachedResponse || fetchPromise;
      });
    })
  );
});
