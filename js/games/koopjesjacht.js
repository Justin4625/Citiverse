// "Koopjesjacht" (Fair, Markthal, Fairy).
// You have €30 and a shopping list of four things. At each stall two offers compete, and you take
// your time to choose. One is honest, the other uses a trick: hidden costs, a fake discount, a
// subscription trap or a pre-ticked extra. The truth is in the small print, which you can only
// read with the magnifying glass.
// At the end your receipt shows what you really paid.
// Score: the number of honest offers you picked.
// AI: writes the flashy slogan for the trick offers (never prices: those stay fixed).

import { chat, isAvailable } from '../ai.js';
import { escapeHtml, say, endScreen, shuffle, parseJson } from './kit.js';
import { guide } from './guide.js';

const BUDGET = 30;
const euro = (v) => `€${v.toFixed(2).replace('.', ',')}`;

const ROUNDS = [
  {
    item: 'Een oplader voor je telefoon',
    honest: { shop: 'Kraam van Fairy', title: 'USB-C oplader', price: 9, lines: ['Gratis meenemen'], real: 9, fine: 'Totaalprijs. Er komt niks bij.' },
    trick: {
      shop: 'SuperDeal Online',
      title: 'USB-C oplader',
      price: 4.99,
      slogan: 'Laagste prijs van Nederland!',
      lines: ['Op voorraad'],
      real: 11.44,
      reveal: ['Er komt nog €6,45 aan kosten bij.'],
      fine: 'Let op: plus €4,95 verzendkosten en €1,50 servicekosten.',
      name: 'Verborgen kosten',
      explain: 'Pas bij het betalen komen er kosten bij.',
    },
  },
  {
    item: 'Een telefoonhoesje',
    honest: { shop: 'Kraam van Fairy', title: 'Hoesje, zwart', price: 7.5, lines: [], real: 7.5, fine: 'Vaste prijs, elke dag.' },
    trick: {
      shop: 'TrendyCases',
      title: 'Hoesje, zwart',
      price: 8.99,
      was: 29.99,
      slogan: 'Mega-korting, alleen vandaag!',
      lines: [],
      real: 8.99,
      reveal: ['De "oude prijs" was verzonnen.'],
      fine: 'De oude prijs is nooit gevraagd. Het kostte altijd €8,99.',
      name: 'Nepkorting',
      explain: 'De oude prijs was verzonnen. Het is geen koopje.',
    },
  },
  {
    item: 'Bubble tea voor onderweg',
    honest: { shop: 'Theekraam', title: 'Bubble tea', price: 4, lines: [], real: 4, fine: 'Eén beker, geen abonnement.' },
    trick: {
      shop: 'SipClub app',
      title: 'Bubble tea',
      price: 0,
      slogan: 'Gratis bij aanmelding!',
      lines: ['Meld je aan in de app'],
      real: 4.99,
      reveal: ['"Gratis" was een abonnement van €4,99 per maand.'],
      fine: 'Proefabonnement: daarna €4,99 per maand. Stopt niet vanzelf.',
      name: 'Abonnementsval',
      explain: '"Gratis" was een abonnement. Daarna betaal je elke maand.',
    },
  },
  {
    item: 'Een armband als cadeau',
    honest: { shop: 'Sieradenkraam', title: 'Zilverkleurige armband', price: 6.5, lines: [], real: 6.5, fine: 'Inclusief verzending.' },
    trick: {
      shop: 'GiftShop24',
      title: 'Zilverkleurige armband',
      price: 6,
      slogan: 'Nog maar 2 op voorraad!',
      lines: ['☑ Bezorgverzekering'],
      real: 8.5,
      reveal: ['Er stond al een extra van €2,50 aangevinkt.'],
      fine: 'Bezorgverzekering van €2,50 staat al aangevinkt.',
      name: 'Al aangevinkt',
      explain: 'Er stond al een extra aangevinkt. Dat betaal je ook.',
    },
  },
];

