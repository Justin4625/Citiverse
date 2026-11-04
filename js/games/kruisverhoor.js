// "Kruisverhoor" (Rules, Rechtbank, Joost).
// A photo of Milan was shared in a big group chat. You may ask 4 questions to 3 witnesses, then
// you give your verdict. Three facts decide the case; you only find them with the right questions.
// Score: up to 3 for the key facts you found + 2 for the right verdict.
// AI: answers a question you write yourself, in the witness's role and only from their facts, and
// says which fact the answer reveals. Without AI you choose from question cards.

import { chat, isAvailable, stripPersonal } from '../ai.js';
import { escapeHtml, say, endScreen, parseJson, shuffle } from './kit.js';

const MAX_QUESTIONS = 4;

const CASE =
  'Sanne (15) heeft een foto van Milan (14) in een grote groepsapp gezet, met de tekst "kijk deze clown 🤡". Milan wil dat de foto weg moet en dat Sanne sorry zegt. Sanne zegt dat het een grap was, en dat de foto toch al online stond.';

const WITNESSES = [
  {
    id: 'milan',
    name: 'Milan',
    role: 'staat op de foto',
    facts: [
      { id: 'herkomst', q: 'Waar kwam de foto vandaan?', a: 'Van mijn eigen account. Maar dat account is privé: alleen mijn volgers kunnen het zien.', key: true },
      { id: 'gevolg', q: 'Wat merk je ervan?', a: 'Ik schaam me. In de pauze lachen mensen me uit, en ik krijg rare berichten van mensen die ik niet ken.', key: true },
      { id: 'zelf', q: 'Deel je zelf weleens foto\'s van anderen?', a: 'Soms een teamfoto van voetbal. Maar dan vraag ik eerst of iedereen dat goed vindt.' },
    ],
  },
  {
    id: 'sanne',
    name: 'Sanne',
    role: 'deelde de foto',
    facts: [
      { id: 'waarom', q: 'Waarom heb je de foto gedeeld?', a: 'Het was een grap. Iedereen doet dat toch?' },
      { id: 'verzoek', q: 'Heeft Milan gevraagd de foto weg te halen?', a: 'Ja, diezelfde avond al. Maar ik vond dat hij zich aanstelde, dus ik heb hem laten staan.', key: true },
      { id: 'screenshot', q: 'Hoe kwam je aan de foto?', a: 'Een vriendin die Milan volgt, stuurde me een screenshot.' },
    ],
  },
  {
    id: 'jesse',
    name: 'Jesse',
    role: 'beheert de groepsapp',
    facts: [
      { id: 'leden', q: 'Hoeveel mensen zitten er in de groep?', a: 'Ongeveer 180. Ook mensen van andere scholen.' },
      { id: 'verwijderen', q: 'Kan de foto nog weg?', a: 'Ik kan het bericht voor iedereen verwijderen. Maar mensen kunnen hem al opgeslagen hebben.' },
      { id: 'regels', q: 'Heeft de groep regels?', a: 'Nee, eigenlijk niet. Ik heb de groep gewoon gemaakt.' },
    ],
  },
];

const KEY_COUNT = WITNESSES.flatMap((w) => w.facts).filter((f) => f.key).length;

