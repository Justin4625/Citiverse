import { LOCATIONS, RADIUS_M } from './locations.js';
import { loadStamps, saveStamp, clearStamps, requestPersistence } from './storage.js';
import { distanceM, isInRange, watchPosition } from './geo.js';
import { createGameMap } from './map.js';
import { renderBook } from './book.js';

// Test mode: GPS off, tap the map to move the player, plus a reset button. ?debug starts in it.
const TEST_STATUS = 'Tap the map to move';

const els = {
  progress: document.getElementById('progress'),
  status: document.getElementById('status'),
  collect: document.getElementById('collect'),
  book: document.getElementById('book'),
  sheet: document.getElementById('sheet'),
  bookToggle: document.getElementById('bookToggle'),
  sheetClose: document.getElementById('sheetClose'),
  toast: document.getElementById('toast'),
  testToggle: document.getElementById('testToggle'),
  reset: document.getElementById('reset'),
};

let stamps = loadStamps();
let position = null;
let testMode = false;
let stopWatch = null;
// Where the player last stood, so leaving and re-entering test mode doesn't lose it.
let lastPosition = null;

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
  els.status.textContent = testMode ? TEST_STATUS : `GPS ±${Math.round(fix.accuracy)} m`;
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

function setTestMode(on) {
  testMode = on;
  els.testToggle.setAttribute('aria-pressed', String(on));
  els.reset.hidden = !on;
  if (on) {
    stopWatch?.();
    stopWatch = null;
    // Keep the player where it is; with no position yet, the first map tap places it.
    position ??= lastPosition;
    els.status.textContent = position ? TEST_STATUS : 'Tap the map to place yourself';
  } else {
    lastPosition = position;
    position = null;
    els.status.textContent = 'Finding your location…';
    stopWatch = watchPosition(onFix, onGeoError);
  }
  render();
}

function toggleSheet(open) {
  els.sheet.hidden = !open;
}

els.collect.addEventListener('click', () => collect(nearestCollectable()));
gameMap.onStopTap((id) => {
  const loc = LOCATIONS.find((l) => l.id === id);
  // In test mode, tapping a far-away stop teleports you there.
  if (testMode && !isNear(loc)) onFix({ lat: loc.lat - 0.00025, lng: loc.lng, accuracy: 5 });
  else collect(loc);
});
els.bookToggle.addEventListener('click', () => toggleSheet(els.sheet.hidden));
els.sheetClose.addEventListener('click', () => toggleSheet(false));

els.testToggle.addEventListener('click', () => setTestMode(!testMode));
gameMap.onMapTap((pos) => {
  if (testMode) onFix({ ...pos, accuracy: 5 });
});

els.reset.addEventListener('click', () => {
  stamps = clearStamps();
  render();
});

setTestMode(new URLSearchParams(location.search).has('debug'));

requestPersistence();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
render();
