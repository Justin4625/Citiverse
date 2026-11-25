// Show and hide overlays with a short exit animation instead of a hard cut. The element gets
// the class is-leaving (styles.css animates it out) and is hidden when that animation ends.
// Showing it again during the exit cancels the exit.
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// While a full-screen menu covers the map, body gets .menu-open: the map and the 3D figures stop
// drawing (nobody sees them), so the phone has all its power for the menu's animation.
const FULL = '.sheet, .stop-panel, .finale';
function markMenus() {
  const open = document.querySelector('.sheet:not([hidden]):not(.is-leaving), .stop-panel:not([hidden]):not(.is-leaving), .finale:not(.is-leaving)');
  const was = document.body.classList.contains('menu-open');
  document.body.classList.toggle('menu-open', Boolean(open));
  if (was && !open) window.dispatchEvent(new Event('menuclosed'));
}
export const menuOpen = () => document.body.classList.contains('menu-open');

// Where a full-screen menu unfolds from (and folds back into): a point on screen, or an element
// whose middle is used. styles.css reads --ox/--oy.
export function setOrigin(el, from) {
  if (!from) return;
  const point = from.getBoundingClientRect
    ? (({ left, top, width, height }) => ({ x: left + width / 2, y: top + height / 2 }))(from.getBoundingClientRect())
    : from;
  el.style.setProperty('--ox', `${Math.round(point.x)}px`);
  el.style.setProperty('--oy', `${Math.round(point.y)}px`);
}

export function show(el, from) {
  setOrigin(el, from);
  clearTimeout(el._leaveTimer);
  el.classList.remove('is-leaving');
  el.hidden = false;
  // After the menu has unfolded, so the map is still drawn under the opening animation.
  if (el.matches(FULL)) setTimeout(markMenus, 560);
}

export function hide(el, { then } = {}) {
  if (el.hidden || el.classList.contains('is-leaving')) return;
  const done = () => {
    clearTimeout(el._leaveTimer);
    if (!el.classList.contains('is-leaving')) return;
    el.classList.remove('is-leaving');
    el.hidden = true;
    then?.();
  };
  if (reduced()) {
    el.hidden = true;
    markMenus();
    then?.();
    return;
  }
  el.classList.add('is-leaving');
  if (el.matches(FULL)) markMenus();
  // Hidden when the longest exit animation (styles.css, about 0.36 s) is over.
  el._leaveTimer = setTimeout(done, 380);
}

