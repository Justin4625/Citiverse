// XP, levels and achievements. Everything stays on this device.
//
// XP for a game = 50 for finishing + up to 150 for the share of the game you got right.
// Playing on site counts in full, playing from a distance counts half. Replaying a stop only
// adds the difference with your best result there, so grinding the same game doesn't pay.

const KEY = 'citiverse.progress.v1';

export const LEVELS = [
  { name: 'Nieuwkomer', xp: 0 },
  { name: 'Buurtbewoner', xp: 300 },
  { name: 'Stadskenner', xp: 800 },
  { name: 'Rotterdammer', xp: 1500 },
  { name: 'Havenbaas', xp: 2400 },
];

export const ACHIEVEMENTS = [
  { id: 'eerste-stempel', name: 'Eerste stempel', text: 'Haal je eerste stempel op de plek zelf.' },
  { id: 'halverwege', name: 'Halverwege', text: 'Verzamel 5 stempels.' },
  { id: 'heel-rotterdam', name: 'Heel Rotterdam', text: 'Verzamel alle 10 stempels.' },
  { id: 'foutloos', name: 'Foutloos', text: 'Speel een minigame zonder fouten.' },
  { id: 'oplichtersjager', name: 'Oplichtersjager', text: 'Haal alles goed bij Nep of echt.' },
  { id: 'dagtocht', name: 'Dagtocht', text: 'Speel op één dag 3 stops op de plek zelf.' },
  { id: 'nieuwsgierig', name: 'Nieuwsgierig', text: 'Stel de Buddies samen 5 vragen.' },
  { id: 'thuisspeler', name: 'Thuisspeler', text: 'Speel een stop op afstand.' },
  { id: 'alle-thema', name: 'Alle rechten', text: 'Speel de minigame van alle 10 thema\'s.' },
  { id: 'havenbaas', name: 'Havenbaas', text: 'Bereik het hoogste level.' },
];

const empty = () => ({ xp: 0, best: {}, plays: {}, achievements: {}, questions: 0, days: {} });

export function loadProgress() {
  try {
    return { ...empty(), ...JSON.parse(localStorage.getItem(KEY)) };
  } catch {
    return empty();
  }
}

function save(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
  return p;
}

export function clearProgress() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
  return empty();
}

export function levelFor(xp) {
  let index = 0;
  LEVELS.forEach((l, i) => {
    if (xp >= l.xp) index = i;
  });
  const next = LEVELS[index + 1] ?? null;
  const from = LEVELS[index].xp;
  return {
    index,
    number: index + 1,
    name: LEVELS[index].name,
    next,
    // 0..1 progress towards the next level (1 at the top level)
    progress: next ? (xp - from) / (next.xp - from) : 1,
  };
}

export function xpFor(result, onSite) {
  const ratio = result.total ? Math.max(0, Math.min(1, result.correct / result.total)) : 1;
  const xp = 50 + Math.round(150 * ratio);
  return onSite ? xp : Math.round(xp / 2);
}

const today = () => new Date().toISOString().slice(0, 10);

function award(p, id, list) {
  if (!p.achievements[id] && ACHIEVEMENTS.some((a) => a.id === id)) {
    p.achievements[id] = new Date().toISOString();
    list.push(ACHIEVEMENTS.find((a) => a.id === id));
  }
}

// stamps: the stamp map after this play, to check stamp achievements.
// Returns { xpGained, levelBefore, levelAfter, newAchievements, progress }.
export function recordGame(stopId, result, { onSite, gameId, stamps = {}, totalStops = 10 }) {
  const p = loadProgress();
  const levelBefore = levelFor(p.xp);
  const xp = xpFor(result, onSite);
  const xpGained = Math.max(0, xp - (p.best[stopId] ?? 0));
  p.best[stopId] = Math.max(p.best[stopId] ?? 0, xp);
  p.xp += xpGained;
  p.plays[stopId] = (p.plays[stopId] ?? 0) + 1;
  if (onSite) {
    const d = today();
    p.days[d] = [...new Set([...(p.days[d] ?? []), stopId])];
  }

  const unlocked = [];
  if (result.total && result.correct === result.total) award(p, 'foutloos', unlocked);
  if (gameId === 'nep-of-echt' && result.correct === result.total) award(p, 'oplichtersjager', unlocked);
  if (!onSite) award(p, 'thuisspeler', unlocked);
  if ((p.days[today()] ?? []).length >= 3) award(p, 'dagtocht', unlocked);
  if (Object.keys(p.plays).length >= totalStops) award(p, 'alle-thema', unlocked);
  checkStamps(p, stamps, totalStops, unlocked);
  const levelAfter = levelFor(p.xp);
  if (levelAfter.index === LEVELS.length - 1) award(p, 'havenbaas', unlocked);

  save(p);
  return { xpGained, xp, levelBefore, levelAfter, newAchievements: unlocked, progress: p };
}

function checkStamps(p, stamps, totalStops, unlocked) {
  const n = Object.keys(stamps).length;
  if (n >= 1) award(p, 'eerste-stempel', unlocked);
  if (n >= 5) award(p, 'halverwege', unlocked);
  if (n >= totalStops) award(p, 'heel-rotterdam', unlocked);
}

// Called after a stamp is saved. Returns newly unlocked achievements.
export function recordStamps(stamps, totalStops) {
  const p = loadProgress();
  const unlocked = [];
  checkStamps(p, stamps, totalStops, unlocked);
  save(p);
  return unlocked;
}

export function recordQuestion() {
  const p = loadProgress();
  p.questions += 1;
  const unlocked = [];
  if (p.questions >= 5) award(p, 'nieuwsgierig', unlocked);
  save(p);
  return unlocked;
}
