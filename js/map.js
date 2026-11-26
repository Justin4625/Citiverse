import { mapStyle, DETAIL_SOURCE, NEW_SOURCE, buildingPaint } from './mapStyle.js';
import { loadIndex, keepDetailLoaded, prefetch } from './mapData.js';
import { stopElement, setStopState, playerElement, setPlayerThemes, setPlayerWalking, setPlayerBearing } from './markers.js';
import { distanceM } from './geo.js';
import { THEMES, themeOf, buddyUrl, themeVars } from './brand.js';

// Pokémon-Go camera: always on the player, tilted, close by. You can zoom a little and turn the
// view by swiping sideways, but not pan away, so you only see what is around you.
const PLAY_ZOOM = 17.4;
// 56 instead of 60: the view looks a bit more down, so the horizon is closer and the far,
// empty part of the map takes less of the screen.
const PLAY_PITCH = 56;
const MIN_PLAY_ZOOM = 16.2;
const MAX_PLAY_ZOOM = 18.8;
// The player stands below the middle of the screen, so you see more of what lies ahead.
const PLAYER_OFFSET = 0.28;
// Turning: closer to the player than DEAD_PX the finger's angle is too jumpy to use. After a
// flick the spin fades out over about SPIN_FADE_MS, measured over the last SPIN_SAMPLE_MS of
// the gesture and capped at MAX_SPIN degrees per ms. More than TAP_TURN degrees is no tap.
const DEAD_PX = 36;
const SPIN_FADE_MS = 320;
const SPIN_SAMPLE_MS = 90;
const MAX_SPIN = 0.9;
const MIN_SPIN = 0.003;
const TAP_TURN = 4;
// A second finger this soon after the first makes it a pinch, not a turn.
const PINCH_LAND_MS = 400;
// Stops further away than this are hidden; the nearby list shows them all.
const VIEW_M = 1500;
// Where the camera waits until the first position is known.
const START = { lat: 51.9225, lng: 4.4792 };
// Stops shrink when you zoom out (full size from FULL_ZOOM) and become plain dots below DOT_ZOOM.
const FULL_ZOOM = 15.5;
const MIN_ZOOM_SCALE = 0.4;
const DOT_ZOOM = 13;
// The Twinny walks to a new position instead of jumping, unless it is further than this.
const MAX_WALK_M = 600;
// Stops shrink with distance down to PERSP_MIN, and grow up to PERSP_MAX close by.
const PERSP_MIN = 0.62;
const PERSP_MAX = 1.15;
// The area the map was baked for (BBOX in tools/bake_map.py): the camera stays inside it.
const MAP_BOUNDS = [[4.38, 51.86], [4.60, 51.975]];
// Phones have up to 3 screen pixels per CSS pixel; drawing the tilted 3D map at 3x is more than
// most phones can do smoothly, and 2x looks the same at arm's length.
const MAX_PIXEL_RATIO = 2;
// A landmark point may miss its building's outline by this much.
const LANDMARK_M = 15;
// Buildings with a radius above this (metres) are tinted more softly.
const BIG_LANDMARK_M = 80;
// Stops in the top HORIZON_SHARE of the screen are far off and fade out.
const HORIZON_SHARE = 0.26;
// The edge pointer keeps clear of the top buttons and the GO button (CSS pixels).
const EDGE = { side: 38, top: 150, bottom: 180 };

// The theme colour mixed with white, so landmarks stay in the soft pastel look of the map.
// `base` and `share` let a ground landmark keep some of its own colour: a park stays grassy.
function landmarkColour(id, { colour = 0, base = '#ffffff', share = 0.55 } = {}) {
  const hex = THEMES[themeOf(id)][colour];
  const mix = (i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * share + parseInt(base.slice(i, i + 2), 16) * (1 - share));
  return `rgb(${mix(1)}, ${mix(3)}, ${mix(5)})`;
}
// A bridge deck lies on blue water, so it takes the theme's second colour; grass keeps most of
// its green.
const GROUND_TINT = { deck: { colour: 1 }, green: { base: '#86d67f', share: 0.3 } };

function circlePolygon({ lat, lng }, radiusM, steps = 64) {
  const dLat = radiusM / 111320;
  const dLng = dLat / Math.cos((lat * Math.PI) / 180);
  const ring = Array.from({ length: steps + 1 }, (_, i) => {
    const a = (i / steps) * 2 * Math.PI;
    return [lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)];
  });
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] } };
}

