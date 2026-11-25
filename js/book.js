import { distanceM } from './geo.js';
import { photoUrl } from './locations.js';
import { buddyUrl, stampUrl, iconUrl, themeOf } from './brand.js';
import { characterOf } from './stop.js';

// The stamp book is also the "nearby" list: first the stops still to do, nearest first, each
// with how far it is and a Route button (or "Help <Buddy>" when you are there), then the
// stamps you collected.

const dateFormat = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' });

// About 5 km/h, rounded up to whole minutes.
function walkTime(m) {
  const min = Math.max(1, Math.ceil(m / 83));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} u ${min % 60} min`;
}

function formatM(m) {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

export function sortByDistance(locations, position) {
  if (!position) return [...locations];
  return [...locations].sort((a, b) => distanceM(position, a) - distanceM(position, b));
}

function card(loc, { done, near, m, routeTo }) {
  const who = characterOf(loc.id);
  let detail = 'Nog niet verzameld';
  if (done) detail = `Verzameld op ${dateFormat.format(new Date(done))}`;
  else if (near) detail = 'Je bent er!';
  else if (m !== null) detail = `${formatM(m)} · ${walkTime(m)} lopen`;

  let action = '';
  if (!done && near) {
    action = `<button class="card__go card__go--here" data-play="${loc.id}">${who ? `Help ${who.name}` : 'Stempel pakken'}</button>`;
  } else if (!done && m !== null) {
    action = routeTo === loc.id
      ? `<button class="card__go card__go--on" data-route="">Stop route</button>`
      : `<button class="card__go" data-route="${loc.id}">Route</button>`;
  }

  return `<li class="card${done ? ' card--done' : ''}${near ? ' card--here' : ''}">
    <button class="card__open" data-id="${loc.id}" aria-label="${loc.name} bekijken">
      <span class="card__photo">
        <img src="${photoUrl(loc)}" alt="" loading="lazy" style="object-position:${loc.focus}">
        ${done ? `<img class="card__stamp" src="${stampUrl(loc.id)}" alt="">` : `<img class="card__buddy" src="${buddyUrl(loc.id)}" alt="">`}
      </span>
      <span class="card__info">
        <small><img src="${iconUrl(loc.id)}" alt="">${themeOf(loc.id)}</small>
        <strong>${loc.name}</strong>
        <span class="card__detail">${detail}</span>
      </span>
    </button>
    ${action}
  </li>`;
}

export function renderBook(el, locations, stamps, { position, isNear, routeTo }) {
  const sorted = sortByDistance(locations, position);
  const open = sorted.filter((loc) => !stamps[loc.id]);
  const done = locations.filter((loc) => stamps[loc.id]);
  const info = (loc) => ({
    done: stamps[loc.id],
    near: !stamps[loc.id] && Boolean(isNear(loc)),
    m: position ? distanceM(position, loc) : null,
    routeTo,
  });
  const section = (title, list) =>
    list.length ? `<h3 class="book__head">${title}</h3><ul class="cards">${list.map((loc) => card(loc, info(loc))).join('')}</ul>` : '';
  el.innerHTML =
    section(position ? 'Nog te doen, dichtbij eerst' : 'Nog te doen', open) +
    section('Verzameld', done) +
    (open.length ? '' : '<p class="book__all">Je hebt alle stempels!</p>');
}

// Ten small stamps under the title, coloured in as you collect them.
export function renderStampRow(el, locations, stamps) {
  el.innerHTML = locations
    .map((loc) => `<li class="${stamps[loc.id] ? 'is-done' : ''}"><img src="${stampUrl(loc.id)}" alt=""></li>`)
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
