import { distanceM, formatDistance } from './geo.js';

export function renderBook(listEl, locations, stamps, position) {
  listEl.innerHTML = locations
    .map((loc) => {
      const at = stamps[loc.id];
      const detail = at
        ? `Collected ${new Date(at).toLocaleDateString()}`
        : position ? formatDistance(distanceM(position, loc)) : 'Not collected yet';
      return `<li class="stamp${at ? ' stamp--done' : ''}">
        <span class="stamp__emoji">${loc.emoji}</span>
        <span class="stamp__info"><strong>${loc.name}</strong><small>${detail}</small></span>
      </li>`;
    })
    .join('');
}
