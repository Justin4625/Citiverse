import { distanceM } from './geo.js';
import { photoUrl } from './locations.js';
import { buddyUrl, iconUrl, themeOf } from './brand.js';
import { characterOf } from './stop.js';

// The "In de buurt" list: every stop, nearest first, with a walking route in Google Maps.
// The route opens Google Maps itself (app on a phone, website elsewhere), so no API key is needed.

export function routeUrl(loc) {
  return `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}&travelmode=walking`;
}

// About 5 km/h, rounded up to whole minutes.
function walkTime(m) {
  const min = Math.max(1, Math.ceil(m / 83));
  return min < 60 ? `${min} min lopen` : `${Math.floor(min / 60)} u ${min % 60} min lopen`;
}

function formatM(m) {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

export function sortByDistance(locations, position) {
  if (!position) return [...locations];
  return [...locations].sort((a, b) => distanceM(position, a) - distanceM(position, b));
}

export function renderNearby(listEl, locations, { stamps, position, isNear, testMode }) {
  listEl.innerHTML = sortByDistance(locations, position)
    .map((loc) => {
      const done = Boolean(stamps[loc.id]);
      const near = isNear(loc);
      const m = position ? distanceM(position, loc) : null;
      const who = characterOf(loc.id);
      const where = near ? 'Je bent er!' : m === null ? loc.area : `${formatM(m)} · ${walkTime(m)}`;
      const action = near
        ? `<button class="near__go near__go--here" data-play="${loc.id}">${who ? `Help ${who.name}` : 'Stempel pakken'}</button>`
        : testMode
          ? `<button class="near__go" data-jump="${loc.id}">Ga hierheen</button>`
          : `<a class="near__go" href="${routeUrl(loc)}" target="_blank" rel="noopener">Route</a>`;
      return `<li class="near${done ? ' near--done' : ''}${near ? ' near--here' : ''}">
        <span class="near__photo">
          <img src="${photoUrl(loc)}" alt="" loading="lazy" style="object-position:${loc.focus}">
          <img class="near__buddy" src="${buddyUrl(loc.id)}" alt="">
        </span>
        <span class="near__info">
          <small><img src="${iconUrl(loc.id)}" alt="">${themeOf(loc.id)}${done ? ' · verzameld' : ''}</small>
          <strong>${loc.name}</strong>
          <span>${where}</span>
        </span>
        ${action}
      </li>`;
    })
    .join('');
}

// The small round button bottom right shows the buddies of the three nearest open stops.
export function renderNearbyButton(el, locations, { stamps, position }) {
  const open = sortByDistance(locations, position).filter((loc) => !stamps[loc.id]).slice(0, 3);
  el.querySelector('.nearby-btn__faces').innerHTML = open.map((loc) => `<img src="${buddyUrl(loc.id)}" alt="">`).join('');
}
