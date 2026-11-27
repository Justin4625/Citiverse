// Read aloud: a small speaker button on every block of text a player reads (speech bubbles, facts,
// secrets, game messages, the practice-round tips). Tap it and the phone reads the text in Dutch;
// tap again to stop. Fixed texts play a recorded mp3 (ElevenLabs, made once with tools/voices.mjs);
// everything else uses the browser's own voice (Web Speech API), so nothing leaves the phone.
//
// The buttons are added by a MutationObserver, so every screen a game draws gets them without the
// game knowing. A block can opt in with data-tts (optionally data-tts="text to read instead"), or
// opt out with data-tts-off. Without speech support no buttons are shown at all.

// Blocks that get a button. A block inside another block does not get its own.
const TARGETS = [
  '.speech', // stop screen: "Hoi, ik ben ..."
  '.stop-fact', // Wist je dat?
  '.secret', // the secret after the game
  '.game-card', // minigame that is still a concept
  '.say__text', // a Buddy talking inside a game
  '.chat__msg--them', // the Buddy's chat answers
  '.guide__bubble', // practice-round tip
  '.msg', // Nep of echt: the message
  '.mod__card', // Moderator: the comment
  '.kv__case', // Kruisverhoor: the case
  '.testimony__bubble', // Kruisverhoor: what the witness says
  '.kv__last', // Kruisverhoor: the last answer
  '.wn__head', // Wat hebben ze nodig: the form
  '.battle__topic', // Overtuig de stad: the statement
  '.speech-attack', // Overtuig de stad: Opiny's answer
  '.noe__karin', // Nep of echt: the closing line
  '[data-tts]',
].join(',');

// Not read out: buttons, icons and counters.
const SKIP = 'button, .tts, [aria-hidden="true"], .guide__count, [data-tts-skip]';
const BLOCK = 'p, div, li, small, header, h1, h2, h3, h4, section, article';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
const supported = Boolean(synth && window.SpeechSynthesisUtterance);

const ICON_PLAY =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="tts__body" d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path class="tts__wave" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
const ICON_STOP = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect class="tts__body" x="7" y="7" width="10" height="10" rx="2"/></svg>';

let voice = null;
let current = null; // { button, block }
// Recorded voices (tools/voices.mjs makes them with ElevenLabs): normalised text -> mp3 in audio/.
// A text that has one plays the mp3 in its Buddy's voice; any other text uses the browser voice.
let recorded = {};
const player = typeof Audio !== 'undefined' ? new Audio() : null;
const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

// The most human voice the device has: neural/online voices (Edge "Natural", Chrome "Google"),
// then Apple's downloaded Premium/Enhanced voices, then any Dutch voice.
const RANK = [/natural|neural|online/i, /premium|enhanced|siri/i, /google/i];
function pickVoice() {
  const voices = synth.getVoices().filter((v) => v.lang?.toLowerCase().replace('_', '-').startsWith('nl'));
  const score = (v) => {
    const i = RANK.findIndex((re) => re.test(v.name));
    return (i < 0 ? RANK.length : i) * 2 + (/nl-nl/i.test(v.lang.replace('_', '-')) ? 0 : 1);
  };
  voice = voices.sort((a, b) => score(a) - score(b))[0] ?? null;
}

// The text of a block as it would be read: no buttons or icons, and a pause between lines.
export function textOf(block) {
  const own = block.dataset.tts;
  if (own) return own;
  const copy = block.cloneNode(true);
  copy.querySelectorAll(SKIP).forEach((n) => n.remove());
  // Lines get a full stop (a pause) when they have none; every element at least a space.
  copy.querySelectorAll('*').forEach((n) => {
    const t = n.textContent.trim();
    n.append(n.matches(BLOCK) && t && !/[.!?:…"”]$/.test(t) ? '. ' : ' ');
  });
  return copy.textContent.replace(/[\p{Extended_Pictographic}\u200d\ufe0f]/gu, '').replace(/\s+/g, ' ').replace(/\s+([.,!?])/g, '$1').replace(/\.\s*\./g, '.').trim();
}

function setState(button, speaking) {
  button.classList.toggle('is-speaking', speaking);
  button.innerHTML = speaking ? ICON_STOP : ICON_PLAY;
  button.setAttribute('aria-label', speaking ? 'Stop met voorlezen' : 'Lees voor');
  button.setAttribute('aria-pressed', String(speaking));
}

export function stop() {
  if (!supported) return;
  if (current) setState(current.button, false);
  current = null;
  player?.pause();
  synth.cancel();
}

export function speak(text, button = null, block = null) {
  if (!supported || !text) return;
  stop();
  const mine = { button, block };
  const end = () => {
    if (current !== mine) return;
    if (button) setState(button, false);
    current = null;
  };
  current = mine;
  if (button) setState(button, true);
  const file = recorded[norm(text)];
  if (file && player) {
    player.src = `audio/${file}`;
    player.onended = end;
    // No mp3 (offline, not cached): read it with the browser voice after all.
    let fell = false;
    const fallback = () => {
      if (current !== mine || fell) return;
      fell = true;
      synthSay(text, end);
    };
    player.onerror = fallback;
    player.play().catch(fallback);
  } else synthSay(text, end);
}

function synthSay(text, end) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = voice?.lang ?? 'nl-NL';
  if (voice) u.voice = voice;
  u.rate = 0.95;
  u.onend = end;
  u.onerror = end;
  synth.speak(u);
}

function makeButton(block) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'tts';
  setState(b, false);
  b.addEventListener('click', (e) => {
    // The button sits inside cards that react to taps (and the practice round listens too).
    e.stopPropagation();
    if (current?.button === b) stop();
    else speak(textOf(block), b, block);
  });
  return b;
}

function decorate(root) {
  const blocks = root.matches?.(TARGETS) ? [root] : [];
  blocks.push(...(root.querySelectorAll?.(TARGETS) ?? []));
  for (const block of blocks) {
    if (block.dataset.ttsOn || block.closest('[data-tts-off], button')) continue;
    const parent = block.parentElement?.closest(TARGETS);
    if (parent && parent !== block) continue;
    if (!textOf(block)) continue;
    block.dataset.ttsOn = '1';
    block.classList.add('has-tts');
    block.prepend(makeButton(block));
  }
}

export function initTts() {
  if (!supported) return;
  pickVoice();
  fetch('audio/voices.json')
    .then((r) => (r.ok ? r.json() : {}))
    .then((m) => (recorded = m))
    .catch(() => {});
  synth.addEventListener?.('voiceschanged', pickVoice);
  decorate(document.body);
  new MutationObserver((records) => {
    for (const r of records) {
      // The text that is being read changed (e.g. the next practice tip): stop reading.
      if (current?.block?.contains(r.target) && !r.target.closest?.('.tts')) stop();
      for (const n of r.addedNodes) if (n.nodeType === 1 && !n.classList.contains('tts')) decorate(n);
      // A block whose text changed (e.g. the next practice tip) may have lost its button, or got
      // its first text only now: (re)decorate it.
      const block = r.target.nodeType === 1 && !r.target.closest('.tts') ? r.target.closest(TARGETS) : null;
      if (block && !block.querySelector(':scope > .tts')) {
        delete block.dataset.ttsOn;
        decorate(block);
      }
    }
    // The screen with the text that was being read is gone: stop reading.
    if (current?.block && !current.block.isConnected) stop();
  }).observe(document.body, { childList: true, subtree: true });
  // Leaving the app stops the voice.
  document.addEventListener('visibilitychange', () => document.hidden && stop());
}
