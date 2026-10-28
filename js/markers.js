import { photoUrl } from './locations.js';

// HTML for the billboard markers that stand on the tilted map.

export function stopElement(loc) {
  const el = document.createElement('div');
  el.className = 'stop';
  // The inner body scales with the zoom level; the outer element is positioned by MapLibre.
  el.innerHTML = `
    <span class="stop__body">
      <span class="stop__label">${loc.name}</span>
      <span class="stop__pin">
        <img class="stop__photo" src="${photoUrl(loc)}" alt="" style="object-position:${loc.focus}" draggable="false">
        <span class="stop__check" aria-hidden="true"></span>
      </span>
      <span class="stop__pole"></span>
      <span class="stop__shadow"></span>
    </span>`;
  el.setAttribute('aria-label', loc.name);
  return el;
}

// state: 'far' | 'near' | 'done'
export function setStopState(el, state) {
  el.dataset.state = state;
}

export function playerElement() {
  const el = document.createElement('div');
  el.className = 'player';
  el.innerHTML = `
    <svg viewBox="0 0 40 56" aria-hidden="true">
      <ellipse class="player__shadow" cx="20" cy="51" rx="11" ry="4"/>
      <rect class="player__body" x="10" y="24" width="20" height="24" rx="9"/>
      <circle class="player__head" cx="20" cy="15" r="10"/>
      <path class="player__cap" d="M10 14a10 10 0 0 1 20 0z"/>
    </svg>`;
  return el;
}
