import { distanceM, formatDistance } from './geo.js';
import { photoUrl } from './locations.js';
import { stampUrl, iconUrl, themeOf } from './brand.js';

const dateFormat = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' });

export function renderBook(listEl, locations, stamps, position) {
  listEl.innerHTML = locations
    .map((loc) => {
      const at = stamps[loc.id];
      const detail = at
        ? `Verzameld op ${dateFormat.format(new Date(at))}`
        : position ? formatDistance(distanceM(position, loc)) : 'Nog niet verzameld';
      return `<li class="card${at ? ' card--done' : ''}" data-id="${loc.id}" role="button" tabindex="0" aria-label="${loc.name} spelen">
        <span class="card__photo">
          <img src="${photoUrl(loc)}" alt="" loading="lazy" style="object-position:${loc.focus}">
          <img class="card__stamp" src="${stampUrl(loc.id)}" alt="">
        </span>
        <span class="card__info">
          <small><img src="${iconUrl(loc.id)}" alt="">${themeOf(loc.id)}</small>
          <strong>${loc.name}</strong>
          <span class="card__detail">${detail}</span>
        </span>
      </li>`;
    })
    .join('');
}

export function renderCredits(el, locations) {
  el.innerHTML = locations
    .map(
      ({ name, credit }) =>
        `<li>${name}: <a href="${credit.url}" target="_blank" rel="noopener">${credit.author}</a>, ${credit.license}</li>`,
    )
    .join('');
}
