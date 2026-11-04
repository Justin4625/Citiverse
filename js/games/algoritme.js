// "Jij bent het algoritme" (Chances, Centrale Bibliotheek, Ruben).
// The library lets a computer pick 3 of 12 applicants for a side job. The computer is a real
// (small) model: a logistic regression that trains in your browser on 300 old applications.
// The old manager was biased against applicants from Zuid, so the model learns that bias. You
// find out why, see yourself rejected, try a fix and discover that travel time still gives
// people away. Three questions decide the score. No language model needed: the AI is the subject.

import { escapeHtml, say, endScreen, seeded, shuffle } from './kit.js';

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
    q: 'Waarom kiest het model bijna niemand van Zuid?',
    options: [
      { text: 'Het model heeft het vooroordeel van de oude manager overgenomen uit de oude data.', right: true },
      { text: 'Mensen van Zuid zijn minder geschikt voor deze baan.', right: false },
      { text: 'Het model kiest willekeurig, dit is toeval.', right: false },
    ],
    explain: 'Een model leert van voorbeelden. De oude manager nam bijna nooit iemand van Zuid aan, dus het model denkt dat "woont op Zuid" een slecht teken is. Kijk maar naar de balken: daar zit het grootste minpunt.',
  },
  fix: {
    q: 'Hoe repareer je dit?',
    options: [
      { text: 'Haal "woont op Zuid" weg en train het model opnieuw.', right: true },
      { text: 'Geef het model nog meer oude sollicitaties van dezelfde manager.', right: false },
      { text: 'Niks doen: een computer is altijd eerlijker dan een mens.', right: false },
    ],
    explain: 'Meer data van dezelfde manager bevat hetzelfde vooroordeel, en een computer is alleen zo eerlijk als de data waarvan hij leert. Weghalen is een goede eerste stap. Maar is het genoeg?',
  },
  proxy: {
    q: 'Na de reparatie worden mensen van Zuid nog steeds minder gekozen. Hoe kan dat?',
    options: [
      { text: 'Reistijd verraadt waar je woont. Het model gebruikt dat nu als vervanger.', right: true },
      { text: 'Er zit een fout in de computer.', right: false },
      { text: 'Mensen van Zuid hebben echt minder motivatie.', right: false },
    ],
    explain: 'Wie op Zuid woont, heeft een langere reistijd naar de bieb in het centrum. Het model vond een omweg naar hetzelfde vooroordeel. Daarom moet een mens altijd controleren wie er wordt afgewezen, en waarom.',
  },
};