// The practice round has its own stall, never used in the real game.
const PRACTICE = {
  item: 'Een pen voor school',
  honest: { shop: 'Kraam van Fairy', title: 'Blauwe pen', price: 2, lines: [], real: 2, fine: 'Gewoon €2. Klaar.' },
  trick: {
    shop: 'PenDeal Online',
    title: 'Blauwe pen',
    price: 0.5,
    slogan: 'Bijna gratis!',
    lines: [],
    real: 5.45,
    reveal: ['Er komt nog €4,95 verzendkosten bij.'],
    fine: 'Let op: plus €4,95 verzendkosten.',
    name: 'Verborgen kosten',
    explain: 'Pas bij het betalen komen er kosten bij.',
  },
};

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

export function mount(el, { practice = false, onPracticeDone = () => {}, onFinish, character }) {
  const rounds = practice ? [PRACTICE] : ROUNDS;
  let round = 0;
  let budget = BUDGET;
  let correct = 0;
  let slogans = null;
  let destroyed = false;
  let aiMade = false;
  const receipt = [];

  isAvailable().then(async (ok) => {
    if (!ok || practice) return;
    slogans = await aiSlogans();
  });

  function offerHtml(o, key) {
    return `<div class="offer" data-k="${key}">
      <small>${escapeHtml(o.shop)}</small>
      <strong>${escapeHtml(o.title)}</strong>
      ${o.slogan ? `<span class="offer__slogan">${escapeHtml(o.slogan)}</span>` : ''}
      <span class="offer__price">${o.was ? `<s>${euro(o.was)}</s> ` : ''}${o.price === 0 ? 'Gratis' : euro(o.price)}</span>
      ${o.lines.map((l) => `<span class="offer__line">${escapeHtml(l)}</span>`).join('')}
      <button class="fine" data-fine type="button" aria-label="Lees de kleine lettertjes"><span>*${escapeHtml(o.fine)}</span><em class="fine__tap" aria-hidden="true">🔍 Tik om te lezen</em></button>
      <button class="btn btn--action offer__buy" data-buy="${key}">Kopen</button>
    </div>`;
  }

  function render() {
    const r = rounds[round];
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
        <div class="g__bar"><span>${practice ? "Oefenkraam" : `Kraam ${round + 1}/${rounds.length}`}</span><span class="wallet"><i class="coin"></i>${euro(budget)}</span></div>
        <p class="g__title">${escapeHtml(r.item)}</p>
        <div class="offers">
          ${pair.map(([k, o]) => offerHtml(o, k)).join('')}
          <span class="loupe" aria-hidden="true"><span class="loupe__glass"></span><span class="loupe__handle"></span></span>
        </div>
      </div>`;
    setupLoupe();
    el.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => reveal(b.dataset.buy)));
  }

  function setupLoupe() {
    const wrap = el.querySelector('.offers');
    const loupe = wrap.querySelector('.loupe');
    const fines = [...wrap.querySelectorAll('[data-fine]')];
    const place = (x, y) => {
      const r = wrap.getBoundingClientRect();
      const lx = Math.max(0, Math.min(r.width, x - r.left));
      const ly = Math.max(0, Math.min(r.height, y - r.top));
      loupe.style.left = `${lx}px`;
      loupe.style.top = `${ly}px`;
      for (const f of fines) {
        const b = f.getBoundingClientRect();
        if (x > b.left - 20 && x < b.right + 20 && y > b.top - 24 && y < b.bottom + 24) f.classList.add('is-read');
      }
    };
    let drag = false;
    loupe.addEventListener('pointerdown', (e) => {
      drag = true;
      loupe.setPointerCapture(e.pointerId);
      loupe.classList.add('is-drag');
    });
    loupe.addEventListener('pointermove', (e) => drag && place(e.clientX, e.clientY));
    // Let go: the loupe returns to its spot under the offers, so it never covers a Kopen button.
    const park = () => {
      drag = false;
      loupe.classList.remove('is-drag');
      loupe.style.left = '';
      loupe.style.top = '';
    };
    loupe.addEventListener('pointerup', park);
    loupe.addEventListener('pointercancel', park);
    // Tapping the fine print reads it right away.
    fines.forEach((f) => f.addEventListener('click', () => f.classList.add('is-read')));
  }

  function reveal(key) {
    const r = rounds[round];
    const honest = key === 'honest';
    const paid = honest ? r.honest.real : r.trick.real;
    budget = Math.round((budget - paid) * 100) / 100;
    if (honest) correct += 1;
    receipt.push({ item: r.honest.title, paid, trick: honest ? null : r.trick.name });
    el.querySelector('.loupe')?.remove();
    el.querySelectorAll('.offer').forEach((o) => {
      o.classList.add(o.dataset.k === 'honest' ? 'is-honest' : 'is-trick');
      if (o.dataset.k === key) o.classList.add('is-bought');
      o.querySelector('.fine').classList.add('is-read');
      o.querySelectorAll('button').forEach((b) => (b.disabled = true));
    });
    const w = el.querySelector('.wallet');
    w.innerHTML = `<i class="coin"></i>${euro(budget)}`;
    w.classList.add('is-paying');
    el.querySelector('.g').insertAdjacentHTML(
      'beforeend',
      `<div class="g__pop">
      <p class="g__verdict ${honest ? 'is-right' : 'is-wrong'}">${honest ? 'Eerlijke deal' : `Truc: ${escapeHtml(r.trick.name)}`}</p>
      ${say(
        character,
        honest
          ? `<p>Goed! De andere was een truc. ${escapeHtml(r.trick.reveal[0])}</p>`
          : `<p>Je betaalt eigenlijk ${euro(paid)}. ${escapeHtml(r.trick.explain)}</p>`,
      )}
      <button class="btn btn--action g__wide" data-next>${round < rounds.length - 1 ? 'Volgende kraam' : 'Afrekenen'}</button>
      </div>`,
    );
    el.querySelector('[data-next]').addEventListener('click', () => {
      round += 1;
      if (round < rounds.length) render();
      else finish();
    });
  }

  function finish() {
    // A practice round never shows a score: it goes straight on to the real game.
    if (practice) return onPracticeDone();
    const line =
      budget < 0
        ? `Je staat ${euro(-budget)} rood. Trucs maken alles duurder.`
        : correct === rounds.length
          ? `Je hebt nog ${euro(budget)} over en je trapte nergens in. Jou houden ze niet voor de gek!`
          : `Je hebt nog ${euro(budget)} over. Bij de eerlijke kraam had je meer overgehouden.`;
    endScreen(el, {
      big: `${correct}/${rounds.length}`,
      sub: 'eerlijke keuzes',
      character,
      line: escapeHtml(line),
      extra: `<div class="receipt"><p class="receipt__head">MARKTHAL ROTTERDAM<br>KASSABON</p>
          ${receipt.map((x) => `<p class="receipt__row"><span>${escapeHtml(x.item)}${x.trick ? `<small>${escapeHtml(x.trick)}</small>` : ''}</span><b>${euro(x.paid)}</b></p>`).join('')}
          <p class="receipt__row receipt__total"><span>Totaal</span><b>${euro(receipt.reduce((s, x) => s + x.paid, 0))}</b></p>
          <p class="receipt__row"><span>Over</span><b>${euro(budget)}</b></p></div>
        <p class="g__hint">Je hebt het recht om te weten wat iets echt kost.</p>${aiMade ? '<p class="g__ai">Een AI heeft de reclameteksten bij de trucs geschreven. Webshops maken ze net zo snel.</p>' : ''}`,
      onDone: () => onFinish({ correct, total: rounds.length, summary: 'eerlijke keuzes' }),
    });
  }

  render();
  // Practice round: read both small prints, then buy.
  const stopGuide = practice && guide(el, [
    { target: () => el.querySelectorAll('[data-fine]')[0], text: 'Wat kost het echt? Tik op de kleine letters.' },
    { target: () => el.querySelectorAll('[data-fine]')[1], text: 'En hier ook.' },
    { target: '.offers', text: 'Welke is eerlijk? Tik op Kopen.', hand: false, wait: () => !!el.querySelector('.g__verdict') },
    { target: '.g__pop', text: 'Hier zie je of het een truc was.', wait: 'ok', after: 0 },
  ], { onDone: onPracticeDone });
  return () => {
    if (stopGuide) stopGuide();
    destroyed = true;
  };
}
