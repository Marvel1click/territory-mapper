import {
  CacheFirst,
  CacheableResponsePlugin,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
  type PrecacheEntry,
  type RuntimeCaching,
} from 'serwist';

const workerGlobal = globalThis as unknown as { __SW_MANIFEST: PrecacheEntry[] };

const runtimeCaching: RuntimeCaching[] = [
  {
    matcher: ({ sameOrigin, url }) =>
      sameOrigin &&
      (url.pathname.startsWith('/api/') ||
        url.pathname.startsWith('/auth/') ||
        url.pathname.startsWith('/invite/') ||
        url.pathname.startsWith('/checkout')),
    handler: new NetworkOnly(),
  },
  {
    matcher: ({ url }) =>
      url.hostname === 'api.mapbox.com' || url.hostname.endsWith('.tiles.mapbox.com'),
    handler: new CacheFirst({
      cacheName: 'territory-mapper-basemap-v2',
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({
          maxEntries: 750,
          maxAgeSeconds: 14 * 24 * 60 * 60,
          maxAgeFrom: 'last-used',
        }),
      ],
    }),
  },
  {
    matcher: ({ sameOrigin, request, url }) =>
      sameOrigin &&
      request.mode === 'navigate' &&
      ['/', '/login', '/forgot-password', '/offline', '/field'].includes(url.pathname),
    handler: new NetworkFirst({
      cacheName: 'territory-mapper-shell-v2',
      networkTimeoutSeconds: 3,
      plugins: [
        new ExpirationPlugin({ maxEntries: 8, maxAgeSeconds: 7 * 24 * 60 * 60 }),
      ],
    }),
  },
  {
    matcher: ({ sameOrigin, url }) =>
      sameOrigin &&
      (url.pathname.startsWith('/_next/static/') ||
        /\.(?:css|js|woff2|png|svg|ico)$/.test(url.pathname)),
    handler: new StaleWhileRevalidate({
      cacheName: 'territory-mapper-static-v2',
      plugins: [
        new ExpirationPlugin({ maxEntries: 128, maxAgeSeconds: 30 * 24 * 60 * 60 }),
      ],
    }),
  },
  {
    matcher: () => true,
    handler: new NetworkOnly(),
  },
];

const serwist = new Serwist({
  precacheEntries: workerGlobal.__SW_MANIFEST,
  precacheOptions: { cleanupOutdatedCaches: true },
  cacheId: 'territory-mapper-v2',
  clientsClaim: true,
  skipWaiting: false,
  navigationPreload: true,
  runtimeCaching,
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher: ({ request }) => request.destination === 'document',
      },
    ],
  },
});

serwist.addEventListeners();
