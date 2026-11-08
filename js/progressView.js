// The "Voortgang" sheet: level, XP, badges and which themes you have played.

import { LEVELS, ACHIEVEMENTS, levelFor } from './progress.js';
import { STOPS } from './stops.js';
import { THEMES, starUrl, iconUrl } from './brand.js';

const STARS = Object.keys(THEMES);

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function renderProgress(el, p, locations, stamps) {
  const level = levelFor(p.xp);
  const stampCount = locations.filter((l) => stamps[l.id]).length;
  const played = locations.filter((l) => p.plays[l.id]).length;
  const unlocked = ACHIEVEMENTS.filter((a) => p.achievements[a.id]).length;

  el.innerHTML = `
    <div class="pv-level">
      <span class="pv-level__num">${level.number}</span>
      <div class="pv-level__info">
        <small>Level ${level.number} van ${LEVELS.length}</small>
        <strong>${level.name}</strong>
        <span class="pv-bar"><i style="width:${Math.round(level.progress * 100)}%"></i></span>
        <span class="pv-level__xp">${p.xp} XP${level.next ? ` · nog ${level.next.xp - p.xp} tot ${level.next.name}` : ' · hoogste level'}</span>
      </div>
    </div>

    <dl class="pv-stats">
      <div><dt>Stempels</dt><dd>${stampCount}/${locations.length}</dd></div>
      <div><dt>Thema's gespeeld</dt><dd>${played}/${locations.length}</dd></div>
      <div><dt>Badges</dt><dd>${unlocked}/${ACHIEVEMENTS.length}</dd></div>
    </dl>

    <h3 class="pv-h">Badges</h3>
    <ul class="pv-badges">
      ${ACHIEVEMENTS.map((a, i) => `<li class="pv-badge${p.achievements[a.id] ? ' pv-badge--on' : ''}">
        <img src="${starUrl(STARS[i % STARS.length])}" alt=""><strong>${esc(a.name)}</strong><small>${esc(a.text)}</small></li>`).join('')}
    </ul>

    <h3 class="pv-h">Thema's</h3>
    <ul class="pv-themes">
      ${locations.map((l) => {
        const stop = STOPS[l.id];
        const best = p.best[l.id];
        return `<li class="pv-theme${best ? ' pv-theme--on' : ''}">
          <img class="pv-theme__icon" src="${iconUrl(l.id)}" alt="">
          <span class="pv-theme__name"><strong>${esc(stop?.theme ?? '')}</strong><small>${esc(l.name)}${stop ? ` · ${esc(stop.card.title)}` : ''}</small></span>
          <span class="pv-theme__xp">${best ? `${best} XP` : 'Nog niet'}${stamps[l.id] ? ' · ✓' : ''}</span>
        </li>`;
      }).join('')}
    </ul>`;
}
