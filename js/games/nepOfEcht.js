// "Nep of echt?" (Safe, Politiebureau, Safy).
// Messages come into Safy's control room; the player taps Nep / Echt (no swiping: Justin's choice).
// No timer (Justin's choice): players get as long as they need per message.
// A streak of right answers raises the multiplier. The local AI writes extra fake messages inside
// fixed templates; without AI the game plays with the built-in messages only.

import { MESSAGES, TEMPLATES } from './nepOfEchtContent.js';
import { chat, isAvailable } from '../ai.js';
import { guide } from './guide.js';

const ROUNDS = 8;

// The practice round has its own message, never used in the real game.
const PRACTICE_MESSAGE = {
  id: 'oefen-oma', kind: 'whatsapp', from: '+44 7700 900112', level: 1, fake: true,
  text: 'Hoi lieverd, dit is oma! Mijn telefoon is kapot. Kun je me snel €50 sturen? Niet aan mama vertellen hoor 😘',
  tells: ['Een onbekend nummer dat zegt dat het oma is, en meteen om geld vraagt.'],
};
// Message difficulty per round, by player level (0 = Nieuwkomer).
const MIXES = [
  [1, 1, 1, 2, 2, 2, 2, 3],
  [1, 1, 2, 2, 2, 2, 3, 3],
  [1, 2, 2, 2, 2, 3, 3, 3],
  [1, 2, 2, 2, 3, 3, 3, 3],
  [2, 2, 2, 3, 3, 3, 3, 3],
];
const MAX_AI = 2; // AI-made fakes per game, swapped into fake rounds from round 3 on
const STATS_KEY = 'nepofecht.stats.v1';

const KIND_LABEL = { sms: 'SMS', whatsapp: 'WhatsApp', mail: 'E-mail', nieuws: 'Nieuws', dm: 'Bericht', app: 'App-melding' };

const shuffle = (arr) => arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Pick one message per level slot, with 4 or 5 fakes in total.
function pickRounds(LEVELS) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const used = new Set();
    const rounds = LEVELS.map((level) => {
      const options = shuffle(MESSAGES.filter((m) => m.level === level && !used.has(m.id)));
      // Fall back to any unused message when a level runs out.
      const pick = options[0] ?? shuffle(MESSAGES.filter((m) => !used.has(m.id)))[0];
      used.add(pick.id);
      return pick;
    });
    const fakes = rounds.filter((m) => m.fake).length;
    if (fakes >= 4 && fakes <= 5) return rounds;
  }
  return shuffle(MESSAGES).slice(0, ROUNDS);
}

// Ask the local model for one fake message inside a template. Returns a message or null.
async function generateFake(template) {
  const reply = await chat(
    [
      {
        role: 'system',
        content:
          'Je schrijft oefenberichten voor een educatief spel waarin kinderen van 11 tot 15 jaar leren nepberichten te herkennen. Maak de nep goed herkenbaar. ' +
          'Schrijf in het Nederlands, informeel zoals echte berichten. Geen scheldwoorden, geen enge of seksuele inhoud. ' +
          'Gebruik geen andere bedrijfsnamen of webadressen dan die je krijgt. Maximaal 220 tekens. ' +
          'Antwoord alleen met JSON in deze vorm: {"tekst": "..."}',
      },
      {
        role: 'user',
        content:
          `Soort bericht: ${KIND_LABEL[template.kind]}. Afzender: ${template.from}. ` +
          (template.domain ? `Webadres dat in het bericht moet staan: ${template.domain}. ` : 'Zet er geen webadres in. ') +
          `Inhoud: ${template.brief} Zorg dat deze kenmerken te herkennen zijn: ${template.tells.join(' ')}`,
      },
    ],
    { json: true, temperature: 0.9, maxTokens: 160 },
  );
  if (!reply) return null;
  try {
    const text = String(JSON.parse(reply).tekst ?? '').trim();
    if (text.length < 30 || text.length > 280) return null;
    // Only the template's own web address may appear.
    const addresses = text.match(/\b[\w-]+(?:\.[\w-]+)*\.(?:nl|com|net|info|org|io|be|eu|app)\b/gi) ?? [];
    if (addresses.some((a) => a.toLowerCase() !== template.domain)) return null;
    if (template.domain && !addresses.length) return null;
    return { id: template.id, kind: template.kind, from: template.from, level: template.level, fake: true, text, tells: template.tells, aiMade: true };
  } catch {
    return null;
  }
}

