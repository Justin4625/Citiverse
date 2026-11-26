// "Pitch in de raad" (Active, Stadhuis, Acty).
// Think of an idea for your neighbourhood and pitch it to three council members, who each care
// about something else: money, the neighbours, and safety. You need 2 of the 3 votes.
// No AI chat: the council members ask fixed questions and you choose an answer.
// Ideas are counted anonymously on this device, so a demo laptop shows what young people want.

import { stripPersonal } from '../ai.js';
import { escapeHtml, say, endScreen, shuffle, tally, typingForm } from './kit.js';
import { guide } from './guide.js';

const TOPICS = [
  {
    id: 'chillen',
    label: 'Een plek om te chillen',
    ideas: ['Een overdekte hangplek met bankjes en wifi in het park', 'Een jongerencafé in een leeg winkelpand', 'Een basketbalveld dat \'s avonds verlicht is'],
  },
  {
    id: 'fietsen',
    label: 'Veilig fietsen naar school',
    ideas: ['Een fietspad dat gescheiden is van de auto\'s', 'Een fietsenstalling met camera bij het station', 'Een oversteek met verkeerslicht bij school'],
  },
  {
    id: 'sporten',
    label: 'Gratis sporten',
    ideas: ['Gratis sportlessen in de buurthuizen', 'Een calisthenics-park op het plein', 'Een skatebaan onder het viaduct'],
  },
  {
    id: 'schoon',
    label: 'Schonere straten',
    ideas: ['Meer afvalbakken met een app die laat zien wanneer ze vol zijn', 'Een opruimdag met muziek en eten', 'Statiegeld-automaten in de wijk'],
  },
];

const MEMBERS = [
  {
    id: 'bram',
    name: 'Bram',
    cares: 'geld',
    question: 'Wat kost het? En wie betaalt dat?',
    answers: [
      { text: 'We gebruiken een plek die er al is. En we helpen zelf mee.', vote: true },
      { text: 'Het kost vast niet zoveel.', vote: false, why: 'Bram wil weten hoeveel. "Vast" is geen antwoord.' },
      { text: 'Geld is niet belangrijk, het gaat om jongeren.', vote: false, why: 'Bram let op geld. Je geeft geen antwoord.' },
    ],
  },
  {
    id: 'esther',
    name: 'Esther',
    cares: 'de buren',
    question: 'Hebben de buren er last van? Van herrie of rommel?',
    answers: [
      { text: 'We praten eerst met de buren. En na tien uur is het stil.', vote: true },
      { text: 'De buren moeten maar wennen.', vote: false, why: 'Esther komt op voor de buren. Zo krijg je haar niet mee.' },
      { text: 'Daar heb ik nog niet over nagedacht.', vote: false, why: 'Esther wil een plan zien.' },
    ],
  },
  {
    id: 'youssef',
    name: 'Youssef',
    cares: 'veiligheid',
    question: 'Hoe zorg je dat het veilig blijft, ook als het donker is?',
    answers: [
      { text: 'Er komen goede lampen. En jongerenwerkers komen vaak langs.', vote: true },
      { text: 'Jongeren zorgen zelf wel voor elkaar.', vote: false, why: 'Youssef wil weten wat je doet als het misgaat.' },
      { text: 'Er gebeurt toch nooit iets.', vote: false, why: 'Dat weet je niet. Youssef wil een plan.' },
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
  const members = practice ? PRACTICE_MEMBERS : MEMBERS;
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
        chooseIdea();
      }),
    );
  }

  function chooseIdea() {
    el.innerHTML = `
      <div class="g">
        <p class="g__title">${topic.label}</p>
        <p class="g__hint">Kies een plan, of verzin er zelf een.</p>
        <div class="g__choices">${topic.ideas.map((i) => `<button class="g__choice" data-i>${escapeHtml(i)}</button>`).join('')}</div>
        <form class="g__own">
          <textarea id="ownIdea" maxlength="200" placeholder="Mijn plan…"></textarea>
          <button class="btn" type="submit">Dit is mijn plan</button>
        </form>
        <p class="g__hint">Zet er geen namen of adressen in.</p>
      </div>`;
    el.querySelectorAll('[data-i]').forEach((b) =>
      b.addEventListener('click', () => {
        idea = b.textContent;
        start();
      }),
    );
    typingForm(el.querySelector('.g__own'), { min: 8 });
    el.querySelector('.g__own').addEventListener('submit', (e) => {
      e.preventDefault();
      const { text } = stripPersonal(el.querySelector('#ownIdea').value.trim());
      if (text.length < 8) return;
      idea = text;
      start();
    });
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
        { target: '.council__lectern', text: 'Dit is je plan. Een raadslid gaat er een vraag over stellen.', wait: 'ok' },
        { target: '.m-answer .g__choices', text: 'Kies het antwoord dat echt iets regelt.', hand: false, wait: () => votes.length > 0 },
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
      extra: `<p class="g__hint">Op dit apparaat kwamen ${count} ${count === 1 ? 'plan' : 'plannen'} binnen over "${escapeHtml(topic.label.toLowerCase())}".</p>`,
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
