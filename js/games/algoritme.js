// "Jij bent het algoritme" (Chances, Centrale Bibliotheek, Chancy).
// A sandbox. First YOU are the algorithm: set sliders for what matters and watch 12 applicants
// for a library side job re-sort live. Then a real (small) model, a logistic regression that
// trains in your browser on 300 old applications, picks instead. The old manager was biased
// against people from Zuid, and the model learned it: it rejects them, and you. Then you repair
// the model by switching data off and retraining live, until you discover that travel time still
// gives away where people live.
// Score: one question about why, finding the fix, and one question about the proxy.
// No language model needed: here the AI is the subject.

import { escapeHtml, say, endScreen, seeded, shuffle } from './kit.js';

const SLIDERS = [
  { key: 'ervaring', label: 'Werkervaring', start: 1 },
  { key: 'motivatie', label: 'Motivatie', start: 1 },
  { key: 'cijfer', label: 'Cijfer Nederlands', start: 1 },
  { key: 'dichtbij', label: 'Woont dichtbij', start: 0 },
];

const FEATURES = [
  { key: 'ervaring', label: 'Werkervaring' },
  { key: 'motivatie', label: 'Motivatie' },
  { key: 'cijfer', label: 'Cijfer Nederlands' },
  { key: 'zuid', label: 'Woont op Zuid' },
  { key: 'reistijd', label: 'Reistijd naar de bieb' },
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
      { text: 'Hij heeft het vooroordeel van de oude manager overgenomen uit de oude data.', right: true },
      { text: 'Mensen van Zuid zijn minder geschikt voor deze baan.', right: false },
      { text: 'De computer kiest willekeurig, dit is toeval.', right: false },
    ],
    explain: 'Een model leert van voorbeelden. De oude manager nam bijna nooit iemand van Zuid aan, dus het model denkt dat "woont op Zuid" een slecht teken is. Kijk naar de balken: daar zit het grootste minpunt.',
  },
  proxy: {
    q: 'Waarom moest "reistijd" ook weg?',
    options: [
      { text: 'Reistijd verraadt waar je woont. Het model gebruikte dat als vervanger voor "woont op Zuid".', right: true },
      { text: 'Reistijd is niet belangrijk voor een bijbaan.', right: false },
      { text: 'Er zat een fout in de computer.', right: false },
    ],
    explain: 'Wie op Zuid woont, heeft een langere reistijd naar de bieb in het centrum. Het model vond een omweg naar hetzelfde vooroordeel. Daarom is "het kenmerk weghalen" niet genoeg: een mens moet blijven controleren wie er wordt afgewezen.',
  },
};

const ZUID_TOTAL = APPLICANTS.filter((a) => a.zuid).length;

