import { mapStyle } from './mapStyle.js';
import { stopElement, setStopState, playerElement } from './markers.js';

const PLAY_ZOOM = 16.6;
const PLAY_PITCH = 55;

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

  let loaded = false;
  let pendingPlayer = null;
  let playerMarker = null;

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

  return {
    setPlayer(pos, { follow = true } = {}) {
      const lngLat = [pos.lng, pos.lat];
      if (!playerMarker) {
        playerMarker = new maplibregl.Marker({ element: playerElement(), anchor: 'bottom' }).setLngLat(lngLat).addTo(map);
        map.flyTo({ center: lngLat, zoom: PLAY_ZOOM, pitch: PLAY_PITCH, duration: 1500 });
      } else {
        playerMarker.setLngLat(lngLat);
        if (follow) map.easeTo({ center: lngLat, duration: 800 });
      }
      if (loaded) updateReach(pos);
      else pendingPlayer = pos;
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

    onMapTap(cb) {
      map.on('click', (e) => cb({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
    },
  };
}