export function mount(el, { onFinish, character }) {
  const data = history();
  let correct = 0;
  let model = null;
  let fixed = null;

  function weightBars(weights) {
    const max = Math.max(...Object.values(weights).map(Math.abs), 0.01);
    return `<ul class="weights">${FEATURES.filter((f) => f.key in weights)
      .map((f) => {
        const w = weights[f.key];
        const pct = Math.round((Math.abs(w) / max) * 50);
        return `<li><span class="weights__label">${f.label}</span>
          <span class="weights__track"><i class="${w < 0 ? 'is-neg' : 'is-pos'}" style="${w < 0 ? `right:50%;width:${pct}%` : `left:50%;width:${pct}%`}"></i></span>
          <b>${w < 0 ? '−' : '+'}${Math.abs(w).toFixed(1).replace('.', ',')}</b></li>`;
      })
      .join('')}</ul>
      <p class="g__hint">Rechts van het midden telt mee als plus, links als min. Hoe langer de balk, hoe zwaarder het weegt.</p>`;
  }

  function ranking(m) {
    const scored = APPLICANTS.map((a) => ({ ...a, s: m.score(a) })).sort((a, b) => b.s - a.s);
    const picked = new Set(scored.slice(0, 3).map((a) => a.naam));
    const zuidPicked = scored.slice(0, 3).filter((a) => a.zuid).length;
    return {
      zuidPicked,
      html: `<ol class="ranking">${scored
        .map(
          (a) => `<li class="${picked.has(a.naam) ? 'is-picked' : ''}">
            <span class="ranking__name"><strong>${a.naam}</strong><small>${a.zuid ? 'Zuid' : 'Noord'} · ${a.ervaring} mnd ervaring · motivatie ${a.motivatie}/5</small></span>
            <span class="ranking__score"><i style="width:${Math.round(a.s * 100)}%"></i></span>
          </li>`,
        )
        .join('')}</ol>`,
    };
  }

  function intro() {
    el.innerHTML = `
      <div class="g">
        ${say(character, '<p>De bieb zoekt 3 jongeren voor een bijbaan, en er zijn 12 sollicitanten. Vroeger koos de oude manager zelf. Nu laten we een computer kiezen die leert van 300 oude sollicitaties: wie werd aangenomen en wie niet?</p>')}
        <div class="data-peek">
          <p class="g__hint">Wat het model te zien krijgt, per sollicitant:</p>
          <ul>${FEATURES.map((f) => `<li>${f.label}</li>`).join('')}</ul>
          <p class="g__hint">En of die persoon toen is aangenomen.</p>
        </div>
        <button class="btn btn--action g__wide" data-go>Train het model</button>
      </div>`;
    el.querySelector('[data-go]').addEventListener('click', () => {
      el.querySelector('[data-go]').disabled = true;
      el.querySelector('[data-go]').textContent = 'Model leert…';
      // Give the button a moment to repaint before the training loop runs.
      setTimeout(() => {
        model = train(data, FEATURES.map((f) => f.key));
        trained();
      }, 60);
    });
  }

  function trained() {
    const r = ranking(model);
    el.innerHTML = `
      <div class="g">
        <p class="g__title">Wat het model leerde</p>
        ${weightBars(model.weights)}
        <p class="g__title">Wie het model kiest</p>
        ${r.html}
        ${question('why')}
      </div>`;
    bindQuestion('why', youRejected);
  }

  function youRejected() {
    const yourScore = model.score(YOU);
    const third = APPLICANTS.map((a) => model.score(a)).sort((a, b) => b - a)[2];
    el.innerHTML = `
      <div class="g">
        <p class="g__title">En nu jij</p>
        ${say(character, '<p>Stel, jij solliciteert ook. Je hebt 20 maanden ervaring, motivatie 5 en een 8,4 voor Nederlands. Beter dan bijna iedereen. Alleen woon je op Zuid.</p>')}
        <div class="you-card ${yourScore >= third ? 'is-picked' : 'is-rejected'}">
          <strong>${yourScore >= third ? 'Uitgenodigd' : 'Afgewezen'}</strong>
          <span>Score van het model: ${Math.round(yourScore * 100)} van 100. De nummer drie scoort ${Math.round(third * 100)}.</span>
        </div>
        <p class="g__hint">Niemand bij de bieb heeft dit besloten. Toch gebeurt het.</p>
        ${question('fix')}
      </div>`;
    bindQuestion('fix', retrain);
  }

  function retrain() {
    fixed = train(data, FEATURES.filter((f) => f.key !== 'zuid').map((f) => f.key));
    const r = ranking(fixed);
    el.innerHTML = `
      <div class="g">
        <p class="g__title">Opnieuw getraind, zonder "woont op Zuid"</p>
        ${weightBars(fixed.weights)}
        ${r.html}
        <p class="g__hint">Van Zuid gekozen: ${r.zuidPicked} van de 3. Van de 12 sollicitanten wonen er 5 op Zuid.</p>
        ${question('proxy')}
      </div>`;
    bindQuestion('proxy', finish);
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
    endScreen(el, {
      big: `${correct}/3`,
      sub: 'vragen goed',
      character,
      line: 'Een algoritme is niet vanzelf eerlijk. Het leert van oude keuzes, ook van de oneerlijke. Daarom heb je het recht om te weten waarom je bent afgewezen, en om een mens te vragen ernaar te kijken.',
      onDone: () => onFinish({ correct, total: 3, summary: 'vragen goed' }),
    });
  }

  intro();
  return () => {};
}
