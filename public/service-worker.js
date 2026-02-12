/**
 * Territory Mapper Service Worker
 * 
 * Custom service worker with:
 * - Advanced caching strategies
 * - Background sync for offline mutations
 * - Push notification support
 * - Precise cache management
 * - Navigation fallback to /offline for uncached pages
 */

importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

// Disable workbox logs in production
workbox.setConfig({ debug: false });

const { strategies, routing, precaching, backgroundSync, expiration, cacheableResponse } = workbox;

// Cache names
const CACHE_NAMES = {
  pages: 'territory-mapper-pages-v1',
  assets: 'territory-mapper-assets-v1',
  images: 'territory-mapper-images-v1',
  api: 'territory-mapper-api-v1',
  mapbox: 'territory-mapper-mapbox-v1',
};

// Precache manifest (will be injected by next-pwa)
precaching.precacheAndRoute(self.__WB_MANIFEST || []);

// Navigation routes - Cache pages with NetworkFirst, fallback to /offline
routing.registerRoute(
  ({ request }) => request.mode === 'navigate',
  new strategies.NetworkFirst({
    cacheName: CACHE_NAMES.pages,
    plugins: [
      new cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new expiration.ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 24 * 60 * 60, // 24 hours
      }),
    ],
  })
);

// Static assets - Cache with StaleWhileRevalidate
routing.registerRoute(
  ({ request }) =>
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font',
  new strategies.StaleWhileRevalidate({
    cacheName: CACHE_NAMES.assets,
    plugins: [
      new cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new expiration.ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
      }),
    ],
  })
);

// Images - Cache with CacheFirst
routing.registerRoute(
  ({ request }) => request.destination === 'image',
  new strategies.CacheFirst({
    cacheName: CACHE_NAMES.images,
    plugins: [
      new cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new expiration.ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
);

// Mapbox tiles and assets - Cache with CacheFirst
routing.registerRoute(
  ({ url }) => url.hostname.includes('mapbox.com'),
  new strategies.CacheFirst({
    cacheName: CACHE_NAMES.mapbox,
    plugins: [
      new cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new expiration.ExpirationPlugin({
        maxEntries: 500,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
);

// API routes - NetworkFirst with background sync (exclude GET requests from background sync)
routing.registerRoute(
  ({ url, request }) => url.pathname.startsWith('/api/') && request.method !== 'GET',
  new strategies.NetworkFirst({
    cacheName: CACHE_NAMES.api,
    plugins: [
      new cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new expiration.ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 5 * 60, // 5 minutes for API data
      }),
      new backgroundSync.BackgroundSyncPlugin('api-sync-queue', {
        maxRetentionTime: 24 * 60, // 24 hours
        onSync: async ({ queue }) => {
          let entry;
          while ((entry = await queue.shiftRequest())) {
            try {
              await fetch(entry.request);
              console.log('[SW] Background sync successful:', entry.request.url);
            } catch (error) {
              console.error('[SW] Background sync failed:', error);
              await queue.unshiftRequest(entry);
              throw error;
            }
          }
        },
      }),
    ],
  })
);

// API GET routes - NetworkFirst without background sync
routing.registerRoute(
  ({ url, request }) => url.pathname.startsWith('/api/') && request.method === 'GET',
  new strategies.NetworkFirst({
    cacheName: CACHE_NAMES.api,
    plugins: [
      new cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new expiration.ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 5 * 60, // 5 minutes for API data
      }),
    ],
  })
);

// Background Sync for offline mutations
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync event:', event.tag);
  
  if (event.tag === 'sync-territories') {
    event.waitUntil(syncTerritories());
  } else if (event.tag === 'sync-houses') {
    event.waitUntil(syncHouses());
  } else if (event.tag === 'sync-assignments') {
    event.waitUntil(syncAssignments());
  }
});

async function syncTerritories() {
  // Attempt to sync territories
  try {
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (response.ok) {
      console.log('[SW] Territory sync successful');
      // Notify clients
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(client => {
        client.postMessage({ type: 'SYNC_COMPLETE', collection: 'territories' });
      });
    }
  } catch (error) {
    console.error('[SW] Territory sync failed:', error);
  }
}

async function syncHouses() {
  try {
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (response.ok) {
      console.log('[SW] House sync successful');
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(client => {
        client.postMessage({ type: 'SYNC_COMPLETE', collection: 'houses' });
      });
    }
  } catch (error) {
    console.error('[SW] House sync failed:', error);
  }
}

async function syncAssignments() {
  try {
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (response.ok) {
      console.log('[SW] Assignment sync successful');
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(client => {
        client.postMessage({ type: 'SYNC_COMPLETE', collection: 'assignments' });
      });
    }
  } catch (error) {
    console.error('[SW] Assignment sync failed:', error);
  }
}

// Push notification support
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received:', event);
  
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch {
    data = { title: 'Territory Mapper', body: event.data?.text() || 'New notification' };
  }

  const title = data.title || 'Territory Mapper';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icons/icon-192x192.svg',
    badge: '/icons/icon-72x72.svg',
    tag: data.tag || 'default',
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || [],
    data: data.data || {},
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click:', event.notification.tag);
  
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If a window client is already open, focus it
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
  );
});

// Message handling from client
self.addEventListener('message', (event) => {
  console.log('[SW] Message from client:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data.type === 'CHECK_SYNC_STATUS') {
    // Report sync status back to client
    event.ports[0]?.postMessage({
      type: 'SYNC_STATUS',
      isOnline: navigator.onLine,
    });
  }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync event:', event.tag);
  
  if (event.tag === 'sync-data') {
    event.waitUntil(syncTerritories());
  }
});

// Install event - Precache critical assets with error handling
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAMES.pages).then((cache) => {
      // Add all critical pages with individual error handling
      const criticalUrls = [
        '/',
        '/offline',
        '/login',
        '/publisher',
        '/settings',
      ];
      
      return Promise.all(
        criticalUrls.map(url => 
          cache.add(url).catch(error => {
            console.warn(`[SW] Failed to cache ${url}:`, error);
            // Continue even if one URL fails
          })
        )
      );
    }).then(() => {
      console.log('[SW] Install completed');
    }).catch((error) => {
      console.error('[SW] Install failed:', error);
      // Don't throw - allow install to complete even with errors
    })
  );
  self.skipWaiting();
});

// Activate event - Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !Object.values(CACHE_NAMES).includes(name))
          .map((name) => {
            console.log('[SW] Cleaning up old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Activation completed');
    })
  );
  self.clients.claim();
});

// Navigation fallback - serve /offline for failed navigation requests
// This handles uncached pages when offline
self.addEventListener('fetch', (event) => {
  // Only handle navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Try network first
          const networkResponse = await fetch(event.request);
          return networkResponse;
        } catch {
          // Network failed, try cache
          const cache = await caches.open(CACHE_NAMES.pages);
          const cachedResponse = await cache.match(event.request);
          
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // Not in cache, serve offline fallback
          const offlineResponse = await cache.match('/offline');
          if (offlineResponse) {
            return offlineResponse;
          }
          
          // Fallback if /offline isn't cached either
          return new Response('Offline - Please check your connection', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' },
          });
        }
      })()
    );
  }
});

console.log('[SW] Service Worker Loaded');
