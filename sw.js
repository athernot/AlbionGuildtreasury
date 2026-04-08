const CACHE_NAME = 'albion-treasury-v5';
const ASSETS = [
  './',
  './login.html',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS).catch(function(err) {
        console.warn('SW: Gagal cache beberapa asset:', err);
      });
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(name) {
          return name !== CACHE_NAME;
        }).map(function(name) {
          return caches.delete(name);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;

  // Use network-first strategy for navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(function() {
        return caches.match(event.request);
      })
    );
    return;
  }

  // Cache-first strategy for static assets
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) {
        // Update cache in background (stale-while-revalidate)
        var fetchPromise = fetch(event.request).then(function(networkResponse) {
          // Only cache successful responses
          if (networkResponse && networkResponse.status === 200) {
            var responseToCache = networkResponse.clone();
            event.waitUntil(
              caches.open(CACHE_NAME).then(function(cache) {
                return cache.put(event.request, responseToCache);
              })
            );
          }
          return networkResponse;
        }).catch(function() {
          // Network failed, return cached
          return null;
        });
        return cached;
      }

      // Not in cache, fetch from network
      return fetch(event.request).then(function(response) {
        // Only cache successful responses
        if (response && response.status === 200) {
          var responseToCache = response.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then(function(cache) {
              return cache.put(event.request, responseToCache);
            })
          );
        }
        return response;
      }).catch(function() {
        // Return null if both cache and network fail
        return null;
      });
    })
  );
});

// Handle messages from clients
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
