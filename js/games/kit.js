// Small helpers shared by the minigames.

export const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const shuffle = (arr) => arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// A line spoken by the stop's character, in the style of the stop panel.
export function say(character, html) {
  const avatar = character.buddy ? `<img src="${character.buddy}" alt="">` : escapeHtml(character.name[0]);
  return `<div class="say"><span class="say__avatar" aria-hidden="true">${avatar}</span><div class="say__text">${html}</div></div>`;
}

// Makes a "type it yourself" form comfortable on a phone: the submit button stays disabled until
// there is enough text (so a tap never silently does nothing), Enter sends (Shift+Enter is a new
// line), the keyboard shows "send", and the field scrolls into view above the keyboard.
export function typingForm(form, { min = 5 } = {}) {
  const field = form?.querySelector('textarea, input');
  const button = form?.querySelector('button[type="submit"]');
  if (!field || !button) return;
  field.setAttribute('enterkeyhint', 'send');
  field.setAttribute('autocapitalize', 'sentences');
  const sync = () => {
    if (!field.disabled) button.disabled = field.value.trim().length < min;
  };
  field.addEventListener('input', sync);
  field.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      if (!button.disabled) form.requestSubmit();
    }
  });
  field.addEventListener('focus', () => setTimeout(() => field.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300));
  sync();
}

// The closing screen every game shows before handing back to the stop panel.
// `line` is HTML that is already escaped; `extra` is optional HTML shown below it.
export function endScreen(el, { big, sub, character, line, extra = '', button = 'Verder', onDone }) {
  el.innerHTML = `
    <div class="g g--end">
      <p class="g__big">${big}</p>
      ${sub ? `<p class="g__sub">${sub}</p>` : ''}
      ${say(character, `<p>${line}</p>`)}
      ${extra}
      <button class="btn btn--action g__wide" data-done>${escapeHtml(button)}</button>
    </div>`;
  el.querySelector('[data-done]').addEventListener('click', onDone);
}

// Counts down `seconds`, calling onTick(secondsLeft, fraction) every frame and onEnd() at 0.
// Returns { stop(), left(), add(seconds) }.
export function countdown(seconds, { onTick, onEnd }) {
  let deadline = performance.now() + seconds * 1000;
  let frame = null;
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    const left = Math.max(0, deadline - performance.now());
    onTick?.(left / 1000, left / (seconds * 1000));
    if (left <= 0) {
      stopped = true;
      onEnd?.();
    } else frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(frame);
    },
    left: () => Math.max(0, (deadline - performance.now()) / 1000),
    add(s) {
      deadline += s * 1000;
    },
  };
}

// Deterministic random numbers, so generated data is the same on every device.
export function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Parses the first JSON object in a model reply. Returns null when there is none.
export function parseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}

// Local, anonymous tallies (e.g. which side players chose). Only on this device.
const TALLY_KEY = 'citiverse.tally.v1';
export function tally(name, key) {
  let all = {};
  try {
    all = JSON.parse(localStorage.getItem(TALLY_KEY)) ?? {};
  } catch {}
  const t = (all[name] ??= {});
  if (key !== undefined) {
    t[key] = (t[key] ?? 0) + 1;
    try {
      localStorage.setItem(TALLY_KEY, JSON.stringify(all));
    } catch {}
  }
  return { ...t };
}
