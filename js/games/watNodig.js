// "Wat hebben ze nodig?" (Privacy, Rotterdam Centraal, Privy).
// On the station everything asks for your data: the free wifi, the bike shed, lost property, a
// ticket app. Each round is one form. Tap only the things the service really needs, then send it.
// The fields light up green (right) or pink (wrong), and Privy says why. At the end you see what
// you gave away that was not needed.
// The idea behind it is data minimisation: a company may only ask for what it really needs (AVG).
// Score: the number of forms you filled in exactly right.
// No AI and no typing: you only tap.

import { escapeHtml, say, endScreen } from './kit.js';
import { guide } from './guide.js';

// `need: true` marks what the service really needs. `why` is Privy's line after the form.
const FORMS = [
  {
    id: 'wifi',
    icon: '📶',
    service: 'Gratis wifi',
    want: 'Je wilt internet terwijl je op de trein wacht.',
    fields: [
      { id: 'naam', icon: '🙂', label: 'Je naam' },
      { id: 'mail', icon: '✉️', label: 'Je e-mail' },
      { id: 'geboren', icon: '🎂', label: 'Je geboortedatum' },
      { id: 'tel', icon: '📱', label: 'Je telefoonnummer' },
      { id: 'akkoord', icon: '✅', label: 'Akkoord met de regels', need: true },
    ],
    why: 'Voor wifi hoeven ze niet te weten wie je bent. Met je mail en nummer kunnen ze je wel reclame sturen.',
  },
  {
    id: 'stalling',
    icon: '🚲',
    service: 'Fietsenstalling',
    want: 'Je zet je fiets een dag in een betaalde stalling.',
    fields: [
      { id: 'betalen', icon: '💳', label: 'Betalen', need: true },
      { id: 'naam', icon: '🙂', label: 'Je naam' },
      { id: 'adres', icon: '🏠', label: 'Je adres' },
      { id: 'geboren', icon: '🎂', label: 'Je geboortedatum' },
      { id: 'tel', icon: '📱', label: 'Je telefoonnummer' },
    ],
    why: 'De stalling wil alleen dat je betaalt. Wie je bent en waar je woont, maakt voor je fiets niks uit.',
  },
  {
    id: 'gevonden',
    icon: '🎧',
    service: 'Gevonden voorwerpen',
    want: 'Je bent je koptelefoon kwijt in de trein. Je wilt hem terug.',
    fields: [
      { id: 'wat', icon: '🔎', label: 'Wat je kwijt bent', need: true },
      { id: 'mail', icon: '✉️', label: 'Je e-mail', need: true },
      { id: 'geboren', icon: '🎂', label: 'Je geboortedatum' },
      { id: 'adres', icon: '🏠', label: 'Je adres' },
      { id: 'selfie', icon: '🤳', label: 'Een foto van jezelf' },
    ],
    why: 'Ze moeten weten wat je zoekt en hoe ze je kunnen bereiken. Meer niet.',
  },
  {
    id: 'app',
    icon: '🚆',
    service: 'Treinkaartje-app',
    want: 'Je koopt een treinkaartje in een app.',
    fields: [
      { id: 'mail', icon: '✉️', label: 'Je e-mail', need: true },
      { id: 'betalen', icon: '💳', label: 'Betalen', need: true },
      { id: 'contacten', icon: '👥', label: 'Je contacten' },
      { id: 'fotos', icon: '🖼️', label: 'Je foto\'s' },
      { id: 'micro', icon: '🎙️', label: 'Je microfoon' },
    ],
    why: 'Je kaartje komt in je mail en je moet betalen. Je contacten, foto\'s en microfoon hebben ze niet nodig.',
  },
];

// The practice round has its own small form, never used in the real game.
const PRACTICE_FORM = {
  id: 'kluisje',
  icon: '🔐',
  service: 'Kluisje',
  want: 'Je stopt je tas een uurtje in een kluisje.',
  fields: [
    { id: 'betalen', icon: '💳', label: 'Betalen', need: true },
    { id: 'geboren', icon: '🎂', label: 'Je geboortedatum' },
    { id: 'contacten', icon: '👥', label: 'Je contacten' },
  ],
  why: 'Voor een kluisje hoef je alleen te betalen.',
};

