// "Ontsnap uit de app" (Healthy, Het Park, Healy).
// A made-up app, Scrollr, is built to keep you watching. You have to find and
// switch off its five tricks in the settings: autoplay, endless scrolling, notifications, streak
// reminders and red dots. There is no clock. Meanwhile the app keeps trying to lure you back:
// taking the bait sends you back to the feed and costs a point.
// AI: writes the lure pop-ups. Without AI the game uses fixed ones.

import { chat, isAvailable } from '../ai.js';
import { escapeHtml, say, endScreen, parseJson, shuffle } from './kit.js';

const LURE_EVERY = 7000;

const TRICKS = {
  autoplay: { label: 'Volgende video automatisch afspelen', screen: 'weergave', explain: 'Autoplay start de volgende video al, voordat je kunt kiezen om te stoppen.' },
  oneindig: { label: 'Oneindig scrollen', screen: 'weergave', explain: 'Er komt nooit een einde aan de feed. Dus er is ook geen moment waarop je vanzelf stopt.' },
  meldingen: { label: 'Pushmeldingen', screen: 'meldingen', explain: 'Meldingen halen je terug de app in, ook als je net met iets anders bezig was.' },
  streak: { label: 'Streak-herinneringen', screen: 'meldingen', explain: 'Door een streak kom je elke dag terug, omdat je hem niet kwijt wilt.' },
  bolletjes: { label: 'Rode bolletjes op iconen', screen: 'meldingen', explain: 'Door rode bolletjes denk je dat je iets mist. Dus klik je erop.' },
};
const DECOYS = {
  donker: { label: 'Donkere modus', screen: 'weergave' },
  groot: { label: 'Grote letters', screen: 'weergave' },
  taal: { label: 'Ondertiteling', screen: 'meldingen' },
};

const LURES = [
  { text: 'Je streak van 47 dagen verdwijnt over 1 uur!', cta: 'Red mijn streak' },
  { text: 'Sam is nu live! Kijk mee voordat het voorbij is.', cta: 'Kijk nu' },
  { text: 'Nog één video? Hij duurt maar 15 seconden.', cta: 'Ja, nog één' },
  { text: '12 mensen hebben op je gereageerd. Wat zeggen ze?', cta: 'Bekijk' },
];

const POSTS = ['🛹 Skatetrucs in het Park', '🐱 Kat valt van de bank', '🍜 Snelste noodles ooit', '⚽ Mooiste goal van de week', '🎧 Nieuwe beat van een Rotterdamse rapper', '🌉 Erasmusbrug bij zonsondergang'];

async function aiLures() {
  const reply = await chat(
    [
      {
        role: 'system',
        content:
          'Je schrijft pop-ups voor een nep-app in een leerzaam spel. De pop-ups proberen jongeren terug te lokken in de app, met trucs als angst iets te missen, een streak, of "nog eentje". ' +
          'Nederlands, maximaal 12 woorden per tekst en 3 woorden per knop. Niet eng, geen echte namen van merken. ' +
          'Antwoord alleen met JSON: {"popups": [{"tekst": "...", "knop": "..."}, ...4 stuks]}',
      },
      { role: 'user', content: 'Maak 4 pop-ups.' },
    ],
    { json: true, temperature: 0.9, maxTokens: 220 },
  );
  const list = parseJson(reply)?.popups;
  if (!Array.isArray(list)) return null;
  const ok = list
    .filter((p) => typeof p?.tekst === 'string' && typeof p?.knop === 'string' && p.tekst.length < 90 && p.knop.length < 24)
    .map((p) => ({ text: p.tekst, cta: p.knop }));
  return ok.length >= 3 ? ok : null;
}

