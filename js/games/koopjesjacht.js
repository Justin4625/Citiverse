// "Koopjesjacht" (Fair, Markthal, Yasmina).
// You have €30 and a shopping list of four things. For each one you choose between two offers.
// One is honest, the other uses a trick: hidden costs, a fake discount, a subscription trap or a
// pre-ticked extra. Only after you choose do you see what you really pay.
// Score: the number of honest offers you picked.
// AI: writes the flashy slogan for the trick offers (never prices: those stay fixed).

import { chat, isAvailable } from '../ai.js';
import { escapeHtml, say, endScreen, shuffle, parseJson } from './kit.js';

const BUDGET = 30;
const euro = (v) => `€${v.toFixed(2).replace('.', ',')}`;

const ROUNDS = [
  {
    item: 'Een oplader voor je telefoon',
    honest: { shop: 'Kraam van Yasmina', title: 'USB-C oplader', price: 9, lines: ['Gratis meenemen'], real: 9 },
    trick: {
      shop: 'SuperDeal Online',
      title: 'USB-C oplader',
      price: 4.99,
      slogan: 'Laagste prijs van Nederland!',
      lines: ['Op voorraad'],
      real: 11.44,
      reveal: ['Verzendkosten €4,95', 'Servicekosten €1,50'],
      name: 'Verborgen kosten',
      explain: 'De lage prijs lokt je, en pas bij het betalen komen er kosten bij. Een eerlijke winkel laat de totaalprijs meteen zien.',
    },
  },
  {
    item: 'Een telefoonhoesje',
    honest: { shop: 'Kraam van Yasmina', title: 'Hoesje, zwart', price: 7.5, lines: [], real: 7.5 },
    trick: {
      shop: 'TrendyCases',
      title: 'Hoesje, zwart',
      price: 8.99,
      was: 29.99,
      slogan: 'Mega-korting, alleen vandaag!',
      lines: [],
      real: 8.99,
      reveal: ['Dit hoesje kostte nooit €29,99. De "oude prijs" is verzonnen.'],
      name: 'Nepkorting',
      explain: 'Een doorgestreepte prijs die nooit echt gevraagd werd, laat een gewone prijs als koopje voelen. Vergelijk altijd met andere winkels.',
    },
  },
  {
    item: 'Bubble tea voor onderweg',
    honest: { shop: 'Theekraam', title: 'Bubble tea', price: 4, lines: [], real: 4 },
    trick: {
      shop: 'SipClub app',
      title: 'Bubble tea',
      price: 0,
      slogan: 'Gratis bij aanmelding!',
      lines: ['Meld je aan in de app'],
      real: 4.99,
      reveal: ['Na de gratis proef word je lid voor €4,99 per maand.', 'Dat gaat automatisch door tot je opzegt.'],
      name: 'Abonnementsval',
      explain: '"Gratis" was een proefabonnement dat vanzelf doorloopt. Lees altijd wat er na de proefperiode gebeurt.',
    },
  },
  {
    item: 'Een armband als cadeau',
    honest: { shop: 'Sieradenkraam', title: 'Zilverkleurige armband', price: 6.5, lines: [], real: 6.5 },
    trick: {
      shop: 'GiftShop24',
      title: 'Zilverkleurige armband',
      price: 6,
      slogan: 'Nog maar 2 op voorraad!',
      lines: ['☑ Bezorgverzekering'],
      real: 8.5,
      reveal: ['De bezorgverzekering van €2,50 stond al aangevinkt.', '"Nog maar 2" stond er gisteren ook al.'],
      name: 'Vooraf aangevinkt en nepschaarste',
      explain: 'Een extra dat al aangevinkt staat, betaal je als je niet oplet. En "nog maar 2" is vaak bedoeld om je te haasten.',
    },
  },
];

async function aiSlogans() {
  const reply = await chat(
    [
      {
        role: 'system',
        content:
          'Je schrijft korte, opvallende reclameslogans voor een leerzaam spel over eerlijk kopen. Nederlands, maximaal 6 woorden per slogan, geen cijfers, geen prijzen, geen merknamen. ' +
          'Antwoord alleen met JSON: {"slogans": ["...", "...", "...", "..."]}',
      },
      { role: 'user', content: `Maak 4 slogans voor: ${ROUNDS.map((r) => r.trick.title).join(', ')}.` },
    ],
    { json: true, temperature: 0.9, maxTokens: 120 },
  );
  const list = parseJson(reply)?.slogans;
  if (!Array.isArray(list) || list.length < ROUNDS.length) return null;
  return list.slice(0, ROUNDS.length).map((s) => (typeof s === 'string' && s.length < 50 && !/\d/.test(s) ? s : null));
}

