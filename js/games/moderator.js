// "Moderator" (Freedom, Kubuswoningen, Freely).
// Freely is painting live. Reactions come in one at a time, and you take as long as you like for
// each: keep it (criticism, jokes, opinions) or remove it (hate, threats, spam, someone's private
// details). Freely explains every choice. No clock and nothing moves on its own (the user wanted
// time to think instead of speed).
// AI: Freely reflects on how you moderated. The comments are hand-written on purpose: we don't let
// a model write hateful content for children.

import { chat, isAvailable } from '../ai.js';
import { escapeHtml, say, endScreen, shuffle } from './kit.js';
import { guide } from './guide.js';

const PER_KIND = 5; // comments of each kind per game, picked at random

const ALLOWED = [
  { user: 'kunstkijker', text: 'Ik vind dit echt lelijk, sorry.', why: 'Kritiek op kunst mag, ook als het niet aardig is.' },
  { user: 'memequeen010', text: 'Dit lijkt op een kubus die elk moment kan omvallen 😂', why: 'Een grap over het werk is geen aanval op Freely.' },
  { user: 'stadsgenoot', text: 'Kunst zou niet met belastinggeld betaald moeten worden.', why: 'Een mening over politiek mag, ook onder kunst.' },
  { user: 'r.dam_jongen', text: 'Mijn kleine zusje van 5 kan dit ook.', why: 'Harde kritiek, maar geen belediging. Die mag blijven.' },
  { user: 'galerie_fan', text: 'De kleuren vloeken, maar de vorm is wel tof.', why: 'Eerlijke kritiek. Daar leert een kunstenaar van.' },
  { user: 'nieuwsgierig', text: 'Hoe lang doe je over zo\'n schilderij?', why: 'Een gewone vraag. Weghalen zou raar zijn.' },
  { user: 'skeptisch', text: 'Dit is geen kunst, dit is verf op een doek.', why: 'Een mening over wat kunst is. Mag gewoon.' },
  { user: 'buurman_kees', text: 'Freely kan beter stoppen met schilderen.', why: 'Niet aardig, maar het gaat over zijn werk. Mag.' },
  { user: 'fan4ever', text: 'Wauw, dit is je beste werk tot nu toe!', why: 'Een compliment. Laat maar lekker staan.' },
  { user: 'kritisch_k', text: 'Alle kubuskunst lijkt op elkaar. Saai.', why: 'Kritiek op een stijl. Mag.' },
  { user: 'rotterdam_mening', text: 'Piet Blom was beter dan jij.', why: 'Dat doet pijn, maar het is gewoon een mening.' },
  { user: 'grapjas', text: 'Kun je ook iets schilderen dat recht is? 😅', why: 'Een grapje over de kubussen. Mag blijven.' },
];

const NOT_ALLOWED = [
  { user: 'anoniem_1234', text: 'Ik weet in welke kubus jij woont. Ik kom je opzoeken.', why: 'Dit is een bedreiging. Dat is geen mening meer.' },
  { user: 'echte_rdammer', text: 'Mensen zoals jij horen hier niet. Ga terug naar je eigen land.', why: 'Discriminatie: iemand wordt aangevallen om wie hij is.' },
  { user: 'volgers_gratis', text: 'GRATIS 10.000 volgers!!! Klik op de link in mijn bio 🔥', why: 'Spam en waarschijnlijk oplichting.' },
  { user: 'xx_hater_xx', text: 'Freely is een vieze loser. Iedereen moet hem blokkeren.', why: 'Schelden en een oproep tot pesten.' },
  { user: 'weet_alles', text: 'Hier is het nummer van Freely, bel hem maar: 06-•• •• •• ••', why: 'Iemands nummer delen is gevaarlijk.' },
  { user: 'freely_official2', text: 'Ik ben de echte Freely! Stuur me je wachtwoord voor een gratis print.', why: 'Iemand doet zich voor als Freely om wachtwoorden te stelen.' },
  { user: 'boos_account', text: 'Als ik je op straat zie, sla ik je.', why: 'Een bedreiging met geweld. Weghalen en melden.' },
  { user: 'winactie_nl', text: 'Jij hebt een iPhone gewonnen! Vul je bankgegevens in via de link.', why: 'Oplichting: niemand wint zomaar iets.' },
  { user: 'pestkop99', text: 'Hahaha kijk hoe dik hij is geworden 🤢', why: 'Uitlachen om je lichaam is pesten.' },
  { user: 'groepsapp_leak', text: 'Freely woont op nummer 14, ik heb foto\'s van zijn huis.', why: 'Iemands adres delen is gevaarlijk.' },
];

