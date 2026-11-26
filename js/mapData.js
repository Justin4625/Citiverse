// Loads the detailed map in small pieces: data/map/<x>/<y>.json holds one grid cell (about
// 380 x 610 m) with its ground and buildings, baked from 3D Rotterdam by tools/bake_map.py.
// Only the cells around the middle of the screen are fetched and handed to the map.

// Cells are loaded around the player (not the middle of the screen, which swings round when you
// turn), up to MAX_CELLS within REACH_M. A cell that is shown stays until it is further than
// KEEP_M, so turning or a few steps back and forth never makes the city flicker. All of this lies
// under the haze (styles.css .haze), so cells come and go out of sight.
const REACH_M = 750;
const KEEP_M = 1100;
const MAX_CELLS = 20;
const PREFETCH_CELLS = 8;
// Fetched cells stay in memory so walking back is instant.
const MAX_CACHED = 60;
// New buildings rise out of the ground over GROW_MS instead of popping up.
const GROW_MS = 700;
const M_PER_DEG = 111320;

const EMPTY = { type: 'FeatureCollection', features: [] };

// Fetched cells, shared by prefetch() and keepDetailLoaded(): "x/y" -> features, or a promise.
const cache = new Map();
let onArrive = () => {};
function fetchCell(key) {
  if (cache.has(key)) return;
  const pending = fetch(`data/map/${key}.json`)
    .then((res) => (res.ok ? res.json() : EMPTY))
    .then((data) => {
      cache.set(key, data.features);
      onArrive();
    })
    .catch(() => cache.delete(key)); // offline or a hiccup: tried again on the next move
  cache.set(key, pending);
}

let indexPromise = null;
// Starts as soon as the game loads, before the map itself is ready.
export function loadIndex() {
  indexPromise ??= window.citiverseIndex?.catch(fetchIndex) ?? fetchIndex();
  return indexPromise;
}
async function fetchIndex() {
  const res = await fetch('data/index.json');
  if (!res.ok) throw new Error(`data/index.json ${res.status}`);
  return res.json();
}

// Keeps the map's detail source filled with the cells around `around()` (the player). onData
// gets the features each time they change; a feature's place in that array is its map id.
// New cells show their ground at once and their buildings first in `newSourceId`, which
// `grow(g)` (0..1) raises out of the ground; then they join the detail source.
// Fetches the cells around `pos` before the map is ready, so the city is there sooner.
export function prefetch(index, pos) {
  // Only the nearest few: the player may start somewhere else.
  cellKeysAround(index, pos).slice(0, PREFETCH_CELLS).forEach(fetchCell);
}
function cellKeysAround(index, pos) {
  const size = 180 / 2 ** index.zoom;
  const available = new Set(index.cells);
  const dLat = REACH_M / M_PER_DEG;
  const dLng = dLat / Math.cos((pos.lat * Math.PI) / 180);
  const cells = [];
  for (let x = Math.floor((pos.lng - dLng + 180) / size); x <= Math.floor((pos.lng + dLng + 180) / size); x++) {
    for (let y = Math.floor((90 - pos.lat - dLat) / size); y <= Math.floor((90 - pos.lat + dLat) / size); y++) {
      const key = `${x}/${y}`;
      if (!available.has(key)) continue;
      const cx = (x + 0.5) * size - 180;
      const cy = 90 - (y + 0.5) * size;
      cells.push({ key, d: Math.hypot((cx - pos.lng) * Math.cos((pos.lat * Math.PI) / 180), cy - pos.lat) });
    }
  }
  return cells.sort((a, b) => a.d - b.d).slice(0, MAX_CELLS).map((c) => c.key);
}

