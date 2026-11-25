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
// Degrees the view turns per pixel of sideways swipe.
const ROTATE_PER_PX = 0.35;
// Stops further away than this are hidden; the nearby list shows them all.
const VIEW_M = 900;
// Where the camera waits until the first position is known.
const START = { lat: 51.9225, lng: 4.4792 };
// Stops shrink when you zoom out (full size from FULL_ZOOM) and become plain dots below DOT_ZOOM.
const FULL_ZOOM = 15.5;
const MIN_ZOOM_SCALE = 0.4;
const DOT_ZOOM = 13;
// The Twinny walks to a new position instead of jumping, unless it is further than this.
const MAX_WALK_M = 600;
// The area the map was baked for (BBOX in tools/bake_map.py): the camera stays inside it.
const MAP_BOUNDS = [[4.38, 51.86], [4.60, 51.975]];

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
    attributionControl: { compact: true },
  });
  // Zoom always around the player, never towards the finger.
  map.scrollZoom.enable({ around: 'center' });
  map.touchZoomRotate.enable({ around: 'center' });
  map.touchZoomRotate.disableRotation();
  map.touchPitch.disable();

  const keepPlayerLow = () => map.setPadding({ top: map.getContainer().clientHeight * PLAYER_OFFSET * 2, bottom: 0, left: 0, right: 0 });
  keepPlayerLow();
  map.on('resize', keepPlayerLow);

  // One finger swiping sideways turns the view around the player. Two fingers are a pinch zoom.
  const fingers = new Map();
  let swipeX = null;
  // A swipe that turned the view is not a tap, so it must not walk the player there.
  let swipedAt = 0;
  const canvas = map.getCanvasContainer();
  canvas.addEventListener('pointerdown', (e) => {
    fingers.set(e.pointerId, e.clientX);
    swipeX = fingers.size === 1 ? e.clientX : null;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (swipeX === null || !fingers.has(e.pointerId)) return;
    if (Math.abs(e.clientX - swipeX) < 2) return;
    map.setBearing(map.getBearing() - (e.clientX - swipeX) * ROTATE_PER_PX);
    swipeX = e.clientX;
    swipedAt = performance.now();
  });
  const lift = (e) => {
    fingers.delete(e.pointerId);
    swipeX = null;
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

  let loaded = false;
  let pendingPlayer = null;
  let playerMarker = null;
  const playerEl = playerElement();

  map.on('load', () => {
    loaded = true;
    map.addSource('reach', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'reach-fill', type: 'fill', source: 'reach', paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.25 } }, 'buildings');
    map.addLayer({ id: 'reach-line', type: 'line', source: 'reach', paint: { 'line-color': '#ffffff', 'line-width': 3, 'line-opacity': 0.9 } }, 'buildings');
    if (pendingPlayer) updateReach(pendingPlayer);
    // Without the index only the coarse overview shows; the game itself still works.
    loadIndex().then((index) => keepDetailLoaded(map, DETAIL_SOURCE, index)).catch(console.warn);
  });

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

  function showNearbyStops(pos) {
    for (const loc of locations) stops.get(loc.id).hidden = distanceM(pos, loc) > VIEW_M;
  }

  let walk = 0; // id of the running walk, so a newer position cancels the old one

  // Moves the player marker to `pos` over time while the Twinny plays its walk cycle, turned
  // towards where it is going on screen. Far jumps (teleport in test mode) skip the walk.
  function walkTo(pos, follow) {
    const from = playerMarker.getLngLat();
    const start = { lat: from.lat, lng: from.lng };
    const dist = distanceM(start, pos);
    const id = ++walk;
    if (dist < 1 || dist > MAX_WALK_M) {
      playerMarker.setLngLat([pos.lng, pos.lat]);
      setPlayerWalking(playerEl, false);
      if (follow) map.jumpTo({ center: [pos.lng, pos.lat] });
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
      // The camera moves with the player frame by frame, so turning the view keeps working.
      if (follow) map.jumpTo({ center: [here.lng, here.lat] });
      if (loaded) updateReach(here);
      if (t < 1) requestAnimationFrame(step);
      else setPlayerWalking(playerEl, false);
    };
    requestAnimationFrame(step);
  }

  return {
    setPlayer(pos, { follow = true } = {}) {
      const lngLat = [pos.lng, pos.lat];
      if (!playerMarker) {
        playerMarker = new maplibregl.Marker({ element: playerEl, anchor: 'bottom' }).setLngLat(lngLat).addTo(map);
        map.jumpTo({ center: lngLat });
        showNearbyStops(pos);
      } else {
        walkTo(pos, follow);
        return;
      }
      if (loaded) updateReach(pos);
      else pendingPlayer = pos;
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
