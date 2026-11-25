import { mapStyle, DETAIL_SOURCE } from './mapStyle.js';
import { loadIndex, keepDetailLoaded } from './mapData.js';
import { stopElement, setStopState, playerElement, setPlayerThemes, setPlayerWalking } from './markers.js';
import { distanceM } from './geo.js';

// Pokémon-Go camera: always on the player, tilted, close by. You can zoom a little and turn the
// view by swiping sideways, but not pan away, so you only see what is around you.
const PLAY_ZOOM = 17.4;
const PLAY_PITCH = 60;
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
// Buildings closer to the player than LOW_NEAR_M are lowered to LOW_MIN of their height,
// rising smoothly to full height at LOW_FAR_M. The camera looks down at only 30 degrees, so a
// tall block between it and the player would hide the street the player walks on and make the
// figure seem to float on its roof.
const LOW_NEAR_M = 25;
const LOW_FAR_M = 85;
const LOW_MIN = 0.06;
// Stops shrink with distance down to PERSP_MIN, and grow up to PERSP_MAX close by.
const PERSP_MIN = 0.62;
const PERSP_MAX = 1.15;
// The area the map was baked for (BBOX in tools/bake_map.py): the camera stays inside it.
const MAP_BOUNDS = [[4.38, 51.86], [4.60, 51.975]];
// Phones have up to 3 screen pixels per CSS pixel; drawing the tilted 3D map at 3x is more than
// most phones can do smoothly, and 2x looks the same at arm's length.
const MAX_PIXEL_RATIO = 2;

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
    if (!wheeling()) {
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
      if (el.hidden) continue;
      const point = map.project([loc.lng, loc.lat]);
      const here = point.y > 0 ? metresPer20px(point) : Infinity;
      const persp = Math.max(PERSP_MIN, Math.min(PERSP_MAX, centre / here));
      el.style.setProperty('--persp', persp.toFixed(3));
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
    if (lowerPos) lowerAround(lowerPos);
    // Without the index only the coarse overview shows; the game itself still works.
    loadIndex().then((index) => keepDetailLoaded(map, DETAIL_SOURCE, index, setBuildings)).catch(console.warn);
  });

  // Buildings of the detail data as outer rings, with their map id (see mapData.js).
  let buildings = [];
  const lowered = new Map(); // id -> k currently set
  let lowerPos = null;
  function setBuildings(features) {
    buildings = [];
    features.forEach((f, id) => {
      if (!f.properties.h) return;
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      buildings.push({ id, rings: polys.map((p) => p[0]) });
    });
    // New data means new ids: start over.
    map.removeFeatureState({ source: DETAIL_SOURCE });
    lowered.clear();
    if (lowerPos) lowerAround(lowerPos);
  }
  // Metres from (0, 0) to the segment a-b, all in metres.
  function segmentDistance(ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(ax + t * dx, ay + t * dy);
  }
  function lowerAround(pos) {
    lowerPos = pos;
    if (!loaded || !buildings.length) return;
    const mLat = 111320;
    const mLng = mLat * Math.cos((pos.lat * Math.PI) / 180);
    for (const { id, rings } of buildings) {
      let d = Infinity;
      for (const ring of rings) {
        // Quick skip: a building whose first corner is far away cannot be near.
        if (Math.abs(ring[0][1] - pos.lat) * mLat > LOW_FAR_M + 400) continue;
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
      const t = Math.max(0, Math.min(1, (d - LOW_NEAR_M) / (LOW_FAR_M - LOW_NEAR_M)));
      const k = +(LOW_MIN + (1 - LOW_MIN) * t * t * (3 - 2 * t)).toFixed(2);
      const was = lowered.get(id) ?? 1;
      if (k === was) continue;
      map.setFeatureState({ source: DETAIL_SOURCE, id }, { k });
      if (k === 1) lowered.delete(id);
      else lowered.set(id, k);
    }
  }
  // While walking, often enough to look smooth, not every frame.
  let lowerAt = 0;
  function lowerAroundSoon(pos, now = performance.now()) {
    if (now - lowerAt < 120) return;
    lowerAt = now;
    lowerAround(pos);
  }

  function updateReach(pos) {
    map.getSource('reach').setData(circlePolygon(pos, radiusM));
  }

  const stops = new Map(
    locations.map((loc) => {
      const el = stopElement(loc);
      new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([loc.lng, loc.lat]).addTo(map);
      return [loc.id, el];
    }),
  );

  function followTo(lngLat) {
    follow = lngLat;
    followMoved = true;
  }

  function showNearbyStops(pos) {
    lastPos = pos;
    for (const loc of locations) stops.get(loc.id).hidden = loc.id !== routeTarget && distanceM(pos, loc) > VIEW_M;
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
      lowerAround(pos);
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
      if (t < 1) lowerAroundSoon(here, now);
      else lowerAround(here);
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
        lowerAround(pos);
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
    },

    // Themes of the collected stamps, so the Twinny wears their colours.
    setPlayerThemes(themes) {
      setPlayerThemes(playerEl, themes);
    },

    setStopStates(stateById) {
      for (const [id, state] of Object.entries(stateById)) setStopState(stops.get(id), state);
    },

    onStopTap(cb) {
      for (const [id, el] of stops) {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          cb(id);
        });
      }
    },

    center() {
      const { lat, lng } = map.getCenter();
      return { lat, lng };
    },

    onMapTap(cb) {
      map.on('click', (e) => {
        if (performance.now() - swipedAt < 400) return;
        cb({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      });
    },
  };
}
