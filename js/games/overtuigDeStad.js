// "Overtuig de stad" (Opinion, Euromast, Opiny).
// A debate battle. Pick a statement and a side. The audience sits between you and Opiny, who
// argues the other side. Each round Opiny attacks with a counterargument and the audience drifts
// her way; you answer by playing one of three argument cards before the timer runs out. Strong
// arguments pull the audience back, fallacies hardly move them, and the card flips to show what
// kind of argument it was. Win the audience over and the Euromast lift takes you to the top,
// where you see which side earlier players on this device chose.
// AI: a joker card lets you write your own argument, which the AI scores (1 to 3).

import { chat, isAvailable, stripPersonal } from '../ai.js';
import { escapeHtml, shuffle, say, endScreen, parseJson, tally, countdown, typingForm } from './kit.js';

const HEIGHT_M = 185;
const TURN_SECONDS = 20;
const AUDIENCE = 24;
const PULL = { 3: 50, 2: 28, 1: 6 };
const ATTACK = 26;

// What kind of argument each weak card is, shown when it flips.
const FALLACY = {
  'Vroeger hadden': 'Beroep op vroeger',
  'Niemand zoekt': 'Overdrijving',
  'Mijn mentor': 'Beroep op autoriteit',
  'Ik let altijd': 'Eén voorbeeld',
  'Volwassenen zitten': 'Jij-bak',
  'Dat is gewoon een slecht': 'Geen reden',
  'Als je niks fout': 'Drogreden',
  'Iedereen maakt weleens': 'Bagatelliseren',
  'Dat gebeurt toch': 'Ontkennen',
  'Ik vind camera': 'Alleen een gevoel',
  'Niemand wil': 'Overdrijving',
  'Die steden': 'Schelden',
  'Ouderen weten': 'Jij-bak',
  'Mijn ouders stemmen': 'Eén voorbeeld',
  'Ingewikkeld is geen': 'Geen reden',
  'Jongeren hebben toch': 'Generalisatie',
  'Werken is iets anders': 'Geen reden',
  'Dat kan me niet': 'Geen argument',
};
const typeOf = (a) =>
  a.points === 3 ? 'Sterk argument' : a.points === 2 ? 'Half argument' : Object.entries(FALLACY).find(([k]) => a.text.startsWith(k))?.[1] ?? 'Zwak argument';

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
          { text: 'Noodgevallen zijn heel zeldzaam.', points: 2, why: 'Klopt, maar je laat de zorg van ouders liggen. Een oplossing is sterker.' },
          { text: 'Vroeger hadden ze ook geen telefoons en ging het ook goed.', points: 1, why: 'Dat het vroeger anders ging, zegt niet dat het nu beter is.' },
        ],
      },
      {
        counter: 'Telefoons zijn ook handig om dingen op te zoeken in de les.',
        answers: [
          { text: 'Daar heeft school laptops voor, en die leiden minder af met meldingen.', points: 3 },
          { text: 'Je kunt ook gewoon een boek gebruiken.', points: 2, why: 'Kan, maar je laat zien dat opzoeken nog steeds lukt. Een alternatief noemen is goed, een beter alternatief is sterker.' },
          { text: 'Niemand zoekt echt iets op, iedereen zit op TikTok.', points: 1, why: 'Dat is overdreven. Als één persoon het wel goed gebruikt, klopt je argument al niet meer.' },
        ],
      },
      {
        counter: 'Jongeren moeten zelf leren omgaan met hun telefoon.',
        answers: [
          { text: 'Zelf kiezen is moeilijk als apps juist gemaakt zijn om je vast te houden. Oefenen kan in de pauze en thuis.', points: 3 },
          { text: 'Op school ben je om te leren, niet om met je telefoon te oefenen.', points: 2, why: 'Een goed punt, maar je gaat niet in op waarom zelf leren kiezen niet werkt.' },
          { text: 'Mijn mentor zegt het ook.', points: 1, why: 'Iemand noemen is geen argument. Waarom heeft je mentor gelijk?' },
        ],
      },
    ],
    oneens: [
      {
        counter: 'Zonder telefoon let iedereen beter op in de les.',
        answers: [
          { text: 'Dan is "telefoon weg tijdens de les" genoeg. In de pauze stoort hij niemand.', points: 3 },
          { text: 'Je kunt ook afgeleid zijn zonder telefoon.', points: 2, why: 'Klopt, maar een telefoon leidt meestal extra af. Je argument maakt dat niet weg.' },
          { text: 'Ik let altijd op, dus het maakt niet uit.', points: 1, why: 'Eén voorbeeld over jezelf zegt niets over de hele school.' },
        ],
      },
      {
        counter: 'In de pauze zit iedereen op zijn telefoon in plaats van met elkaar te praten.',
        answers: [
          { text: 'Veel jongeren doen juist samen iets op hun telefoon, zoals een video kijken of een spel spelen.', points: 3 },
          { text: 'Dat moeten leerlingen zelf mogen kiezen.', points: 2, why: 'Een redelijk punt, maar je gaat niet in op het probleem dat Opiny noemt.' },
          { text: 'Volwassenen zitten ook de hele dag op hun telefoon.', points: 1, why: 'Dat heet een jij-bak: wijzen naar een ander maakt het probleem niet kleiner.' },
        ],
      },
      {
        counter: 'In een kluisje kan je telefoon tenminste niet gestolen worden.',
        answers: [
          { text: 'Kluisjes kosten geld en ruimte, en een telefoon in je tas is meestal ook veilig.', points: 3 },
          { text: 'Dan moet je de hele tijd naar je kluisje lopen.', points: 2, why: 'Een nadeel, maar het weegt niet zo zwaar. Wat kost de regel echt?' },
          { text: 'Dat is gewoon een slecht idee.', points: 1, why: 'Dat is een mening zonder reden. Waarom is het slecht?' },
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
          { text: 'Je kunt regels maken: alleen kijken als er iets gebeurd is, en de beelden snel wissen.', points: 3 },
          { text: 'Er hangen nu ook al gewone camera\'s.', points: 2, why: 'Klopt, maar gezichtsherkenning weet ook wíe je bent. Dat is een groter verschil dan je laat zien.' },
          { text: 'Als je niks fout doet, heb je niks te verbergen.', points: 1, why: 'Een bekende drogreden: privacy is ook voor mensen die niets fout doen.' },
        ],
      },
      {
        counter: 'Gezichtsherkenning maakt fouten, en bij sommige groepen mensen vaker dan bij andere.',
        answers: [
          { text: 'Dan moet een mens altijd controleren voordat er iets gebeurt, en moet het systeem eerst getest worden.', points: 3 },
          { text: 'De techniek wordt steeds beter.', points: 2, why: 'Misschien, maar wat doe je met de fouten van nu?' },
          { text: 'Iedereen maakt weleens fouten.', points: 1, why: 'Dat maakt het probleem kleiner dan het is: een fout kan betekenen dat een onschuldig iemand wordt opgepakt.' },
        ],
      },
      {
        counter: 'Wat als de beelden gehackt of misbruikt worden?',
        answers: [
          { text: 'Dan moeten de beelden goed beveiligd en kort bewaard worden, met een toezichthouder die controleert.', points: 3 },
          { text: 'De politie gebruikt de beelden alleen voor onderzoek.', points: 2, why: 'Dat is de bedoeling, maar Opiny vraagt wat er gebeurt als het misgaat.' },
          { text: 'Dat gebeurt toch nooit.', points: 1, why: 'Dat weet je niet. Datalekken gebeuren juist vaak.' },
        ],
      },
    ],
    oneens: [
      {
        counter: 'Met gezichtsherkenning vind je criminelen veel sneller.',
        answers: [
          { text: 'Maar dan worden elke dag duizenden onschuldige mensen gescand. Dat is een te grote inbreuk op ieders privacy.', points: 3 },
          { text: 'Criminelen dragen dan gewoon een pet en een mondkapje.', points: 2, why: 'Kan, maar het werkt dan nog steeds soms. De afweging met privacy is sterker.' },
          { text: 'Ik vind camera\'s eng.', points: 1, why: 'Een gevoel is echt, maar het is nog geen argument. Wat is er eng aan?' },
        ],
      },
      {
        counter: 'Mensen voelen zich veiliger als er camera\'s hangen.',
        answers: [
          { text: 'Je veiliger vóélen is niet hetzelfde als veiliger zijn. Meer licht en meer mensen op straat helpen ook.', points: 3 },
          { text: 'Sommige mensen voelen zich juist onveiliger als ze bekeken worden.', points: 2, why: 'Een goed tegenvoorbeeld, maar je laat de vraag liggen of het echt veiliger wordt.' },
          { text: 'Niemand wil camera\'s.', points: 1, why: 'Dat is overdreven, en het klopt niet.' },
        ],
      },
      {
        counter: 'Andere steden doen het ook al.',
        answers: [
          { text: 'Dat het ergens anders gebeurt, maakt het niet goed. In de EU gelden juist strenge regels voor gezichtsherkenning op straat.', points: 3 },
          { text: 'Rotterdam hoeft niet alles na te doen.', points: 2, why: 'Klopt, maar je zegt niet waarom het hier niet zou moeten.' },
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
          { text: 'Veel volwassenen weten ook niet alles. Als je mag stemmen, ga je je er juist meer in verdiepen.', points: 3 },
          { text: 'Je krijgt op school al maatschappijleer.', points: 2, why: 'Dat helpt, maar niet iedereen heeft dat vak. Een algemener argument is sterker.' },
          { text: 'Ouderen weten er ook niks van.', points: 1, why: 'Dat is een jij-bak en een overdrijving.' },
        ],
      },
      {
        counter: 'Jongeren stemmen gewoon wat hun ouders stemmen.',
        answers: [
          { text: 'Jongeren hebben vaak eigen meningen over dingen die hen raken, zoals sportvelden, het OV en uitgaan.', points: 3 },
          { text: 'Dat doen veel volwassenen ook.', points: 2, why: 'Misschien, maar je laat niet zien dat jongeren wel een eigen mening hebben.' },
          { text: 'Mijn ouders stemmen saai.', points: 1, why: 'Grappig, maar het zegt niets over alle jongeren.' },
        ],
      },
      {
        counter: 'De gemeenteraad beslist over ingewikkelde dingen, zoals belastingen.',
        answers: [
          { text: 'De gemeente beslist ook over dingen waar jongeren elke dag mee te maken hebben, zoals jongerenwerk, sport en veilig fietsen.', points: 3 },
          { text: 'Met een stemhulp kun je je laten informeren.', points: 2, why: 'Een handige oplossing, maar je laat zien dat het wel ingewikkeld is.' },
          { text: 'Ingewikkeld is geen reden.', points: 1, why: 'Je zegt alleen dat Opiny ongelijk heeft, niet waarom.' },
        ],
      },
    ],
    oneens: [
      {
        counter: 'Jongeren moeten meepraten over hun eigen stad.',
        answers: [
          { text: 'Meepraten kan ook via een jongerenraad of inspraak. Daarvoor hoef je niet te stemmen.', points: 3 },
          { text: 'Vanaf 18 mag je al stemmen, zo lang is dat niet.', points: 2, why: 'Klopt, maar je laat liggen hoe jongeren tot die tijd meepraten.' },
          { text: 'Jongeren hebben toch geen interesse.', points: 1, why: 'Dat is een generalisatie: veel jongeren hebben dat wel.' },
        ],
      },
      {
        counter: 'Met 16 mag je ook al werken en belasting betalen.',
        answers: [
          { text: 'Voor veel belangrijke dingen is 18 de grens, zoals een contract tekenen. Eén duidelijke grens is eerlijk.', points: 3 },
          { text: 'De meeste 16-jarigen werken maar een paar uur.', points: 2, why: 'Een feitelijk punt, maar ook een paar uur werken is werken.' },
          { text: 'Werken is iets anders dan stemmen, punt.', points: 1, why: '"Punt" is geen uitleg. Waarom is het anders?' },
        ],
      },
      {
        counter: 'In sommige landen mag het al vanaf 16, zoals in Oostenrijk.',
        answers: [
          { text: 'Elk land maakt eigen keuzes. Onderzoek eerst of het daar goed werkt voordat Rotterdam het overneemt.', points: 3 },
          { text: 'Nederland is geen Oostenrijk.', points: 2, why: 'Klopt, maar wat is het verschil dat ertoe doet?' },
          { text: 'Dat kan me niet schelen.', points: 1, why: 'Dat is geen argument, en je publiek haakt af.' },
        ],
      },
    ],
  },
];

