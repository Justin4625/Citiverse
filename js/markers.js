import { photoUrl } from './locations.js';
import { buddyUrl, stampUrl, themeVars } from './brand.js';
import { twinnySvg } from './twinny.js';

// HTML for the billboard markers that stand on the tilted map.

export function stopElement(loc) {
  const el = document.createElement('div');
  el.className = 'stop';
  // The inner body scales with the zoom level; the outer element is positioned by MapLibre.
  el.innerHTML = `
    <span class="stop__body" style="${themeVars(loc.id)}">
      <span class="stop__label">${loc.name}</span>
      <span class="stop__pin">
        <img class="stop__photo" src="${photoUrl(loc)}" alt="" style="object-position:${loc.focus}" draggable="false">
        <img class="stop__check" src="${stampUrl(loc.id)}" alt="" draggable="false">
      </span>
      <span class="stop__pole"></span>
      <img class="stop__buddy" src="${buddyUrl(loc.id)}" alt="" draggable="false">
      <span class="stop__shadow"></span>
    </span>`;
  el.setAttribute('aria-label', loc.name);
  return el;
}

// state: 'far' | 'near' | 'done'
export function setStopState(el, state) {
  el.dataset.state = state;
}

// The player is a Digital Twinny that colours in with every stamp (see twinny.js). It starts as
// the SVG and swaps to the walking 3D figure (twinny3d.js) once Three.js and WebGL are there.
export function playerElement() {
  const el = document.createElement('div');
  el.className = 'player';
  el.twinny = { themes: [], three: null };
  setPlayerThemes(el, []);
  import('./twinny3d.js')
    .then(({ createTwinny3D }) => {
      const box = document.createElement('div');
      box.className = 'player__3d';
      const three = createTwinny3D(box);
      three.setThemes(el.twinny.themes);
      el.replaceChildren(box);
      el.classList.add('player--3d');
      el.twinny.three = three;
    })
    .catch(() => {}); // no WebGL or offline without the CDN: keep the SVG
  return el;
}

export function setPlayerThemes(el, themes) {
  const key = [...themes].sort().join();
  if (el.dataset.themes === key) return;
  el.dataset.themes = key;
  el.twinny.themes = themes;
  if (el.twinny.three) el.twinny.three.setThemes(themes);
  else el.innerHTML = twinnySvg(themes);
}

/** Walk animation on or off; angle in radians on screen, 0 = towards the viewer. */
export function setPlayerWalking(el, on, angle) {
  el.twinny.three?.setWalking(on, angle);
}