export function mount(el, { onFinish, character }) {
  const data = history();
  let correct = 0;
  let model = null;
  const weights = Object.fromEntries(SLIDERS.map((s) => [s.key, s.start]));
  let myPick = [];
  const enabled = new Set(FEATURES.map((f) => f.key));
  let toggles = 0;
  let fixed = false;

  // Standardised applicant values for the player's own formula.
  const stats = Object.fromEntries(
    ['ervaring', 'motivatie', 'cijfer', 'reistijd'].map((k) => {
      const v = APPLICANTS.map((a) => a[k]);
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
    const before = new Map([...box.querySelectorAll('[data-name]')].map((n) => [n.dataset.name, n.getBoundingClientRect().top]));
    const max = Math.max(...scored.map((a) => a.s));
    const min = Math.min(...scored.map((a) => a.s));
    box.innerHTML = scored
      .map(
        (a) => `<li data-name="${a.naam}" class="${picked.has(a.naam) ? 'is-picked' : ''} ${a.zuid ? 'is-zuid' : ''}">
          <span class="ranking__name"><strong>${a.naam}</strong><small><b class="wijk">${a.zuid ? 'Zuid' : 'Noord'}</b> · ${a.ervaring} mnd · motivatie ${a.motivatie}/5 · ${String(a.cijfer).replace('.', ',')}</small></span>
          <span class="ranking__score"><i style="width:${Math.round(((a.s - min) / (max - min || 1)) * 90 + 10)}%"></i></span>
        </li>`,
      )
      .join('');
    box.querySelectorAll('[data-name]').forEach((n) => {
      const old = before.get(n.dataset.name);
      if (old === undefined) return;
      const dy = old - n.getBoundingClientRect().top;
      if (!dy) return;
      n.style.transform = `translateY(${dy}px)`;
      n.style.transition = 'none';
      requestAnimationFrame(() => {
        n.style.transition = 'transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1)';
        n.style.transform = '';
      });
    });
  }

  function rank(scoreFn) {
    const scored = APPLICANTS.map((a) => ({ ...a, s: scoreFn(a) })).sort((a, b) => b.s - a.s);
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

  // 1. You are the algorithm.
  function yourTurn() {
    el.innerHTML = `
      <div class="g">
        ${say(character, '<p>De bieb zoekt 3 jongeren voor een bijbaan. Eerst ben jíj het algoritme: schuif aan de knoppen en kijk wie er bovenaan komt. Wat vind jij belangrijk?</p>')}
        <div class="sliders">${SLIDERS.map(
          (s) => `<label class="slider"><span>${s.label}</span>
            <input type="range" id="w-${s.key}" min="0" max="3" step="1" value="${weights[s.key]}" data-k="${s.key}">
            <b class="slider__v">${['niet', 'beetje', 'belangrijk', 'heel'][weights[s.key]]}</b></label>`,
        ).join('')}</div>
        <ol class="ranking ranking--live"></ol>
        <button class="btn btn--action g__wide" data-go>Dit zijn mijn 3</button>
      </div>`;
    const box = el.querySelector('.ranking');
    const update = () => {
      const r = rank(myScore);
      myPick = [...r.picked];
      renderRanking(box, r.scored, r.picked);
    };
    el.querySelectorAll('[data-k]').forEach((inp) =>
      inp.addEventListener('input', () => {
        weights[inp.dataset.k] = Number(inp.value);
        inp.parentElement.querySelector('.slider__v').textContent = ['niet', 'beetje', 'belangrijk', 'heel'][weights[inp.dataset.k]];
        update();
      }),
    );
    update();
    el.querySelector('[data-go]').addEventListener('click', computerTurn);
  }

  // 2. The computer learns from 300 old applications.
  function computerTurn() {
    el.innerHTML = `
      <div class="g">
        ${say(character, '<p>Nu laten we een computer kiezen. Die krijgt 300 oude sollicitaties: wie de vorige manager wel en niet aannam. Daar leert hij van.</p>')}
        <div class="training"><span class="training__bar"><i></i></span><small class="training__txt">Model leert van 300 oude sollicitaties…</small></div>
      </div>`;
    setTimeout(() => {
      model = train(data, FEATURES.map((f) => f.key));
      const r = rank(model.score);
      const mine = new Set(myPick);
      el.innerHTML = `
        <div class="g">
          <div class="compare">
            <div><p class="g__hint">Jouw 3</p>${APPLICANTS.filter((a) => mine.has(a.naam)).map((a) => `<span class="pick ${a.zuid ? 'is-zuid' : ''}">${a.naam}<small>${a.zuid ? 'Zuid' : 'Noord'}</small></span>`).join('')}</div>
            <div><p class="g__hint">De computer</p>${r.scored.slice(0, 3).map((a) => `<span class="pick ${a.zuid ? 'is-zuid' : ''}">${a.naam}<small>${a.zuid ? 'Zuid' : 'Noord'}</small></span>`).join('')}</div>
          </div>
          <p class="g__title">Wat de computer leerde</p>
          ${weightBars(model.weights)}
          <p class="g__hint">Rechts van het midden telt als plus, links als min. Hoe langer de balk, hoe zwaarder het weegt.</p>
          ${question('why')}
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
        ${say(character, '<p>Stel, jij solliciteert ook. Je hebt 20 maanden ervaring, motivatie 5 en een 8,4 voor Nederlands. Beter dan bijna iedereen. Alleen woon je op Zuid.</p>')}
        <div class="you-card ${you >= third ? 'is-picked' : 'is-rejected'}">
          <strong>${you >= third ? 'Uitgenodigd' : 'Afgewezen'}</strong>
          <span>Score van de computer: ${Math.round(you * 100)} van 100. De nummer drie scoort ${Math.round(third * 100)}.</span>
        </div>
        <p class="g__hint">Niemand bij de bieb heeft dit besloten. Toch gebeurt het. Kun jij het model repareren?</p>
        <button class="btn btn--action g__wide" data-go>Repareer het model</button>
      </div>`;
    el.querySelector('[data-go]').addEventListener('click', repair);
  }

  // 4. Switch data off and retrain live until the model is fair.
  function repair() {
    el.innerHTML = `
      <div class="g">
        ${say(character, `<p>Zet kenmerken uit en de computer traint direct opnieuw. Lukt het om de sterke kandidaten van Zuid een eerlijke kans te geven? Van de 12 wonen er ${ZUID_TOTAL} op Zuid.</p>`)}
        <div class="chips">${FEATURES.map((f) => `<button class="chip ${enabled.has(f.key) ? 'is-on' : ''}" data-f="${f.key}" aria-pressed="${enabled.has(f.key)}">${f.label}</button>`).join('')}</div>
        <div class="repair-status"></div>
        <div class="repair-weights"></div>
        <ol class="ranking"></ol>
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
      el.querySelector('.repair-weights').innerHTML = weightBars(m.weights);
      const meritLeft = ['ervaring', 'motivatie', 'cijfer'].filter((k) => enabled.has(k)).length;
      const status = el.querySelector('.repair-status');
      if (!enabled.has('zuid') && !enabled.has('reistijd') && meritLeft >= 2) {
        fixed = true;
        status.innerHTML = `<p class="g__verdict is-right">Eerlijk!</p><p class="g__hint">Nu kiest de computer alleen op ervaring, motivatie en cijfer: ${r.scored.slice(0, 3).map((a) => a.naam).join(', ')}. Waar je woont telt niet meer mee.</p>
          ${question('proxy')}`;
        bindQuestion('proxy', finish);
      } else if (!enabled.has('zuid') && enabled.has('reistijd')) {
        status.innerHTML = `<p class="g__verdict is-wrong">${r.zuid} van de 3 van Zuid. Nog steeds niet eerlijk!</p><p class="g__hint">"Woont op Zuid" is weg, maar welk ander kenmerk verraadt waar iemand woont? Kijk naar de balken.</p>`;
      } else if (meritLeft < 2) {
        status.innerHTML = `<p class="g__verdict is-wrong">Nu weet de computer bijna niks meer over wie goed is.</p><p class="g__hint">Laat werkervaring, motivatie en cijfer aan staan: die zeggen wél iets over de baan.</p>`;
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
        box.insertAdjacentHTML(
          'beforeend',
          `<p class="g__verdict ${right ? 'is-right' : 'is-wrong'}">${right ? 'Goed!' : 'Niet helemaal'}</p>
          ${say(character, `<p>${escapeHtml(QUESTIONS[id].explain)}</p>`)}
          <button class="btn btn--action g__wide" data-next>Verder</button>`,
        );
        box.querySelector('[data-next]').addEventListener('click', next);
        box.querySelector('[data-next]').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }),
    );
  }

  function finish() {
    // The fix counts as a point when you found it in a few tries (2 switches is the minimum).
    if (fixed && toggles <= 5) correct += 1;
    endScreen(el, {
      big: `${correct}/3`,
      sub: 'punten',
      character,
      line: escapeHtml(
        'Een algoritme is niet vanzelf eerlijk. Het leert van oude keuzes, ook van de oneerlijke, en vindt omwegen. Daarom heb je het recht om te weten waarom je bent afgewezen, en om een mens te vragen ernaar te kijken.',
      ),
      extra: `<p class="g__hint">${toggles <= 5 ? `Je repareerde het model in ${toggles} stappen.` : `Je had ${toggles} stappen nodig om het model te repareren. Met 2 stappen kan het ook.`}</p>`,
      onDone: () => onFinish({ correct, total: 3, summary: 'punten' }),
    });
  }

  yourTurn();
  return () => {};
}