function recordStat(id, wrong) {
  try {
    const stats = JSON.parse(localStorage.getItem(STATS_KEY)) ?? {};
    const s = (stats[id] ??= { seen: 0, wrong: 0 });
    s.seen += 1;
    if (wrong) s.wrong += 1;
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {}
}

export function mount(el, { practice = false, onPracticeDone = () => {}, onFinish, character = { name: 'Safy' }, difficulty = 0 }) {
  const rounds = practice ? [PRACTICE_MESSAGE] : pickRounds(MIXES[difficulty] ?? MIXES[0]);
  const aiReady = [];
  let index = 0;
  let score = 0;
  let correct = 0;
  let streak = 0;
  let answered = false;
  let destroyed = false;
  let aiUsed = 0;

  // Generate AI messages in the background while the player reads the first rounds.
  isAvailable().then((ok) => {
    if (!ok || destroyed || practice) return;
    for (const template of shuffle(TEMPLATES).slice(0, MAX_AI)) {
      generateFake(template).then((msg) => msg && !destroyed && aiReady.push(msg));
    }
  });

  el.innerHTML = `
    <div class="noe">
      <div class="noe__bar">
        <span class="noe__round"></span>
        <span class="noe__streak"></span>
        <span class="noe__score"></span>
      </div>
      <div class="lockscreen"><span class="lockscreen__time">${new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}</span><span class="lockscreen__date">Meldkamer van Safy</span><div class="noe__stage"></div></div>
      <div class="noe__actions">
        <button class="noe__btn noe__btn--nep" data-answer="nep">Nep</button>
        <button class="noe__btn noe__btn--echt" data-answer="echt">Echt</button>
      </div>
      <div class="noe__feedback" hidden></div>
    </div>`;

  const q = (sel) => el.querySelector(sel);
  const stage = q('.noe__stage');
  const actions = q('.noe__actions');
  const feedback = q('.noe__feedback');

  const multiplier = () => Math.min(3, 1 + Math.floor(streak / 2));

  function updateBar() {
    q('.noe__round').textContent = practice ? 'Oefenbericht' : `Bericht ${index + 1}/${ROUNDS}`;
    q('.noe__streak').textContent = streak >= 2 ? `Reeks x${multiplier()}` : '';
    q('.noe__score').textContent = `${score} pt`;
  }

  function showRound() {
    // Swap in an AI-made fake for this round when one is ready and the slot is a fake.
    if (index >= 2 && aiUsed < MAX_AI && aiReady.length && rounds[index].fake) {
      rounds[index] = aiReady.shift();
      aiUsed += 1;
    }
    const msg = rounds[index];
    answered = false;
    feedback.hidden = true;
    actions.hidden = false;
    stage.innerHTML = `
      <article class="msg msg--${msg.kind}">
        <header class="msg__head"><span class="msg__kind">${KIND_LABEL[msg.kind]}</span><strong class="msg__from">${escapeHtml(msg.from)}</strong></header>
        <p class="msg__text">${escapeHtml(msg.text)}</p>
      </article>
`;
    updateBar();
  }


  function answer(choice) {
    if (answered) return;
    answered = true;
    const msg = rounds[index];
    const right = (choice === 'nep') === msg.fake;
    let gained = 0;
    if (right) {
      streak += 1;
      correct += 1;
      gained = 100 * multiplier();
      score += gained;
    } else {
      streak = 0;
    }
    if (!practice) recordStat(msg.id, !right);
    navigator.vibrate?.(right ? 40 : [60, 40, 60]);

    const verdict = right ? `Goed! +${gained}` : msg.fake ? 'Opgelicht!' : 'Toch echt';
    const explanation = msg.fake
      ? `<p>Dit is <strong>nep</strong>. ${escapeHtml(msg.tells[0])}</p>`
      : `<p>Dit bericht is <strong>echt</strong>. ${escapeHtml(msg.why)}</p>`;

    actions.hidden = true;
    stage.querySelector('.msg')?.classList.add(right ? 'is-right' : 'is-wrong');
    feedback.innerHTML = `
      <p class="noe__verdict ${right ? 'is-right' : 'is-wrong'}">${verdict}</p>
      <div class="noe__karin"><span class="noe__avatar" aria-hidden="true">${character.name[0]}</span><div>${explanation}</div></div>
      ${msg.aiMade ? '<p class="noe__ai">Een AI heeft dit bericht gemaakt. Oplichters maken ze net zo makkelijk.</p>' : ''}
      <button class="btn btn--action noe__next">${practice ? 'Verder' : index + 1 < ROUNDS ? 'Volgende bericht' : 'Uitslag bekijken'}</button>`;
    feedback.hidden = false;
    feedback.querySelector('.noe__next').addEventListener('click', next);
    updateBar();
  }

  function next() {
    index += 1;
    if (index < rounds.length) showRound();
    else finish();
  }

  function finish() {
    if (practice) return onPracticeDone();
    const line = correct === ROUNDS
      ? 'Alles goed! Jou lichten ze niet zomaar op.'
      : correct >= 6
        ? 'Goed gedaan! Onthoud: oplichters willen altijd dat je je haast.'
        : correct >= 4
          ? 'Bijna! Kijk altijd wie het stuurt.'
          : 'Oplichters zijn slim, hè? Let op haast en vragen om geld.';
    el.innerHTML = `
      <div class="noe noe--end">
        <p class="noe__big">${correct}/${ROUNDS}</p>
        <p class="noe__total">${score} punten</p>
        <div class="noe__karin"><span class="noe__avatar" aria-hidden="true">${character.name[0]}</span><p>${line}</p></div>
        <button class="btn btn--action noe__done">Verder</button>
      </div>`;
    el.querySelector('.noe__done').addEventListener('click', () => onFinish({ score, correct, total: ROUNDS }));
  }

  actions.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-answer]');
    if (btn) answer(btn.dataset.answer);
  });

  const onKey = (e) => {
    if (e.key === 'ArrowLeft') answer('nep');
    if (e.key === 'ArrowRight') answer('echt');
  };
  document.addEventListener('keydown', onKey);

  showRound();
  // Practice round: the first message is played with the buttons lit up.
  const stopGuide = practice && guide(el, [
    { target: '.msg', text: 'Lees het bericht. Is het nep of echt?', wait: 'ok', pad: 6 },
    { target: '.noe__actions', text: 'Tik op Nep of op Echt.', hand: false, wait: () => !feedback.hidden, pad: 6 },
    { target: '.noe__feedback', text: 'Hier legt Safy uit hoe je het herkent.', wait: 'ok', pad: 6 },
  ], { onDone: onPracticeDone });

  return () => {
    if (stopGuide) stopGuide();
    destroyed = true;
    document.removeEventListener('keydown', onKey);
  };
}
