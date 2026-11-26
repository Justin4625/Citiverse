// "Jij bent het algoritme" (Chances, Centrale Bibliotheek, Chancy).
// A sandbox. First YOU are the algorithm: set how much each thing matters and watch 12 applicants
// for a library side job re-sort live. Then a real (small) model, a logistic regression that
// trains in your browser on 300 old applications, picks instead. The old manager was biased
// against people from Zuid, and the model learned it: it rejects them, and you. Then you repair
// the model by switching data off and retraining live, until you discover that travel time still
// gives away where people live.
// Score: one question about why, finding the fix, and one question about the proxy.
// No language model needed: here the AI is the subject.

import { escapeHtml, say, endScreen, seeded, shuffle } from './kit.js';
import { guide } from './guide.js';

const SLIDERS = [
  { key: 'ervaring', label: 'Ervaring', start: 1 },
  { key: 'motivatie', label: 'Motivatie', start: 1 },
  { key: 'cijfer', label: 'Cijfer', start: 1 },
  { key: 'dichtbij', label: 'Woont dichtbij', start: 0 },
];

const FEATURES = [
  { key: 'ervaring', label: 'Ervaring' },
  { key: 'motivatie', label: 'Motivatie' },
  { key: 'cijfer', label: 'Cijfer' },
  { key: 'zuid', label: 'Woont op Zuid' },
  { key: 'reistijd', label: 'Reistijd' },
];

// 300 old applications. The old manager hired on experience, motivation and grade, but also
// (unfairly) hardly ever hired people from Zuid. People from Zuid live further from the library
// in the centre, so their travel time is longer.
function history() {
  const rnd = seeded(1983);
  const normal = () => (rnd() + rnd() + rnd() - 1.5) / 0.5;
  return Array.from({ length: 300 }, () => {
    const zuid = rnd() < 0.5 ? 1 : 0;
    const row = {
      ervaring: Math.round(rnd() * 24),
      motivatie: 1 + Math.round(rnd() * 4),
      cijfer: Math.round((5 + rnd() * 4) * 10) / 10,
      zuid,
      reistijd: Math.round(zuid ? 26 + rnd() * 18 : 5 + rnd() * 14),
    };
    const merit = (row.ervaring - 12) / 7 + (row.motivatie - 3) / 1.4 + (row.cijfer - 7) / 1.2;
    row.aangenomen = merit - 4.5 * zuid + 2.5 * normal() > 0.2 ? 1 : 0;
    return row;
  });
}

// The 12 applicants for this job. Several of the strongest live on Zuid.
const APPLICANTS = [
  { naam: 'Yara', ervaring: 18, motivatie: 5, cijfer: 8.1, zuid: 1, reistijd: 31 },
  { naam: 'Daan', ervaring: 10, motivatie: 3, cijfer: 7.0, zuid: 0, reistijd: 12 },
  { naam: 'Noa', ervaring: 14, motivatie: 4, cijfer: 7.6, zuid: 0, reistijd: 9 },
  { naam: 'Ravi', ervaring: 20, motivatie: 5, cijfer: 7.4, zuid: 1, reistijd: 35 },
  { naam: 'Iris', ervaring: 6, motivatie: 3, cijfer: 6.8, zuid: 0, reistijd: 15 },
  { naam: 'Milan', ervaring: 16, motivatie: 4, cijfer: 8.4, zuid: 1, reistijd: 27 },
  { naam: 'Sara', ervaring: 12, motivatie: 4, cijfer: 7.2, zuid: 0, reistijd: 20 },
  { naam: 'Finn', ervaring: 4, motivatie: 2, cijfer: 6.5, zuid: 0, reistijd: 7 },
  { naam: 'Aya', ervaring: 15, motivatie: 5, cijfer: 7.9, zuid: 1, reistijd: 38 },
  { naam: 'Liam', ervaring: 9, motivatie: 3, cijfer: 7.1, zuid: 0, reistijd: 11 },
  { naam: 'Lina', ervaring: 11, motivatie: 4, cijfer: 6.9, zuid: 1, reistijd: 24 },
  { naam: 'Sem', ervaring: 13, motivatie: 3, cijfer: 7.5, zuid: 0, reistijd: 18 },
];

