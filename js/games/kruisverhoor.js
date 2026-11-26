// "Kruisverhoor" (Rules, Rechtbank, Ruly).
// A courtroom game in the style of a detective game.
// 1. Investigation: ask 6 questions to 3 witnesses. Answers that matter become evidence cards.
// 2. Cross-examination: Sanne gives her testimony, statement by statement. When she says
//    something that your evidence proves wrong, shout "Bezwaar!" and present that card.
//    A wrong objection costs credibility. Without the right evidence you can't catch her lie.
// 3. Verdict, with the gavel.
// Score: 1 point per lie you caught (3) + 2 for the right verdict.
// No AI and no typing: you choose from question cards (the user removed chatting inside games).

import { escapeHtml, say, endScreen, shuffle } from './kit.js';
import { guide } from './guide.js';

const MAX_QUESTIONS = 6;
const CREDIBILITY = 3;

const CASE =
  'Sanne zette een foto van Milan in een grote groepsapp: "kijk deze clown 🤡". Milan wil dat de foto weggaat. Sanne zegt dat het een grap was.';

// Facts with `evidence` become evidence cards.
const WITNESSES = [
  {
    id: 'milan',
    name: 'Milan',
    role: 'staat op de foto',
    facts: [
      { id: 'herkomst', q: 'Waar kwam de foto vandaan?', a: 'Van mijn account. Dat is privé.', evidence: 'Privé-account' },
      { id: 'gevolg', q: 'Wat merk je ervan?', a: 'Ik schaam me. Mensen lachen me uit.', evidence: 'Milan wordt uitgelachen' },
      { id: 'zelf', q: 'Deel je zelf weleens foto\'s van anderen?', a: 'Alleen als iedereen het goed vindt.' },
    ],
  },
  {
    id: 'sanne',
    name: 'Sanne',
    role: 'deelde de foto',
    facts: [
      { id: 'waarom', q: 'Waarom heb je de foto gedeeld?', a: 'Het was een grap. Iedereen doet dat toch?' },
      { id: 'screenshot', q: 'Hoe kwam je aan de foto?', a: 'Een vriendin stuurde me een screenshot.' },
      { id: 'sorry', q: 'Wil je sorry zeggen?', a: 'Waarom? Ik heb niks verkeerds gedaan.' },
    ],
  },
  {
    id: 'jesse',
    name: 'Jesse',
    role: 'beheert de groepsapp',
    facts: [
      { id: 'verzoek', q: 'Wat gebeurde er na het delen?', a: 'Milan vroeg: "Haal dit weg." Sanne stuurde een lachende emoji.', evidence: 'Milan vroeg het weg te halen' },
      { id: 'leden', q: 'Hoeveel mensen zitten er in de groep?', a: 'Ongeveer 180.' },
      { id: 'regels', q: 'Heeft de groep regels?', a: 'Nee, eigenlijk niet.' },
    ],
  },
];

// Sanne's testimony. `lie` names the evidence that proves the statement wrong.
const TESTIMONY = [
  { text: 'Het was gewoon een grapje, iedereen in de groep moest erom lachen.', lie: null },
  { text: 'De foto stond toch al openbaar online. Iedereen kon hem zien.', lie: 'herkomst', caught: 'Milans account is privé. De foto was niet openbaar.' },
  { text: 'Milan heeft nooit gevraagd om de foto weg te halen.', lie: 'verzoek', caught: 'Milan vroeg het wel. Dat zegt Jesse.' },
  { text: 'En Milan vindt het zelf ook helemaal niet erg.', lie: 'gevolg', caught: 'Milan wordt uitgelachen. Hij vindt het wel erg.' },
];

const VERDICTS = [
  { text: 'De foto moet weg en Sanne zegt sorry.', right: true },
  { text: 'Sanne mocht het, het was een grap.', right: false },
  { text: 'Het is de schuld van de groepsapp.', right: false },
];

const RULING =
  'Je hebt portretrecht. Iemand mag geen foto van jou delen als je daardoor wordt uitgelachen. Vraag je of hij weg moet? Dan moet dat ook.';

