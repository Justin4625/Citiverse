// The player's own avatar: a "Digital Twinny" (DCR's name for the player in Citiverse GO).
// Same bean shape as the Buddies, but white. Every stamp pours in the colour of that stop's
// theme from the feet up, so after all 10 stamps the Twinny wears the full GO rainbow.

import { THEMES } from './brand.js';

// Order of the star ring on the CITIVERSE GO logo.
const ORDER = Object.keys(THEMES);
const WHITE = '#eef2f9';

let uid = 0;

/**
 * @param {string[]} collected theme keys of the stamps the player has (e.g. ['privacy', 'fair'])
 * @returns {string} SVG markup, viewBox 0 0 100 150, feet at y 142
 */
/**
 * Colours fill from the feet up to the top of the head, like a glass filling up. One colour per
 * theme, blended smoothly; the white part sits above with a short soft edge. Shared by the SVG
 * and the 3D Twinny.
 * @returns {[number, string][]} [offset from the top (0) to the feet (1), hex colour]
 */
export function twinnyStops(collected = []) {
  const have = ORDER.filter((t) => collected.includes(t));
  const fill = Math.min(have.length / ORDER.length, 1);
  if (!have.length) return [[0, WHITE], [1, '#d9e1ef']];
  const top = 1 - fill; // fraction from the top where the colour starts
  const band = fill / have.length;
  // Bottom-most colour is the first collected theme in logo order.
  const stops = [...have].reverse().map((t, i) => [top + band * (i + 0.5), THEMES[t][0]]);
  if (fill < 1) stops.unshift([Math.max(top - 0.08, 0), WHITE], [Math.min(top + band * 0.15, 1), WHITE]);
  return stops;
}

export function twinnySvg(collected = []) {
  const id = `tw${++uid}`;
  const stops = twinnyStops(collected);
  const gradient = stops.map(([o, c]) => `<stop offset="${o.toFixed(3)}" stop-color="${c}"/>`).join('');

  const paint = `url(#${id}f)`;
  return `
    <svg viewBox="0 0 100 150" aria-hidden="true">
      <defs>
        <linearGradient id="${id}f" gradientUnits="userSpaceOnUse" x1="0" y1="6" x2="0" y2="146">${gradient}</linearGradient>
        <radialGradient id="${id}s" cx="0.38" cy="0.3" r="0.75">
          <stop offset="0" stop-color="#fff" stop-opacity="0.55"/>
          <stop offset="0.45" stop-color="#fff" stop-opacity="0"/>
          <stop offset="1" stop-color="#0b1a3d" stop-opacity="0.4"/>
        </radialGradient>
        <linearGradient id="${id}v" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#e4e6ea"/>
          <stop offset="1" stop-color="#b9bdc5"/>
        </linearGradient>
      </defs>
      <ellipse cx="50" cy="145" rx="24" ry="4" fill="#0b1a3d" opacity="0.25"/>
      <g fill="${paint}">
        <path d="M28 46 C18 52 12 74 10 98 q0 6 5 4 C18 86 22 70 28 62 Z"/>
        <path d="M72 46 C82 52 88 74 90 98 q0 6 -5 4 C82 86 78 70 72 62 Z"/>
        <path d="M31 96 h16 v38 q0 8 -9 8 h-6 q-4 0 -3 -4 q2 -4 2 -8 z"/>
        <path d="M53 96 h16 v34 q0 4 2 8 q1 4 -3 4 h-6 q-9 0 -9 -8 z"/>
      </g>
      <g fill="#0b1a3d" opacity="0.14">
        <path d="M28 46 C18 52 12 74 10 98 q0 6 5 4 C18 86 22 70 28 62 Z"/>
        <path d="M72 46 C82 52 88 74 90 98 q0 6 -5 4 C82 86 78 70 72 62 Z"/>
        <path d="M31 96 h16 v38 q0 8 -9 8 h-6 q-4 0 -3 -4 q2 -4 2 -8 z"/>
        <path d="M53 96 h16 v34 q0 4 2 8 q1 4 -3 4 h-6 q-9 0 -9 -8 z"/>
      </g>
      <path d="M24 34 a26 26 0 0 1 52 0 v62 q0 18 -18 18 h-16 q-18 0 -18 -18 z" fill="${paint}"/>
      <path d="M24 34 a26 26 0 0 1 52 0 v62 q0 18 -18 18 h-16 q-18 0 -18 -18 z" fill="url(#${id}s)"/>
      <path d="M32 30 q18 -10 36 0 q4 14 -1 26 q-17 7 -34 0 q-5 -12 -1 -26 z" fill="url(#${id}v)"/>
      <ellipse cx="44" cy="41" rx="2.4" ry="4" fill="#14171c"/>
      <ellipse cx="56" cy="41" rx="2.4" ry="4" fill="#14171c"/>
      <circle cx="50" cy="78" r="8" fill="#16295c"/>
      <path d="M45.6 79.2 q4.4 4 8.8 0" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>
      <circle cx="47" cy="75.4" r="1.1" fill="#fff"/>
      <circle cx="53" cy="75.4" r="1.1" fill="#fff"/>
    </svg>`;
}
