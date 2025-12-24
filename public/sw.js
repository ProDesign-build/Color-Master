const CACHE_NAME = 'colour-master-v3'; // Bumped version to v3

// 1. URLs to cache immediately. 
// NOTE: We removed .tsx files because they don't exist in the live app.
// We only cache the "Skeleton" of the app here.
const PRECACHE_URLS = [
  './', 
  './index.html',
  './manifest.json',
  './assets/index.js',  // <--- The file we just fixed
  './assets/index.css', // <--- The CSS file
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

// Fetch Event: The "Brain" of the PWA
self.addEventListener('fetch', (event) => {
  
  // A. Handle Navigation Requests (HTML pages)
  // If user navigates to /home or /mixing while offline, serve index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match('./index.html');
        })
    );
    return;
  }

  // B. Handle Assets (JS, CSS, Images) - Stale-While-Revalidate
  // 1. Try to fetch from network & update cache
  // 2. If network fails, fall back to cache
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            // Cache valid responses
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            // Network failed, do nothing (we will return cachedResponse)
          });

          // Return cached response if we have it, otherwise wait for network
          return cachedResponse || fetchPromise;
        });
      })
    );
  }
});
