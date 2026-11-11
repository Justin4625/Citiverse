// "Iedereen over de brug" (Everybody, Erasmusbrug, Every).
// The bridge closes tonight and Every's message has to reach everyone. Rewrite it until three very
// different Rotterdammers understand it: Noor (her phone reads messages aloud), Ahmad (learning
// Dutch) and Mirjam (no mobile internet, so links don't work). Three attempts.
// Clear rules decide who understands the message, so the result is always fair and explainable.
// AI: puts each person's reaction into their own words. Without AI they use fixed lines.

import { chat, isAvailable } from '../ai.js';
import { escapeHtml, say, endScreen } from './kit.js';

const ATTEMPTS = 3;

// The message is built from four blocks; tapping a block swaps it for the next version. The first
// version of each block is the original from the city. Typing the message yourself also works.
export const PARTS = [
  ['Wegens werkzaamheden is de Erasmusbrug gestremd', 'De Erasmusbrug is dicht', 'Door werk aan de weg is de Erasmusbrug gestremd'],
  ['van 22:00 tot 06:00.', 'vannacht van 22.00 tot 6.00 uur.', 'binnenkort.'],
  ['Raadpleeg rotterdam.nl/stremming voor alternatieve routes', 'Kijk op rotterdam.nl voor een andere route.', 'Neem de Willemsbrug, de Maastunnel of de metro.', 'Neem een alternatieve route.'],
  ['🚧🌉', '', 'Pas op! ⚠️'],
];
export const buildMessage = (picks) => PARTS.map((opts, i) => opts[picks[i]]).filter(Boolean).join(' ');
const ORIGINAL = buildMessage([0, 0, 0, 0]);

const HARD_WORDS = ['wegens', 'werkzaamheden', 'gestremd', 'stremming', 'raadpleeg', 'raadplegen', 'alternatief', 'alternatieve', 'i.v.m.', 'desbetreffende', 'middels', 'derhalve'];

const EMOJI = /\p{Extended_Pictographic}/u;
const LINK = /\b[\w-]+\.(nl|com|org|net)\b(\/\S*)?/i;
const ROUTE = /willemsbrug|maastunnel|metro|watertaxi|tunnel|andere brug|pont/i;
const TIME = /\b\d{1,2}([:.]\d{2})?\s*(uur)?\b.*\b\d{1,2}([:.]\d{2})?\s*(uur)?\b|vanavond|vannacht|morgenochtend/i;
// "gestremd" also counts as closed: Ahmad trips over the word, but the others understand it.
const CLOSED = /dicht|gesloten|gestremd|stremming|niet over|niet open|kan niet|mag niet/i;

function sentences(text) {
  return text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
}

// Each check returns null when the person understands the message, otherwise the reason.
export function checks(text) {
  const lower = text.toLowerCase();
  const about = /brug/i.test(text) && CLOSED.test(text);
  const routeInText = ROUTE.test(text);
  const hard = HARD_WORDS.filter((w) => lower.includes(w));
  const long = sentences(text).find((s) => s.split(/\s+/).length > 14);
  return {
    noor: !about
      ? 'Ik hoor niet dat de brug dicht is.'
      : EMOJI.test(text)
        ? 'Mijn telefoon leest de plaatjes voor als losse woorden, zoals "bouwbord" en "brug". Dat is verwarrend.'
        : LINK.test(text) && !routeInText
          ? 'Mijn telefoon leest een webadres voor, maar ik hoor niet hoe ik moet reizen.'
          : null,
    ahmad: !about
      ? 'Wat is er met de brug?'
      : hard.length
        ? `Ik ken het woord "${hard[0]}" niet.`
        : long
          ? 'Eén zin is heel lang. Dan raak ik de draad kwijt.'
          : null,
    mirjam: !about
      ? 'Wat is er aan de hand met de brug?'
      : !TIME.test(text)
        ? 'Ik weet niet wanneer de brug dicht is.'
        : !routeInText
          ? 'Ik heb geen internet op mijn telefoon. Hoe kom ik dan naar de overkant?'
          : null,
  };
}

const PEOPLE = [
  { id: 'noor', name: 'Noor', about: 'is slechtziend, haar telefoon leest berichten voor', you: 'Je bent slechtziend en je telefoon leest berichten voor.', ok: 'Mijn telefoon las het duidelijk voor. Ik weet wat ik moet doen!' },
  { id: 'ahmad', name: 'Ahmad', about: 'leert sinds een half jaar Nederlands', you: 'Je leert sinds een half jaar Nederlands.', ok: 'Ik begrijp het. Korte zinnen en gewone woorden, dank je!' },
  { id: 'mirjam', name: 'Mirjam', about: 'heeft geen mobiel internet, links werken niet', you: 'Je hebt geen mobiel internet, dus links werken niet.', ok: 'Duidelijk! Ik weet wanneer, en hoe ik er dan kom. Ik hoef niks op te zoeken.' },
];

