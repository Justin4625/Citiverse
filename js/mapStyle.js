// Flat, label-free map style: Pokémon Go colours, Mini Metro simplicity.
const C = {
  land: '#b6e7a8',
  urban: '#c6edb9',
  park: '#8fd98a',
  water: '#63cdf0',
  road: '#fff6c9',
  path: '#e9f6d2',
  building: '#eee9fa',
  sky: '#7fd3f7',
  horizon: '#dff6ff',
};

const URBAN = ['residential', 'commercial', 'industrial', 'retail', 'neighbourhood'];
const MAJOR = ['motorway', 'trunk', 'primary', 'secondary'];
const MINOR = ['tertiary', 'minor', 'service'];

const roadWidth = (min, max) => ['interpolate', ['exponential', 1.6], ['zoom'], 13, min, 19, max];
const lineLayout = { 'line-cap': 'round', 'line-join': 'round' };
const classIn = (classes) => ['in', ['get', 'class'], ['literal', classes]];
// Buildings are kept low and soft so stops and the player stay readable.
const scaledHeight = (prop) => ['*', ['min', ['coalesce', ['get', prop], 0], 60], 0.4];

export const mapStyle = {
  version: 8,
  sources: {
    omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
  },
  sky: {
    'sky-color': C.sky,
    'horizon-color': C.horizon,
    'sky-horizon-blend': 0.6,
  },
  light: { anchor: 'viewport', color: '#ffffff', intensity: 0.25 },
  layers: [
    { id: 'land', type: 'background', paint: { 'background-color': C.land } },
    { id: 'urban', type: 'fill', source: 'omt', 'source-layer': 'landuse', filter: classIn(URBAN), paint: { 'fill-color': C.urban } },
    { id: 'park', type: 'fill', source: 'omt', 'source-layer': 'park', paint: { 'fill-color': C.park } },
    { id: 'green', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: classIn(['grass', 'wood']), paint: { 'fill-color': C.park } },
    { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': C.water } },
    { id: 'waterway', type: 'line', source: 'omt', 'source-layer': 'waterway', paint: { 'line-color': C.water, 'line-width': 3 } },
    {
      id: 'paths', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 15,
      filter: classIn(['path', 'pedestrian']), layout: lineLayout,
      paint: { 'line-color': C.path, 'line-width': roadWidth(0.5, 5) },
    },
    {
      id: 'roads-minor', type: 'line', source: 'omt', 'source-layer': 'transportation',
      filter: classIn(MINOR), layout: lineLayout,
      paint: { 'line-color': C.road, 'line-width': roadWidth(0.5, 14) },
    },
    {
      id: 'roads-major', type: 'line', source: 'omt', 'source-layer': 'transportation',
      filter: classIn(MAJOR), layout: lineLayout,
      paint: { 'line-color': C.road, 'line-width': roadWidth(1.5, 24) },
    },
    {
      id: 'buildings', type: 'fill-extrusion', source: 'omt', 'source-layer': 'building', minzoom: 14,
      paint: {
        'fill-extrusion-color': C.building,
        'fill-extrusion-height': scaledHeight('render_height'),
        'fill-extrusion-base': scaledHeight('render_min_height'),
        'fill-extrusion-opacity': 0.92,
      },
    },
  ],
};