export function mount(el, { onFinish, character }) {
  const on = { autoplay: true, oneindig: true, meldingen: true, streak: true, bolletjes: true, donker: false, groot: false, taal: false };
  let screen = 'feed';
  let lureTimer = null;
  let feedTimer = null;
  let post = 0;
  let lures = shuffle(LURES);
  let lureIndex = 0;
  let resisted = 0;
  let bitten = 0;
  let aiMade = false;
  let ended = false;
  let destroyed = false;

  isAvailable().then(async (ok) => {
    if (!ok) return;
    const made = await aiLures();
    if (made && !destroyed) {
      lures = made;
      aiMade = true;
    }
  });

  const offCount = () => Object.keys(TRICKS).filter((k) => !on[k]).length;

  function intro() {
    el.innerHTML = `
      <div class="g">
        ${say(character, '<p>Ik wilde even één filmpje kijken. Een uur later zat ik er nog. Deze app zit vol trucs om je vast te houden. Zet ze allemaal uit in de instellingen. En trap niet in de pop-ups!</p>')}
        <button class="btn btn--action g__wide" data-go>Start</button>
      </div>`;
    el.querySelector('[data-go]').addEventListener('click', start);
  }

  function start() {
    el.innerHTML = `
      <div class="g">
        <div class="g__bar"><span class="oa__count">0/5 trucs uit</span><span class="oa__bitten">0 keer erin getrapt</span></div>
        <div class="phone"><div class="phone__screen"></div></div>
        <p class="g__hint">Tik op het tandwiel om naar de instellingen te gaan.</p>
      </div>`;
    lureTimer = setInterval(showLure, LURE_EVERY);
    feedTimer = setInterval(() => {
      if (on.autoplay && screen === 'feed') {
        post = (post + 1) % POSTS.length;
        draw();
      }
    }, 1800);
    draw();
  }

  function header(title, back) {
    return `<header class="phone__head">
      ${back ? `<button class="phone__icon" data-nav="${back}" aria-label="Terug">‹</button>` : '<strong class="phone__logo">Scrollr</strong>'}
      ${back ? `<strong class="phone__title">${title}</strong>` : ''}
      <span class="phone__spacer"></span>
      ${!back ? `<span class="phone__icon phone__bell" aria-hidden="true">🔔${on.bolletjes ? '<i class="dot">9</i>' : ''}</span>` : ''}
      ${!back ? `<button class="phone__icon" data-nav="settings" aria-label="Instellingen">⚙︎${on.bolletjes ? '<i class="dot">1</i>' : ''}</button>` : ''}
    </header>`;
  }

  function toggleRow(key, def) {
    return `<label class="toggle"><span>${escapeHtml(def.label)}</span>
      <input type="checkbox" data-t="${key}" ${on[key] ? 'checked' : ''}><i aria-hidden="true"></i></label>`;
  }

  function draw() {
    const s = el.querySelector('.phone__screen');
    if (!s) return;
    if (screen === 'feed') {
      s.innerHTML = `${header()}
        ${on.streak ? '<div class="phone__streak">🔥 47 dagen streak. Kom morgen terug!</div>' : ''}
        <div class="phone__post"><span>${POSTS[post]}</span>${on.autoplay ? '<small>Volgende video start automatisch…</small>' : '<small>Autoplay staat uit</small>'}</div>
        <div class="phone__post phone__post--next"><span>${POSTS[(post + 1) % POSTS.length]}</span></div>
        ${on.oneindig ? '<p class="phone__more">Er is altijd meer ↓</p>' : '<p class="phone__more">Je bent bij. Tijd voor iets anders?</p>'}`;
    } else if (screen === 'settings') {
      s.innerHTML = `${header('Instellingen', 'feed')}
        <nav class="phone__menu">
          <button data-nav="account">Account</button>
          <button data-nav="weergave">Weergave en video</button>
          <button data-nav="meldingen">Meldingen</button>
          <button data-nav="privacy">Privacy</button>
        </nav>`;
    } else if (screen === 'weergave' || screen === 'meldingen') {
      const rows = [...Object.entries(TRICKS), ...Object.entries(DECOYS)].filter(([, d]) => d.screen === screen);
      s.innerHTML = `${header(screen === 'weergave' ? 'Weergave en video' : 'Meldingen', 'settings')}
        <div class="phone__toggles">${rows.map(([k, d]) => toggleRow(k, d)).join('')}</div>`;
    } else {
      s.innerHTML = `${header(screen === 'account' ? 'Account' : 'Privacy', 'settings')}<p class="phone__empty">Hier staat niks wat je vasthoudt. Zoek verder!</p>`;
    }
    s.querySelectorAll('[data-nav]').forEach((b) =>
      b.addEventListener('click', () => {
        screen = b.dataset.nav;
        draw();
      }),
    );
    s.querySelectorAll('[data-t]').forEach((c) =>
      c.addEventListener('change', () => {
        on[c.dataset.t] = c.checked;
        el.querySelector('.oa__count').textContent = `${offCount()}/5 trucs uit`;
        if (offCount() === 5) setTimeout(finish, 400);
      }),
    );
  }

  function showLure() {
    if (ended || el.querySelector('.lure')) return;
    const l = lures[lureIndex % lures.length];
    lureIndex += 1;
    const phone = el.querySelector('.phone');
    phone.insertAdjacentHTML(
      'beforeend',
      `<div class="lure" role="dialog" aria-label="Melding van Scrollr">
        <p>${escapeHtml(l.text)}</p>
        <div class="lure__actions">
          <button class="btn btn--action" data-bite>${escapeHtml(l.cta)}</button>
          <button class="btn" data-ignore>Nee, bedankt</button>
        </div>
      </div>`,
    );
    phone.querySelector('[data-bite]').addEventListener('click', () => {
      bitten += 1;
      el.querySelector('.oa__bitten').textContent = `${bitten} keer erin getrapt`;
      phone.querySelector('.lure').remove();
      screen = 'feed';
      draw();
      el.querySelector('.g__bar').insertAdjacentHTML('afterend', '<p class="g__hint oa__penalty">Erin getrapt! Terug naar je feed.</p>');
      setTimeout(() => el.querySelector('.oa__penalty')?.remove(), 1500);
    });
    phone.querySelector('[data-ignore]').addEventListener('click', () => {
      resisted += 1;
      phone.querySelector('.lure').remove();
    });
  }

  function stopAll() {
    clearInterval(lureTimer);
    clearInterval(feedTimer);
  }

  function finish() {
    if (ended) return;
    ended = true;
    stopAll();
    const off = offCount();
    // Every pop-up you fell for costs a point.
    const score = Math.max(0, off - bitten);
    const stillOn = Object.entries(TRICKS).filter(([k]) => on[k]);
    endScreen(el, {
      big: `${score}/5`,
      sub: 'punten',
      character,
      line: escapeHtml(
        off === 5
          ? `Ontsnapt! ${bitten ? `Je trapte ${bitten} keer in een pop-up, maar` : 'Je trapte nergens in, en'} jij bepaalt weer wat de app doet. Tijd om naar buiten te gaan!`
          : 'De app had je nog vast. Die trucs zitten er expres in. Maar de meeste kun je zelf uitzetten.',
      ),
      extra: `${stillOn.length ? `<ul class="traces">${stillOn.map(([, t]) => `<li class="w2"><strong>${escapeHtml(t.label)}</strong>: ${escapeHtml(t.explain)}</li>`).join('')}</ul>` : ''}
        <p class="g__hint">Pop-ups weggetikt: ${resisted}. Erin getrapt: ${bitten}. Elke keer dat je erin trapt, kost een punt.</p>
        ${aiMade ? '<p class="g__ai">Een AI heeft de pop-ups geschreven. Apps testen zulke teksten echt, om te zien welke het best werken.</p>' : ''}`,
      onDone: () => onFinish({ correct: score, total: 5, summary: 'punten' }),
    });
  }

  intro();
  return () => {
    destroyed = true;
    stopAll();
  };
}
