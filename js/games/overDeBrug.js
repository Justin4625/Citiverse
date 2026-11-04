// "Iedereen over de brug" (Everybody, Erasmusbrug, Sem).
// The bridge closes tonight and Sem's message has to reach everyone. Rewrite it until three very
// different Rotterdammers understand it: Noor (her phone reads messages aloud), Ahmad (learning
// Dutch) and Mirjam (no mobile internet, so links don't work). Three attempts.
// Clear rules decide who understands the message, so the result is always fair and explainable.
// AI: puts each person's reaction into their own words. Without AI they use fixed lines.

import { chat, isAvailable } from '../ai.js';
import { escapeHtml, say, endScreen } from './kit.js';

const ATTEMPTS = 3;

const ORIGINAL =
  'Wegens werkzaamheden is de Erasmusbrug gestremd van 22:00 tot 06:00. Raadpleeg rotterdam.nl/stremming voor alternatieve routes 🚧🌉';

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
  { id: 'mirjam', name: 'Mirjam', about: 'heeft geen mobiel internet, links werken niet', you: 'Je hebt geen mobiel internet, dus links werken niet.', ok: 'Helder: ik weet wanneer, en hoe ik er dan kom. Ik hoef niks op te zoeken.' },
];

async function voice(person, problem) {
  const reply = await chat(
    [
      {
        role: 'system',
        content: `Je bent ${person.name}. ${person.you} Je leest een bericht van de gemeente over de Erasmusbrug. Zeg in één korte zin, in de ik-vorm en eenvoudig Nederlands, hoe het bericht voor jou overkomt. Gebruik precies deze reden en voeg niets toe: "${problem ?? 'Ik begrijp het bericht goed.'}"`,
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
  let aiOn = false;
  let destroyed = false;
  isAvailable().then((ok) => (aiOn = ok));

  function editor(results) {
    const left = ATTEMPTS - attempt;
    el.innerHTML = `
      <div class="g">
        <div class="g__bar"><span>Poging ${Math.min(attempt + 1, ATTEMPTS)}/${ATTEMPTS}</span><span>${best}/3 over de brug</span></div>
        ${attempt === 0 ? say(character, '<p>Vannacht gaat de brug dicht. Dit bericht heeft de gemeente gemaakt. Maar niet iedereen snapt het. Herschrijf het zo dat Noor, Ahmad en Mirjam alle drie weten wat ze moeten doen.</p>') : ''}
        <div class="people">${PEOPLE.map((p) => {
          const r = results?.[p.id];
          return `<div class="person${r ? (r.ok ? ' is-ok' : ' is-no') : ''}">
            <strong>${p.name}</strong><small>${p.about}</small>
            ${r ? `<p>${escapeHtml(r.line)}</p>` : ''}
          </div>`;
        }).join('')}</div>
        <label class="g__hint" for="bridgeText">Het bericht</label>
        <textarea id="bridgeText" maxlength="400">${escapeHtml(text)}</textarea>
        <p class="g__hint">Tip: tijdens de sluiting kun je de Willemsbrug, de Maastunnel of de metro nemen.</p>
        <button class="btn btn--action g__wide" data-test>Test bij Noor, Ahmad en Mirjam (${left} over)</button>
      </div>`;
    el.querySelector('[data-test]').addEventListener('click', test);
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
          ? 'Top! Een bericht voor iedereen gebruikt korte zinnen en gewone woorden, zet de belangrijkste informatie in de tekst zelf, en laat plaatjes weg die voorgelezen worden.'
          : 'Iedereen moet online mee kunnen doen. Gebruik korte zinnen en gewone woorden, zet de belangrijkste informatie in de tekst zelf, en vertrouw niet alleen op een link of plaatjes.',
      ),
      onDone: () => onFinish({ correct: best, total: 3, summary: 'mensen over de brug' }),
    });
  }

  editor(null);
  return () => {
    destroyed = true;
  };
}
