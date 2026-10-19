// Service worker: offline app shell + update detection.
// VERSION is stamped by `npm run stamp` from a hash of the app files, so every
// real change ships a new service worker and the app shows its update banner.
const VERSION = 'e6f4d6b6';
const CACHE = `calorie-tracker-${VERSION}`;
const ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'css/app.css',
  'js/app.js',
  'js/logic.js',
  'js/store.js',
  'js/version.js',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/favicon-32.png'
];

self.addEventListener('install', event => {
  // Fetch fresh copies (skip the HTTP cache) so the new version is complete.
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(a => new Request(a, { cache: 'reload' })))));
  // Don't take over yet: the page shows an "Update" banner and asks us to.
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// Cache first (works fully offline); page loads fall back to the cached app.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (hit) return hit;
    try {
      return await fetch(req);
    } catch (err) {
      if (req.mode === 'navigate') return cache.match('index.html');
      throw err;
    }
  })());
});
