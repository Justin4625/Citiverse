import { mapStyle } from './mapStyle.js';
import { stopElement, setStopState, playerElement, setPlayerThemes, setPlayerWalking } from './markers.js';
import { distanceM } from './geo.js';

const PLAY_ZOOM = 16.6;
const PLAY_PITCH = 55;
// Stops shrink when you zoom out (full size from FULL_ZOOM) and become plain dots below DOT_ZOOM.
const FULL_ZOOM = 15.5;
const MIN_ZOOM_SCALE = 0.4;
const DOT_ZOOM = 13;
// The Twinny walks to a new position instead of jumping, unless it is further than this.
const MAX_WALK_M = 600;

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
  const bounds = locations.reduce(
    (b, loc) => b.extend([loc.lng, loc.lat]),
    new maplibregl.LngLatBounds([locations[0].lng, locations[0].lat], [locations[0].lng, locations[0].lat]),
  );
  const map = new maplibregl.Map({
    container,
    style: mapStyle,
    bounds,
    fitBoundsOptions: { padding: { top: 120, bottom: 140, left: 50, right: 50 } },
    maxPitch: 60,
    attributionControl: { compact: true },
  });
  map.setPitch(40);

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
      if (follow) map.easeTo({ center: [pos.lng, pos.lat], duration: 800 });
      if (loaded) updateReach(pos);
      return;
    }
    const duration = Math.min(Math.max(dist * 15, 500), 2500);
    const a = map.project([start.lng, start.lat]);
    const b = map.project([pos.lng, pos.lat]);
    setPlayerWalking(playerEl, true, Math.atan2(b.x - a.x, b.y - a.y));
    if (follow) map.easeTo({ center: [pos.lng, pos.lat], duration, easing: (t) => t });
    const t0 = performance.now();
    const step = (now) => {
      if (id !== walk) return;
      const t = Math.min((now - t0) / duration, 1);
      const here = { lat: start.lat + (pos.lat - start.lat) * t, lng: start.lng + (pos.lng - start.lng) * t };
      playerMarker.setLngLat([here.lng, here.lat]);
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
        map.flyTo({ center: lngLat, zoom: PLAY_ZOOM, pitch: PLAY_PITCH, duration: 1500 });
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
      map.on('click', (e) => cb({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
    },
  };
}