// The practice round has its own small case, never used in the real game.
const PRACTICE_CASE = {
  text: 'Daan zegt dat Lisa zijn fiets heeft geleend zonder te vragen. Lisa zegt dat ze dat niet deed.',
  witnesses: [
    { id: 'jesse', name: 'Tim', role: 'woont naast Daan', facts: [{ id: 'zag', q: 'Wat heb je gezien?', a: 'Ik zag Lisa gisteren op de fiets van Daan.', evidence: 'Tim zag Lisa op de fiets' }] },
    { id: 'sanne', name: 'Lisa', role: 'leende de fiets?', facts: [{ id: 'lisa', q: 'Waar was je gisteren?', a: 'Gewoon thuis.' }] },
  ],
  testimony: [{ text: 'Ik heb die fiets nooit aangeraakt.', lie: 'zag', caught: 'Tim zag Lisa gisteren op de fiets van Daan.' }],
};
const MAIN_CASE = { text: CASE, witnesses: WITNESSES, testimony: TESTIMONY };

const portrait = (w, extra = '') =>
  `<span class="portrait portrait--${w.id} ${extra}" aria-hidden="true"><b>${w.name[0]}</b></span>`;

export function mount(el, { practice = false, onPracticeDone = () => {}, onFinish, character }) {
  const C = practice ? PRACTICE_CASE : MAIN_CASE;
  C.accused = C.witnesses[1];
  const asked = [];
  const evidence = new Map(); // fact id -> { title, text }
  let current = C.witnesses[0];
  let destroyed = false;
  let statement = 0;
  let credibility = CREDIBILITY;
  const caught = new Set();
  let stopGuide = () => {};
  let hearingGuided = false;


  function evidenceBar() {
    return `<div class="evidence">${[...evidence.entries()].length
      ? [...evidence.entries()].map(([id, e]) => `<span class="evidence__card" data-e="${id}"><small>Bewijs</small><strong>${escapeHtml(e.title)}</strong></span>`).join('')
      : '<span class="evidence__empty">Nog geen bewijs</span>'}</div>`;
  }

  function investigate() {
    const left = MAX_QUESTIONS - asked.length;
    el.innerHTML = `
      <div class="g kv kv--ask">
        <div class="g__bar"><span>Nog ${left} ${left === 1 ? 'vraag' : 'vragen'}</span><span>${evidence.size} bewijs</span></div>
        <p class="kv__case">${escapeHtml(C.text)}</p>
        <div class="kv__tabs" role="tablist">
          ${C.witnesses.map((w) => `<button role="tab" class="kv__tab${w === current ? ' is-on' : ''}" aria-selected="${w === current}" data-w="${w.id}">${portrait(w)}<span><strong>${w.name}</strong><small>${w.role}</small></span></button>`).join('')}
        </div>
        <div class="g__choices">
          ${current.facts
            .map((f) => {
              const done = asked.some((a) => a.fact === f);
              return `<button class="g__choice" data-f="${f.id}" ${done || !left ? 'disabled' : ''}>${escapeHtml(f.q)}${done ? '<small>Al gevraagd</small>' : ''}</button>`;
            })
            .join('')}
        </div>
        ${evidenceBar()}
        ${(() => {
          const a = asked[asked.length - 1];
          return a
            ? `<div class="kv__entry kv__last${a.fact?.evidence ? ' is-key' : ''}"><small>${a.witness.name}: ${escapeHtml(a.q)}</small><p>${escapeHtml(a.a)}</p>${a.fact?.evidence ? `<b class="kv__new">Nieuw bewijs: ${escapeHtml(a.fact.evidence)}</b>` : ''}</div>`
            : '<div class="kv__entry kv__last kv__last--empty"><p>Kies een getuige en stel een vraag.</p></div>';
        })()}
        <button class="btn ${left ? '' : 'btn--action'} g__wide" data-next ${asked.length ? '' : 'disabled'}>Naar de zitting</button>
      </div>`;

    el.querySelectorAll('[data-w]').forEach((b) =>
      b.addEventListener('click', () => {
        current = C.witnesses.find((w) => w.id === b.dataset.w);
        investigate();
      }),
    );
    el.querySelectorAll('[data-f]').forEach((b) =>
      b.addEventListener('click', () => {
        const fact = current.facts.find((f) => f.id === b.dataset.f);
        record(current, fact.q, fact.a, fact);
      }),
    );
    el.querySelector('[data-next]').addEventListener('click', hearing);
  }

  function record(witness, q, a, fact) {
    asked.push({ witness, q, a, fact });
    if (fact?.evidence && !evidence.has(fact.id)) {
      evidence.set(fact.id, { title: fact.evidence, text: fact.a });
    }
    investigate();
    if (fact?.evidence) {
      const card = el.querySelector(`[data-e="${fact.id}"]`);
      card?.classList.add('is-new');
    }
  }

  function hearing() {
    const sanne = C.accused;
    const s = C.testimony[statement];
    const done = caught.has(statement);
    el.innerHTML = `
      <div class="g kv">
        <div class="g__bar"><span>Verklaring van ${C.accused.name}</span><span class="cred">${'<i class="on"></i>'.repeat(credibility)}${'<i></i>'.repeat(CREDIBILITY - credibility)}</span></div>
        <div class="testimony">
          ${portrait(sanne, 'portrait--big')}
          <div class="testimony__bubble ${done ? 'is-caught' : ''}">
            <small>Uitspraak ${statement + 1}/${C.testimony.length}</small>
            <p>"${escapeHtml(s.text)}"</p>
          </div>
        </div>
        <div class="testimony__nav">
          <button class="btn" data-prev ${statement === 0 ? 'disabled' : ''} aria-label="Vorige uitspraak">‹</button>
          <button class="btn btn--objection" data-object ${done ? 'disabled' : ''}>Bezwaar!</button>
          <button class="btn" data-fwd ${statement === C.testimony.length - 1 ? 'disabled' : ''} aria-label="Volgende uitspraak">›</button>
        </div>
        ${evidenceBar()}
        <button class="btn g__wide" data-verdict>Klaar: naar de uitspraak</button>
      </div>`;
    el.querySelector('[data-prev]').addEventListener('click', () => {
      statement -= 1;
      hearing();
    });
    el.querySelector('[data-fwd]').addEventListener('click', () => {
      statement += 1;
      hearing();
    });
    el.querySelector('[data-object]').addEventListener('click', choose);
    el.querySelector('[data-verdict]').addEventListener('click', verdict);
    if (practice && !hearingGuided) {
      hearingGuided = true;
      stopGuide = practice && guide(el, [
        { target: '.testimony', text: 'Lisa zegt dat ze de fiets nooit heeft aangeraakt. Klopt dat?', wait: 'ok' },
        { target: '[data-object]', text: 'Dat klopt niet met je bewijs! Roep Bezwaar.' },
        { target: '.evidence__card', text: 'Laat het bewijs zien.' },
        { target: '.testimony', text: 'Gesnapt! Zo vang je een leugen.', wait: () => caught.size > 0, after: 1300 },
        { target: '.testimony', text: 'In de echte zaak stel je meer vragen en zoek je meer leugens.', wait: 'ok' },
      ], { onDone: onPracticeDone });
    }
  }

  function choose() {
    const box = el.querySelector('.evidence');
    if (!evidence.size) {
      flash('Je hebt geen bewijs om te laten zien!', false);
      return;
    }
    const nav = el.querySelector('.testimony__nav');
    nav.classList.add('is-choosing');
    nav.innerHTML = '<p class="g__hint">Tik op het bewijs dat je laat zien.</p><button class="btn" data-cancel>Toch niet</button>';
    el.querySelector('[data-cancel]').addEventListener('click', hearing);
    box.classList.add('is-choosing');
    box.querySelectorAll('[data-e]').forEach((card) => {
      card.setAttribute('role', 'button');
      card.tabIndex = 0;
      const pick = () => present(card.dataset.e);
      card.addEventListener('click', pick);
      card.addEventListener('keydown', (e) => e.key === 'Enter' && pick());
    });
  }

  function present(id) {
    const s = C.testimony[statement];
    if (s.lie === id) {
      caught.add(statement);
      el.insertAdjacentHTML('beforeend', '<div class="objection" aria-hidden="true"><span>BEZWAAR!</span></div>');
      navigator.vibrate?.([60, 40, 120]);
      setTimeout(() => {
        el.querySelector('.objection')?.remove();
        hearing();
        el.querySelector('.testimony').insertAdjacentHTML('afterend', say(character, `<p>${escapeHtml(s.caught)}</p>`));
      }, 1100);
    } else {
      credibility -= 1;
      flash(s.lie ? 'Dit bewijs past niet bij deze uitspraak.' : 'Deze uitspraak klopt gewoon. Sanne vond het echt een grap.', true);
      if (credibility <= 0) {
        setTimeout(verdict, 1400);
        return;
      }
      setTimeout(hearing, 1400);
    }
  }

  function flash(text, penalty) {
    el.querySelector('.testimony')?.classList.add('is-shake');
    el.querySelector('.g__bar').insertAdjacentHTML('afterend', `<p class="g__verdict is-wrong">${escapeHtml(text)}</p>`);
    if (penalty) el.querySelector('.cred').innerHTML = `${'<i class="on"></i>'.repeat(Math.max(0, credibility))}${'<i></i>'.repeat(CREDIBILITY - Math.max(0, credibility))}`;
  }

  function verdict() {
    if (practice) return onPracticeDone();
    el.innerHTML = `
      <div class="g">
        ${say(character, `<p>${caught.size === 3 ? 'Je hebt alle leugens gevonden!' : caught.size ? `Je vond ${caught.size} van de 3 leugens.` : 'Je hebt Sanne niet op een leugen kunnen betrappen.'} Wat is jouw uitspraak, rechter?</p>`)}
        <div class="g__choices">${shuffle(VERDICTS)
          .map((v) => `<button class="g__choice" data-right="${v.right}">${escapeHtml(v.text)}</button>`)
          .join('')}</div>
      </div>`;
    el.querySelectorAll('[data-right]').forEach((b) =>
      b.addEventListener('click', () => {
        el.insertAdjacentHTML('beforeend', '<div class="gavel" aria-hidden="true"><span class="gavel__head"></span><span class="gavel__bang">BAM</span></div>');
        setTimeout(() => ruling(b.dataset.right === 'true'), 900);
      }),
    );
  }

  function ruling(right) {
    el.querySelector('.gavel')?.remove();
    const correct = caught.size + (right ? 2 : 0);
    const missed = C.testimony.map((s, i) => ({ s, i })).filter(({ s, i }) => s.lie && !caught.has(i));
    endScreen(el, {
      big: `${correct}/5`,
      sub: right ? 'Goede uitspraak' : 'De rechter oordeelt anders',
      character,
      line: escapeHtml(RULING),
      extra: missed.length
        ? `<p class="g__hint">Je miste ${missed.length} ${missed.length === 1 ? 'leugen' : 'leugens'}. Probeer het nog eens!</p>`
        : '<p class="g__hint">Je vond alle drie de leugens. Echt een advocaat!</p>',
      onDone: () => onFinish({ correct, total: 5, summary: 'punten voor bezwaren en uitspraak' }),
    });
  }

  investigate();
  stopGuide = practice && guide(el, [
    { target: '.kv__case', text: 'Dit is een oefenzaak. Zoek uit of Lisa de waarheid zegt.', wait: 'ok' },
    { target: '.g__choices', text: 'Vraag Tim wat hij heeft gezien.', wait: () => asked.length > 0 },
    { target: '.evidence', text: 'Belangrijke antwoorden worden bewijs. Dat heb je straks nodig!', wait: 'ok' },
  ], { onDone: hearing });
  return () => {
    if (stopGuide) stopGuide();
    destroyed = true;
  };
}