async function scoreOwnArgument(statement, side, counter, argument) {
  const reply = await chat(
    [
      {
        role: 'system',
        content:
          'Je beoordeelt argumenten van jongeren (10 tot 20 jaar) in een debatspel. Wees eerlijk en bemoedigend. ' +
          'Geef 3 punten voor een argument dat ingaat op het tegenargument en een reden of voorbeeld geeft, ' +
          '2 punten voor een redelijk argument dat niet goed ingaat op het tegenargument of geen reden geeft, ' +
          '1 punt voor geen argument, een drogreden, schelden of iets wat niet over het onderwerp gaat. ' +
          'Antwoord alleen met JSON: {"punten": 1, "uitleg": "één korte zin in het Nederlands, taalniveau B1"}',
      },
      {
        role: 'user',
        content: `Stelling: ${statement}\nDe jongere is het ${side === 'eens' ? 'eens' : 'oneens'} met de stelling.\nTegenargument van Opiny: ${counter}\nArgument van de jongere: ${argument}`,
      },
    ],
    { json: true, temperature: 0.2, maxTokens: 120 },
  );
  const data = parseJson(reply);
  const points = Number(data?.punten);
  if (![1, 2, 3].includes(points) || typeof data?.uitleg !== 'string') return null;
  return { points, why: data.uitleg.slice(0, 240) };
}

