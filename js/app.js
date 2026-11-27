import { LOCATIONS, RADIUS_M, photoUrl } from './locations.js';
import { loadStamps, saveStamp, clearStamps, requestPersistence } from './storage.js';
import { distanceM, isInRange, watchPosition } from './geo.js';
import { createGameMap } from './map.js';
import { renderBook, renderCredits, renderStampRow } from './book.js';
import { THEMES, buddyUrl, stampUrl, themeOf, themeVars } from './brand.js';
import { twinnySvg } from './twinny.js';
import { createStopPanel, hasStop, characterOf } from './stop.js';
import { loadProgress, clearProgress, recordGame, recordStamps, levelFor } from './progress.js';
import { renderProgress } from './progressView.js';
import { fetchRoute, progressOn } from './route.js';
import { show, hide, setOrigin } from './ui.js';
import { initTts } from './tts.js';

// Test mode: GPS off, tap the map to move the player, plus a reset button. ?debug starts in it.
const TEST_STATUS = 'Tik op de kaart om te lopen';

const els = {
  sheetCount: document.getElementById('sheetCount'),
  credits: document.getElementById('credits'),
  status: document.getElementById('status'),
  book: document.getElementById('book'),
  sheet: document.getElementById('sheet'),
  bookToggle: document.getElementById('bookToggle'),
  sheetClose: document.getElementById('sheetClose'),
  toast: document.getElementById('toast'),
  testToggle: document.getElementById('testToggle'),
  reset: document.getElementById('reset'),
  toolsToggle: document.getElementById('toolsToggle'),
  toolsMenu: document.getElementById('toolsMenu'),
  stopPanel: document.getElementById('stopPanel'),
  levelChip: document.getElementById('levelChip'),
  levelNum: document.getElementById('levelNum'),
  levelName: document.getElementById('levelName'),
  levelBar: document.getElementById('levelBar'),
  progressSheet: document.getElementById('progressSheet'),
  progressBody: document.getElementById('progressBody'),
  progressClose: document.getElementById('progressClose'),
  stampRow: document.getElementById('stampRow'),
  route: document.getElementById('route'),
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
  // Back from a stop: the camera flies back out to the player.
  onClose: () => gameMap.unfocus(),
  onCollect: (loc) => collect(loc, { onSite: false }),
  onPlayed: (loc, result, { onSite, gameId }) => {
    const outcome = recordGame(loc.id, result, { onSite, gameId, stamps, totalStops: LOCATIONS.length });
    renderLevel();
    return outcome;
  },
  getDifficulty: () => levelFor(loadProgress().xp).index,
  onAchievements: () => renderLevel(),
  // Away from a stop its panel offers the walking route instead of the minigame.
  onRoute: (loc) => {
    stopPanel.close();
    startRoute(loc);
  },
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

// A short message at the top of the map. It fades away after a few seconds, unless it stays
// true until something changes (searching for GPS, no permission).
let statusTimer;
function showStatus(text, { stay = false, ms = 3500 } = {}) {
  clearTimeout(statusTimer);
  els.status.textContent = text;
  els.status.hidden = false;
  if (!stay) statusTimer = setTimeout(hideStatus, ms);
}
function hideStatus() {
  clearTimeout(statusTimer);
  els.status.hidden = true;
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

let calledFor = null; // the stop whose "tap the stop" message was shown last

const collectedThemes = () => LOCATIONS.filter((loc) => stamps[loc.id]).map((loc) => themeOf(loc.id));

function render() {
  const count = LOCATIONS.filter((loc) => stamps[loc.id]).length;
  els.sheetCount.textContent = `${count} van ${LOCATIONS.length} verzameld`;
  gameMap.setPlayerThemes(collectedThemes());

  gameMap.setStopStates(
    Object.fromEntries(
      LOCATIONS.map((loc) => [loc.id, stamps[loc.id] ? 'done' : isNear(loc) ? 'near' : 'far']),
    ),
  );

  // Arriving at a stop you can play: say once that the stop is awake and waits for a tap.
  const target = nearestCollectable();
  if (target && target.id !== calledFor) {
    const character = characterOf(target.id);
    showStatus(`${character ? `${character.name} heeft je hulp nodig` : target.name}. Tik op de stop!`);
  }
  calledFor = target?.id ?? null;

  renderStampRow(els.stampRow, LOCATIONS, stamps);
  renderRoute();
  if (!els.sheet.hidden) renderBookList();
}

function renderBookList() {
  renderBook(els.book, LOCATIONS, stamps, { position, isNear, routeTo: route?.loc.id });
}

// ---------- Walking route to a stop ----------
// Drawn on the map from the player to the stop; shrinks as you walk, is fetched again when you
// wander off it, and disappears once you are there.
const OFF_ROUTE_M = 40;
const REROUTE_AFTER_MS = 8000;
let route = null; // { loc, data, fetchedAt, loading }

async function startRoute(loc) {
  if (!position) return;
  route = { loc, data: null, fetchedAt: Date.now(), loading: true };
  toggleSheet(false);
  renderRoute();
  const data = await fetchRoute(position, loc);
  if (route?.loc !== loc) return; // stopped or replaced meanwhile
  route = { loc, data, fetchedAt: Date.now(), loading: false };
  renderRoute();
}

function stopRoute() {
  route = null;
  gameMap.showRoute(null);
  renderRoute();
}

// The route is only the line on the map: you follow it, no banner with directions.
function renderRoute() {
  els.route.hidden = true;
  if (!route) return;
  const { loc } = route;
  if (isNear(loc)) {
    stopRoute();
    return;
  }
  if (route.data && position) {
    const p = progressOn(route.data, position);
    gameMap.showRoute(p.line, loc.id);
    if (p.offRouteM > OFF_ROUTE_M && !route.loading && Date.now() - route.fetchedAt > REROUTE_AFTER_MS) startRoute(loc);
  }
}

// onSite: false when the stop panel hands over, so walking off during a minigame still counts.
function collect(loc, { onSite = true } = {}) {
  if (!loc || stamps[loc.id] || (onSite && !isNear(loc))) return;
  stamps = saveStamp(loc.id);
  navigator.vibrate?.([80, 40, 160]);
  showToast(loc, recordStamps(stamps, LOCATIONS.length));
  if (LOCATIONS.every((l) => stamps[l.id])) setTimeout(showFinale, 3200);
  render();
  renderLevel();
}

// The baked map only covers Rotterdam (map.js MAP_BOUNDS). Away from it, or when the phone
// gives no location at all (no permission, or a plain http:// address on a local network),
// the game starts in test mode at Centraal, so it can always be played.
const PLAY_AREA = { west: 4.38, south: 51.86, east: 4.6, north: 51.975 };
const inPlayArea = ({ lat, lng }) => lng > PLAY_AREA.west && lng < PLAY_AREA.east && lat > PLAY_AREA.south && lat < PLAY_AREA.north;
function playFromCentraal(why) {
  position = null;
  lastPosition = null;
  setTestMode(true);
  showStatus(`${why} Testmodus staat aan, je start bij Centraal.`, { ms: 6000 });
}

function onFix(fix) {
  if (!testMode && !inPlayArea(fix)) {
    playFromCentraal('Je bent niet in Rotterdam.');
    return;
  }
  position = fix;
  gameMap.setPlayer(fix);
  // Found you: the searching message can go.
  if (!testMode && !els.status.hidden) hideStatus();
  render();
}

function onGeoError(err) {
  if (!testMode && !position) {
    playFromCentraal(err.code === 1 ? 'De app mag je locatie niet zien.' : 'Je locatie is niet gevonden.');
    return;
  }
  showStatus(
    err.code === 1 ? 'De app mag je locatie niet zien. Zet dat aan om te kunnen spelen.' : `Je locatie is niet gevonden (${err.message}).`,
    { stay: true },
  );
}

// Collecting a stamp is the big moment: the stamp slams onto the photo with a burst of confetti in
// the stop's colours, and when the card goes the stamp flies into the stamp book (GO button).
let toastTimer;
const CONFETTI = 28;
function showToast(loc, achievements = []) {
  const [a, b] = THEMES[themeOf(loc.id)];
  const bits = Array.from({ length: CONFETTI }, (_, i) => {
    const angle = (i / CONFETTI) * 2 * Math.PI + Math.random() * 0.3;
    const reach = 120 + Math.random() * 110;
    const colour = [a, b, '#ffffff', '#ffd23f'][i % 4];
    return `<i style="--x:${Math.round(Math.cos(angle) * reach)}px;--y:${Math.round(Math.sin(angle) * reach - 60)}px;--r:${Math.round(Math.random() * 720 - 360)}deg;--c:${colour};--d:${(Math.random() * 0.15).toFixed(2)}s"></i>`;
  }).join('');
  els.toast.setAttribute('style', themeVars(loc.id));
  els.toast.innerHTML = `<span class="toast__burst" aria-hidden="true">${bits}</span>
    <span class="toast__photo"><img src="${photoUrl(loc)}" alt="" style="object-position:${loc.focus}">
      <img class="toast__stamp" src="${stampUrl(loc.id)}" alt=""></span>
    <small>Stempel verzameld</small><strong>${loc.name}</strong>
    ${achievements.map((a) => `<span class="toast__badge">Badge: ${a.name}</span>`).join('')}`;
  show(els.toast);
  clearTimeout(toastTimer);
  // Short, and a tap sends it away at once: the player wants to get back to the map.
  const close = () => {
    clearTimeout(toastTimer);
    els.toast.removeEventListener('click', close);
    flyStampToBook(els.toast.querySelector('.toast__stamp'));
    hide(els.toast);
  };
  els.toast.addEventListener('click', close);
  toastTimer = setTimeout(close, achievements.length ? 1800 : 1200);
}

// A copy of the stamp flies from the card into the GO button, which bounces when it lands.
function flyStampToBook(stamp) {
  if (!stamp || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const from = stamp.getBoundingClientRect();
  const to = els.bookToggle.getBoundingClientRect();
  const copy = stamp.cloneNode();
  copy.className = 'stamp-fly';
  Object.assign(copy.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
  document.body.append(copy);
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const flight = copy.animate(
    [
      { transform: 'translate(0, 0) scale(1) rotate(-10deg)' },
      { transform: `translate(${dx * 0.35}px, ${dy * 0.35 - 60}px) scale(0.9) rotate(8deg)`, offset: 0.4 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.35) rotate(0deg)`, opacity: 0.9 },
    ],
    { duration: 450, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'forwards' },
  );
  flight.onfinish = () => {
    copy.remove();
    els.bookToggle.classList.remove('is-bump');
    void els.bookToggle.offsetWidth; // restart the bounce
    els.bookToggle.classList.add('is-bump');
  };
}

function setTestMode(on) {
  testMode = on;
  els.testToggle.setAttribute('aria-checked', String(on));
  els.toolsToggle.parentElement.classList.toggle('tools--on', on);
  if (on) {
    stopWatch?.();
    stopWatch = null;
    // Keep the player where it is; with no position yet, the first map tap places it.
    // The camera follows the player, so without a position there is nothing to tap: start at Centraal.
    position ??= lastPosition;
    if (!position) {
      const start = LOCATIONS[0];
      onFix({ lat: start.lat - 0.0006, lng: start.lng, accuracy: 5 });
    }
    showStatus(TEST_STATUS);
  } else {
    lastPosition = position;
    position = null;
    showStatus('Locatie zoeken…', { stay: true });
    stopWatch = watchPosition(onFix, onGeoError);
  }
  render();
}

// Numbers the items in a menu (--k), so they can come in one after another.
const stagger = (items) => [...items].forEach((el, i) => el.style.setProperty('--k', Math.min(i, 12)));

const isOpen = (el) => !el.hidden && !el.classList.contains('is-leaving');

function closeSheets() {
  hide(els.sheet);
  hide(els.progressSheet);
}

function toggleSheet(open) {
  if (open) {
    hide(els.progressSheet);
    renderBookList();
    stagger(els.book.querySelectorAll('.card'));
    stagger(els.stampRow.children);
    els.sheet.scrollTop = 0;
    show(els.sheet, els.bookToggle);
  } else if (isOpen(els.sheet)) {
    hide(els.sheet);
  }
}

function toggleProgress(open) {
  if (open) {
    hide(els.sheet);
    els.progressSheet.scrollTop = 0;
    show(els.progressSheet, els.levelChip);
  } else if (isOpen(els.progressSheet)) {
    hide(els.progressSheet);
  }
  if (open) {
    renderProgress(els.progressBody, loadProgress(), LOCATIONS, stamps);
    stagger(els.progressBody.children);
  }
}

// Opens the stop's panel when it has a character, otherwise collects straight away.
// Away from the stop you play from a distance: half XP and no stamp.
function enterStop(loc) {
  if (!loc) return;
  if (!hasStop(loc.id)) return collect(loc);
  closeSheets();
  stopPanel.open(loc, { isCollected: Boolean(stamps[loc.id]), isOnSite: Boolean(isNear(loc)) });
}

const teleportTo = (loc) => onFix({ lat: loc.lat - 0.00025, lng: loc.lng, accuracy: 5 });
// Tapping a stop on the map: the camera dives at the stop, then its screen grows out of it.
let diving = false;
function onStopTapped(id) {
  const loc = LOCATIONS.find((l) => l.id === id);
  // In test mode, tapping a far-away stop teleports you there.
  if (testMode && !isNear(loc)) {
    teleportTo(loc);
    return;
  }
  if (diving || !hasStop(loc.id)) {
    enterStop(loc);
    return;
  }
  diving = true;
  els.stopPanel.dataset.from = 'map';
  gameMap.focusStop(id).then((point) => {
    diving = false;
    setOrigin(els.stopPanel, point);
    enterStop(loc);
  });
}
gameMap.onStopTap(onStopTapped);
// The pointer at the screen edge starts a walking route to the stop it points at.
gameMap.onPointerTap((id) => {
  const loc = LOCATIONS.find((l) => l.id === id);
  if (route?.loc.id !== id) startRoute(loc);
});
els.route.addEventListener('click', (e) => {
  if (e.target.closest('[data-stop-route]')) stopRoute();
});
els.bookToggle.addEventListener('click', () => toggleSheet(!isOpen(els.sheet)));
// Tapping a stop in the stamp book plays it: on site when you are there, otherwise from a
// distance. Its button starts or stops the walking route, or opens the stop when you are there.
els.book.addEventListener('click', (e) => {
  const byId = (id) => LOCATIONS.find((l) => l.id === id);
  const open = e.target.closest('[data-id]');
  const play = e.target.closest('[data-play]');
  const go = e.target.closest('[data-route]');
  if (open || play) {
    setOrigin(els.stopPanel, open || play);
    els.stopPanel.dataset.from = 'book';
  }
  if (open) enterStop(byId(open.dataset.id));
  else if (play) enterStop(byId(play.dataset.play));
  else if (go?.dataset.route) startRoute(byId(go.dataset.route));
  else if (go) {
    stopRoute();
    renderBookList();
  }
});
els.levelChip.addEventListener('click', () => toggleProgress(!isOpen(els.progressSheet)));
els.progressClose.addEventListener('click', () => toggleProgress(false));
els.sheetClose.addEventListener('click', () => toggleSheet(false));

function toggleTools(open) {
  if (open) show(els.toolsMenu);
  else hide(els.toolsMenu);
  els.toolsToggle.setAttribute('aria-expanded', String(open));
}
els.toolsToggle.addEventListener('click', () => toggleTools(!isOpen(els.toolsMenu)));
// A tap anywhere else closes the menu.
document.addEventListener('pointerdown', (e) => {
  if (!els.toolsMenu.hidden && !e.target.closest('.tools')) toggleTools(false);
});
els.testToggle.addEventListener('click', () => {
  setTestMode(!testMode);
  toggleTools(false);
});
gameMap.onMapTap((pos) => {
  if (testMode) onFix({ ...pos, accuracy: 5 });
});

els.reset.addEventListener('click', () => {
  stamps = clearStamps();
  clearProgress();
  render();
  renderLevel();
  toggleTools(false);
  showStatus('Stempels gewist');
});

// Start screen: the Citiverse GO logo and all ten buddies with your own Twinny in the middle,
// gone after one tap.
const splash = document.getElementById('splash');
const buddyImgs = Object.keys(THEMES).map((t, i) => `<img src="img/dcr/buddy-${t}.png" alt="" style="--i:${i}">`);
buddyImgs.splice(5, 0, `<span class="splash__twinny">${twinnySvg(collectedThemes())}</span>`);
document.getElementById('splashBuddies').innerHTML = buddyImgs.join('');
document.getElementById('splashStart').addEventListener('click', () => {
  splash.classList.add('splash--out');
  // A timer, not animationend: with reduced motion the fade-out never runs.
  setTimeout(() => (splash.hidden = true), 450);
  setTimeout(showCoach, 1400);
});

// ---------- First time on the map ----------
// One short tip from a Buddy, once per device: how you find and play a stop.
const COACH_KEY = 'stamprally.coach.v1';
function showCoach() {
  try {
    if (localStorage.getItem(COACH_KEY)) return;
  } catch {
    return;
  }
  const coach = document.createElement('section');
  coach.className = 'coach';
  coach.setAttribute('role', 'dialog');
  coach.setAttribute('aria-label', 'Zo speel je');
  coach.setAttribute('style', themeVars('erasmusbrug'));
  coach.innerHTML = `
    <img class="coach__buddy" src="${buddyUrl('erasmusbrug')}" alt="">
    <div class="coach__text">
      <strong>Zo speel je</strong>
      <p>Loop naar een plek met een Buddy. Ben je dichtbij, tik dan op de stop.</p>
      <p>Zie je geen stop? De Buddy aan de rand van je scherm wijst de weg. Tik erop voor een route.</p>
    </div>
    <button class="btn btn--action coach__ok">Oké, ik ga!</button>`;
  document.body.append(coach);
  coach.querySelector('.coach__ok').addEventListener('click', () => {
    try {
      localStorage.setItem(COACH_KEY, '1');
    } catch {}
    hide(coach, { then: () => coach.remove() });
  });
}

// ---------- All ten stamps ----------
// The end of the rally: your Twinny in every colour, all ten stamps landing one by one.
function showFinale() {
  const finale = document.createElement('section');
  finale.className = 'finale';
  finale.setAttribute('role', 'dialog');
  finale.setAttribute('aria-label', 'Alle stempels verzameld');
  finale.innerHTML = `
    <div class="finale__card">
      <div class="finale__twinny">${twinnySvg(collectedThemes())}</div>
      <h2>Heel Rotterdam!</h2>
      <p>Je hebt alle tien Buddies geholpen. Elke stempel staat in je boek.</p>
      <ol class="finale__stamps" aria-hidden="true">
        ${LOCATIONS.map((loc, i) => `<li style="--i:${i}"><img src="${stampUrl(loc.id)}" alt=""></li>`).join('')}
      </ol>
      <button class="btn btn--action" data-finale="book">Bekijk je stempelboek</button>
      <button class="btn btn--quiet" data-finale="map">Terug naar de kaart</button>
    </div>`;
  document.body.append(finale);
  finale.addEventListener('click', (e) => {
    const go = e.target.closest('[data-finale]');
    if (!go) return;
    hide(finale, { then: () => finale.remove() });
    if (go.dataset.finale === 'book') toggleSheet(true);
  });
}

const debug = new URLSearchParams(location.search).has('debug');
setTestMode(debug);
// For test scripts: collect a stamp without playing the minigame.
if (debug) window.citiverse = { collect: (id) => collect(LOCATIONS.find((l) => l.id === id), { onSite: false }), finale: showFinale, tapStop: onStopTapped, where: () => position ?? lastPosition };

renderCredits(els.credits, LOCATIONS);
requestPersistence();
initTts();
renderLevel();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
render();
