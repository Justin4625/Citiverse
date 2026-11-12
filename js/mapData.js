// Loads the detailed map in small pieces: data/map/<x>/<y>.json holds one grid cell (about
// 380 x 610 m) with its ground and buildings, baked from 3D Rotterdam by tools/bake_map.py.
// Only the cells around the middle of the screen are fetched and handed to the map.

// Below this zoom the coarse overview (data/overview.geojson) is enough.
const DETAIL_ZOOM = 14.6;
// How far from the middle of the screen cells are loaded, and how many at most.
const REACH_M = 700;
const MAX_CELLS = 12;
// Fetched cells stay in memory so walking back is instant.
const MAX_CACHED = 60;
const M_PER_DEG = 111320;

const EMPTY = { type: 'FeatureCollection', features: [] };

export async function loadIndex() {
  const res = await fetch('data/index.json');
  if (!res.ok) throw new Error(`data/index.json ${res.status}`);
  return res.json();
}

// Keeps the map's detail source filled with the cells around its centre.
export function keepDetailLoaded(map, sourceId, index) {
  const size = 180 / 2 ** index.zoom;
  const available = new Set(index.cells);
  const cache = new Map(); // "x/y" -> features, or a promise while loading
  let shown = '';

  function cellsAround({ lng, lat }) {
    const dLat = REACH_M / M_PER_DEG;
    const dLng = dLat / Math.cos((lat * Math.PI) / 180);
    const cells = [];
    for (let x = Math.floor((lng - dLng + 180) / size); x <= Math.floor((lng + dLng + 180) / size); x++) {
      for (let y = Math.floor((90 - lat - dLat) / size); y <= Math.floor((90 - lat + dLat) / size); y++) {
        const key = `${x}/${y}`;
        if (!available.has(key)) continue;
        const dx = ((x + 0.5) * size - 180 - lng) * M_PER_DEG * Math.cos((lat * Math.PI) / 180);
        const dy = (90 - (y + 0.5) * size - lat) * M_PER_DEG;
        cells.push({ key, distance: Math.hypot(dx, dy) });
      }
    }
    return cells.sort((a, b) => a.distance - b.distance).slice(0, MAX_CELLS).map((c) => c.key);
  }

  function load(key) {
    if (cache.has(key)) return;
    const pending = fetch(`data/map/${key}.json`)
      .then((res) => (res.ok ? res.json() : EMPTY))
      .then((data) => {
        cache.set(key, data.features);
        update();
      })
      .catch(() => cache.delete(key)); // offline or a hiccup: tried again on the next move
    cache.set(key, pending);
  }

  function update() {
    if (map.getZoom() < DETAIL_ZOOM) return; // keep what is shown; the overview covers the rest
    const wanted = cellsAround(map.getCenter());
    wanted.forEach(load);
    const ready = wanted.filter((key) => Array.isArray(cache.get(key)));
    const signature = ready.join(' ');
    if (signature === shown) return;
    shown = signature;
    map.getSource(sourceId).setData({ type: 'FeatureCollection', features: ready.flatMap((key) => cache.get(key)) });
    // Forget the cells furthest back in time once the cache is full.
    for (const key of cache.keys()) {
      if (cache.size <= MAX_CACHED) break;
      if (!wanted.includes(key)) cache.delete(key);
    }
  }

  map.on('moveend', update);
  update();
}
