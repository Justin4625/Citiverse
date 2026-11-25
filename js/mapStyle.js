// The map in game colours, drawn from small files baked out of 3D Rotterdam
// (gemeente Rotterdam, CC BY 4.0) by tools/bake_map.py:
//   overview  data/overview.geojson: water, green and roads of the whole city, coarse
//   detail    the grid cells around the player (js/mapData.js): surfaces with a kind and a level,
//             and building outlines with their height h in metres
const C = {
  land: '#b6e7a8',
  plot: '#c6edb9',
  green: '#8fd98a',
  water: '#63cdf0',
  road: '#fff6c9',
  pavement: '#e9f6d2',
  cycle: '#ffb3a7',
  rail: '#d9d3ea',
  sand: '#ffe9a8',
  building: '#dccfff',
  sky: '#7fd3f7',
  horizon: '#dff6ff',
};

export const ATTRIBUTION = '<a href="https://www.3drotterdam.nl/" target="_blank" rel="noopener">3D Rotterdam</a> © Gemeente Rotterdam (CC BY 4.0)';
export const DETAIL_SOURCE = 'detail';

// Drawn bottom to top, so roads lie over pavements and water over everything on the ground.
const KINDS = ['plot', 'pavement', 'sand', 'green', 'rail', 'road', 'cycle', 'water'];
const OVERVIEW_KINDS = ['green', 'road', 'water'];
const colourByKind = ['match', ['get', 'kind'], ...KINDS.flatMap((kind) => [kind, C[kind]]), C.pavement];

const fill = (source, kind, filter) => ({
  id: `${source}-${kind}`, type: 'fill', source, filter,
  paint: { 'fill-color': C[kind], 'fill-antialias': false },
});

// Buildings are kept low and soft so stops and the player stay readable.
const HEIGHT_SCALE = 0.5;

export const mapStyle = {
  version: 8,
  sources: {
    overview: { type: 'geojson', data: 'data/overview.geojson', tolerance: 0.5, attribution: ATTRIBUTION },
    // generateId: a feature's id is its place in the data, so map.js can lower single buildings.
    [DETAIL_SOURCE]: { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, tolerance: 0.2, generateId: true },
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
  light: { anchor: 'viewport', color: '#ffffff', intensity: 0.25 },
  layers: [
    { id: 'land', type: 'background', paint: { 'background-color': C.land } },
    ...OVERVIEW_KINDS.map((kind) => fill('overview', kind, ['==', ['get', 'kind'], kind])),
    ...KINDS.map((kind) => fill(DETAIL_SOURCE, kind, ['all', ['==', ['get', 'kind'], kind], ['==', ['get', 'level'], 0]])),
    // Bridges and other decks above the ground cover whatever runs underneath.
    {
      id: 'detail-raised', type: 'fill', source: DETAIL_SOURCE, filter: ['>', ['get', 'level'], 0],
      paint: { 'fill-color': colourByKind, 'fill-antialias': false },
    },
    {
      id: 'buildings', type: 'fill-extrusion', source: DETAIL_SOURCE, filter: ['has', 'h'],
      paint: {
        'fill-extrusion-color': C.building,
        // Feature-state 'k' (0..1, set in map.js) lowers the buildings right around the player.
        'fill-extrusion-height': ['*', ['get', 'h'], HEIGHT_SCALE, ['coalesce', ['feature-state', 'k'], 1]],
        'fill-extrusion-opacity': 0.92,
      },
    },
  ],
};