export function keepDetailLoaded(map, sourceId, newSourceId, index, { around, grow, prepare = () => {}, onData = () => {} }) {
  const size = 180 / 2 ** index.zoom;
  const available = new Set(index.cells);
  let shown = []; // cells in the detail source
  let rising = null; // { keys, started } while new cells grow

  const centreOf = (key) => {
    const [x, y] = key.split('/').map(Number);
    return { lng: (x + 0.5) * size - 180, lat: 90 - (y + 0.5) * size };
  };
  const distanceTo = ({ lng, lat }, key) => {
    const c = centreOf(key);
    return Math.hypot((c.lng - lng) * M_PER_DEG * Math.cos((lat * Math.PI) / 180), (c.lat - lat) * M_PER_DEG);
  };

  function cellsAround(pos) {
    const dLat = REACH_M / M_PER_DEG;
    const dLng = dLat / Math.cos((pos.lat * Math.PI) / 180);
    const cells = [];
    for (let x = Math.floor((pos.lng - dLng + 180) / size); x <= Math.floor((pos.lng + dLng + 180) / size); x++) {
      for (let y = Math.floor((90 - pos.lat - dLat) / size); y <= Math.floor((90 - pos.lat + dLat) / size); y++) {
        const key = `${x}/${y}`;
        if (available.has(key)) cells.push({ key, distance: distanceTo(pos, key) });
      }
    }
    return cells.sort((a, b) => a.distance - b.distance).slice(0, MAX_CELLS).map((c) => c.key);
  }

  const load = fetchCell;
  // Cells that arrive close together are shown together, not one by one.
  let arriveTimer = 0;
  onArrive = () => {
    clearTimeout(arriveTimer);
    arriveTimer = setTimeout(update, 120);
  };
  const ready = (key) => Array.isArray(cache.get(key));
  // prepare() may add properties to the features (map.js: landmark tints) before they are drawn.
  const setSource = (id, features) => {
    prepare(features);
    map.getSource(id).setData({ type: 'FeatureCollection', features });
  };

  function update() {
    if (rising) return; // the next update runs when the new buildings have risen
    const pos = around();
    const wanted = cellsAround(pos);
    wanted.forEach(load);
    // Keep what is shown unless it is far away now; add what has arrived.
    const keep = shown.filter((key) => distanceTo(pos, key) <= KEEP_M);
    const fresh = wanted.filter((key) => ready(key) && !keep.includes(key));
    if (!fresh.length && keep.length === shown.length) return;
    if (!fresh.length) {
      show(keep);
      return;
    }
    // The new cells' ground shows at once, their buildings grow in their own layer.
    const ground = fresh.flatMap((key) => cache.get(key).filter((f) => !f.properties.h));
    setSource(sourceId, [...keep.flatMap((key) => cache.get(key)), ...ground]);
    setSource(newSourceId, fresh.flatMap((key) => cache.get(key).filter((f) => f.properties.h)));
    rising = { keys: [...keep, ...fresh], started: performance.now() };
    grow(0);
    requestAnimationFrame(step);
  }

  function step(now) {
    const t = Math.min(1, (now - rising.started) / GROW_MS);
    grow(1 - (1 - t) ** 3); // fast at first, landing softly
    if (t < 1) {
      requestAnimationFrame(step);
      return;
    }
    // Grown: everything moves into the detail source. The new layer is emptied only once that
    // source shows them, so there is no frame without the new buildings.
    const keys = rising.keys;
    show(keys);
    let tries = 0;
    const handOver = () => {
      if (!map.isSourceLoaded(sourceId) && tries++ < 60) {
        requestAnimationFrame(handOver);
        return;
      }
      setSource(newSourceId, []);
      rising = null;
      update();
    };
    requestAnimationFrame(handOver);
  }

  function show(keys) {
    shown = keys;
    const features = keys.flatMap((key) => cache.get(key));
    setSource(sourceId, features);
    onData(features);
    // Forget the cells furthest back in time once the cache is full.
    for (const key of cache.keys()) {
      if (cache.size <= MAX_CACHED) break;
      if (!keys.includes(key)) cache.delete(key);
    }
  }

  // Check a few times a second while the player moves.
  let timer = 0;
  map.on('move', () => {
    timer ||= setTimeout(() => {
      timer = 0;
      update();
    }, 400);
  });
  update();
}