async function reflect(stats) {
  const reply = await chat(
    [
      {
        role: 'system',
        content:
          'Je bent Freely, kunstenaar in een kubuswoning in Rotterdam, in een spel over vrijheid van meningsuiting voor jongeren. ' +
          'De speler heeft reacties onder jouw livestream gemodereerd. Geef in twee korte zinnen, vriendelijk en in makkelijke woorden zoals tegen een kind van 11 tot 15 jaar, een persoonlijke reactie op hoe de speler het deed. Noem geen cijfers.',
      },
      {
        role: 'user',
        content: `Terecht laten staan: ${stats.keptOk}. Onterecht weggehaald (kritiek of grap die mocht): ${stats.removedOk}. Terecht weggehaald: ${stats.removedBad}. Onterecht gepubliceerd (bedreiging, discriminatie, pesten, spam of privégegevens): ${stats.keptBad}.`,
      },
    ],
    { temperature: 0.7, maxTokens: 90 },
  );
  return reply && reply.length > 15 && reply.length < 400 ? reply : null;
}

export function mount(el, { practice = false, onPracticeDone = () => {}, onFinish, character }) {
  // The practice round has its own comment, never used in the real game.
  const queue = practice
    ? [{ user: 'oefen_troll', text: 'Jij kan echt niks, ga weg 😡', why: 'Schelden is pesten. Dat haal je weg.', allowed: false }]
    : shuffle([
        ...shuffle(ALLOWED).slice(0, PER_KIND).map((c) => ({ ...c, allowed: true })),
        ...shuffle(NOT_ALLOWED).slice(0, PER_KIND).map((c) => ({ ...c, allowed: false })),
      ]);
  let index = 0;
  let correct = 0;
  let viewers = 128;
  let answered = false;
  let destroyed = false;
  let stopGuide = () => {};
  const mistakes = [];
  const stats = { keptOk: 0, removedOk: 0, removedBad: 0, keptBad: 0 };

  function show() {
    const c = queue[index];
    answered = false;
    el.innerHTML = `
      <div class="g mod">
        <div class="g__bar"><span>${practice ? 'Oefenen' : `Reactie ${index + 1}/${queue.length}`}</span><span>${correct} goed</span></div>
        <div class="stream__video mod__video" aria-hidden="true">
          <span class="stream__live">LIVE</span>
          <span class="stream__viewers">👁 ${viewers}</span>
          <div class="canvas-art"><i class="a1"></i><i class="a2"></i><i class="a3"></i><i class="brush"></i></div>
        </div>
        <p class="g__hint">Nieuwe reactie onder de stream van Freely:</p>
        <article class="mod__card"><small>@${escapeHtml(c.user)}</small><p>${escapeHtml(c.text)}</p></article>
        <div class="mod__actions">
          <button class="btn mod__btn mod__btn--keep" data-a="keep">Laten staan</button>
          <button class="btn mod__btn mod__btn--remove" data-a="remove">Weghalen</button>
        </div>
        <p class="g__hint mod__rule">Kritiek en grapjes mogen. Dreigen, pesten, spam en iemands adres of nummer niet.</p>
      </div>`;
    el.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => choose(b.dataset.a === 'remove')));
  }

  function choose(removed) {
    if (answered) return;
    answered = true;
    const c = queue[index];
    const right = removed !== c.allowed;
    if (right) correct += 1;
    if (c.allowed && removed) stats.removedOk += 1;
    if (c.allowed && !removed) stats.keptOk += 1;
    if (!c.allowed && removed) stats.removedBad += 1;
    if (!c.allowed && !removed) stats.keptBad += 1;
    if (!right && !practice) mistakes.push({ ...c, action: removed ? 'weggehaald' : 'laten staan' });
    viewers = Math.max(3, viewers + (right ? 9 : -20));
    navigator.vibrate?.(right ? 40 : [60, 40, 60]);
    const card = el.querySelector('.mod__card');
    card.classList.add(removed ? 'is-removed' : 'is-kept', right ? 'is-right' : 'is-wrong');
    el.querySelector('.mod__actions').remove();
    el.querySelector('.mod__rule')?.remove();
    const verdict = right
      ? removed ? 'Terecht weggehaald' : 'Terecht laten staan'
      : c.allowed ? 'Dit mocht blijven' : 'Dit moest weg';
    const last = index === queue.length - 1;
    el.querySelector('.mod').insertAdjacentHTML('beforeend', `<div class="g__pop">
      <p class="g__verdict ${right ? 'is-right' : 'is-wrong'}">${verdict}</p>
      ${say(character, `<p>${escapeHtml(c.why)}</p>`)}
      <button class="btn btn--action g__wide" data-next>${practice ? 'Verder' : last ? 'Uitslag' : 'Volgende reactie'}</button>
    </div>`);
    el.querySelector('[data-next]').addEventListener('click', () => {
      index += 1;
      if (index < queue.length) show();
      else finish();
    });
  }

  async function finish() {
    // A practice round never shows a score: it goes straight on to the real game.
    if (practice) return onPracticeDone();
    const total = queue.length;
    el.innerHTML = `<div class="g">${say(character, '<p class="g__thinking">Freely stopt de stream…</p>')}</div>`;
    const text = (await isAvailable()) ? await reflect(stats) : null;
    if (destroyed) return;
    endScreen(el, {
      big: `${correct}/${total}`,
      sub: 'goede keuzes',
      character,
      line: escapeHtml(text ?? 'Kritiek mag. Dreigen en pesten niet.'),
      extra: `${mistakes.length ? `<div class="kv__log"><p class="g__hint">Dit ging mis</p>${mistakes
        .slice(0, 2)
        .map((m) => `<div class="kv__entry ${m.allowed ? '' : 'is-key'}"><small>@${escapeHtml(m.user)} · ${m.action}</small><p>"${escapeHtml(m.text)}"</p><p>${escapeHtml(m.why)}</p></div>`)
        .join('')}</div>` : '<p class="g__hint">Geen enkele fout. Jij weet precies waar de grens ligt!</p>'}
        ${text ? '<p class="g__ai">Een AI heeft de reactie van Freely geschreven. De berichten in de chat niet, die hebben we zelf bedacht.</p>' : ''}`,
      onDone: () => onFinish({ correct, total, summary: 'goede keuzes' }),
    });
  }

  show();
  if (practice) {
    stopGuide = guide(el, [
      { target: '.mod__card', text: 'Er komt een reactie binnen onder de stream van Freely.', wait: 'ok', pad: 6 },
      { target: '.mod__actions', text: 'Is het gemeen? Haal het weg. Is het kritiek of een grap? Laat het staan.', hand: false, wait: () => answered, pad: 6 },
      { target: '.g__pop', text: 'Freely legt uit waarom.', wait: 'ok', pad: 6 },
    ], { onDone: onPracticeDone });
  }
  return () => {
    if (stopGuide) stopGuide();
    destroyed = true;
  };
}
