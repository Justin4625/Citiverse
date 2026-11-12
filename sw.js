// Network-first with cache fallback, so the app shell still opens offline.
const CACHE = 'stamprally-v18';
const SHELL = [
  './', './index.html', './styles.css', './manifest.webmanifest', './icon.svg', './data/index.json', './data/overview.geojson',
  './js/app.js', './js/geo.js', './js/storage.js', './js/locations.js',
  './js/map.js', './js/mapStyle.js', './js/mapData.js', './js/markers.js', './js/book.js',
  './img/centraal.jpg', './img/markthal.jpg', './img/kubuswoningen.jpg', './img/erasmusbrug.jpg', './img/rechtbank.jpg',
  './img/euromast.jpg', './img/hetpark.jpg', './img/politiebureau.jpg', './img/stadhuis.jpg', './img/bibliotheek.jpg',
  './js/stops.js', './js/stop.js', './js/ai.js', './js/progress.js', './js/progressView.js',
  './js/games/index.js', './js/games/kit.js', './js/games/nepOfEcht.js', './js/games/nepOfEchtContent.js',
  './js/games/spoorloos.js', './js/games/koopjesjacht.js', './js/games/moderator.js', './js/games/overDeBrug.js',
  './js/games/kruisverhoor.js', './js/games/overtuigDeStad.js', './js/games/ontsnapUitDeApp.js',
  './js/games/pitchInDeRaad.js', './js/games/algoritme.js', './js/brand.js', './js/twinny.js', './js/twinny3d.js',
  // Digital Child Rights artwork (img/dcr): per theme a buddy, icon, GO stamp and star.
  './img/dcr/logo.png', './img/dcr/bg-portrait.jpg', './img/dcr/bg-landscape.jpg',
  './img/dcr/stamp-dcr.png', './img/dcr/star-dcr.png',
  ...['everybody', 'chances', 'fair', 'opinion', 'freedom', 'active', 'healthy', 'privacy', 'safe', 'rules'].flatMap((t) =>
    ['buddy', 'icon', 'stamp', 'star'].map((kind) => `./img/dcr/${kind}-${t}.png`),
  ),
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
