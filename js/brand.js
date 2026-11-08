// Digital Child Rights "Citiverse GO" artwork: one theme per stop, each with its own buddy,
// icon, stamp (GO smile) and star, all in img/dcr/. Colours are the two ends of the theme's
// gradient, sampled from the icons.

import { STOPS } from './stops.js';

export const THEMES = {
  everybody: ['#089bd5', '#d8698f'],
  chances: ['#de4c82', '#9b3186'],
  fair: ['#863489', '#3a4795'],
  opinion: ['#254e92', '#17814c'],
  freedom: ['#1c8249', '#daa107'],
  active: ['#e79e00', '#ec7902'],
  healthy: ['#ea6f07', '#c81b1e'],
  privacy: ['#c0321e', '#83b01a'],
  safe: ['#72b22e', '#089b8b'],
  rules: ['#079b8d', '#039ccf'],
};

export const themeOf = (id) => STOPS[id]?.theme.toLowerCase() ?? 'everybody';

export const buddyUrl = (id) => `img/dcr/buddy-${themeOf(id)}.png`;
export const iconUrl = (id) => `img/dcr/icon-${themeOf(id)}.png`;
export const stampUrl = (id) => `img/dcr/stamp-${themeOf(id)}.png`;
export const starUrl = (theme) => `img/dcr/star-${theme}.png`;

// Inline CSS custom properties so a component can paint itself in the stop's theme gradient.
export function themeVars(id) {
  const [a, b] = THEMES[themeOf(id)];
  return `--t1:${a};--t2:${b}`;
}
