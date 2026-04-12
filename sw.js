const CACHE_NAME = 'albion-log-v9';
const ASSETS = [
  './',
  './login.html',
  './index.html',
  './syphon.html',
  './style.css',
  './app.js',
  './syphon.js',
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
      // Force take control of all open pages immediately
      return self.clients.claim();
    }).then(function() {
      // Tell all clients to reload with fresh content
      return self.clients.matchAll({type: 'window'}).then(function(clients) {
        clients.forEach(function(client) {
          client.postMessage({type: 'CACHE_UPDATED', version: CACHE_NAME});
        });
      });
    })
  );
});

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;

  var url = event.request.url;

  // Skip chrome-extension:// URLs (browser extensions)
  if (url.indexOf('chrome-extension://') === 0 || url.indexOf('chrome://') === 0) return;

  // Skip external CDN URLs — don't cache them at runtime
  // (only cache at install time, fetch them directly from network at runtime)
  if (url.indexOf('https://cdnjs.cloudflare.com') === 0) {
    event.respondWith(fetch(event.request).catch(function() {
      return null;
    }));
    return;
  }

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
              }).catch(function() {
                // Ignore cache write errors
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
            }).catch(function() {
              // Ignore cache write errors
            })
          );
        }
        return response;
      }).catch(function() {
        // Return null if both cache and network fail
        return null;
      });
    }).catch(function() {
      // Cache.match failed (e.g., invalid scheme), fetch from network
      return fetch(event.request).catch(function() {
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
