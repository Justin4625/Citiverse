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
      reveal: ['Verzendkosten €4,95', 'Servicekosten €1,50'],
      fine: 'Exclusief verzendkosten (€4,95) en servicekosten (€1,50).',
      name: 'Verborgen kosten',
      explain: 'De lage prijs lokt je. Pas als je gaat betalen, komen er kosten bij. Een eerlijke winkel laat meteen zien wat je in totaal betaalt.',
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
      reveal: ['Dit hoesje kostte nooit €29,99. De "oude prijs" is verzonnen.'],
      fine: 'Van-prijs is een adviesprijs. Hier nooit voor verkocht.',
      name: 'Nepkorting',
      explain: 'Die doorgestreepte prijs heeft nooit echt gegolden. Zo lijkt een gewone prijs ineens een koopje. Kijk altijd even wat andere winkels vragen.',
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
      reveal: ['Na de gratis proef word je lid voor €4,99 per maand.', 'Dat gaat automatisch door tot je opzegt.'],
      fine: 'Proefabonnement. Daarna €4,99 per maand, verlengt automatisch.',
      name: 'Abonnementsval',
      explain: '"Gratis" was een proefabonnement dat vanzelf doorloopt. Kijk altijd wat er gebeurt als de gratis periode voorbij is.',
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
      reveal: ['De bezorgverzekering van €2,50 stond al aangevinkt.', '"Nog maar 2" stond er gisteren ook al.'],
      fine: 'Bezorgverzekering €2,50 standaard aangevinkt.',
      name: 'Al aangevinkt en nep "bijna op"',
      explain: 'Let je niet op, dan betaal je voor een extra dat al aangevinkt stond. En "nog maar 2" staat er vaak alleen zodat je je gaat haasten.',
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
  const receipt = [];

  isAvailable().then(async (ok) => {
    if (!ok) return;
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
        <div class="g__bar"><span>Kraam ${round + 1}/${ROUNDS.length}</span><span class="wallet"><i class="coin"></i>${euro(budget)}</span></div>
        ${round === 0 ? say(character, `<p>Je hebt ${euro(BUDGET)} voor vier dingen. Wat iets echt kost, staat in de kleine lettertjes. Tik erop om ze te lezen, of sleep het vergrootglas erheen.</p>`) : ''}
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
    const r = ROUNDS[round];
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
      `      <p class="g__verdict ${honest ? 'is-right' : 'is-wrong'}">${honest ? 'Eerlijke deal' : `Truc: ${escapeHtml(r.trick.name)}`}</p>
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
        ? `Je staat ${euro(-budget)} rood. En misschien loopt er nog een abonnement. Door trucs wordt alles duurder dan het lijkt.`
        : correct === ROUNDS.length
          ? `Je hebt nog ${euro(budget)} over en je trapte nergens in. Jou houden ze niet voor de gek!`
          : `Je hebt nog ${euro(budget)} over. Met de eerlijke aanbiedingen had je ${euro(BUDGET - ROUNDS.reduce((s, r) => s + r.honest.real, 0))} over gehad.`;
    endScreen(el, {
      big: `${correct}/${ROUNDS.length}`,
      sub: 'eerlijke keuzes',
      character,
      line: escapeHtml(line),
      extra: `<div class="receipt"><p class="receipt__head">MARKTHAL ROTTERDAM<br>KASSABON</p>
          ${receipt.map((x) => `<p class="receipt__row"><span>${escapeHtml(x.item)}${x.trick ? `<small>${escapeHtml(x.trick)}</small>` : ''}</span><b>${euro(x.paid)}</b></p>`).join('')}
          <p class="receipt__row receipt__total"><span>Totaal</span><b>${euro(receipt.reduce((s, x) => s + x.paid, 0))}</b></p>
          <p class="receipt__row"><span>Over</span><b>${euro(budget)}</b></p></div>
        <p class="g__hint">Je hebt er recht op om te weten wat je koopt. Dus: meteen de hele prijs, geen nepkortingen en geen verstopte abonnementen.</p>${aiMade ? '<p class="g__ai">Een AI heeft de reclameteksten bij de trucs geschreven. Webshops maken ze net zo snel.</p>' : ''}`,
      onDone: () => onFinish({ correct, total: ROUNDS.length, summary: 'eerlijke keuzes' }),
    });
  }

  render();
  return () => {
    destroyed = true;
  };
}
