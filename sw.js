// Network-first with cache fallback, so the app shell still opens offline.
const CACHE = 'stamprally-v6';
const SHELL = [
  './', './index.html', './styles.css', './manifest.webmanifest', './icon.svg',
  './js/app.js', './js/geo.js', './js/storage.js', './js/locations.js',
  './js/map.js', './js/mapStyle.js', './js/markers.js', './js/book.js',
  './img/centraal.jpg', './img/markthal.jpg', './img/kubuswoningen.jpg', './img/erasmusbrug.jpg', './img/euromast.jpg',
];

self.addEventListener('install', (e) => {
  // 'reload' skips the browser's HTTP cache, so a new version never mixes with old files.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' })))));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const sameOrigin = new URL(e.request.url).origin === location.origin;
  // Own files are revalidated with the server every time (GitHub Pages would otherwise serve them from cache for 10 min).
  e.respondWith(
    (sameOrigin ? fetch(e.request.url, { cache: 'no-cache' }) : fetch(e.request))
      .then((res) => {
        if (res.ok && sameOrigin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request)),
  );
});
