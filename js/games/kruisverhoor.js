// "Kruisverhoor" (Rules, Rechtbank, Ruly).
// A courtroom game in the style of a detective game.
// 1. Investigation: ask 4 questions to 3 witnesses. Answers that matter become evidence cards.
// 2. Cross-examination: Sanne gives her testimony, statement by statement. When she says
//    something that your evidence proves wrong, shout "Bezwaar!" and present that card.
//    A wrong objection costs credibility. Without the right evidence you can't catch her lie.
// 3. Verdict, with the gavel.
// Score: 1 point per lie you caught (3) + 2 for the right verdict.
// AI: answers a question you write yourself, in the witness's role and only from their facts,
// and says which fact the answer reveals. Without AI you choose from question cards.

import { chat, isAvailable, stripPersonal } from '../ai.js';
import { escapeHtml, say, endScreen, parseJson, shuffle } from './kit.js';

const MAX_QUESTIONS = 4;
const CREDIBILITY = 3;

const CASE =
  'Sanne (15) heeft een foto van Milan (14) in een grote groepsapp gezet, met de tekst "kijk deze clown 🤡". Milan wil dat de foto weg moet en dat Sanne sorry zegt. Sanne zegt dat het een grap was.';

// Facts with `evidence` become evidence cards.
const WITNESSES = [
  {
    id: 'milan',
    name: 'Milan',
    role: 'staat op de foto',
    facts: [
      { id: 'herkomst', q: 'Waar kwam de foto vandaan?', a: 'Van mijn eigen account. Maar dat account is privé: alleen mijn volgers kunnen het zien.', evidence: 'Privé-account' },
      { id: 'gevolg', q: 'Wat merk je ervan?', a: 'Ik schaam me. In de pauze lachen mensen me uit, en ik krijg rare berichten van mensen die ik niet ken.', evidence: 'Milan wordt uitgelachen' },
      { id: 'zelf', q: 'Deel je zelf weleens foto\'s van anderen?', a: 'Soms een teamfoto van voetbal. Maar dan vraag ik eerst of iedereen dat goed vindt.' },
    ],
  },
  {
    id: 'sanne',
    name: 'Sanne',
    role: 'deelde de foto',
    facts: [
      { id: 'waarom', q: 'Waarom heb je de foto gedeeld?', a: 'Het was een grap. Iedereen doet dat toch?' },
      { id: 'screenshot', q: 'Hoe kwam je aan de foto?', a: 'Een vriendin die Milan volgt, stuurde me een screenshot.' },
      { id: 'sorry', q: 'Wil je sorry zeggen?', a: 'Waarom? Ik heb niks verkeerds gedaan.' },
    ],
  },
  {
    id: 'jesse',
    name: 'Jesse',
    role: 'beheert de groepsapp',
    facts: [
      { id: 'verzoek', q: 'Wat gebeurde er na het delen?', a: 'Milan stuurde die avond in de groep: "Haal dit alsjeblieft weg." Sanne reageerde met een lachende emoji.', evidence: 'Milan vroeg het weg te halen' },
      { id: 'leden', q: 'Hoeveel mensen zitten er in de groep?', a: 'Ongeveer 180. Ook mensen van andere scholen.' },
      { id: 'regels', q: 'Heeft de groep regels?', a: 'Nee, eigenlijk niet. Ik heb de groep gewoon gemaakt.' },
    ],
  },
];

// Sanne's testimony. `lie` names the evidence that proves the statement wrong.
const TESTIMONY = [
  { text: 'Het was gewoon een grapje, iedereen in de groep moest erom lachen.', lie: null },
  { text: 'De foto stond toch al openbaar online. Iedereen kon hem zien.', lie: 'herkomst', caught: 'Milans account is privé. Alleen zijn volgers konden de foto zien, en jij kreeg hem via een screenshot.' },
  { text: 'Milan heeft nooit gevraagd om de foto weg te halen.', lie: 'verzoek', caught: 'Volgens Jesse vroeg Milan diezelfde avond in de groep om de foto weg te halen. Jij reageerde met een lachende emoji.' },
  { text: 'En Milan vindt het zelf ook helemaal niet erg.', lie: 'gevolg', caught: 'Milan schaamt zich en wordt in de pauze uitgelachen. Dat is niet "niet erg".' },
];

const VERDICTS = [
  { text: 'De foto moet weg en Sanne moet sorry zeggen. Milan wordt er belachelijk mee gemaakt en vroeg al om verwijdering.', right: true },
  { text: 'Sanne mocht de foto delen, want het was een grap.', right: false },
  { text: 'Niemand is schuldig. Het is de schuld van de groepsapp.', right: false },
];