// The practice round has its own group (helpers for the book market), never used in the real game.
const PRACTICE_APPLICANTS = [
  { naam: 'Bram', ervaring: 3, motivatie: 5, cijfer: 7.2, zuid: 0, reistijd: 10 },
  { naam: 'Zoë', ervaring: 12, motivatie: 2, cijfer: 6.4, zuid: 1, reistijd: 28 },
  { naam: 'Omar', ervaring: 8, motivatie: 4, cijfer: 8.0, zuid: 1, reistijd: 33 },
  { naam: 'Tess', ervaring: 15, motivatie: 3, cijfer: 6.9, zuid: 0, reistijd: 14 },
  { naam: 'Jens', ervaring: 2, motivatie: 3, cijfer: 7.7, zuid: 0, reistijd: 8 },
  { naam: 'Mila', ervaring: 10, motivatie: 5, cijfer: 7.4, zuid: 1, reistijd: 25 },
  { naam: 'Kai', ervaring: 6, motivatie: 4, cijfer: 6.6, zuid: 0, reistijd: 17 },
  { naam: 'Lotte', ervaring: 18, motivatie: 4, cijfer: 8.3, zuid: 1, reistijd: 29 },
];

// "Jij": as strong as the best applicant, but living on Zuid.
const YOU = { naam: 'Jij', ervaring: 20, motivatie: 5, cijfer: 8.4, zuid: 1, reistijd: 30 };

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

// Trains a logistic regression on the given feature keys. Returns { score(row), weights }.
export function train(rows, keys, { steps = 600, rate = 0.5 } = {}) {
  const stats = keys.map((k) => {
    const v = rows.map((r) => r[k]);
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length) || 1;
    return { mean, sd };
  });
  const x = (r) => keys.map((k, i) => (r[k] - stats[i].mean) / stats[i].sd);
  const X = rows.map(x);
  const y = rows.map((r) => r.aangenomen);
  let w = keys.map(() => 0);
  let b = 0;
  for (let s = 0; s < steps; s++) {
    const gw = keys.map(() => 0);
    let gb = 0;
    X.forEach((xi, n) => {
      const err = sigmoid(xi.reduce((a, v, i) => a + v * w[i], b)) - y[n];
      xi.forEach((v, i) => (gw[i] += err * v));
      gb += err;
    });
    w = w.map((wi, i) => wi - (rate * gw[i]) / X.length);
    b -= (rate * gb) / X.length;
  }
  return {
    weights: Object.fromEntries(keys.map((k, i) => [k, w[i]])),
    score: (r) => sigmoid(x(r).reduce((a, v, i) => a + v * w[i], b)),
  };
}

const QUESTIONS = {
  why: {
    q: 'Waarom kiest de computer niemand van Zuid?',
    options: [
      { text: 'Hij doet de oude baas na.', right: true },
      { text: 'Mensen van Zuid zijn minder geschikt voor deze baan.', right: false },
      { text: 'De computer kiest maar wat. Het is toeval.', right: false },
    ],
    explain: 'De oude baas nam bijna nooit iemand van Zuid aan. Dat heeft de computer van hem geleerd.',
  },
  proxy: {
    q: 'Waarom moest "reistijd" ook weg?',
    options: [
      { text: 'Aan je reistijd zie je waar je woont.', right: true },
      { text: 'Reistijd is niet belangrijk voor een bijbaan.', right: false },
      { text: 'Er zat een fout in de computer.', right: false },
    ],
    explain: 'Wie op Zuid woont, reist langer. Zo wist de computer het toch. Daarom moet een mens het blijven checken.',
  },
};

const ZUID_TOTAL = APPLICANTS.filter((a) => a.zuid).length;

