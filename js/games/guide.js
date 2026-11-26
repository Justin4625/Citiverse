// The practice round: shows how a minigame works on the game's own screen. Step by step it puts a
// spotlight on a real element, a hand does the move (tap or swipe), and a short bubble says what
// to do. The player then does it for real and the game just carries on, so the first round is
// the tutorial. Nothing is told up front.
//
// guide(host, steps, { id, onDone }) -> cancel()
// A step: {
//   target: CSS selector inside host, or a function returning an element,
//   at: optional [fx, fy] spot inside the target (fractions), default the centre,
//   area: optional [fx, fy, fw, fh] part of the target to light up (fractions), e.g. on a canvas,
//   text: what to do, a few words,
//   hand: 'tap' (default) | 'swipe' | false,
//   wait: 'tap' (default: the player taps the target) | 'ok' (an Oké button) | () => boolean,
//   pad: extra room around the spotlight in px,
// }
// Only the spotlighted element can be tapped while a step waits for a tap.
// It runs in the practice round that every minigame starts with (stop.js), never in the real game.

const HAND =
  '<svg viewBox="-14 -2 34 42" aria-hidden="true"><path d="M-3.5 1 a3.5 3.5 0 0 1 7 0 V12 h2 a3 3 0 0 1 3 3 v1 a3 3 0 0 1 3 3 v1 a3 3 0 0 1 3 3 V30 a8 8 0 0 1 -8 8 h-6 a8 8 0 0 1 -7 -4 l-6 -10 a3 3 0 0 1 5 -3 l3.5 4 Z"/></svg>';

export function guide(host, steps, { onDone = () => {} } = {}) {
  const layer = document.createElement('div');
  layer.className = 'guide';
  layer.innerHTML = `
    <div class="guide__block" data-b="t"></div><div class="guide__block" data-b="r"></div>
    <div class="guide__block" data-b="b"></div><div class="guide__block" data-b="l"></div>
    <div class="guide__spot"></div>
    <div class="guide__hand">${HAND}<i class="guide__ripple"></i></div>
    <div class="guide__bubble" role="status"><p class="guide__text"></p><div class="guide__row"><span class="guide__count"></span><button class="btn btn--action guide__ok" type="button">Oké</button></div></div>`;
  document.body.append(layer);
  const spot = layer.querySelector('.guide__spot');
  const handEl = layer.querySelector('.guide__hand');
  const bubble = layer.querySelector('.guide__bubble');
  const okBtn = layer.querySelector('.guide__ok');
  const blocks = Object.fromEntries([...layer.querySelectorAll('[data-b]')].map((b) => [b.dataset.b, b]));

  let index = -1;
  let target = null;
  let frame = null;
  let poll = null;
  let ended = false;
  let onTap = null;

  const find = (step) => (typeof step.target === 'function' ? step.target() : host.querySelector(step.target));

  function place() {
    if (ended) return;
    const step = steps[index];
    if (target && !target.isConnected) target = find(step) ?? target;
    if (target?.isConnected) {
      let r = target.getBoundingClientRect();
      if (step.area) {
        const [ax, ay, aw, ah] = step.area;
        r = { left: r.left + r.width * ax, top: r.top + r.height * ay, width: r.width * aw, height: r.height * ah };
      }
      const pad = step.pad ?? 8;
      const box = { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 };
      Object.assign(spot.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px` });
      const vw = innerWidth;
      const vh = innerHeight;
      Object.assign(blocks.t.style, { left: 0, top: 0, width: `${vw}px`, height: `${Math.max(0, box.y)}px` });
      Object.assign(blocks.b.style, { left: 0, top: `${box.y + box.h}px`, width: `${vw}px`, height: `${Math.max(0, vh - box.y - box.h)}px` });
      Object.assign(blocks.l.style, { left: 0, top: `${box.y}px`, width: `${Math.max(0, box.x)}px`, height: `${box.h}px` });
      Object.assign(blocks.r.style, { left: `${box.x + box.w}px`, top: `${box.y}px`, width: `${Math.max(0, vw - box.x - box.w)}px`, height: `${box.h}px` });
      const [fx, fy] = step.at ?? [0.5, 0.5];
      handEl.style.left = `${r.left + r.width * fx}px`;
      handEl.style.top = `${r.top + r.height * fy}px`;
      // The bubble goes where there is more room: above or below the spotlight.
      const below = box.y + box.h / 2 < vh / 2;
      bubble.style.top = below ? `${Math.min(vh - 20, box.y + box.h + 14)}px` : '';
      bubble.style.bottom = below ? '' : `${Math.min(vh - 20, vh - box.y + 14)}px`;
      bubble.classList.toggle('is-below', below);
    }
    frame = requestAnimationFrame(place);
  }

  function show(n) {
    clearInterval(poll);
    if (onTap) document.removeEventListener('click', onTap, true);
    onTap = null;
    index = n;
    if (index >= steps.length) return finish(true);
    const step = steps[index];
    target = null;
    layer.classList.remove('is-on');
    // The game may still be drawing this element: wait for it (max 3 s), else skip the step.
    let tries = 0;
    poll = setInterval(() => {
      const el = find(step);
      if (!el && ++tries < 30) return;
      clearInterval(poll);
      if (!el) return show(index + 1);
      target = el;
      begin(step);
    }, 100);
  }

  function begin(step) {
    const wait = step.wait ?? 'tap';
    layer.querySelector('.guide__text').textContent = step.text;
    layer.querySelector('.guide__count').textContent = `${index + 1}/${steps.length}`;
    okBtn.hidden = wait !== 'ok';
    layer.dataset.wait = typeof wait === 'function' ? 'watch' : wait;
    handEl.dataset.move = step.hand === false ? 'none' : step.hand ?? (wait === 'ok' ? 'none' : 'tap');
    // Restart the bubble and hand animations for the new step.
    bubble.classList.remove('is-in');
    void bubble.offsetWidth;
    bubble.classList.add('is-in');
    layer.classList.add('is-on');
    if (wait === 'tap') {
      onTap = (e) => {
        if (!target.contains(e.target)) return;
        document.removeEventListener('click', onTap, true);
        onTap = null;
        layer.classList.remove('is-on');
        // Let the game handle the tap first, then move on.
        setTimeout(() => show(index + 1), step.after ?? 450);
      };
      document.addEventListener('click', onTap, true);
    } else if (typeof wait === 'function') {
      poll = setInterval(() => {
        if (!wait()) return;
        clearInterval(poll);
        layer.classList.remove('is-on');
        setTimeout(() => show(index + 1), step.after ?? 300);
      }, 120);
    }
  }

  function finish(done) {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(frame);
    clearInterval(poll);
    if (onTap) document.removeEventListener('click', onTap, true);
    layer.classList.add('is-leaving');
    setTimeout(() => layer.remove(), 250);
    if (done !== null) onDone();
  }

  okBtn.addEventListener('click', () => show(index + 1));
  frame = requestAnimationFrame(place);
  show(0);
  return () => finish(null);
}
