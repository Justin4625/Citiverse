import { LOCATIONS, RADIUS_M } from './locations.js';
import { loadStamps, saveStamp, clearStamps, requestPersistence } from './storage.js';
import { distanceM, isInRange, watchPosition } from './geo.js';
import { createGameMap } from './map.js';
import { renderBook } from './book.js';

// ?debug → tap the map to move the player, plus a reset button.
const DEBUG = new URLSearchParams(location.search).has('debug');

const els = {
  progress: document.getElementById('progress'),
  status: document.getElementById('status'),
  collect: document.getElementById('collect'),
  book: document.getElementById('book'),
  sheet: document.getElementById('sheet'),
  bookToggle: document.getElementById('bookToggle'),
  sheetClose: document.getElementById('sheetClose'),
  toast: document.getElementById('toast'),
};

let stamps = loadStamps();
let position = null;

const gameMap = createGameMap('map', LOCATIONS, RADIUS_M);

function isNear(loc) {
  return position && isInRange(distanceM(position, loc), position.accuracy, RADIUS_M);
}

function nearestCollectable() {
  if (!position) return null;
  return (
    LOCATIONS.filter((loc) => !stamps[loc.id] && isNear(loc))
      .sort((a, b) => distanceM(position, a) - distanceM(position, b))[0] ?? null
  );
}

function render() {
  const count = LOCATIONS.filter((loc) => stamps[loc.id]).length;
  els.progress.textContent = `${count}/${LOCATIONS.length}`;

  gameMap.setStopStates(
    Object.fromEntries(
      LOCATIONS.map((loc) => [loc.id, stamps[loc.id] ? 'done' : isNear(loc) ? 'near' : 'far']),
    ),
  );

  const target = nearestCollectable();
  els.collect.hidden = !target;
  if (target) els.collect.textContent = `${target.emoji} Collect stamp!`;

  renderBook(els.book, LOCATIONS, stamps, position);
}

function collect(loc) {
  if (!loc || stamps[loc.id] || !isNear(loc)) return;
  stamps = saveStamp(loc.id);
  navigator.vibrate?.([80, 40, 160]);
  showToast(loc);
  render();
}

function onFix(fix) {
  position = fix;
  gameMap.setPlayer(fix);
  els.status.textContent = DEBUG ? 'Debug: tap the map or a stop to walk' : `GPS ±${Math.round(fix.accuracy)} m`;
  render();
}

function onGeoError(err) {
  els.status.textContent =
    err.code === 1 ? 'Location access denied — allow it to play.' : `No location (${err.message}).`;
}

let toastTimer;
function showToast(loc) {
  els.toast.innerHTML = `<span class="toast__stamp">${loc.emoji}</span><strong>${loc.name}</strong><small>Stamp collected!</small>`;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (els.toast.hidden = true), 2600);
}

function toggleSheet(open) {
  els.sheet.hidden = !open;
}

els.collect.addEventListener('click', () => collect(nearestCollectable()));
gameMap.onStopTap((id) => {
  const loc = LOCATIONS.find((l) => l.id === id);
  // In debug, tapping a far-away stop teleports you there.
  if (DEBUG && !isNear(loc)) onFix({ lat: loc.lat - 0.00025, lng: loc.lng, accuracy: 5 });
  else collect(loc);
});
els.bookToggle.addEventListener('click', () => toggleSheet(els.sheet.hidden));
els.sheetClose.addEventListener('click', () => toggleSheet(false));

if (DEBUG) {
  els.status.textContent = 'Debug: tap the map or a stop to walk';
  gameMap.onMapTap((pos) => onFix({ ...pos, accuracy: 5 }));
  const reset = document.createElement('button');
  reset.className = 'reset';
  reset.textContent = 'Reset stamps';
  reset.addEventListener('click', () => {
    stamps = clearStamps();
    render();
  });
  els.book.after(reset);
} else {
  watchPosition(onFix, onGeoError);
}

requestPersistence();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
render();