const RULING =
  'Je hebt portretrecht. Een foto waarop je herkenbaar bent, mag niet zomaar gedeeld worden als je daar een goede reden tegen hebt, bijvoorbeeld omdat je belachelijk wordt gemaakt. Dat de foto al ergens anders stond, verandert dat niet, zeker niet als het een privé-account was. En wie gevraagd wordt een foto weg te halen en dat weigert, kan daartoe gedwongen worden.';

async function askFreeQuestion(witness, question) {
  const reply = await chat(
    [
      {
        role: 'system',
        content: [
          `Je bent ${witness.name}, ${witness.role}, in een rechtszaakspel voor jongeren. De zaak: ${CASE}`,
          'Beantwoord de vraag in je rol, in één of twee korte zinnen, in eenvoudig Nederlands.',
          'Gebruik alleen deze feiten. Staat het antwoord er niet in, zeg dan dat je dat niet weet.',
          ...witness.facts.map((f) => `- [${f.id}] ${f.a}`),
          'Antwoord alleen met JSON: {"antwoord": "...", "feit": "id van het feit dat je antwoord vertelt, of null"}',
        ].join('\n'),
      },
      { role: 'user', content: question },
    ],
    { json: true, temperature: 0.3, maxTokens: 140 },
  );
  const data = parseJson(reply);
  if (typeof data?.antwoord !== 'string' || !data.antwoord.trim()) return null;
  const fact = witness.facts.find((f) => f.id === data.feit) ?? null;
  return { answer: data.antwoord.trim().slice(0, 280), fact };
}

const portrait = (w, extra = '') =>
  `<span class="portrait portrait--${w.id} ${extra}" aria-hidden="true"><b>${w.name[0]}</b></span>`;

