// "Overtuig de stad" (Opinion, Euromast, Opiny).
// A debate battle. Pick a statement and a side. The audience sits between you and Opiny, who
// argues the other side. Each round Opiny attacks with a counterargument and the audience drifts
// her way; you answer by playing one of three argument cards, with no clock. Strong
// arguments pull the audience back, fallacies hardly move them, and the card flips to show what
// kind of argument it was. Win the audience over and the Euromast lift takes you to the top,
// where you see which side earlier players on this device chose.
// No AI and no typing: you always play one of the argument cards.

import { escapeHtml, shuffle, say, endScreen, tally } from './kit.js';
import { guide } from './guide.js';

const HEIGHT_M = 185;
const AUDIENCE = 24;
const PULL = { 3: 50, 2: 28, 1: 6 };
const ATTACK = 18;

// What kind of argument each weak card is, shown when it flips.
const FALLACY = {
  'Vroeger hadden': 'Vroeger was het ook zo',
  'Niemand zoekt': 'Overdrijving',
  'Mijn mentor': 'Iemand zei het',
  'Ik let altijd': 'Eén voorbeeld',
  'Volwassenen zitten': 'Wijzen naar een ander',
  'Dat is gewoon een slecht': 'Geen reden',
  'Als je niks fout': 'Klinkt goed, klopt niet',
  'Iedereen maakt weleens': 'Het kleiner maken dan het is',
  'Dat gebeurt toch': 'Ontkennen',
  'Ik vind camera': 'Alleen een gevoel',
  'Niemand wil': 'Overdrijving',
  'Die steden': 'Schelden',
  'Ouderen weten': 'Wijzen naar een ander',
  'Mijn ouders kiezen': 'Eén voorbeeld',
  'Ingewikkeld is geen': 'Geen reden',
  'Jongeren hebben toch': 'Alle jongeren hetzelfde',
  'Werken is iets anders': 'Geen reden',
  'Dat kan me niet': 'Geen argument',
};
const typeOf = (a) =>
  a.points === 3 ? 'Sterk!' : a.points === 2 ? 'Kan beter' : Object.entries(FALLACY).find(([k]) => a.text.startsWith(k))?.[1] ?? 'Zwak';

