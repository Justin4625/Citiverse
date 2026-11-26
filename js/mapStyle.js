// The map in game colours, drawn from small files baked out of 3D Rotterdam
// (gemeente Rotterdam, CC BY 4.0) by tools/bake_map.py:
//   overview  data/overview.geojson: water, green and roads of the whole city, coarse
//   detail    the grid cells around the player (js/mapData.js): surfaces with a kind and a level,
//             and building outlines with their height h in metres
// The look is a cartoon city: soft fills with a slightly darker edge line, like an inked drawing,
// buildings that cast a soft shadow on the ground and are lit by one fixed sun.
const C = {
  land: '#b4e6a2',
  plot: '#c4ecb4',
  green: '#86d67f',
  water: '#5ccaf2',
  road: '#fff3c2',
  pavement: '#e8f5cf',
  cycle: '#ffb0a3',
  rail: '#d6cfe9',
  sand: '#ffe6a0',
  building: '#e3d9ff',
  buildingTall: '#c9b7fb',
  sky: '#7fd3f7',
  horizon: '#e2f6ff',
};

// Edge lines: the same colour family, a step darker, so every shape reads without hard black ink.
const EDGE = {
  water: '#2fa6d8',
  green: '#5fbf5c',
  road: '#ead79a',
  cycle: '#f08d80',
  rail: '#b6acd6',
};

export const ATTRIBUTION = '<a href="https://www.3drotterdam.nl/" target="_blank" rel="noopener">3D Rotterdam</a> © Gemeente Rotterdam (CC BY 4.0)';
export const DETAIL_SOURCE = 'detail';
export const NEW_SOURCE = 'detail-new';

// The buildings' paint; `grow` (0..1) raises them out of the ground and fades them in.
export function buildingPaint(grow) {
  return {
    // A stop's landmark (feature-state 'lm', a colour set in map.js) wears its theme tint.
    // Taller blocks are a step deeper lilac, so a busy street still has some variety.
    'fill-extrusion-color': ['case',
      ['==', ['typeof', ['feature-state', 'lm']], 'string'], ['to-color', ['feature-state', 'lm']],
      ['interpolate', ['linear'], ['get', 'h'], 6, C.building, 40, C.buildingTall]],
    // Every block keeps one fixed height once it is there, so nothing changes while you walk or
    // turn. Towers are capped at MAX_HEIGHT, so one high block never fills the screen.
    'fill-extrusion-height': ['*', ['min', ['*', ['get', 'h'], HEIGHT_SCALE], MAX_HEIGHT], grow],
    'fill-extrusion-vertical-gradient': true,
    'fill-extrusion-opacity': Math.max(0.01, Math.min(1, grow * 1.4)),
  };
}

// Drawn bottom to top, so roads lie over pavements and water over everything on the ground.
const KINDS = ['plot', 'pavement', 'sand', 'green', 'rail', 'road', 'cycle', 'water'];
const OVERVIEW_KINDS = ['green', 'road', 'water'];
// A landmark shape on the ground (a bridge deck, a park's grass; feature-state 'lm' set in map.js)
// wears the theme tint of its stop, like a landmark building.
const withLandmark = (colour) => ['case',
  ['==', ['typeof', ['feature-state', 'lm']], 'string'], ['to-color', ['feature-state', 'lm']], colour];
const colourByKind = withLandmark(['match', ['get', 'kind'], ...KINDS.flatMap((kind) => [kind, C[kind]]), C.pavement]);

const fill = (source, kind, filter) => ({
  id: `${source}-${kind}`, type: 'fill', source, filter,
  paint: { 'fill-color': source === DETAIL_SOURCE && kind === 'green' ? withLandmark(C[kind]) : C[kind], 'fill-antialias': false },
});

// Thin edge on the ground shapes. Only from close by: far away the lines would turn into noise.
const edge = (source, kind, filter, minzoom = 15) => ({
  id: `${source}-${kind}-edge`, type: 'line', source, filter, minzoom,
  layout: { 'line-join': 'round' },
  paint: {
    'line-color': EDGE[kind],
    'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 15, 0.8, 18, kind === 'water' ? 3.5 : 2.2],
    'line-opacity': ['interpolate', ['linear'], ['zoom'], minzoom, 0, minzoom + 0.8, 0.9],
  },
});