export function mount(el, { onFinish, character }) {
  let round = 0;
  let budget = BUDGET;
  let correct = 0;
  let slogans = null;
  let destroyed = false;
  let aiMade = false;

  isAvailable().then(async (ok) => {
    if (!ok) return;
    slogans = await aiSlogans();
  });

  function offerHtml(o, key) {
    return `<button class="offer" data-k="${key}">
      <small>${escapeHtml(o.shop)}</small>
      <strong>${escapeHtml(o.title)}</strong>
      ${o.slogan ? `<span class="offer__slogan">${escapeHtml(o.slogan)}</span>` : ''}
      <span class="offer__price">${o.was ? `<s>${euro(o.was)}</s> ` : ''}${o.price === 0 ? 'Gratis' : euro(o.price)}</span>
      ${o.lines.map((l) => `<span class="offer__line">${escapeHtml(l)}</span>`).join('')}
    </button>`;
  }

  function render() {
    const r = ROUNDS[round];
    const trick = { ...r.trick };
    if (slogans?.[round]) {
      trick.slogan = slogans[round];
      aiMade = true;
    }
    const pair = shuffle([
      ['honest', r.honest],
      ['trick', trick],
    ]);
    el.innerHTML = `
      <div class="g">
        <div class="g__bar"><span>${round + 1}/${ROUNDS.length}</span><span class="wallet">Portemonnee: ${euro(budget)}</span></div>
        ${round === 0 ? say(character, `<p>Je hebt ${euro(BUDGET)} voor vier dingen. Bij elke kraam kies je een aanbieding. Let op: niet alles is wat het lijkt.</p>`) : ''}
        <p class="g__title">${escapeHtml(r.item)}</p>
        <div class="offers">${pair.map(([k, o]) => offerHtml(o, k)).join('')}</div>
      </div>`;
    el.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => reveal(b.dataset.k)));
  }

  function reveal(key) {
    const r = ROUNDS[round];
    const honest = key === 'honest';
    const paid = honest ? r.honest.real : r.trick.real;
    budget = Math.round((budget - paid) * 100) / 100;
    if (honest) correct += 1;
    el.querySelectorAll('[data-k]').forEach((b) => {
      b.disabled = true;
      b.classList.add(b.dataset.k === 'honest' ? 'is-honest' : 'is-trick');
    });
    el.querySelector('.wallet').textContent = `Portemonnee: ${euro(budget)}`;
    el.querySelector('.g').insertAdjacentHTML(
      'beforeend',
      `<p class="g__verdict ${honest ? 'is-right' : 'is-wrong'}">${honest ? 'Eerlijke deal' : `Truc: ${escapeHtml(r.trick.name)}`}</p>
      ${say(
        character,
        honest
          ? `<p>Je betaalt ${euro(paid)}, precies wat erop stond. De andere aanbieding was een truc: ${escapeHtml(r.trick.name.toLowerCase())}.</p><ul>${r.trick.reveal.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>`
          : `<p>Je betaalt eigenlijk ${euro(paid)}.</p><ul>${r.trick.reveal.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul><p>${escapeHtml(r.trick.explain)}</p>`,
      )}
      <button class="btn btn--action g__wide" data-next>${round < ROUNDS.length - 1 ? 'Volgende kraam' : 'Afrekenen'}</button>`,
    );
    el.querySelector('[data-next]').addEventListener('click', () => {
      round += 1;
      if (round < ROUNDS.length) render();
      else finish();
    });
    el.querySelector('[data-next]').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function finish() {
    const line =
      budget < 0
        ? `Je staat ${euro(-budget)} rood, en je hebt misschien nog een abonnement lopen. Trucs maken dingen duurder dan ze lijken.`
        : correct === ROUNDS.length
          ? `Je hebt nog ${euro(budget)} over en trapte nergens in. Jij laat je niet beetnemen!`
          : `Je hebt nog ${euro(budget)} over. Met de eerlijke aanbiedingen was dat ${euro(BUDGET - ROUNDS.reduce((s, r) => s + r.honest.real, 0))} geweest.`;
    endScreen(el, {
      big: `${correct}/${ROUNDS.length}`,
      sub: 'eerlijke keuzes',
      character,
      line: escapeHtml(line),
      extra: `<p class="g__hint">Je hebt recht op eerlijke informatie over wat je koopt: de totaalprijs vooraf, geen nepkortingen en geen verborgen abonnementen.</p>${aiMade ? '<p class="g__ai">De reclameteksten bij de trucs zijn door AI geschreven. Zo snel maken webshops ze ook.</p>' : ''}`,
      onDone: () => onFinish({ correct, total: ROUNDS.length, summary: 'eerlijke keuzes' }),
    });
  }

  render();
  return () => {
    destroyed = true;
  };
}