export function mount(el, { onFinish, character }) {
  const asked = [];
  const evidence = new Map(); // fact id -> { title, text }
  let current = WITNESSES[0];
  let aiOn = false;
  let busy = false;
  let destroyed = false;
  let statement = 0;
  let credibility = CREDIBILITY;
  const caught = new Set();

  isAvailable().then((ok) => {
    aiOn = ok;
    if (!destroyed && el.querySelector('.kv--ask')) investigate();
  });

  function evidenceBar() {
    return `<div class="evidence">${[...evidence.entries()].length
      ? [...evidence.entries()].map(([id, e]) => `<span class="evidence__card" data-e="${id}"><small>Bewijs</small><strong>${escapeHtml(e.title)}</strong></span>`).join('')
      : '<span class="evidence__empty">Nog geen bewijs</span>'}</div>`;
  }

  function intro() {
    el.innerHTML = `
      <div class="g">
        <div class="court" aria-hidden="true">
          <span class="court__bench">RECHTBANK ROTTERDAM</span>
          <div class="court__row">${WITNESSES.map((w) => portrait(w)).join('')}</div>
        </div>
        ${say(character, `<p>Vandaag dient deze zaak.</p><p>${escapeHtml(CASE)}</p><p>Straks legt Sanne een verklaring af. Ik denk dat ze niet alles eerlijk vertelt. Verzamel eerst bewijs: je mag ${MAX_QUESTIONS} vragen stellen.</p>`)}
        <button class="btn btn--action g__wide" data-go>Start het onderzoek</button>
      </div>`;
    el.querySelector('[data-go]').addEventListener('click', investigate);
  }

  function investigate() {
    const left = MAX_QUESTIONS - asked.length;
    el.innerHTML = `
      <div class="g kv kv--ask">
        <div class="g__bar"><span>Nog ${left} ${left === 1 ? 'vraag' : 'vragen'}</span><span>${evidence.size} bewijs</span></div>
        <div class="kv__tabs" role="tablist">
          ${WITNESSES.map((w) => `<button role="tab" class="kv__tab${w === current ? ' is-on' : ''}" aria-selected="${w === current}" data-w="${w.id}">${portrait(w)}<span><strong>${w.name}</strong><small>${w.role}</small></span></button>`).join('')}
        </div>
        <div class="g__choices">
          ${current.facts
            .map((f) => {
              const done = asked.some((a) => a.fact === f);
              return `<button class="g__choice" data-f="${f.id}" ${done || !left || busy ? 'disabled' : ''}>${escapeHtml(f.q)}${done ? '<small>Al gevraagd</small>' : ''}</button>`;
            })
            .join('')}
        </div>
        ${aiOn && left ? `<form class="g__own">
          <input id="kvOwn" class="g__input" maxlength="160" placeholder="Of stel ${current.name} je eigen vraag…" autocomplete="off" ${busy ? 'disabled' : ''}>
          <button class="btn" type="submit" ${busy ? 'disabled' : ''}>Vraag</button>
        </form>` : ''}
        ${evidenceBar()}
        ${asked.length ? `<div class="kv__log">${asked
          .slice()
          .reverse()
          .map((a) => `<div class="kv__entry${a.fact?.evidence ? ' is-key' : ''}"><small>${a.witness.name}: ${escapeHtml(a.q)}</small><p>${escapeHtml(a.a)}</p>${a.ai ? '<i>Antwoord gemaakt door AI</i>' : ''}</div>`)
          .join('')}</div>` : ''}
        <button class="btn ${left ? '' : 'btn--action'} g__wide" data-next ${asked.length ? '' : 'disabled'}>Naar de zitting</button>
      </div>`;

    el.querySelectorAll('[data-w]').forEach((b) =>
      b.addEventListener('click', () => {
        current = WITNESSES.find((w) => w.id === b.dataset.w);
        investigate();
      }),
    );
    el.querySelectorAll('[data-f]').forEach((b) =>
      b.addEventListener('click', () => {
        const fact = current.facts.find((f) => f.id === b.dataset.f);
        record(current, fact.q, fact.a, fact, false);
      }),
    );
    el.querySelector('.g__own')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { text } = stripPersonal(el.querySelector('#kvOwn').value.trim());
      if (text.length < 5 || busy) return;
      busy = true;
      const witness = current;
      investigate();
      el.querySelector('.g__own').insertAdjacentHTML('beforeend', `<p class="g__thinking">${witness.name} denkt na…</p>`);
      const res = await askFreeQuestion(witness, text);
      busy = false;
      if (destroyed) return;
      if (!res) {
        investigate();
        el.querySelector('.g__bar').insertAdjacentHTML('afterend', '<p class="g__hint">Dat lukte even niet. Kies een vraag van de kaartjes.</p>');
        return;
      }
      record(witness, text, res.answer, res.fact, true);
    });
    el.querySelector('[data-next]').addEventListener('click', hearing);
  }

  function record(witness, q, a, fact, ai) {
    asked.push({ witness, q, a, fact, ai });
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
    const sanne = WITNESSES[1];
    const s = TESTIMONY[statement];
    const done = caught.has(statement);
    el.innerHTML = `
      <div class="g kv">
        <div class="g__bar"><span>Verklaring van Sanne</span><span class="cred">${'<i class="on"></i>'.repeat(credibility)}${'<i></i>'.repeat(CREDIBILITY - credibility)}</span></div>
        <div class="testimony">
          ${portrait(sanne, 'portrait--big')}
          <div class="testimony__bubble ${done ? 'is-caught' : ''}">
            <small>Uitspraak ${statement + 1}/${TESTIMONY.length}</small>
            <p>"${escapeHtml(s.text)}"</p>
          </div>
        </div>
        <div class="testimony__nav">
          <button class="btn" data-prev ${statement === 0 ? 'disabled' : ''} aria-label="Vorige uitspraak">‹</button>
          <button class="btn btn--objection" data-object ${done ? 'disabled' : ''}>Bezwaar!</button>
          <button class="btn" data-fwd ${statement === TESTIMONY.length - 1 ? 'disabled' : ''} aria-label="Volgende uitspraak">›</button>
        </div>
        <p class="g__hint">Blader door de verklaring. Klopt een uitspraak niet met je bewijs? Roep "Bezwaar!" en laat het bewijs zien. Een verkeerd bezwaar kost geloofwaardigheid.</p>
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
    const s = TESTIMONY[statement];
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
    el.innerHTML = `
      <div class="g">
        ${say(character, `<p>${caught.size === 3 ? 'Je hebt alle leugens ontmaskerd!' : caught.size ? `Je ving ${caught.size} van de 3 onwaarheden.` : 'Je hebt Sanne niet op een leugen kunnen betrappen.'} Wat is jouw uitspraak, rechter?</p>`)}
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
    const missed = TESTIMONY.map((s, i) => ({ s, i })).filter(({ s, i }) => s.lie && !caught.has(i));
    endScreen(el, {
      big: `${correct}/5`,
      sub: right ? 'Goede uitspraak' : 'De rechter oordeelt anders',
      character,
      line: escapeHtml(RULING),
      extra: missed.length
        ? `<div class="kv__log"><p class="g__hint">Onwaarheden die je miste</p>${missed
            .map(({ s }) => `<div class="kv__entry is-key"><small>Sanne: "${escapeHtml(s.text)}"</small><p>${escapeHtml(s.caught)}</p></div>`)
            .join('')}</div>`
        : '<p class="g__hint">Je ving alle drie de onwaarheden. Een echte advocaat!</p>',
      onDone: () => onFinish({ correct, total: 5, summary: 'punten voor bezwaren en uitspraak' }),
    });
  }

  intro();
  return () => {
    destroyed = true;
  };
}