export function createGameMap(container, locations, radiusM) {
  // The map data starts loading right away, while MapLibre is still starting up.
  loadIndex().then((index) => prefetch(index, START)).catch(() => {});
  const map = new maplibregl.Map({
    container,
    style: mapStyle,
    center: [START.lng, START.lat],
    zoom: PLAY_ZOOM,
    pitch: PLAY_PITCH,
    minPitch: PLAY_PITCH,
    maxPitch: PLAY_PITCH,
    minZoom: MIN_PLAY_ZOOM,
    maxZoom: MAX_PLAY_ZOOM,
    maxBounds: MAP_BOUNDS,
    dragPan: false,
    dragRotate: false,
    keyboard: false,
    doubleClickZoom: false,
    pitchWithRotate: false,
    attributionControl: false,
    pixelRatio: Math.min(devicePixelRatio, MAX_PIXEL_RATIO),
  });
  // Zoom always around the player, never towards the finger. Pinching is done by the game itself
  // (below), so it zooms exactly with the fingers and does not shoot on after letting go.
  map.scrollZoom.enable({ around: 'center' });
  map.touchZoomRotate.disable();
  map.touchPitch.disable();
  // The map credits are in the settings menu (index.html, Bronnen).
  // iPhone Safari ignores touch-action: none for pinching and zooms the whole page towards the
  // fingers instead. Its own gesture events and a two-finger touchmove can be cancelled, which
  // keeps the page still so only the map zooms, also when a finger lands on a button.
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
  }
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });

  const keepPlayerLow = () => map.setPadding({ top: map.getContainer().clientHeight * PLAYER_OFFSET * 2, bottom: 0, left: 0, right: 0 });
  keepPlayerLow();
  map.on('resize', keepPlayerLow);

  // One camera loop moves the map once per frame: it follows the player marker and applies the
  // turn. Moving the camera from several places at once (easeTo, setBearing, jumpTo) made it
  // stutter.
  let follow = null; // [lng, lat] the camera should be on
  let zoomBeforeFocus = null;
  let unfocusTimer = 0;
  let focusing = false; // while the camera flies to a stop (focusStop), the loop leaves it alone
  let followMoved = false;
  let bearing = map.getBearing();
  let bearingMoved = false;
  let spin = 0; // degrees per ms the view keeps turning after the finger lets go
  let lastFrame = performance.now();
  let zoom = null; // set by a pinch, applied by the loop
  const fingers = new Map(); // pointerId -> { x, y }
  let grab = null; // the one finger that is turning the view
  let pinch = null; // { startDist, startZoom } while two fingers are down
  // jumpTo stops a running mouse-wheel zoom, so the loop waits for that to finish.
  const wheeling = () => map.isZooming() && !pinch;
  function cameraLoop(now) {
    const dt = Math.min(now - lastFrame, 50);
    lastFrame = now;
    if (!wheeling() && !focusing) {
      if (spin && !grab) {
        bearing += spin * dt;
        spin *= Math.exp(-dt / SPIN_FADE_MS);
        if (Math.abs(spin) < MIN_SPIN) spin = 0;
        bearingMoved = true;
      }
      if (bearingMoved || followMoved || zoom !== null) {
        const camera = follow ? { center: follow, bearing } : { bearing };
        if (zoom !== null) camera.zoom = zoom;
        map.jumpTo(camera);
        bearingMoved = false;
        followMoved = false;
        zoom = null;
      }
    }
    requestAnimationFrame(cameraLoop);
  }
  requestAnimationFrame(cameraLoop);

  // Turning works like Pokémon GO: put one finger on the map and move it around the player, and
  // the world turns with it, as if you hold the ground and spin it. The turn is the change of the
  // finger's angle around the player, so a full circle turns the view a full circle and the
  // ground stays under the finger. Letting go while moving spins on and slows down.
  // Two fingers are a pinch zoom around the player: the zoom follows the distance between the
  // fingers, so pinching back to where you started brings back the same view.
  let swipedAt = 0; // a turn is not a tap, so it must not walk the player there
  const canvas = map.getCanvasContainer();
  function fingerAround(e) {
    const box = canvas.getBoundingClientRect();
    const p = map.project(follow ?? map.getCenter());
    const x = e.clientX - box.left - p.x;
    const y = e.clientY - box.top - p.y;
    return { angle: (Math.atan2(y, x) * 180) / Math.PI, r: Math.hypot(x, y) };
  }
  canvas.addEventListener('pointerdown', (e) => {
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    spin = 0;
    if (fingers.size === 1) {
      grab = { id: e.pointerId, angle: fingerAround(e).angle, turned: 0, moves: [], at: performance.now(), bearing };
      return;
    }
    // The second finger of a pinch: two fingers never land at the same moment, so undo the
    // little turn the first one made on its own just before.
    if (grab && performance.now() - grab.at < PINCH_LAND_MS) {
      bearing = grab.bearing;
      bearingMoved = true;
    }
    grab = null;
    pinch = fingers.size === 2 ? { startDist: fingerDistance(), startZoom: map.getZoom() } : null;
  });
  function fingerDistance() {
    const [a, b] = [...fingers.values()];
    return Math.max(Math.hypot(a.x - b.x, a.y - b.y), 1);
  }
  canvas.addEventListener('pointermove', (e) => {
    if (!fingers.has(e.pointerId)) return;
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch) {
      const z = pinch.startZoom + Math.log2(fingerDistance() / pinch.startDist);
      zoom = Math.max(MIN_PLAY_ZOOM, Math.min(MAX_PLAY_ZOOM, z));
      return;
    }
    if (!grab || e.pointerId !== grab.id) return;
    const { angle, r } = fingerAround(e);
    const d = ((angle - grab.angle + 540) % 360) - 180; // shortest way, so -179 to 179 is 2 degrees
    grab.angle = angle;
    // Right next to the player the angle swings wildly with tiny moves: hold still there.
    if (r < DEAD_PX) return;
    bearing -= d;
    bearingMoved = true;
    grab.turned += Math.abs(d);
    if (grab.turned > TAP_TURN) swipedAt = performance.now();
    const now = performance.now();
    grab.moves.push({ t: now, d, dt: now - (grab.lastMove ?? now - 16) });
    grab.lastMove = now;
    while (grab.moves.length > 1 && now - grab.moves[0].t > SPIN_SAMPLE_MS) grab.moves.shift();
  });
  const lift = (e) => {
    fingers.delete(e.pointerId);
    // The finger that stays after a pinch neither zooms nor turns until it is lifted too.
    if (fingers.size < 2) pinch = null;
    if (!grab || e.pointerId !== grab.id) return;
    const now = performance.now();
    // Only a finger that was still moving when it let go flicks the view on, at the speed of
    // its last moves (degrees turned over the time they took).
    const { moves } = grab;
    if (e.type === 'pointerup' && moves.length && now - moves[moves.length - 1].t < SPIN_SAMPLE_MS) {
      const turned = moves.reduce((sum, m) => sum + m.d, 0);
      const took = moves.reduce((sum, m) => sum + m.dt, 0) + (now - moves[moves.length - 1].t);
      spin = Math.max(-MAX_SPIN, Math.min(MAX_SPIN, -turned / Math.max(took, 16)));
    }
    grab = null;
  };
  canvas.addEventListener('pointerup', lift);
  canvas.addEventListener('pointercancel', lift);

  function scaleStops() {
    const zoom = map.getZoom();
    const scale = Math.min(1, Math.max(MIN_ZOOM_SCALE, 1 - (FULL_ZOOM - zoom) * 0.2));
    const el = map.getContainer();
    el.style.setProperty('--stop-scale', scale.toFixed(3));
    el.classList.toggle('stops--dots', zoom < DOT_ZOOM);
    el.classList.toggle('stops--small', zoom < FULL_ZOOM - 0.5);
  }
  map.on('zoom', scaleStops);
  scaleStops();

  // Stops further away on the tilted map are drawn smaller, as they would be in 3D: the scale is
  // how many metres 20 screen pixels cover at the middle, against at the stop.
  function metresPer20px(point) {
    const a = map.unproject(point);
    const b = map.unproject([point.x + 20, point.y]);
    return distanceM({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng });
  }
  function perspectiveStops() {
    const centre = metresPer20px(map.project(map.getCenter()));
    for (const loc of locations) {
      const el = stops.get(loc.id);
      if (!el || el.hidden) continue;
      const point = map.project([loc.lng, loc.lat]);
      const here = point.y > 0 ? metresPer20px(point) : Infinity;
      const persp = Math.max(PERSP_MIN, Math.min(PERSP_MAX, centre / here));
      el.style.setProperty('--persp', persp.toFixed(3));
      // Up near the horizon a stop is a tiny, unreadable pin among the top buttons: it fades
      // out there, and the pointer at the screen edge shows the way instead.
      el.classList.toggle('stop--horizon', point.y < map.getContainer().clientHeight * HORIZON_SHARE);
    }
  }
  map.on('move', perspectiveStops);

  let loaded = false;
  let pendingPlayer = null;
  let pendingRoute = null;
  let routeTarget = null; // stop id of the route, always shown however far away
  let lastPos = null;
  let playerMarker = null;
  const playerEl = playerElement();
  // The light on the Twinny turns with the view (twinny3d.js setBearing).
  map.on('rotate', () => setPlayerBearing(playerEl, map.getBearing()));

  map.on('load', () => {
    loaded = true;
    map.addSource('reach', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'reach-fill', type: 'fill', source: 'reach', paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.25 } }, 'buildings');
    map.addLayer({ id: 'reach-line', type: 'line', source: 'reach', paint: { 'line-color': '#ffffff', 'line-width': 3, 'line-opacity': 0.9 } }, 'buildings');
    map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    const lineLayout = { 'line-cap': 'round', 'line-join': 'round' };
    // On top of the buildings, so the way stays visible behind a block.
    map.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: lineLayout, paint: { 'line-color': '#ffffff', 'line-width': 14 } });
    map.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: lineLayout, paint: { 'line-color': '#e2457f', 'line-width': 8 } });
    if (pendingRoute) map.getSource('route').setData(pendingRoute);
    if (pendingPlayer) updateReach(pendingPlayer);
    loadStops3D();
    // Without the index only the coarse overview shows; the game itself still works.
    loadIndex()
      .then((index) => keepDetailLoaded(map, DETAIL_SOURCE, NEW_SOURCE, index, {
        around: () => playerMarker?.getLngLat() ?? map.getCenter(),
        grow: (g) => {
          const paint = buildingPaint(g);
          map.setPaintProperty('buildings-new', 'fill-extrusion-height', paint['fill-extrusion-height']);
          map.setPaintProperty('buildings-new', 'fill-extrusion-opacity', paint['fill-extrusion-opacity']);
        },
        prepare: tintLandmarks,
        onData: () => {
          if (!overviewLoaded) {
            overviewLoaded = true;
            setTimeout(() => map.getSource('overview').setData('data/overview.geojson'), 1500);
          }
        },
      }))
      .catch(console.warn);
  });

  let overviewLoaded = false;
  // Metres from (0, 0) to the segment a-b, all in metres.
  function segmentDistance(ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(ax + t * dx, ay + t * dy);
  }
  // Metres from pos to the nearest edge of a building (0 inside it), or Infinity when its first
  // corner is already further than `within` (a quick skip for the far ones).
  function buildingDistance(pos, rings, within) {
    const mLat = 111320;
    const mLng = mLat * Math.cos((pos.lat * Math.PI) / 180);
    let d = Infinity;
    for (const ring of rings) {
      if (Math.abs(ring[0][1] - pos.lat) * mLat > within + 400) continue;
      let inside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const ax = (ring[j][0] - pos.lng) * mLng;
        const ay = (ring[j][1] - pos.lat) * mLat;
        const bx = (ring[i][0] - pos.lng) * mLng;
        const by = (ring[i][1] - pos.lat) * mLat;
        d = Math.min(d, segmentDistance(ax, ay, bx, by));
        if ((ay > 0) !== (by > 0) && 0 < ((bx - ax) * -ay) / (by - ay) + ax) inside = !inside;
      }
      if (inside) d = 0;
    }
    return d;
  }
  // The landmark of each stop is painted in a light tint of the stop's theme, so Markthal or
  // Centraal stand out from the lilac city: the building its landmark point lies in, or for a
  // bridge or a park the deck or grass at its `ground` points (see locations.js). The colour is
  // written once into the feature itself (property lm, read by mapStyle.js), so it can never
  // blink off when new map cells arrive. Each feature is checked only once.
  const tinted = new WeakSet();
  function tintLandmarks(features) {
    for (const f of features) {
      if (tinted.has(f)) continue;
      tinted.add(f);
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      const rings = polys.map((p) => p[0]);
      if (f.properties.h) {
        for (const loc of locations) {
          if (!loc.landmark) continue;
          const [lat, lng] = loc.landmark;
          if (buildingDistance({ lat, lng }, rings, 0) > 0) continue;
          // A huge building (Centraal) gets a softer tint, so it doesn't fill the screen.
          const pts = rings.flat();
          const c = { lng: pts.reduce((a, q) => a + q[0], 0) / pts.length, lat: pts.reduce((a, q) => a + q[1], 0) / pts.length };
          const r = Math.max(...pts.map((q) => distanceM(c, { lng: q[0], lat: q[1] })));
          f.properties.lm = landmarkColour(loc.id, { share: r > BIG_LANDMARK_M ? 0.25 : 0.55 });
        }
        continue;
      }
      const { kind, level } = f.properties;
      const on = level > 0 ? 'deck' : kind === 'green' ? 'green' : null;
      if (!on) continue;
      for (const loc of locations) {
        if (loc.ground?.on !== on) continue;
        if (loc.ground.at.some(([lat, lng]) => buildingDistance({ lat, lng }, rings, LANDMARK_M) <= LANDMARK_M)) {
          f.properties.lm = landmarkColour(loc.id, GROUND_TINT[on]);
        }
      }
    }
  }



  function updateReach(pos) {
    map.getSource('reach').setData(circlePolygon(pos, radiusM));
  }

  // The stops are 3D models inside the map (stops3d.js). Only when Three.js or WebGL is not
  // available they fall back to the flat HTML markers (markers.js) in `stops`.
  const stops = new Map();
  let stops3d = null;
  let stopTap = () => {};
  function useFlatStops() {
    for (const loc of locations) {
      const el = stopElement(loc);
      new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([loc.lng, loc.lat]).addTo(map);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        stopTap(loc.id);
      });
      if (states.has(loc.id)) setStopState(el, states.get(loc.id));
      stops.set(loc.id, el);
    }
    if (lastPos) showNearbyStops(lastPos);
    perspectiveStops();
  }
  function loadStops3D() {
    import('./stops3d.js')
      .then(({ createStops3D }) => {
        stops3d = createStops3D(map, locations, { origin: START, onFrame: updatePointer, player: () => playerMarker?.getLngLat() });
        map.addLayer(stops3d.layer);
        for (const [id, state] of states) stops3d.setState(id, state);
        if (lastPos) showNearbyStops(lastPos);
      })
      .catch((err) => {
        console.warn('3D stops unavailable, using flat markers', err);
        useFlatStops();
      });
  }
  // A tap on a 3D stop; true when it hit one.
  function tapStop3D(point) {
    const id = stops3d?.hitTest(point);
    if (id) stopTap(id);
    return Boolean(id);
  }
  map.on('click', (e) => {
    if (performance.now() - swipedAt < 400) return;
    tapStop3D(e.point);
  });

  // ---------- Pointer to the next stop ----------
  // When the stop you still have to do that is nearest (or the stop of your route) is not on
  // screen, a Buddy face at the screen edge points the way, with the distance. Tap it for a route.
  const states = new Map();
  const pointer = document.createElement('button');
  pointer.className = 'pointer';
  pointer.hidden = true;
  pointer.innerHTML = '<span class="pointer__arrow" aria-hidden="true"></span><img class="pointer__buddy" alt="" draggable="false"><b class="pointer__dist"></b>';
  document.body.append(pointer);
  let pointerId = null;
  let pointerTap = () => {};
  pointer.addEventListener('click', () => pointerId && pointerTap(pointerId));

  function bearingTo(a, b) {
    const r = Math.PI / 180;
    const y = Math.sin((b.lng - a.lng) * r) * Math.cos(b.lat * r);
    const x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lng - a.lng) * r);
    return Math.atan2(y, x) / r;
  }
  const shortDistance = (m) => (m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`);

  function updatePointer() {
    if (!playerMarker) return;
    const { lat, lng } = playerMarker.getLngLat();
    const here = { lat, lng };
    let target = routeTarget && locations.find((l) => l.id === routeTarget);
    if (!target) {
      let best = Infinity;
      for (const loc of locations) {
        if (states.get(loc.id) === 'done') continue;
        const d = distanceM(here, loc);
        if (d < best) [best, target] = [d, loc];
      }
    }
    const { clientWidth: w, clientHeight: h } = map.getContainer();
    let onScreen = false;
    if (target && stops3d) {
      const point = stops3d.screenPoint(target.id);
      onScreen = stops3d.isShown(target.id) && point && point.x > 0 && point.x < w && point.y > EDGE.top && point.y < h;
    } else if (target && stops.has(target.id)) {
      const el = stops.get(target.id);
      const point = map.project([target.lng, target.lat]);
      onScreen = !el.hidden && !el.classList.contains('stop--horizon') && point.x > 0 && point.x < w && point.y > EDGE.top && point.y < h;
    }
    pointer.hidden = !target || onScreen;
    if (pointer.hidden) return;
    if (target.id !== pointerId) {
      pointerId = target.id;
      pointer.querySelector('img').src = buddyUrl(target.id);
      pointer.setAttribute('style', themeVars(target.id));
      pointer.setAttribute('aria-label', `Route naar ${target.name}`);
    }
    pointer.querySelector('b').textContent = shortDistance(distanceM(here, target));
    // From the player's spot on screen, in the stop's direction (up = the way the view looks),
    // to where that line leaves the free part of the screen.
    const angle = ((bearingTo(here, target) - map.getBearing()) * Math.PI) / 180;
    const dx = Math.sin(angle);
    const dy = -Math.cos(angle);
    const o = map.project([lng, lat]);
    const ox = Math.max(EDGE.side, Math.min(w - EDGE.side, o.x));
    const oy = Math.max(EDGE.top, Math.min(h - EDGE.bottom, o.y));
    let t = Infinity;
    if (dx > 1e-6) t = Math.min(t, (w - EDGE.side - ox) / dx);
    if (dx < -1e-6) t = Math.min(t, (EDGE.side - ox) / dx);
    if (dy < -1e-6) t = Math.min(t, (EDGE.top - oy) / dy);
    let x = ox + dx * t;
    let y = oy + dy * t;
    // A stop behind you would put the pointer at the bottom, on the player and the GO button:
    // it goes to the lower corner on that side instead.
    if (dy > 0 && (!Number.isFinite(t) || y > h - EDGE.bottom)) {
      x = dx < 0 ? EDGE.side : w - EDGE.side;
      y = h - EDGE.bottom;
    }
    pointer.style.translate = `${x}px ${y}px`;
    pointer.style.setProperty('--angle', `${angle}rad`);
  }
  map.on('move', updatePointer);


  function followTo(lngLat) {
    follow = lngLat;
    followMoved = true;
  }

  function showNearbyStops(pos) {
    lastPos = pos;
    for (const loc of locations) {
      const shown = loc.id === routeTarget || distanceM(pos, loc) <= VIEW_M;
      stops3d?.setShown(loc.id, shown);
      if (stops.has(loc.id)) stops.get(loc.id).hidden = !shown;
    }
  }

  let walk = 0; // id of the running walk, so a newer position cancels the old one

  // Moves the player marker to `pos` over time while the Twinny plays its walk cycle, turned
  // towards where it is going on screen. Far jumps (teleport in test mode) skip the walk.
  function walkTo(pos, keepOnPlayer) {
    const from = playerMarker.getLngLat();
    const start = { lat: from.lat, lng: from.lng };
    const dist = distanceM(start, pos);
    const id = ++walk;
    if (dist < 1 || dist > MAX_WALK_M) {
      playerMarker.setLngLat([pos.lng, pos.lat]);
      setPlayerWalking(playerEl, false);
      if (keepOnPlayer) followTo([pos.lng, pos.lat]);
      if (loaded) updateReach(pos);
      showNearbyStops(pos);
      return;
    }
    const duration = Math.min(Math.max(dist * 15, 500), 2500);
    const a = map.project([start.lng, start.lat]);
    const b = map.project([pos.lng, pos.lat]);
    setPlayerWalking(playerEl, true, Math.atan2(b.x - a.x, b.y - a.y));
    showNearbyStops(pos);
    const t0 = performance.now();
    const step = (now) => {
      if (id !== walk) return;
      const t = Math.min((now - t0) / duration, 1);
      const here = { lat: start.lat + (pos.lat - start.lat) * t, lng: start.lng + (pos.lng - start.lng) * t };
      playerMarker.setLngLat([here.lng, here.lat]);
      // The camera loop picks this up in the same frame.
      if (keepOnPlayer) followTo([here.lng, here.lat]);
      if (loaded) updateReach(here);
      if (t < 1) requestAnimationFrame(step);
      else setPlayerWalking(playerEl, false);
    };
    requestAnimationFrame(step);
  }

  return {
    setPlayer(pos, { follow: keepOnPlayer = true } = {}) {
      const lngLat = [pos.lng, pos.lat];
      if (!playerMarker) {
        playerMarker = new maplibregl.Marker({ element: playerEl, anchor: 'bottom' }).setLngLat(lngLat).addTo(map);
        followTo(lngLat);
        showNearbyStops(pos);
      } else {
        walkTo(pos, keepOnPlayer);
        return;
      }
      if (loaded) updateReach(pos);
      else pendingPlayer = pos;
    },

    // The walking route as [lng, lat] points, or null to remove it.
    showRoute(line, targetId = null) {
      routeTarget = line ? targetId : null;
      const data = { type: 'FeatureCollection', features: line ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: line } }] : [] };
      if (loaded) map.getSource('route').setData(data);
      else pendingRoute = data;
      if (lastPos) showNearbyStops(lastPos);
      updatePointer();
    },

    // Themes of the collected stamps, so the Twinny wears their colours.
    setPlayerThemes(themes) {
      setPlayerThemes(playerEl, themes);
    },

    setStopStates(stateById) {
      for (const [id, state] of Object.entries(stateById)) {
        if (stops.has(id)) setStopState(stops.get(id), state);
        stops3d?.setState(id, state);
        states.set(id, state);
      }
      updatePointer();
    },

    // Flies the camera close to a stop (a menu then grows out of it). Resolves with the stop's
    // place on screen once there. unfocus() flies back to the player.
    focusStop(id, ms = 560) {
      const loc = locations.find((l) => l.id === id);
      if (!loc || matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve(this.stopScreenPoint(id));
      // A second tap while the camera is still out on a stop keeps the zoom from before the first.
      if (!focusing) zoomBeforeFocus = map.getZoom();
      clearTimeout(unfocusTimer);
      focusing = true;
      map.stop();
      map.easeTo({ center: [loc.lng, loc.lat], zoom: Math.min(MAX_PLAY_ZOOM + 0.6, map.getZoom() + 1.4), duration: ms, easing: (t) => 1 - (1 - t) ** 3 });
      return new Promise((resolve) => setTimeout(() => resolve(this.stopScreenPoint(id)), ms));
    },
    unfocus(ms = 520) {
      if (!focusing) return;
      const back = follow ?? map.getCenter().toArray();
      map.easeTo({ center: back, zoom: zoomBeforeFocus ?? PLAY_ZOOM, bearing, duration: ms, easing: (t) => 1 - (1 - t) ** 3 });
      clearTimeout(unfocusTimer);
      unfocusTimer = setTimeout(() => {
        focusing = false;
        followMoved = true;
      }, ms);
    },

    // Where a stop is on screen (CSS pixels), e.g. for a menu to unfold from.
    stopScreenPoint(id) {
      const loc = locations.find((l) => l.id === id);
      if (!loc) return null;
      return stops3d?.screenPoint(id) ?? map.project([loc.lng, loc.lat]);
    },

    // Tapping the edge pointer: cb(stopId).
    onPointerTap(cb) {
      pointerTap = cb;
    },

    onStopTap(cb) {
      stopTap = cb;
    },

    center() {
      const { lat, lng } = map.getCenter();
      return { lat, lng };
    },

    onMapTap(cb) {
      map.on('click', (e) => {
        if (performance.now() - swipedAt < 400) return;
        if (stops3d?.hitTest(e.point)) return; // that tap was on a stop
        cb({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      });
    },
  };
}