export function mount(el, { practice = false, onPracticeDone = () => {}, onFinish, character }) {
  const forms = practice ? [PRACTICE_FORM] : FORMS;
  let index = 0;
  let perfect = 0;
  let picked = new Set();
  let sent = false;
  const givenAway = []; // { label, service } for data you gave that was not needed
  let stopGuide = () => {};

  function show() {
    const f = forms[index];
    picked = new Set();
    sent = false;
    el.innerHTML = `
      <div class="g wn">
        <div class="g__bar"><span>${practice ? 'Oefenen' : `Formulier ${index + 1}/${forms.length}`}</span><span>${perfect} goed</span></div>
        <section class="wn__form">
          <header class="wn__head"><span class="wn__icon" aria-hidden="true">${f.icon}</span><div><strong>${escapeHtml(f.service)}</strong><p>${escapeHtml(f.want)}</p></div></header>
          <p class="g__hint wn__ask">Tik aan wat ze <strong>echt</strong> nodig hebben.</p>
          <div class="wn__fields">${f.fields.map((x) => `
            <button class="wn__field" data-f="${x.id}" aria-pressed="false">
              <span class="wn__emoji" aria-hidden="true">${x.icon}</span><span class="wn__label">${escapeHtml(x.label)}</span><i class="wn__check" aria-hidden="true"></i>
            </button>`).join('')}</div>
        </section>
        <button class="btn btn--action g__wide" data-send>Versturen</button>
      </div>`;
    el.querySelectorAll('[data-f]').forEach((b) =>
      b.addEventListener('click', () => {
        if (sent) return;
        const id = b.dataset.f;
        if (picked.has(id)) picked.delete(id);
        else picked.add(id);
        b.setAttribute('aria-pressed', String(picked.has(id)));
      }),
    );
    el.querySelector('[data-send]').addEventListener('click', send);
  }

  function send() {
    if (sent) return;
    sent = true;
    const f = forms[index];
    let right = true;
    for (const x of f.fields) {
      const gave = picked.has(x.id);
      const ok = gave === Boolean(x.need);
      if (!ok) right = false;
      if (gave && !x.need && !practice) givenAway.push({ label: x.label, service: f.service });
      const b = el.querySelector(`[data-f="${x.id}"]`);
      b.disabled = true;
      b.classList.add(ok ? 'is-right' : 'is-wrong');
      // A needed field you left empty shows what was missing.
      if (!gave && x.need) b.classList.add('is-missed');
    }
    if (right) perfect += 1;
    navigator.vibrate?.(right ? 40 : [60, 40, 60]);
    const extra = f.fields.filter((x) => picked.has(x.id) && !x.need).length;
    const verdict = right ? 'Precies goed!' : extra ? `${extra} te veel weggegeven` : 'Je miste iets';
    const last = index === forms.length - 1;
    el.querySelector('[data-send]').remove();
    el.querySelector('.wn').insertAdjacentHTML('beforeend', `<div class="g__pop">
      <p class="g__verdict ${right ? 'is-right' : 'is-wrong'}">${verdict}</p>
      ${say(character, `<p>${escapeHtml(f.why)}</p>${mistakes(f)}`)}
      <button class="btn btn--action g__wide" data-next>${practice ? 'Verder' : last ? 'Uitslag' : 'Volgend formulier'}</button>
    </div>`);
    el.querySelector('[data-next]').addEventListener('click', () => {
      index += 1;
      if (index < forms.length) show();
      else finish();
    });
  }

  // Names what was given for nothing and what was missing, so the covered fields don't matter.
  function mistakes(f) {
    const list = (xs) => xs.map((x) => x.label.toLowerCase()).join(', ');
    const extra = f.fields.filter((x) => picked.has(x.id) && !x.need);
    const missed = f.fields.filter((x) => !picked.has(x.id) && x.need);
    return `${extra.length ? `<p><strong>Niet nodig:</strong> ${escapeHtml(list(extra))}.</p>` : ''}${missed.length ? `<p><strong>Wel nodig:</strong> ${escapeHtml(list(missed))}.</p>` : ''}`;
  }

  function finish() {
    // A practice round never shows a score: it goes straight on to the real game.
    if (practice) return onPracticeDone();
    const list = givenAway.length
      ? `<p class="g__hint">Dit gaf je weg zonder dat het nodig was:</p>
         <ul class="wn__given">${givenAway.map((g) => `<li>${escapeHtml(g.label)} <small>${escapeHtml(g.service)}</small></li>`).join('')}</ul>`
      : '<p class="g__hint">Je gaf niks weg wat niet nodig was. Echt spoorloos!</p>';
    endScreen(el, {
      big: `${perfect}/${forms.length}`,
      sub: 'formulieren precies goed',
      character,
      line: escapeHtml('Vraag altijd: waarom willen ze dit weten? Een bedrijf mag alleen vragen wat het echt nodig heeft. Dat staat in de wet.'),
      extra: list,
      onDone: () => onFinish({ correct: perfect, total: forms.length, summary: 'formulieren precies goed' }),
    });
  }

  show();
  if (practice) {
    stopGuide = guide(el, [
      { target: '.wn__head', text: 'Lees wat je wilt doen.', wait: 'ok', pad: 6 },
      { target: '[data-f="betalen"]', text: 'Wat is echt nodig? Hier alleen betalen. Tik erop.' },
      { target: '[data-send]', text: 'Klaar? Verstuur het formulier.' },
      { target: '.g__pop', text: 'Privy legt uit wat ze echt nodig hadden.', wait: 'ok', pad: 6 },
    ], { onDone: onPracticeDone });
  }
  return () => {
    if (stopGuide) stopGuide();
  };
}