const VERDICTS = [
  { text: 'De foto moet weg en Sanne moet sorry zeggen. Milan wordt er belachelijk mee gemaakt en vroeg al om verwijdering.', right: true },
  { text: 'Sanne mocht de foto delen, want hij stond al online.', right: false },
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

export function mount(el, { onFinish, character }) {
  let asked = [];
  const found = new Set();
  let current = WITNESSES[0];
  let aiOn = false;
  let busy = false;
  let destroyed = false;

  isAvailable().then((ok) => {
    aiOn = ok;
    if (!destroyed && el.querySelector('.kv')) render();
  });

  function intro() {
    el.innerHTML = `
      <div class="g">
        ${say(character, `<p>Dit is de zaak die vandaag voor de rechter komt.</p><p>${escapeHtml(CASE)}</p><p>Jij mag ${MAX_QUESTIONS} vragen stellen aan de getuigen. Kies slim: sommige antwoorden beslissen de zaak.</p>`)}
        <button class="btn btn--action g__wide" data-go>Start het verhoor</button>
      </div>`;
    el.querySelector('[data-go]').addEventListener('click', render);
  }

  function render() {
    const left = MAX_QUESTIONS - asked.length;
    el.innerHTML = `
      <div class="g kv">
        <div class="g__bar"><span>Nog ${left} ${left === 1 ? 'vraag' : 'vragen'}</span><span>${found.size} belangrijke feiten</span></div>
        <div class="kv__tabs" role="tablist">
          ${WITNESSES.map((w) => `<button role="tab" class="kv__tab${w === current ? ' is-on' : ''}" aria-selected="${w === current}" data-w="${w.id}"><strong>${w.name}</strong><small>${w.role}</small></button>`).join('')}
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
        ${asked.length ? `<div class="kv__log"><p class="g__hint">Dossier</p>${asked
          .slice()
          .reverse()
          .map((a) => `<div class="kv__entry${a.fact?.key ? ' is-key' : ''}"><small>${a.witness.name}: ${escapeHtml(a.q)}</small><p>${escapeHtml(a.a)}</p>${a.ai ? '<i>Antwoord gemaakt door AI</i>' : ''}</div>`)
          .join('')}</div>` : ''}
        <button class="btn ${left ? '' : 'btn--action'} g__wide" data-verdict ${asked.length ? '' : 'disabled'}>Doe uitspraak</button>
      </div>`;

    el.querySelectorAll('[data-w]').forEach((b) =>
      b.addEventListener('click', () => {
        current = WITNESSES.find((w) => w.id === b.dataset.w);
        render();
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
      render();
      el.querySelector('.g__own').insertAdjacentHTML('beforeend', `<p class="g__thinking">${witness.name} denkt na…</p>`);
      const res = await askFreeQuestion(witness, text);
      busy = false;
      if (destroyed) return;
      if (!res) {
        render();
        el.querySelector('.g__bar').insertAdjacentHTML('afterend', '<p class="g__hint">Dat lukte even niet. Kies een vraag van de kaartjes.</p>');
        return;
      }
      record(witness, text, res.answer, res.fact, true);
    });
    el.querySelector('[data-verdict]').addEventListener('click', verdict);
  }

  function record(witness, q, a, fact, ai) {
    asked.push({ witness, q, a, fact, ai });
    if (fact?.key) found.add(fact.id);
    render();
  }

  function verdict() {
    el.innerHTML = `
      <div class="g">
        ${say(character, '<p>Wat is jouw uitspraak, rechter?</p>')}
        <div class="g__choices">${shuffle(VERDICTS)
          .map((v) => `<button class="g__choice" data-right="${v.right}">${escapeHtml(v.text)}</button>`)
          .join('')}</div>
      </div>`;
    el.querySelectorAll('[data-right]').forEach((b) =>
      b.addEventListener('click', () => ruling(b.dataset.right === 'true')),
    );
  }

  function ruling(right) {
    const missed = WITNESSES.flatMap((w) => w.facts.filter((f) => f.key && !found.has(f.id)).map((f) => ({ w, f })));
    const correct = found.size + (right ? 2 : 0);
    endScreen(el, {
      big: `${correct}/${KEY_COUNT + 2}`,
      sub: right ? 'Goede uitspraak' : 'De rechter oordeelt anders',
      character,
      line: escapeHtml(RULING),
      extra: missed.length
        ? `<div class="kv__log"><p class="g__hint">Belangrijke feiten die je miste</p>${missed
            .map(({ w, f }) => `<div class="kv__entry is-key"><small>${w.name}: ${escapeHtml(f.q)}</small><p>${escapeHtml(f.a)}</p></div>`)
            .join('')}</div>`
        : '<p class="g__hint">Je vond alle drie de beslissende feiten.</p>',
      onDone: () => onFinish({ correct, total: KEY_COUNT + 2, summary: 'punten voor feiten en uitspraak' }),
    });
  }

  intro();
  return () => {
    destroyed = true;
  };
}