// Buildings are kept low and soft (about a third of their real height) so the street, the
// stops and the player stay readable, also with a block between the camera and the player.
const HEIGHT_SCALE = 0.35;
const MAX_HEIGHT = 16;
const ground0 = (kind) => ['all', ['==', ['get', 'kind'], kind], ['==', ['get', 'level'], 0]];

export const mapStyle = {
  version: 8,
  sources: {
    // Filled by map.js once the streets around the player are in: the overview is only seen
    // far off under the haze, so it must not hold up the start.
    overview: { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, tolerance: 0.5, maxzoom: 12, attribution: ATTRIBUTION },
    // generateId: a feature's id is its place in the data, so map.js can lower single buildings.
    // maxzoom 14: MapLibre cuts GeoJSON into tiles and only makes a tile when it comes into view.
    // With its default (18) turning the view kept asking for new small tiles, and buildings
    // vanished and popped back while they were made. A z14 tile is ~2.4 km wide, so the few tiles
    // around the player cover everything and are reused while you turn (detail stays ~0.6 m).
    [DETAIL_SOURCE]: { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, tolerance: 0.2, maxzoom: 14, generateId: true },
    [NEW_SOURCE]: { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, tolerance: 0.2, maxzoom: 14 },
  },
  sky: {
    'sky-color': C.sky,
    'horizon-color': C.horizon,
    'sky-horizon-blend': 0.6,
    // The ground fades into the horizon, so far away is a soft haze instead of the whole city.
    'fog-color': C.horizon,
    'fog-ground-blend': 0.35,
    'horizon-fog-blend': 0.8,
  },
  // One sun fixed to the map (from the south-west, fairly high), so the walls keep the same
  // light and shade while the view turns, like a real afternoon.
  light: { anchor: 'map', position: [1.4, 210, 40], color: '#ffffff', intensity: 0.32 },
  layers: [
    { id: 'land', type: 'background', paint: { 'background-color': C.land } },
    ...OVERVIEW_KINDS.map((kind) => fill('overview', kind, ['==', ['get', 'kind'], kind])),
    edge('overview', 'water', ['==', ['get', 'kind'], 'water'], 12),
    ...KINDS.map((kind) => fill(DETAIL_SOURCE, kind, ground0(kind))),
    ...['green', 'rail', 'road', 'cycle', 'water'].map((kind) => edge(DETAIL_SOURCE, kind, ground0(kind))),
    // Bridges and other decks above the ground cover whatever runs underneath.
    {
      id: 'detail-raised', type: 'fill', source: DETAIL_SOURCE, filter: ['>', ['get', 'level'], 0],
      paint: { 'fill-color': colourByKind, 'fill-antialias': false },
    },
    {
      id: 'detail-raised-edge', type: 'line', source: DETAIL_SOURCE, filter: ['>', ['get', 'level'], 0], minzoom: 15,
      paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 15, 0.8, 18, 2.5], 'line-opacity': 0.8 },
    },
    // A soft shadow on the ground, away from the sun, so the blocks stand on the street instead
    // of floating above it.
    {
      id: 'building-shadow', type: 'fill', source: DETAIL_SOURCE, filter: ['has', 'h'], minzoom: 14.5,
      paint: {
        'fill-color': '#5b4d9c',
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14.5, 0, 15.5, 0.16],
        'fill-translate': [5, 7],
        'fill-translate-anchor': 'map',
        'fill-antialias': false,
      },
    },
    {
      id: 'buildings', type: 'fill-extrusion', source: DETAIL_SOURCE, filter: ['has', 'h'],
      paint: buildingPaint(1),
    },
    // Buildings of cells that just arrived (js/mapData.js) rise out of the ground here before
    // they join the others.
    {
      id: 'buildings-new', type: 'fill-extrusion', source: NEW_SOURCE, filter: ['has', 'h'],
      paint: buildingPaint(0),
    },
  ],
};