// For each statement and side: three counterarguments from Opiny, each with three answers.
// points 3 = strong, 2 = reasonable, 1 = weak. `why` explains the weak and reasonable ones.
const STATEMENTS = [
  {
    id: 'telefoon',
    text: 'Mobiele telefoons moeten de hele schooldag in een kluisje.',
    eens: [
      {
        counter: 'Maar wat als je ouders je in een noodgeval willen bereiken?',
        answers: [
          { text: 'In een noodgeval kunnen ouders de school bellen, en die regelt het meteen.', points: 3 },
          { text: 'Noodgevallen zijn heel zeldzaam.', points: 2, why: 'Klopt, maar ouders blijven zich zorgen maken. Bedenk een oplossing.' },
          { text: 'Vroeger hadden ze ook geen telefoons en ging het ook goed.', points: 1, why: 'Dat het vroeger anders ging, zegt niet dat het nu beter is.' },
        ],
      },
      {
        counter: 'Telefoons zijn ook handig om dingen op te zoeken in de les.',
        answers: [
          { text: 'Daar heeft school laptops voor. Daar krijg je geen meldingen op.', points: 3 },
          { text: 'Je kunt ook gewoon een boek gebruiken.', points: 2, why: 'Kan, maar een boek is niet altijd handig.' },
          { text: 'Niemand zoekt echt iets op, iedereen zit op TikTok.', points: 1, why: 'Dat is overdreven. Niet iedereen zit op TikTok.' },
        ],
      },
      {
        counter: 'Jongeren moeten zelf leren omgaan met hun telefoon.',
        answers: [
          { text: 'Apps zijn gemaakt om je vast te houden. Oefenen kan thuis.', points: 3 },
          { text: 'Op school ben je om te leren, niet om met je telefoon te oefenen.', points: 2, why: 'Kan, maar je zegt niet waarom zelf kiezen moeilijk is.' },
          { text: 'Mijn mentor zegt het ook.', points: 1, why: 'Iemand noemen is geen argument. Waarom heeft je mentor gelijk?' },
        ],
      },
    ],
    oneens: [
      {
        counter: 'Zonder telefoon let iedereen beter op in de les.',
        answers: [
          { text: 'Dan is "telefoon weg tijdens de les" genoeg. In de pauze stoort hij niemand.', points: 3 },
          { text: 'Je kunt ook afgeleid zijn zonder telefoon.', points: 2, why: 'Klopt, maar een telefoon leidt nog meer af.' },
          { text: 'Ik let altijd op, dus het maakt niet uit.', points: 1, why: 'Eén voorbeeld over jezelf zegt niets over de hele school.' },
        ],
      },
      {
        counter: 'In de pauze zit iedereen op zijn telefoon in plaats van met elkaar te praten.',
        answers: [
          { text: 'Maak de pauze leuker, met sport of spelletjes. Daar is geen kluisje voor nodig.', points: 3 },
          { text: 'Dat moeten leerlingen zelf mogen kiezen.', points: 2, why: 'Kan, maar je reageert niet op wat Opiny zegt.' },
          { text: 'Volwassenen zitten ook de hele dag op hun telefoon.', points: 1, why: 'Naar een ander wijzen lost het probleem niet op.' },
        ],
      },
      {
        counter: 'In een kluisje kan je telefoon tenminste niet gestolen worden.',
        answers: [
          { text: 'Kluisjes kosten geld en ruimte, en een telefoon in je tas is meestal ook veilig.', points: 3 },
          { text: 'Dan moet je de hele tijd naar je kluisje lopen.', points: 2, why: 'Klopt, maar zo erg is dat niet.' },
          { text: 'Dat is gewoon een slecht idee.', points: 1, why: 'Je zegt niet waarom. Waarom is het slecht?' },
        ],
      },
    ],
  },
  {
    id: 'camera',
    text: 'Rotterdam moet camera\'s met gezichtsherkenning ophangen in het centrum.',
    eens: [
      {
        counter: 'Dan wordt iedereen de hele tijd bekeken, ook als je niks doet.',
        answers: [
          { text: 'Ze kijken alleen als er iets gebeurd is. Daarna wissen ze de beelden snel.', points: 3 },
          { text: 'Er hangen nu ook al gewone camera\'s.', points: 2, why: 'Klopt, maar gezichtsherkenning weet ook wíe je bent.' },
          { text: 'Als je niks fout doet, heb je niks te verbergen.', points: 1, why: 'Ook als je niks fout doet, heb je recht op privacy.' },
        ],
      },
      {
        counter: 'Gezichtsherkenning maakt fouten, en bij sommige groepen mensen vaker dan bij andere.',
        answers: [
          { text: 'Dan moet een mens het altijd eerst checken.', points: 3 },
          { text: 'De techniek wordt steeds beter.', points: 2, why: 'Misschien, maar wat doe je met de fouten van nu?' },
          { text: 'Iedereen maakt weleens fouten.', points: 1, why: 'Door een fout kan iemand worden opgepakt die niks heeft gedaan.' },
        ],
      },
      {
        counter: 'Wat als de beelden gehackt of misbruikt worden?',
        answers: [
          { text: 'Dan moeten de beelden goed beveiligd zijn en snel weg.', points: 3 },
          { text: 'De politie gebruikt de beelden alleen voor onderzoek.', points: 2, why: 'Dat is de bedoeling. Maar wat als het misgaat?' },
          { text: 'Dat gebeurt toch nooit.', points: 1, why: 'Dat weet je niet. Er worden juist vaak gegevens gestolen.' },
        ],
      },
    ],
    oneens: [
      {
        counter: 'Met gezichtsherkenning vind je criminelen veel sneller.',
        answers: [
          { text: 'Dan worden elke dag duizenden onschuldige mensen gescand.', points: 3 },
          { text: 'Criminelen dragen dan gewoon een pet en een mondkapje.', points: 2, why: 'Kan, maar dat werkt niet altijd.' },
          { text: 'Ik vind camera\'s eng.', points: 1, why: 'Dat mag je voelen. Maar wat is er eng aan?' },
        ],
      },
      {
        counter: 'Mensen voelen zich veiliger als er camera\'s hangen.',
        answers: [
          { text: 'Je veilig vóélen is niet hetzelfde als veilig zijn. Meer licht helpt ook.', points: 3 },
          { text: 'Sommige mensen voelen zich juist onveiliger als ze bekeken worden.', points: 2, why: 'Kan, maar wordt het nou echt veiliger?' },
          { text: 'Niemand wil camera\'s.', points: 1, why: 'Dat is overdreven, en het klopt niet.' },
        ],
      },
      {
        counter: 'Andere steden doen het ook al.',
        answers: [
          { text: 'Dat het ergens anders gebeurt, maakt het niet goed.', points: 3 },
          { text: 'Rotterdam hoeft niet alles na te doen.', points: 2, why: 'Klopt, maar waarom niet in Rotterdam?' },
          { text: 'Die steden zijn gewoon dom.', points: 1, why: 'Iemand uitschelden is geen argument.' },
        ],
      },
    ],
  },
  {
    id: 'stemmen',
    text: 'Jongeren vanaf 16 jaar moeten mogen stemmen voor de gemeenteraad.',
    eens: [
      {
        counter: 'Op je 16e weet je nog niet genoeg over politiek.',
        answers: [
          { text: 'Als je mag stemmen, ga je er juist meer over leren.', points: 3 },
          { text: 'Je krijgt op school al maatschappijleer.', points: 2, why: 'Dat helpt, maar niet iedereen heeft dat vak.' },
          { text: 'Ouderen weten er ook niks van.', points: 1, why: 'Dat is overdreven, en je wijst naar een ander.' },
        ],
      },
      {
        counter: 'Jongeren stemmen gewoon wat hun ouders stemmen.',
        answers: [
          { text: 'Jongeren praten op school en online over politiek. Zo vormen ze hun eigen mening.', points: 3 },
          { text: 'Dat doen veel volwassenen ook.', points: 2, why: 'Misschien, maar hebben jongeren dan wel een eigen mening?' },
          { text: 'Mijn ouders kiezen altijd een saaie partij.', points: 1, why: 'Grappig, maar dat zegt niks over andere jongeren.' },
        ],
      },
      {
        counter: 'De gemeenteraad beslist over ingewikkelde dingen, zoals belastingen.',
        answers: [
          { text: 'De gemeente beslist ook over sport en veilig fietsen. Daar weten jongeren veel van.', points: 3 },
          { text: 'Met een stemhulp kun je uitzoeken wat partijen willen.', points: 2, why: 'Handig, maar dan is het dus wel moeilijk.' },
          { text: 'Ingewikkeld is geen reden.', points: 1, why: 'Je zegt alleen dat Opiny ongelijk heeft, niet waarom.' },
        ],
      },
    ],
    oneens: [
      {
        counter: 'Jongeren moeten meepraten over hun eigen stad.',
        answers: [
          { text: 'Meepraten kan ook via een jongerenraad.', points: 3 },
          { text: 'Vanaf 18 mag je al stemmen, zo lang is dat niet.', points: 2, why: 'Klopt, maar hoe praten jongeren tot die tijd mee?' },
          { text: 'Jongeren hebben toch geen interesse.', points: 1, why: 'Dat klopt niet. Veel jongeren hebben wel interesse.' },
        ],
      },
      {
        counter: 'Met 16 mag je ook al werken en belasting betalen.',
        answers: [
          { text: 'Voor veel dingen is 18 de grens. Eén grens is duidelijk.', points: 3 },
          { text: 'De meeste 16-jarigen werken maar een paar uur.', points: 2, why: 'Klopt, maar een paar uur werken is ook werken.' },
          { text: 'Werken is iets anders dan stemmen, punt.', points: 1, why: '"Punt" is geen uitleg. Waarom is het anders?' },
        ],
      },
      {
        counter: 'In sommige landen mag het al vanaf 16, zoals in Oostenrijk.',
        answers: [
          { text: 'Elk land is anders. Onderzoek eerst of het daar echt goed werkt.', points: 3 },
          { text: 'Nederland is geen Oostenrijk.', points: 2, why: 'Klopt, maar wat is dan het verschil?' },
          { text: 'Dat kan me niet schelen.', points: 1, why: 'Dat is geen reden. Het publiek haakt af.' },
        ],
      },
    ],
  },
];

