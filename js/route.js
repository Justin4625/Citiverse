import { distanceM } from './geo.js';

// Walking routes from the OpenStreetMap walking router of FOSSGIS (routing.openstreetmap.de,
// free, no key, data © OpenStreetMap). Only the start and end point are sent, rounded to about
// 10 m. Without a connection the route falls back to a straight line.
const ROUTER = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot';
// About 5 km/h.
const M_PER_MIN = 83;

const round = (n) => n.toFixed(4);

const TURN = {
  left: 'linksaf',
  right: 'rechtsaf',
  'slight left': 'flauw linksaf',
  'slight right': 'flauw rechtsaf',
  'sharp left': 'scherp linksaf',
  'sharp right': 'scherp rechtsaf',
  straight: 'rechtdoor',
  uturn: 'omdraaien',
};

function stepText({ maneuver, name }) {
  if (maneuver.type === 'roundabout' || maneuver.type === 'rotary') return 'Neem de rotonde';
  const turn = TURN[maneuver.modifier] ?? 'rechtdoor';
  const verb = turn === 'rechtdoor' || turn === 'omdraaien' ? turn : `ga ${turn}`;
  const text = verb[0].toUpperCase() + verb.slice(1);
  return name ? `${text}, ${name}` : text;
}

// Index of the route point closest to `pos`, with the distance to it.
function closest(coords, pos) {
  let best = 0;
  let bestM = Infinity;
  coords.forEach(([lng, lat], i) => {
    const m = distanceM(pos, { lat, lng });
    if (m < bestM) [best, bestM] = [i, m];
  });
  return { index: best, m: bestM };
}

export async function fetchRoute(from, to) {
  const url = `${ROUTER}/${round(from.lng)},${round(from.lat)};${round(to.lng)},${round(to.lat)}?overview=full&geometries=geojson&steps=true`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.code !== 'Ok') throw new Error(data.code);
    const coords = data.routes[0].geometry.coordinates;
    const steps = data.routes[0].legs[0].steps
      .filter((s) => !['depart', 'arrive'].includes(s.maneuver.type))
      .map((s) => {
        const [lng, lat] = s.maneuver.location;
        return { index: closest(coords, { lat, lng }).index, text: stepText(s) };
      });
    return { coords: [...coords, [to.lng, to.lat]], steps };
  } catch {
    return { coords: [[from.lng, from.lat], [to.lng, to.lat]], steps: [] };
  }
}

// What is left of the route from `pos`: the line still to walk, metres, and the next turn.
export function progressOn(route, pos) {
  const { index, m: offRouteM } = closest(route.coords, pos);
  const rest = [[pos.lng, pos.lat], ...route.coords.slice(index + 1)];
  let metres = 0;
  for (let i = 1; i < rest.length; i++) {
    metres += distanceM({ lng: rest[i - 1][0], lat: rest[i - 1][1] }, { lng: rest[i][0], lat: rest[i][1] });
  }
  const next = route.steps.find((s) => s.index > index);
  let nextM = null;
  if (next) {
    const [lng, lat] = route.coords[next.index];
    nextM = distanceM(pos, { lat, lng });
  }
  return { line: rest, metres, minutes: Math.max(1, Math.ceil(metres / M_PER_MIN)), next, nextM, offRouteM };
}