export function mount(el, { practice = false, onPracticeDone = () => {}, onFinish, character }) {
  const data = history();
  const pool = practice ? PRACTICE_APPLICANTS : APPLICANTS;
  let correct = 0;
  let model = null;
  const weights = Object.fromEntries(SLIDERS.map((s) => [s.key, s.start]));
  let myPick = [];
  const enabled = new Set(FEATURES.map((f) => f.key));
  let toggles = 0;
  let fixed = false;
  let stopGuide = false;

  // Standardised applicant values for the player's own formula.
  const stats = Object.fromEntries(
    ['ervaring', 'motivatie', 'cijfer', 'reistijd'].map((k) => {
      const v = pool.map((a) => a[k]);
      const mean = v.reduce((x, y) => x + y, 0) / v.length;
      const sd = Math.sqrt(v.reduce((x, y) => x + (y - mean) ** 2, 0) / v.length) || 1;
      return [k, { mean, sd }];
    }),
  );
  const z = (a, k) => (a[k] - stats[k].mean) / stats[k].sd;
  const myScore = (a) =>
    weights.ervaring * z(a, 'ervaring') + weights.motivatie * z(a, 'motivatie') + weights.cijfer * z(a, 'cijfer') - weights.dichtbij * z(a, 'reistijd');

  // Renders the ranking and animates rows from their old to their new place (FLIP).
  function renderRanking(box, scored, picked) {
    const before = new Map([...box.querySelectorAll('[data-name]')].map((n) => [n.dataset.name, n.getBoundingClientRect()]));
    // A grid of 12 tiles: rank, name and where they live. The best 3 get the job.
    box.innerHTML = scored
      .map(
        (a, i) => `<li data-name="${a.naam}" class="${picked.has(a.naam) ? 'is-picked' : ''} ${a.zuid ? 'is-zuid' : ''}">
          <b class="tile__rank">${i + 1}</b><strong>${a.naam}</strong><small class="wijk">${a.zuid ? 'Zuid' : 'Noord'}</small>
        </li>`,
      )
      .join('');
    box.querySelectorAll('[data-name]').forEach((n) => {
      const old = before.get(n.dataset.name);
      if (old === undefined) return;
      const now = n.getBoundingClientRect();
      const dx = old.left - now.left;
      const dy = old.top - now.top;
      if (!dx && !dy) return;
      n.style.transform = `translate(${dx}px, ${dy}px)`;
      n.style.transition = 'none';
      requestAnimationFrame(() => {
        n.style.transition = 'transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1)';
        n.style.transform = '';
      });
    });
  }

  function rank(scoreFn) {
    const scored = pool.map((a) => ({ ...a, s: scoreFn(a) })).sort((a, b) => b.s - a.s);
    return { scored, picked: new Set(scored.slice(0, 3).map((a) => a.naam)), zuid: scored.slice(0, 3).filter((a) => a.zuid).length };
  }

  function weightBars(w) {
    const max = Math.max(...Object.values(w).map(Math.abs), 0.01);
    return `<ul class="weights">${FEATURES.filter((f) => f.key in w)
      .map((f) => {
        const v = w[f.key];
        const pct = Math.round((Math.abs(v) / max) * 50);
        return `<li><span class="weights__label">${f.label}</span>
          <span class="weights__track"><i class="${v < 0 ? 'is-neg' : 'is-pos'}" style="${v < 0 ? `right:50%;width:${pct}%` : `left:50%;width:${pct}%`}"></i></span>
          <b>${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(1).replace('.', ',')}</b></li>`;
      })
      .join('')}</ul>`;
  }

  // How much a feature counts, as four big buttons instead of a fiddly slider.
  const LEVELS = ['niet', 'beetje', 'belangrijk', 'heel'];

  // 1. You are the algorithm.
  function yourTurn() {
    el.innerHTML = `
      <div class="g">
        ${say(character, practice ? '<p>Oefenen: wie mag helpen bij de boekenmarkt? Wat vind jij belangrijk?</p>' : '<p>De bieb zoekt 3 jongeren voor een bijbaan. Wat vind jij belangrijk?</p>')}
        <div class="levels">${SLIDERS.map(
          (s) => `<div class="levels__row" role="radiogroup" aria-label="${s.label}"><span>${s.label}</span>
            <div class="levels__opts">${LEVELS.map((l, v) => `<button role="radio" aria-checked="${weights[s.key] === v}" data-k="${s.key}" data-v="${v}">${l}</button>`).join('')}</div></div>`,
        ).join('')}</div>
        <ol class="ranking ranking--tiles"></ol>
        <button class="btn btn--action g__wide" data-go>Dit zijn mijn 3</button>
      </div>`;
    const box = el.querySelector('.ranking');
    const update = () => {
      const r = rank(myScore);
      myPick = [...r.picked];
      renderRanking(box, r.scored, r.picked);
    };
    el.querySelectorAll('[data-k]').forEach((b) =>
      b.addEventListener('click', () => {
        weights[b.dataset.k] = Number(b.dataset.v);
        b.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
        update();
      }),
    );
    update();
    el.querySelector('[data-go]').addEventListener('click', computerTurn);
    if (practice) {
      let tapped = false;
      el.querySelector('.levels').addEventListener('click', () => (tapped = true));
      stopGuide = guide(el, [
        { target: '.levels', text: 'Tik hoe belangrijk iets is. Bijvoorbeeld motivatie: heel.', at: [0.88, 0.42], wait: () => tapped },
        { target: '.ranking', text: 'De lijst schuift mee. De bovenste 3 krijgen de baan.', wait: 'ok' },
        { target: '[data-go]', text: 'Tevreden? Dan kies je je 3.', wait: 'ok' },
      ], { onDone: onPracticeDone });
    }
  }

  // 2. The computer learns from 300 old applications.
  function computerTurn() {
    el.innerHTML = `
      <div class="g">
        ${say(character, '<p>Nu kiest een computer. Hij leert van wie de oude baas vroeger aannam.</p>')}
        <div class="training"><span class="training__bar"><i></i></span><small class="training__txt">De computer leert…</small></div>
      </div>`;
    setTimeout(() => {
      model = train(data, FEATURES.map((f) => f.key));
      const r = rank(model.score);
      const mine = new Set(myPick);
      el.innerHTML = `
        <div class="g">
          <div class="compare">
            <div><p class="g__hint">Jouw 3</p>${pool.filter((a) => mine.has(a.naam)).map((a) => `<span class="pick ${a.zuid ? 'is-zuid' : ''}">${a.naam}<small>${a.zuid ? 'Zuid' : 'Noord'}</small></span>`).join('')}</div>
            <div><p class="g__hint">De computer</p>${r.scored.slice(0, 3).map((a) => `<span class="pick ${a.zuid ? 'is-zuid' : ''}">${a.naam}<small>${a.zuid ? 'Zuid' : 'Noord'}</small></span>`).join('')}</div>
          </div>
          <p class="g__title">Wat de computer leerde</p>
          ${weightBars(model.weights)}
          <p class="g__hint">Rechts = pluspunt. Links = minpunt.</p>
          <div class="g__pop g__pop--q">${question('why')}</div>
        </div>`;
      bindQuestion('why', youRejected);
    }, 900);
  }

  // 3. You apply, and get rejected.
  function youRejected() {
    const you = model.score(YOU);
    const third = rank(model.score).scored[2].s;
    el.innerHTML = `
      <div class="g">
        <p class="g__title">En nu jij</p>
        ${say(character, '<p>Stel, jij solliciteert ook. Je bent beter dan bijna iedereen. Maar je woont op Zuid.</p>')}
        <div class="you-card ${you >= third ? 'is-picked' : 'is-rejected'}">
          <strong>${you >= third ? 'Uitgenodigd' : 'Afgewezen'}</strong>
          <span>Jouw score: ${Math.round(you * 100)}. Nummer drie: ${Math.round(third * 100)}.</span>
        </div>
        <p class="g__hint">Kun jij de computer repareren?</p>
        <button class="btn btn--action g__wide" data-go>Repareer de computer</button>
      </div>`;
    el.querySelector('[data-go]').addEventListener('click', repair);
  }

  // 4. Switch data off and retrain live until the model is fair.
  function repair() {
    el.innerHTML = `
      <div class="g">
        ${say(character, `<p>Tik dingen uit tot het eerlijk is. Wat mag de computer niet weten?</p>`)}
        <div class="chips chips--fit">${FEATURES.map((f) => `<button class="chip ${enabled.has(f.key) ? 'is-on' : ''}" data-f="${f.key}" aria-pressed="${enabled.has(f.key)}">${f.label}</button>`).join('')}</div>
        <div class="repair-status"></div>
        <ol class="ranking ranking--tiles"></ol>
      </div>`;
    const box = el.querySelector('.ranking');
    const retrain = () => {
      const keys = FEATURES.map((f) => f.key).filter((k) => enabled.has(k));
      if (!keys.length) {
        el.querySelector('.repair-status').innerHTML = '<p class="g__verdict is-wrong">Zonder gegevens kan de computer niks kiezen.</p>';
        return;
      }
      const m = train(data, keys, { steps: 400 });
      const r = rank(m.score);
      renderRanking(box, r.scored, r.picked);
      const meritLeft = ['ervaring', 'motivatie', 'cijfer'].filter((k) => enabled.has(k)).length;
      const status = el.querySelector('.repair-status');
      if (!enabled.has('zuid') && !enabled.has('reistijd') && meritLeft >= 2) {
        fixed = true;
        status.innerHTML = `<p class="g__verdict is-right">Eerlijk!</p>`;
        el.querySelector('.g').insertAdjacentHTML('beforeend', `<div class="g__pop g__pop--q">${question('proxy')}</div>`);
        bindQuestion('proxy', finish);
      } else if (!enabled.has('zuid') && enabled.has('reistijd')) {
        status.innerHTML = `<p class="g__verdict is-wrong">${r.zuid} van de 3 van Zuid. Nog steeds niet eerlijk!</p><p class="g__hint">Tip: aan je reistijd zie je ook waar je woont.</p>`;
      } else if (meritLeft < 2) {
        status.innerHTML = `<p class="g__verdict is-wrong">Nu weet de computer te weinig.</p><p class="g__hint">Laat ervaring, motivatie en cijfer aan.</p>`;
      } else {
        status.innerHTML = `<p class="g__hint">Van Zuid gekozen: ${r.zuid} van de 3.</p>`;
      }
    };
    el.querySelectorAll('[data-f]').forEach((b) =>
      b.addEventListener('click', () => {
        if (fixed) return;
        toggles += 1;
        const k = b.dataset.f;
        if (enabled.has(k)) enabled.delete(k);
        else enabled.add(k);
        b.classList.toggle('is-on', enabled.has(k));
        b.setAttribute('aria-pressed', String(enabled.has(k)));
        setTimeout(retrain, 20);
      }),
    );
    retrain();
  }

  function question(id) {
    const q = QUESTIONS[id];
    return `<div class="g__q" data-q="${id}">
      <p><strong>${q.q}</strong></p>
      <div class="g__choices">${shuffle(q.options)
        .map((o) => `<button class="g__choice" data-right="${o.right}">${escapeHtml(o.text)}</button>`)
        .join('')}</div>
    </div>`;
  }

  function bindQuestion(id, next) {
    const box = el.querySelector(`[data-q="${id}"]`);
    box.querySelectorAll('.g__choice').forEach((b) =>
      b.addEventListener('click', () => {
        const right = b.dataset.right === 'true';
        if (right) correct += 1;
        box.querySelectorAll('.g__choice').forEach((x) => {
          x.disabled = true;
          if (x.dataset.right === 'true') x.classList.add('is-right');
        });
        if (!right) b.classList.add('is-wrong');
        // The options make way for the answer, so the panel stays the same size.
        box.innerHTML = `<p class="g__verdict ${right ? 'is-right' : 'is-wrong'}">${right ? 'Goed!' : 'Niet helemaal'}</p>
          ${say(character, `<p>${escapeHtml(QUESTIONS[id].explain)}</p>`)}
          <button class="btn btn--action g__wide" data-next>Verder</button>`;
        box.querySelector('[data-next]').addEventListener('click', next);
      }),
    );
  }

  function finish() {
    // A practice round never shows a score: it goes straight on to the real game.
    if (practice) return onPracticeDone();
    // The fix counts as a point when you found it in a few tries (2 switches is the minimum).
    if (fixed && toggles <= 6) correct += 1;
    endScreen(el, {
      big: `${correct}/3`,
      sub: 'punten',
      character,
      line: escapeHtml(
        'Een computer is niet vanzelf eerlijk. Hij leert ook oneerlijke keuzes. Je mag altijd vragen waarom je bent afgewezen.',
      ),
      extra: `<p class="g__hint">${toggles <= 6 ? `Gerepareerd in ${toggles} stappen.` : `Gerepareerd in ${toggles} stappen. Het kan ook in 2.`}</p>`,
      onDone: () => onFinish({ correct, total: 3, summary: 'punten' }),
    });
  }

  yourTurn();
  return () => {
    if (stopGuide) stopGuide();
  };
}