// The practice round has its own statement with one round, never used in the real game.
const PRACTICE_STATEMENT = {
  id: 'oefen',
  text: 'Op school moet gratis wifi zijn voor alle leerlingen.',
  eens: [
    {
      counter: 'Dan zit iedereen in de pauze alleen maar op zijn telefoon.',
      answers: [
        { text: 'Met wifi kun je ook je rooster en huiswerk checken. Dat is handig voor school.', points: 3 },
        { text: 'Iedereen wil gewoon wifi.', points: 1, why: 'Dat iedereen het wil, is nog geen reden. Waarom is het goed voor school?' },
      ],
    },
  ],
};

export function mount(el, { practice = false, onPracticeDone = () => {}, onFinish, character }) {
  let statement = null;
  let side = null;
  let round = 0;
  let points = 0;
  let tug = 0; // -100 = audience with Opiny, +100 = with you
  let destroyed = false;
  let stopGuide = () => {};

  function chooseStatement() {
    el.innerHTML = `
      <div class="g">
        ${say(character, '<p>Tijd voor een debat! Kies een stelling. Overtuig het publiek.</p>')}
        <div class="g__choices">
          ${STATEMENTS.map((s) => `<button class="g__choice" data-id="${s.id}"><strong>${escapeHtml(s.text)}</strong></button>`).join('')}
        </div>
      </div>`;
    el.querySelectorAll('[data-id]').forEach((b) =>
      b.addEventListener('click', () => {
        statement = STATEMENTS.find((s) => s.id === b.dataset.id);
        chooseSide();
      }),
    );
  }

  function chooseSide() {
    el.innerHTML = `
      <div class="g">
        <p class="g__title">${escapeHtml(statement.text)}</p>
        <div class="g__sides">
          <button class="btn btn--action" data-side="eens">Eens</button>
          <button class="btn" data-side="oneens">Oneens</button>
        </div>
        <p class="g__hint">Er is geen goed of fout. Leg uit waarom.</p>
      </div>`;
    el.querySelectorAll('[data-side]').forEach((b) =>
      b.addEventListener('click', () => {
        side = b.dataset.side;
        tally(`overtuig-${statement.id}`, side);
        arena();
        attack();
      }),
    );
  }

  function practiceRound() {
    statement = PRACTICE_STATEMENT;
    side = 'eens';
    arena();
    attack();
    stopGuide = guide(el, [
          { target: '.battle__topic', text: 'Dit is de stelling. Jij bent het ermee eens. Opiny niet.', wait: 'ok' },
          { target: '.battle__speech', text: 'Opiny zegt iets terug. Het publiek loopt naar haar toe!', wait: 'ok' },
          { target: '.hand', text: 'Kies het antwoord met de beste reden.', hand: false, wait: () => !!el.querySelector('.hand [data-next]') },
          { target: '.battle__stage', text: 'Goed argument? Dan komt het publiek naar jou.', wait: 'ok' },
        ], { onDone: onPracticeDone });
  }

  function crowd() {
    // Each audience member leans to whoever the tug value favours, from the middle outwards.
    const yours = Math.round(((tug + 100) / 200) * AUDIENCE);
    return Array.from({ length: AUDIENCE }, (_, i) => `<i class="${i < AUDIENCE - yours ? 'is-lotte' : 'is-you'}"></i>`).join('');
  }

  function arena() {
    el.innerHTML = `
      <div class="g battle">
        <div class="g__bar"><span>${practice ? 'Oefenronde' : 'Ronde <b class="b-round">1</b>/3'}</span><span class="b-points">0 punten</span></div>
        <p class="battle__topic"><small>Stelling · jij bent het ${side === 'eens' ? 'eens' : 'oneens'}</small>${escapeHtml(statement.text)}</p>
        <div class="battle__stage">
          <div class="fighter fighter--lotte"><span class="fighter__avatar">O</span><small>Opiny</small></div>
          <div class="battle__crowd" aria-label="Het publiek">${crowd()}</div>
          <div class="fighter fighter--you"><span class="fighter__avatar">Jij</span><small>${side === 'eens' ? 'Eens' : 'Oneens'}</small></div>
        </div>
        <div class="tug"><i class="tug__marker" style="left:${(tug + 100) / 2}%"></i></div>
        <div class="battle__speech"></div>
        <div class="hand"></div>
      </div>`;
  }

  function updateCrowd() {
    el.querySelector('.battle__crowd').innerHTML = crowd();
    el.querySelector('.tug__marker').style.left = `${(tug + 100) / 2}%`;
    el.querySelector('.b-points').textContent = `${points} punten`;
  }

  function attack() {
    const r = statement[side][round];
    const br = el.querySelector('.b-round');
    if (br) br.textContent = round + 1;
    el.querySelector('.battle__speech').innerHTML = `<div class="speech-attack"><small>Opiny</small><p>${escapeHtml(r.counter)}</p></div>`;
    el.querySelector('.fighter--lotte').classList.add('is-attacking');
    setTimeout(() => el.querySelector('.fighter--lotte')?.classList.remove('is-attacking'), 500);
    tug = Math.max(-100, tug - ATTACK);
    updateCrowd();
    deal(r);
  }

  function deal(r) {
    const hand = el.querySelector('.hand');
    hand.innerHTML = `${shuffle(r.answers)
      .map((a, i) => `<button class="arg-card" style="--i:${i}" data-text="${escapeHtml(a.text)}"><span class="arg-card__face">${escapeHtml(a.text)}</span></button>`)
      .join('')}
`;
    hand.querySelectorAll('[data-text]').forEach((b) =>
      b.addEventListener('click', () => play(r, r.answers.find((a) => a.text === b.dataset.text), b)),
    );
  }

  function play(r, answer, card) {
    el.querySelectorAll('.arg-card').forEach((c) => {
      c.disabled = true;
      if (c !== card) c.classList.add('is-discarded');
    });
    card.classList.add('is-played', answer.points === 3 ? 'is-strong' : answer.points === 2 ? 'is-ok' : 'is-weak');
    card.querySelector('.arg-card__face').insertAdjacentHTML('beforeend', `<em class="arg-card__type">${escapeHtml(typeOf(answer))}</em>`);
    setTimeout(
      () => resolve(r, answer, answer.points, answer.points === 3 ? 'Sterk! Je zegt ook waarom.' : answer.why, typeOf(answer)),
      700,
    );
  }

  function resolve(r, answer, gained, why, type) {
    points += gained;
    tug = Math.max(-100, Math.min(100, tug + (PULL[gained] ?? 0)));
    updateCrowd();
    if (gained === 3) el.querySelector('.fighter--you').classList.add('is-attacking');
    el.querySelector('.hand').innerHTML = `
      <p class="g__verdict ${gained === 3 ? 'is-right' : 'is-wrong'}">${escapeHtml(type)}${gained ? ` +${gained}` : ''}</p>
      ${say(character, `<p>${escapeHtml(why)}</p>`)}
      <button class="btn btn--action g__wide" data-next>${round < 2 ? 'Volgende ronde' : 'Uitslag'}</button>`;
    el.querySelector('[data-next]').addEventListener('click', () => {
      el.querySelector('.fighter--you')?.classList.remove('is-attacking');
      round += 1;
      if (round < 3) attack();
      else finish();
    });
  }

  function finish() {
    // A practice round never shows a score: it goes straight on to the real game.
    if (practice) return onPracticeDone();
    const won = tug > 0;
    const t = tally(`overtuig-${statement.id}`);
    const total = (t.eens ?? 0) + (t.oneens ?? 0);
    const pct = (k) => Math.round(((t[k] ?? 0) / total) * 100);
    const m = Math.round((points / 9) * HEIGHT_M);
    endScreen(el, {
      big: won ? `${m} m` : 'Verloren',
      sub: won ? 'Het publiek staat achter je' : 'Het publiek koos voor Opiny',
      character,
      line: escapeHtml(
        won
          ? `De lift gaat naar ${m} meter! Een goed argument zegt waarom.`
          : 'Het publiek was niet overtuigd. Zeg altijd waarom je iets vindt.',
      ),
      extra: `<div class="lift-end"><span class="lift-end__tower"><i style="height:${(points / 9) * 100}%"></i></span><span>${points} van 9 argumentpunten</span></div>
        <div class="poll"><p class="poll__q">${escapeHtml(statement.text)}</p>
        <div class="poll__row"><span>Eens</span><span class="poll__bar"><i style="width:${pct('eens')}%"></i></span><b>${pct('eens')}%</b></div>
        <div class="poll__row"><span>Oneens</span><span class="poll__bar"><i style="width:${pct('oneens')}%"></i></span><b>${pct('oneens')}%</b></div>
        <p class="g__hint">${total} ${total === 1 ? 'speler' : 'spelers'} op dit apparaat. Jouw mening telt mee.</p></div>`,
      onDone: () => onFinish({ correct: points, total: 9, summary: 'argumentpunten' }),
    });
  }

  if (practice) practiceRound();
  else chooseStatement();
  return () => {
    if (stopGuide) stopGuide();
    destroyed = true;
  };
}