async function voice(person, problem) {
  const reply = await chat(
    [
      {
        role: 'system',
        content: `Je bent ${person.name}. ${person.you} Je leest een bericht van de gemeente over de Erasmusbrug. Zeg in één korte zin, in de ik-vorm en in gewone woorden, hoe het bericht voor jou overkomt. Gebruik precies deze reden en voeg niets toe: "${problem ?? 'Ik begrijp het bericht goed.'}"`,
      },
      { role: 'user', content: 'Hoe komt het bericht op jou over?' },
    ],
    { temperature: 0.6, maxTokens: 60 },
  );
  const line = reply?.replace(/^["']|["']$/g, '').trim();
  return line && line.length > 5 && line.length < 220 ? line : null;
}

export function mount(el, { onFinish, character }) {
  let attempt = 0;
  let best = 0;
  let text = ORIGINAL;
  const picks = PARTS.map(() => 0);
  let aiOn = false;
  let destroyed = false;
  let across = {}; // who stood on the far side after the last test
  isAvailable().then((ok) => (aiOn = ok));

  // The Erasmusbrug, with the three people walking across when they understand the message.
  function scene() {
    return `<div class="bridge" aria-hidden="true">
      <svg viewBox="0 0 360 150" preserveAspectRatio="xMidYMid meet">
        <rect x="0" y="104" width="360" height="46" fill="#8fd0ea"/>
        <path d="M0 116 Q 30 110 60 116 T 120 116 T 180 116 T 240 116 T 300 116 T 360 116" stroke="#ffffff" stroke-width="2" fill="none" opacity="0.6"/>
        <rect x="0" y="92" width="52" height="58" fill="#cfd6c4"/>
        <rect x="308" y="92" width="52" height="58" fill="#cfd6c4"/>
        <rect x="40" y="90" width="280" height="8" fill="#14171c"/>
        <path d="M128 90 L 150 12 L 162 90" fill="none" stroke="#14171c" stroke-width="5" stroke-linejoin="round"/>
        ${Array.from({ length: 9 }, (_, i) => `<line x1="150" y1="${14 + i * 2}" x2="${170 + i * 17}" y2="90" stroke="#14171c" stroke-width="1.2"/>`).join('')}
        ${Array.from({ length: 6 }, (_, i) => `<line x1="152" y1="${18 + i * 2}" x2="${120 - i * 13}" y2="90" stroke="#14171c" stroke-width="1.2"/>`).join('')}
        <rect x="200" y="84" width="40" height="6" fill="#ff6a13" class="bridge__barrier"/>
        <text x="26" y="140" font-size="9" font-weight="800" text-anchor="middle" fill="#3a414b">NOORD</text>
        <text x="334" y="140" font-size="9" font-weight="800" text-anchor="middle" fill="#3a414b">ZUID</text>
      </svg>
      ${PEOPLE.map((p, i) => `<span class="walker walker--${p.id}${across[p.id] ? ' is-across' : ''}" style="--i:${i}">${p.name[0]}</span>`).join('')}
    </div>`;
  }

  function blocksHtml() {
    return PARTS.map((opts, i) => {
      const t = opts[picks[i]];
      return `<button class="block" data-part="${i}" aria-label="Verander dit stukje">
        <span${t ? '' : ' class="block__empty"'}>${t ? escapeHtml(t) : '(niks)'}</span><i aria-hidden="true">↻</i></button>`;
    }).join('');
  }

  // Marks what trips people up, shown live after the first test.
  function marks(t) {
    // Links first, so the other marks never end up inside a web address.
    let html = escapeHtml(t).replace(/\b[\w-]+\.(nl|com|org|net)\b(\/[^\s<]*)?/gi, (m) => `<mark class="mk mk--link" title="Werkt niet zonder internet">${m}</mark>`);
    html = html.replace(new RegExp(`\\b(${HARD_WORDS.map((w) => w.replace(/\./g, '\\.')).join('|')})\\b`, 'gi'), '<mark class="mk mk--hard">$1</mark>');
    html = html.replace(/\p{Extended_Pictographic}/gu, (m) => `<mark class="mk mk--emoji">${m}</mark>`);
    return html;
  }

  function editor(results) {
    const left = ATTEMPTS - attempt;
    el.innerHTML = `
      <div class="g">
        <div class="g__bar"><span>Poging ${Math.min(attempt + 1, ATTEMPTS)}/${ATTEMPTS}</span><span>${best}/3 over de brug</span></div>
        ${scene()}
        ${attempt === 0 ? say(character, '<p>Vannacht gaat de brug dicht. Dit bericht heeft de gemeente gemaakt. Maar niet iedereen snapt het. Pas het aan, zodat Noor, Ahmad en Mirjam alle drie weten wat ze moeten doen. Wie het snapt, komt veilig aan de overkant.</p>') : ''}
        <div class="people">${PEOPLE.map((p) => {
          const r = results?.[p.id];
          return `<div class="person${r ? (r.ok ? ' is-ok' : ' is-no') : ''}">
            <strong>${p.name}</strong><small>${p.about}</small>
            ${r ? `<p>${escapeHtml(r.line)}</p>` : ''}
          </div>`;
        }).join('')}</div>
        <p class="g__hint">Tik op een stukje van het bericht om het te veranderen.</p>
        <div class="blocks">${blocksHtml()}</div>
        <details class="g__type"><summary>Of typ het bericht zelf</summary>
          <textarea id="bridgeText" maxlength="400" autocapitalize="sentences">${escapeHtml(text)}</textarea>
        </details>
        ${attempt > 0 ? `<div class="marks"><small>Hier gaat het mis: <mark class="mk mk--hard">moeilijk woord</mark> <mark class="mk mk--emoji">voorgelezen plaatje</mark> <mark class="mk mk--link">link</mark></small><p class="marks__text">${marks(text)}</p></div>` : ''}
        <p class="g__hint">Tip: tijdens de sluiting kun je de Willemsbrug, de Maastunnel of de metro nemen.</p>
        <button class="btn btn--action g__wide" data-test>Test bij Noor, Ahmad en Mirjam (${left} over)</button>
      </div>`;
    el.querySelector('[data-test]').addEventListener('click', test);
    const area = el.querySelector('#bridgeText');
    const showMarks = () => {
      const m = el.querySelector('.marks__text');
      if (m) m.innerHTML = marks(area.value);
    };
    area.addEventListener('input', () => {
      el.querySelector('.blocks').classList.add('is-typed');
      showMarks();
    });
    el.querySelector('.blocks').addEventListener('click', (e) => {
      const b = e.target.closest('[data-part]');
      if (!b) return;
      const i = Number(b.dataset.part);
      picks[i] = (picks[i] + 1) % PARTS[i].length;
      area.value = buildMessage(picks);
      el.querySelector('.blocks').classList.remove('is-typed');
      el.querySelector('.blocks').innerHTML = blocksHtml();
      showMarks();
    });
    // Walk people to their new side after the scene has painted.
    if (results) {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          for (const p of PEOPLE) el.querySelector(`.walker--${p.id}`)?.classList.toggle('is-across', results[p.id].ok);
          across = Object.fromEntries(PEOPLE.map((p) => [p.id, results[p.id].ok]));
        }),
      );
    }
  }

  async function test() {
    text = el.querySelector('#bridgeText').value.trim();
    if (!text) return;
    el.querySelector('[data-test]').disabled = true;
    const c = checks(text);
    const results = {};
    for (const p of PEOPLE) results[p.id] = { ok: !c[p.id], line: c[p.id] ?? p.ok };
    if (aiOn) {
      el.querySelector('[data-test]').textContent = 'Ze lezen het bericht…';
      const lines = await Promise.all(PEOPLE.map((p) => voice(p, c[p.id])));
      if (destroyed) return;
      PEOPLE.forEach((p, i) => {
        if (lines[i]) results[p.id].line = lines[i];
      });
    }
    attempt += 1;
    const passed = Object.values(results).filter((r) => r.ok).length;
    best = Math.max(best, passed);
    if (passed === 3 || attempt >= ATTEMPTS) {
      editor(results);
      el.querySelector('[data-test]').outerHTML = `<button class="btn btn--action g__wide" data-done>${passed === 3 ? 'Iedereen is over de brug!' : 'Naar de uitslag'}</button>`;
      el.querySelector('[data-done]').addEventListener('click', finish);
    } else {
      editor(results);
    }
  }

  function finish() {
    endScreen(el, {
      big: `${best}/3`,
      sub: 'over de brug',
      character,
      line: escapeHtml(
        best === 3
          ? 'Top! Zo maak je een bericht voor iedereen: korte zinnen en gewone woorden. Zet alles wat belangrijk is in de tekst zelf. En laat plaatjes weg, want die worden voorgelezen.'
          : 'Iedereen moet online mee kunnen doen. Gebruik dus korte zinnen en gewone woorden. Zet alles wat belangrijk is in de tekst zelf. En reken niet alleen op een link of plaatjes.',
      ),
      onDone: () => onFinish({ correct: best, total: 3, summary: 'mensen over de brug' }),
    });
  }

  editor(null);
  return () => {
    destroyed = true;
  };
}
