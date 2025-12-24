/**
 * Colour Master - Final Production Service Worker
 * Version: v15 (Bulletproof Strategy)
 */

const CACHE_NAME = 'colour-master-v15'; 

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',

  // 1. External Styling & Fonts
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap',
  
  // 2. Textures (Essential for the UI)
  'https://i.postimg.cc/TdFZ8Kpq/Vector-Smart-Object.png',
  'https://i.postimg.cc/jRL3h8sN/Texture-v1.jpg',

  // 3. App Logic (ESM.sh Dependencies)
  // Ensure these match your index.html import map exactly!
  'https://esm.sh/react@19.0.0',
  'https://esm.sh/react-dom@19.0.0',
  'https://esm.sh/lucide-react@0.460.0',
  'https://esm.sh/dexie@4.0.8',
  'https://esm.sh/dexie-react-hooks@4.0.2',
  'https://esm.sh/colord@2.9.3'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use "addAll" but catch errors so one failing icon doesn't stop the whole SW
      return Promise.allSettled(
        PRECACHE_URLS.map(url => cache.add(url))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});



self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Navigation: Network-First (to get updates), fallback to cached index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Assets: Cache-First, then Network
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then((networkResponse) => {
        // FIXED: Removed the 'type !== basic' restriction to allow ESM.sh and PostImg (CORS)
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      });
    })
  );
});
