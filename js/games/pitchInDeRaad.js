// "Pitch in de raad" (Active, Stadhuis, Acty).
// Think of an idea for your neighbourhood and pitch it to three council members, who each care
// about something else: money, the neighbours, and safety. You need 2 of the 3 votes.
// No AI chat: the council members ask fixed questions and you choose an answer.
// Ideas are counted anonymously on this device, so a demo laptop shows what young people want.

import { escapeHtml, say, endScreen, shuffle, tally } from './kit.js';
import { guide } from './guide.js';

// Each topic has its own three council members' questions, so the questions fit your plan.
// Bram always looks at money and Esther at the neighbours; the third looks at what fits the topic.
const TOPICS = [
  {
    id: 'chillen',
    label: 'Een plek om te chillen',
    ideas: ['Een overdekte hangplek met bankjes en wifi in het park', 'Een jongerencafé in een leeg winkelpand', 'Een basketbalveld dat \'s avonds verlicht is'],
    members: [
      {
        name: 'Bram', cares: 'geld', question: 'Wie gaat dat betalen?',
        answers: [
          { text: 'We gebruiken een plek die er al is. Jongeren helpen zelf met opknappen.', vote: true },
          { text: 'Het kost vast niet zoveel.', vote: false, why: 'Bram wil weten wie betaalt. "Vast" is geen antwoord.' },
          { text: 'De gemeente heeft genoeg geld.', vote: false, why: 'Dat weet je niet. Bram wil een plan.' },
        ],
      },
      {
        name: 'Esther', cares: 'de buren', question: 'Hebben de buren \'s avonds last van herrie?',
        answers: [
          { text: 'Om tien uur gaat het dicht. Dan is het stil.', vote: true },
          { text: 'De buren moeten maar wennen.', vote: false, why: 'Esther komt op voor de buren. Zo krijg je haar niet mee.' },
          { text: 'Jongeren maken nooit herrie.', vote: false, why: 'Dat gelooft Esther niet. Ze wil weten wat je eraan doet.' },
        ],
      },
      {
        name: 'Youssef', cares: 'veiligheid', question: 'Hoe blijft het veilig als het donker is?',
        answers: [
          { text: 'Er komen goede lampen. En een jongerenwerker komt vaak langs.', vote: true },
          { text: 'Er gebeurt toch nooit iets.', vote: false, why: 'Dat weet je niet. Youssef wil een plan.' },
          { text: 'Jongeren letten zelf wel op elkaar.', vote: false, why: 'Mooi, maar wat doe je als het misgaat?' },
        ],
      },
    ],
  },
  {
    id: 'fietsen',
    label: 'Veilig fietsen naar school',
    ideas: ['Een fietspad dat gescheiden is van de auto\'s', 'Een fietsenstalling met camera bij het station', 'Een oversteek met verkeerslicht bij school'],
    members: [
      {
        name: 'Bram', cares: 'geld', question: 'Dat is duur. Waarom is het dat geld waard?',
        answers: [
          { text: 'Elke dag fietsen hier veel leerlingen langs. Minder ongelukken is dat geld waard.', vote: true },
          { text: 'Andere steden hebben het ook.', vote: false, why: 'Dat zegt niet waarom het hier nodig is.' },
          { text: 'Over geld moet je niet zeuren als het om kinderen gaat.', vote: false, why: 'Bram let op geld. Je geeft geen antwoord.' },
        ],
      },
      {
        name: 'Esther', cares: 'de buurt', question: 'Wat merken de mensen in de straat ervan?',
        answers: [
          { text: 'We vragen eerst wat zij ervan vinden. Zij fietsen er zelf ook.', vote: true },
          { text: 'Daar heb ik nog niet over nagedacht.', vote: false, why: 'Esther wil zien dat je aan de buurt denkt.' },
          { text: 'Fietsers zijn belangrijker.', vote: false, why: 'Zo krijg je de buurt niet mee.' },
        ],
      },
      {
        name: 'Youssef', cares: 'veiligheid', question: 'Hoe weet je dat het echt veiliger wordt?',
        answers: [
          { text: 'Leerlingen wijzen de gevaarlijkste plek aan. Daar beginnen we.', vote: true },
          { text: 'Dat voel je gewoon.', vote: false, why: 'Youssef wil meer dan een gevoel.' },
          { text: 'Slechter kan het toch niet worden.', vote: false, why: 'Dat is geen antwoord op zijn vraag.' },
        ],
      },
    ],
  },
  {
    id: 'sporten',
    label: 'Gratis sporten',
    ideas: ['Gratis sportlessen in de buurthuizen', 'Een buitensportplek met rekstokken op het plein', 'Een skatebaan onder het viaduct'],
    members: [
      {
        name: 'Bram', cares: 'geld', question: 'Wie betaalt de trainers en de spullen?',
        answers: [
          { text: 'Sportclubs uit de buurt helpen mee. Oudere jongeren geven les.', vote: true },
          { text: 'Sport is gezond, dus het mag geld kosten.', vote: false, why: 'Klopt, maar Bram vroeg wie betaalt.' },
          { text: 'Dat zien we later wel.', vote: false, why: 'Bram wil het nu weten.' },
        ],
      },
      {
        name: 'Esther', cares: 'de buren', question: 'Hebben de buren er last van?',
        answers: [
          { text: 'We spreken vaste tijden af. Om negen uur is het klaar.', vote: true },
          { text: 'Sporten maakt geen lawaai.', vote: false, why: 'Dat klopt niet altijd. Esther wil een plan.' },
          { text: 'Dan doen ze de ramen maar dicht.', vote: false, why: 'Esther komt op voor de buren. Zo krijg je haar niet mee.' },
        ],
      },
      {
        name: 'Youssef', cares: 'veiligheid', question: 'Wat als iemand zich bezeert?',
        answers: [
          { text: 'Er komt een EHBO-kist. En er hangt een bord met de regels.', vote: true },
          { text: 'Sporten doe je op eigen risico.', vote: false, why: 'Youssef wil dat je er toch over nadenkt.' },
          { text: 'Er valt nooit iemand.', vote: false, why: 'Dat weet je niet. Youssef wil een plan.' },
        ],
      },
    ],
  },
  {
    id: 'schoon',
    label: 'Schonere straten',
    ideas: ['Meer afvalbakken met een app die laat zien wanneer ze vol zijn', 'Een opruimdag met muziek en eten', 'Statiegeld-automaten in de wijk'],
    members: [
      {
        name: 'Bram', cares: 'geld', question: 'Wie betaalt dat?',
        answers: [
          { text: 'Winkels in de buurt sponsoren het. Vrijwilligers helpen mee.', vote: true },
          { text: 'Afval opruimen kost toch niks.', vote: false, why: 'Het kost wel geld. Bram wil weten wie betaalt.' },
          { text: 'Iemand anders betaalt wel.', vote: false, why: 'Dat is geen plan. Bram stemt tegen.' },
        ],
      },
      {
        name: 'Esther', cares: 'de buren', question: 'Doen de buren ook mee?',
        answers: [
          { text: 'We hangen flyers op en vragen de buren mee te doen.', vote: true },
          { text: 'De buren maken de rommel, dus zij moeten het oplossen.', vote: false, why: 'Zo krijg je de buren niet mee.' },
          { text: 'Dat maakt niet uit.', vote: false, why: 'Esther vindt de buren juist belangrijk.' },
        ],
      },
      {
        name: 'Youssef', cares: 'of het blijft werken', question: 'Hoe zorg je dat het over een maand niet weer vies is?',
        answers: [
          { text: 'Elke maand kijken we samen hoe het gaat.', vote: true },
          { text: 'Mensen gooien vanzelf minder weg.', vote: false, why: 'Dat gebeurt niet vanzelf. Youssef wil een plan.' },
          { text: 'Dan bedenken we wel een nieuw plan.', vote: false, why: 'Youssef wil weten hoe dit plan blijft werken.' },
        ],
      },
    ],
  },
];