export function mount(el, { onFinish, character }) {
  let statement = null;
  let side = null;
  let round = 0;
  let points = 0;
  let tug = 0; // -100 = audience with Opiny, +100 = with you
  let timer = null;
  let destroyed = false;
  let aiOn = false;
  isAvailable().then((ok) => (aiOn = ok));

  function chooseStatement() {
    el.innerHTML = `
      <div class="g">
        ${say(character, '<p>Debat op de Euromast! Kies een stelling en een kant. Ik speel de andere kant. Het publiek in het midden beslist wie het overtuigendst is.</p>')}
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
        <p class="g__hint">Er is geen goed of fout antwoord. Je wint met hoe goed je je mening onderbouwt.</p>
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

  function crowd() {
    // Each audience member leans to whoever the tug value favours, from the middle outwards.
    const yours = Math.round(((tug + 100) / 200) * AUDIENCE);
    return Array.from({ length: AUDIENCE }, (_, i) => `<i class="${i < AUDIENCE - yours ? 'is-lotte' : 'is-you'}"></i>`).join('');
  }

  function arena() {
    el.innerHTML = `
      <div class="g battle">
        <div class="g__bar"><span>Ronde <b class="b-round">1</b>/3</span><span class="b-points">0 punten</span></div>
        <div class="battle__stage">
          <div class="fighter fighter--lotte"><span class="fighter__avatar">O</span><small>Opiny</small></div>
          <div class="battle__crowd" aria-label="Het publiek">${crowd()}</div>
          <div class="fighter fighter--you"><span class="fighter__avatar">Jij</span><small>${side === 'eens' ? 'Eens' : 'Oneens'}</small></div>
        </div>
        <div class="tug"><i class="tug__marker" style="left:${(tug + 100) / 2}%"></i></div>
        <div class="battle__speech"></div>
        <div class="battle__timer"><i></i></div>
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
    el.querySelector('.b-round').textContent = round + 1;
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
      ${aiOn ? '<button class="arg-card arg-card--joker" data-joker><span class="arg-card__face"><strong>Joker</strong>Schrijf je eigen argument</span></button>' : ''}`;
    hand.querySelectorAll('[data-text]').forEach((b) =>
      b.addEventListener('click', () => play(r, r.answers.find((a) => a.text === b.dataset.text), b)),
    );
    hand.querySelector('[data-joker]')?.addEventListener('click', () => joker(r));
    startTimer(r);
  }

  function startTimer(r) {
    timer?.stop();
    const bar = el.querySelector('.battle__timer i');
    timer = countdown(TURN_SECONDS, {
      onTick: (left, frac) => {
        bar.style.width = `${frac * 100}%`;
        bar.classList.toggle('is-low', left < 6);
      },
      onEnd: () => {
        tug = Math.max(-100, tug - 15);
        updateCrowd();
        resolve(r, null, 0, 'Te laat! Het publiek wacht niet. Opiny wint deze ronde.', 'Geen antwoord');
      },
    });
  }

  function play(r, answer, card) {
    timer?.stop();
    el.querySelectorAll('.arg-card').forEach((c) => {
      c.disabled = true;
      if (c !== card) c.classList.add('is-discarded');
    });
    card.classList.add('is-played', answer.points === 3 ? 'is-strong' : answer.points === 2 ? 'is-ok' : 'is-weak');
    card.querySelector('.arg-card__face').insertAdjacentHTML('beforeend', `<em class="arg-card__type">${escapeHtml(typeOf(answer))}</em>`);
    setTimeout(
      () => resolve(r, answer, answer.points, answer.points === 3 ? 'Sterk: je gaat in op mijn punt en geeft een reden.' : answer.why, typeOf(answer)),
      700,
    );
  }

  function joker(r) {
    timer?.stop();
    el.querySelector('.battle__timer i').style.width = '0';
    el.querySelector('.hand').innerHTML = `
      <form class="g__own">
        <textarea id="ownArgument" maxlength="280" placeholder="Mijn argument tegen wat Opiny zegt…"></textarea>
        <button class="btn btn--action" type="submit">Speel mijn argument</button>
      </form>`;
    typingForm(el.querySelector('.g__own'), { min: 8 });
    el.querySelector('#ownArgument').focus();
    el.querySelector('.g__own').addEventListener('submit', async (e) => {
      e.preventDefault();
      const { text } = stripPersonal(el.querySelector('#ownArgument').value.trim());
      if (text.length < 8) return;
      el.querySelectorAll('.g__own button, .g__own textarea').forEach((x) => (x.disabled = true));
      el.querySelector('.g__own').insertAdjacentHTML('beforeend', '<p class="g__thinking">Het publiek denkt na…</p>');
      const scored = await scoreOwnArgument(statement.text, side, r.counter, text);
      if (destroyed) return;
      if (!scored) {
        deal(r);
        el.querySelector('.hand').insertAdjacentHTML('afterbegin', '<p class="g__hint">Dat lukte even niet. Speel een kaart.</p>');
        return;
      }
      resolve(r, null, scored.points, scored.why, scored.points === 3 ? 'Sterk argument' : scored.points === 2 ? 'Half argument' : 'Zwak argument', true);
    });
  }

  function resolve(r, answer, gained, why, type, own = false) {
    points += gained;
    tug = Math.max(-100, Math.min(100, tug + (PULL[gained] ?? 0)));
    updateCrowd();
    if (gained === 3) el.querySelector('.fighter--you').classList.add('is-attacking');
    el.querySelector('.hand').innerHTML = `
      <p class="g__verdict ${gained === 3 ? 'is-right' : 'is-wrong'}">${escapeHtml(type)}${gained ? ` +${gained}` : ''}</p>
      ${say(character, `<p>${escapeHtml(why)}</p>`)}
      ${own ? '<p class="g__ai">Je argument is beoordeeld door de AI. Ben je het er niet mee eens? Bespreek het met je groep.</p>' : ''}
      <button class="btn btn--action g__wide" data-next>${round < 2 ? 'Volgende ronde' : 'Uitslag'}</button>`;
    el.querySelector('[data-next]').addEventListener('click', () => {
      el.querySelector('.fighter--you')?.classList.remove('is-attacking');
      round += 1;
      if (round < 3) attack();
      else finish();
    });
  }

  function finish() {
    timer?.stop();
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
          ? `De lift neemt je mee naar ${m} meter! Sterke argumenten gaan in op wat de ander zegt en geven een reden of oplossing.`
          : 'Het publiek liet zich niet overtuigen. Let op drogredenen: wijzen naar een ander, overdrijven of "punt" zeggen overtuigt niemand.',
      ),
      extra: `<div class="lift-end"><span class="lift-end__tower"><i style="height:${(points / 9) * 100}%"></i></span><span>${points} van 9 argumentpunten</span></div>
        <div class="poll"><p class="poll__q">${escapeHtml(statement.text)}</p>
        <div class="poll__row"><span>Eens</span><span class="poll__bar"><i style="width:${pct('eens')}%"></i></span><b>${pct('eens')}%</b></div>
        <div class="poll__row"><span>Oneens</span><span class="poll__bar"><i style="width:${pct('oneens')}%"></i></span><b>${pct('oneens')}%</b></div>
        <p class="g__hint">${total} ${total === 1 ? 'speler' : 'spelers'} op dit apparaat. Jouw mening telt mee.</p></div>`,
      onDone: () => onFinish({ correct: points, total: 9, summary: 'argumentpunten' }),
    });
  }

  chooseStatement();
  return () => {
    destroyed = true;
    timer?.stop();
  };
}
