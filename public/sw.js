/**
 * Colour Master - Service Worker
 * Version: v12 (Dynamic Strategy)
 */

const CACHE_NAME = 'colour-master-v12'; 

// Core files that must be available to boot the app
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://i.postimg.cc/TdFZ8Kpq/Vector-Smart-Object.png',
  'https://i.postimg.cc/jRL3h8sN/Texture-v1.jpg'
];

// Install Event: Pre-cache the "Skeleton"
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching core assets');
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

// Activate Event: Clean up old versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Handling Offline & Dynamic Caching
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests (like database syncs or analytics)
  if (event.request.method !== 'GET') return;

  // --- STRATEGY 1: Navigation (HTML) ---
  // Always try network first so user sees updates, fallback to index.html if offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('./index.html') || caches.match('./');
      })
    );
    return;
  }

  // --- STRATEGY 2: Assets (JS, CSS, Images) ---
  // Cache-First, then Network (with dynamic caching for Vite hashed files)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        // Don't cache invalid responses or cross-origin errors
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        // Dynamic Caching: Save Vite's new assets automatically as they load
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // Final fallback if both fail
        return new Response('Offline content not available', { status: 503 });
      });
    })
  );
});
