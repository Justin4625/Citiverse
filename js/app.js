import { LOCATIONS, RADIUS_M, photoUrl } from './locations.js';
import { loadStamps, saveStamp, clearStamps, requestPersistence } from './storage.js';
import { distanceM, isInRange, watchPosition } from './geo.js';
import { createGameMap } from './map.js';
import { renderBook, renderCredits } from './book.js';
import { createStopPanel, hasStop, characterOf } from './stop.js';
import { loadProgress, clearProgress, recordGame, recordStamps, levelFor } from './progress.js';
import { renderProgress } from './progressView.js';

// Test mode: GPS off, tap the map to move the player, plus a reset button. ?debug starts in it.
const TEST_STATUS = 'Tik op de kaart om te lopen';

const els = {
  sheetCount: document.getElementById('sheetCount'),
  credits: document.getElementById('credits'),
  status: document.getElementById('status'),
  collect: document.getElementById('collect'),
  book: document.getElementById('book'),
  sheet: document.getElementById('sheet'),
  bookToggle: document.getElementById('bookToggle'),
  sheetClose: document.getElementById('sheetClose'),
  toast: document.getElementById('toast'),
  testToggle: document.getElementById('testToggle'),
  reset: document.getElementById('reset'),
  stopPanel: document.getElementById('stopPanel'),
  levelChip: document.getElementById('levelChip'),
  levelNum: document.getElementById('levelNum'),
  levelName: document.getElementById('levelName'),
  levelBar: document.getElementById('levelBar'),
  progressSheet: document.getElementById('progressSheet'),
  progressBody: document.getElementById('progressBody'),
  progressClose: document.getElementById('progressClose'),
};

let stamps = loadStamps();
let position = null;
let testMode = false;
let stopWatch = null;
// Where the player last stood, so leaving and re-entering test mode doesn't lose it.
let lastPosition = null;

const gameMap = createGameMap('map', LOCATIONS, RADIUS_M);
// Stops with a character open a panel first; the stamp comes after helping them.
const stopPanel = createStopPanel(els.stopPanel, {
  onCollect: (loc) => collect(loc, { onSite: false }),
  onPlayed: (loc, result, { onSite, gameId }) => {
    const outcome = recordGame(loc.id, result, { onSite, gameId, stamps, totalStops: LOCATIONS.length });
    renderLevel();
    return outcome;
  },
  getDifficulty: () => levelFor(loadProgress().xp).index,
  onAchievements: () => renderLevel(),
});

function renderLevel() {
  const p = loadProgress();
  const level = levelFor(p.xp);
  els.levelNum.textContent = level.number;
  els.levelName.textContent = level.name;
  els.levelBar.style.width = `${Math.round(level.progress * 100)}%`;
  els.levelChip.setAttribute('aria-label', `Level ${level.number}, ${level.name}, ${p.xp} XP. Bekijk je voortgang`);
  if (!els.progressSheet.hidden) renderProgress(els.progressBody, p, LOCATIONS, stamps);
}

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
  els.sheetCount.textContent = `${count} van ${LOCATIONS.length} verzameld`;

  gameMap.setStopStates(
    Object.fromEntries(
      LOCATIONS.map((loc) => [loc.id, stamps[loc.id] ? 'done' : isNear(loc) ? 'near' : 'far']),
    ),
  );

  const target = nearestCollectable();
  els.collect.hidden = !target;
  if (target && els.collect.dataset.id !== target.id) {
    els.collect.dataset.id = target.id;
    const character = characterOf(target.id);
    els.collect.innerHTML = `<img src="${photoUrl(target)}" alt="" style="object-position:${target.focus}">
      <span><strong>${character ? `Help ${character.name}` : 'Stempel pakken'}</strong><small>${target.name}</small></span>`;
  }
  if (!target) delete els.collect.dataset.id;

  renderBook(els.book, LOCATIONS, stamps, position);
}