// The practice round has its own small plan and one council member, never used in the real game.
const PRACTICE_IDEA = 'Een bankje bij de bushalte';
const PRACTICE_MEMBERS = [
  {
    id: 'lia',
    name: 'Lia',
    cares: 'de stoep',
    question: 'Kunnen mensen er dan nog wel langs?',
    answers: [
      { text: 'Ja, het bankje komt tegen de muur. Er blijft genoeg ruimte over.', vote: true },
      { text: 'Ze lopen er maar omheen.', vote: false, why: 'Lia wil dat iedereen erlangs kan.' },
    ],
  },
];

export function mount(el, { practice = false, onPracticeDone = () => {}, onFinish, character }) {
  let members = PRACTICE_MEMBERS;
  let topic = null;
  let idea = '';
  let index = 0;
  const votes = [];
  let destroyed = false;
  let stopGuide = () => {};

  function chooseTopic() {
    el.innerHTML = `
      <div class="g">
        ${say(character, '<p>Wat moet er beter in jouw buurt?</p>')}
        <div class="g__choices">${TOPICS.map((t) => `<button class="g__choice" data-t="${t.id}"><strong>${t.label}</strong></button>`).join('')}</div>
      </div>`;
    el.querySelectorAll('[data-t]').forEach((b) =>
      b.addEventListener('click', () => {
        topic = TOPICS.find((t) => t.id === b.dataset.t);
        members = topic.members;
        chooseIdea();
      }),
    );
  }

  function chooseIdea() {
    el.innerHTML = `
      <div class="g">
        <p class="g__title">${topic.label}</p>
        <p class="g__hint">Kies een plan.</p>
        <div class="g__choices">${topic.ideas.map((i) => `<button class="g__choice" data-i>${escapeHtml(i)}</button>`).join('')}</div>
      </div>`;
    el.querySelectorAll('[data-i]').forEach((b) =>
      b.addEventListener('click', () => {
        idea = b.textContent;
        start();
      }),
    );
  }

  function start() {
    if (!practice) tally('ideeen', topic.id);
    member();
  }

  // The council chamber: three seats with vote lamps, and you at the lectern.
  function bar() {
    return `<div class="council">
      <div class="council__seats">${members.map((m, i) => {
        const v = votes[i];
        return `<span class="council__seat${v === true ? ' is-yes' : v === false ? ' is-no' : i === index ? ' is-now' : ''}" style="--i:${i}">
          <i class="council__lamp"></i><b>${m.name[0]}</b><small>${m.name}</small><em>${escapeHtml(m.cares)}</em></span>`;
      }).join('')}</div>
      <div class="council__lectern"><small>Jouw plan</small><p>${escapeHtml(idea)}</p></div>
      <div class="council__tally"><span class="yes">${votes.filter((v) => v === true).length} voor</span><span class="no">${votes.filter((v) => v === false).length} tegen</span></div>
    </div>`;
  }

  async function member() {
    const m = members[index];
    el.innerHTML = `
      <div class="g">
        ${bar()}
        <div class="say"><span class="say__avatar" aria-hidden="true">${m.name[0]}</span><div class="say__text"><p><strong>${m.name}</strong> let vooral op ${m.cares}</p><p class="m-q">${escapeHtml(m.question)}</p></div></div>
        <div class="m-answer"></div>
      </div>`;
    const box = el.querySelector('.m-answer');
    cards(m, box);
    if (index === 0) {
      stopGuide = practice && guide(el, [
        { target: '.council__lectern', text: 'Dit is je plan. De raadsleden stemmen erover.', wait: 'ok' },
        { target: () => el.querySelector('.m-q')?.closest('.say'), text: `${m.name} let op ${m.cares}. Lees haar vraag.`, wait: 'ok' },
        { target: '.m-answer .g__choices', text: `${m.name} vroeg: "${m.question}" Welk antwoord helpt haar echt?`, hand: false, wait: () => votes.length > 0 },
        { target: '.g__pop', text: 'Zo zie je hoe het raadslid stemt.', wait: 'ok' },
      ], { onDone: onPracticeDone });
    }
  }

  function cards(m, box, note) {
    box.innerHTML = `${note ? `<p class="g__hint">${note}</p>` : ''}<div class="g__choices">${shuffle(m.answers)
      .map((a) => `<button class="g__choice" data-vote="${a.vote}">${escapeHtml(a.text)}</button>`)
      .join('')}</div>`;
    box.querySelectorAll('[data-vote]').forEach((b) =>
      b.addEventListener('click', () => {
        const a = m.answers.find((x) => x.text === b.textContent);
        decided(m, a.vote, a.vote ? 'Duidelijk antwoord. Daar kan ik wat mee.' : a.why);
      }),
    );
  }

  function decided(m, vote, why) {
    votes[index] = vote;
    const last = index === members.length - 1;
    el.querySelector('.m-answer').innerHTML = `<div class="g__pop">
      <p class="g__verdict ${vote ? 'is-right' : 'is-wrong'}">${m.name} stemt ${vote ? 'voor' : 'tegen'}</p>
      <div class="say"><span class="say__avatar" aria-hidden="true">${m.name[0]}</span><div class="say__text"><p>${escapeHtml(why)}</p></div></div>
      <button class="btn btn--action g__wide" data-next>${last ? 'Naar de uitslag' : 'Volgende raadslid'}</button></div>`;
    el.querySelector('.council').outerHTML = bar();
    el.querySelector('[data-next]').addEventListener('click', () => {
      index += 1;
      if (last) finish();
      else member();
    });
  }

  function finish() {
    // A practice round never shows a score: it goes straight on to the real game.
    if (practice) return onPracticeDone();
    const yes = votes.filter(Boolean).length;
    const count = tally('ideeen')[topic.id] ?? 1;
    endScreen(el, {
      big: yes >= 2 ? 'Aangenomen' : 'Afgewezen',
      sub: `${yes} van de 3 stemmen voor`,
      character,
      line: escapeHtml(
        yes >= 2
          ? 'Je plan gaat door! In het echt mag jij ook naar de gemeenteraad om iets te zeggen.'
          : 'Deze keer niet. Raadsleden willen weten hoe je het regelt. Probeer het nog een keer.',
      ),
      extra: `<p class="g__hint">Op dit apparaat ${count === 1 ? 'kwam 1 plan' : `kwamen ${count} plannen`} binnen over "${escapeHtml(topic.label.toLowerCase())}".</p>`,
      onDone: () => onFinish({ correct: yes, total: 3, summary: 'stemmen voor' }),
    });
  }

  if (practice) {
    idea = PRACTICE_IDEA;
    member();
  } else chooseTopic();
  return () => {
    if (stopGuide) stopGuide();
    destroyed = true;
  };
}