// onSite: false when the stop panel hands over, so walking off during a minigame still counts.
function collect(loc, { onSite = true } = {}) {
  if (!loc || stamps[loc.id] || (onSite && !isNear(loc))) return;
  stamps = saveStamp(loc.id);
  navigator.vibrate?.([80, 40, 160]);
  showToast(loc, recordStamps(stamps, LOCATIONS.length));
  render();
  renderLevel();
}

function onFix(fix) {
  position = fix;
  gameMap.setPlayer(fix);
  els.status.textContent = testMode ? TEST_STATUS : `GPS ±${Math.round(fix.accuracy)} m`;
  render();
}

function onGeoError(err) {
  els.status.textContent =
    err.code === 1 ? 'Geen toegang tot je locatie. Sta het toe om te spelen.' : `Geen locatie (${err.message}).`;
}

let toastTimer;
function showToast(loc, achievements = []) {
  els.toast.innerHTML = `<span class="toast__photo"><img src="${photoUrl(loc)}" alt="" style="object-position:${loc.focus}">
      <span class="toast__stamp" aria-hidden="true"><b>✓</b><small>Rotterdam</small></span></span>
    <small>Stempel verzameld</small><strong>${loc.name}</strong>
    ${achievements.map((a) => `<span class="toast__badge">Badge: ${a.name}</span>`).join('')}`;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (els.toast.hidden = true), achievements.length ? 3600 : 2600);
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
    els.status.textContent = position ? TEST_STATUS : 'Tik op de kaart om jezelf neer te zetten';
  } else {
    lastPosition = position;
    position = null;
    els.status.textContent = 'Locatie zoeken…';
    stopWatch = watchPosition(onFix, onGeoError);
  }
  render();
}

function toggleSheet(open) {
  els.sheet.hidden = !open;
  if (open) els.progressSheet.hidden = true;
}

function toggleProgress(open) {
  els.progressSheet.hidden = !open;
  if (open) {
    els.sheet.hidden = true;
    renderProgress(els.progressBody, loadProgress(), LOCATIONS, stamps);
  }
}

// Opens the stop's panel when it has a character, otherwise collects straight away.
// Away from the stop you play from a distance: half XP and no stamp.
function enterStop(loc) {
  if (!loc) return;
  if (!hasStop(loc.id)) return collect(loc);
  els.sheet.hidden = true;
  els.progressSheet.hidden = true;
  stopPanel.open(loc, { isCollected: Boolean(stamps[loc.id]), isOnSite: Boolean(isNear(loc)) });
}

els.collect.addEventListener('click', () => enterStop(nearestCollectable()));
gameMap.onStopTap((id) => {
  const loc = LOCATIONS.find((l) => l.id === id);
  // In test mode, tapping a far-away stop teleports you there.
  if (testMode && !isNear(loc)) onFix({ lat: loc.lat - 0.00025, lng: loc.lng, accuracy: 5 });
  else enterStop(loc);
});
els.bookToggle.addEventListener('click', () => toggleSheet(els.sheet.hidden));
// Tapping a stop in the stamp book plays it: on site when you are there, otherwise from a distance.
els.book.addEventListener('click', (e) => {
  const card = e.target.closest('[data-id]');
  if (card) enterStop(LOCATIONS.find((l) => l.id === card.dataset.id));
});
els.book.addEventListener('keydown', (e) => {
  const card = e.target.closest('[data-id]');
  if (card && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    enterStop(LOCATIONS.find((l) => l.id === card.dataset.id));
  }
});
els.levelChip.addEventListener('click', () => toggleProgress(els.progressSheet.hidden));
els.progressClose.addEventListener('click', () => toggleProgress(false));
els.sheetClose.addEventListener('click', () => toggleSheet(false));

els.testToggle.addEventListener('click', () => setTestMode(!testMode));
gameMap.onMapTap((pos) => {
  if (testMode) onFix({ ...pos, accuracy: 5 });
});

els.reset.addEventListener('click', () => {
  stamps = clearStamps();
  clearProgress();
  render();
  renderLevel();
});

setTestMode(new URLSearchParams(location.search).has('debug'));

renderCredits(els.credits, LOCATIONS);
requestPersistence();
renderLevel();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
render();
