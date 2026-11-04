// "Spoorloos" (Privacy, Rotterdam Centraal, Mo).
// Your train leaves in 8 minutes. At five moments you choose: fast but leaving a data trail, or
// private but slower. You can't avoid everything in time, so you have to pick which traces matter
// most. At the end Mo tells you what he now knows about you.
// Score: how much of the most sensitive data you kept to yourself, compared with the best
// possible route within 8 minutes.
// AI: Mo turns your traces into a short profile of you. Without AI he lists them.

import { chat, isAvailable } from '../ai.js';
import { escapeHtml, say, endScreen } from './kit.js';

const MINUTES = 8;

// weight: how sensitive the trace is (1 = a bit, 3 = very).
const STEPS = [
  {
    title: 'Inchecken',
    options: [
      { label: 'Persoonlijke OV-chipkaart', min: 1, trace: 'Je reis is gekoppeld aan je naam: het OV-bedrijf weet dat je hier vandaag was.', weight: 3 },
      { label: 'Inchecken met je bankpas', min: 1, trace: 'Je bank ziet dat je vandaag met de trein reisde, en vanaf welk station.', weight: 3 },
      { label: 'Anonieme OV-chipkaart uit de automaat', min: 3, trace: null },
    ],
  },
  {
    title: 'Je perron zoeken',
    options: [
      { label: 'Reisapp met locatie "altijd aan"', min: 0, trace: 'Je reisapp weet ook waar je bent als je hem niet gebruikt, dus ook waar je woont en slaapt.', weight: 3 },
      { label: 'Reisapp met locatie "alleen tijdens gebruik"', min: 1, trace: 'Je reisapp weet waar je nu bent, maar niet de rest van de dag.', weight: 1 },
      { label: 'Op het grote bord in de hal kijken', min: 2, trace: null },
    ],
  },
  {
    title: 'De vertrektijd checken',
    options: [
      { label: 'Gratis wifi, inloggen met je social-media-account', min: 0, trace: 'Het platform weet nu dat je op Rotterdam Centraal was, en kan dat aan je profiel koppelen.', weight: 2 },
      { label: 'Gratis wifi, inloggen met je e-mailadres', min: 1, trace: 'De wifi-aanbieder heeft je e-mailadres en weet welk apparaat je hebt.', weight: 1 },
      { label: 'Het aan een medewerker vragen', min: 2, trace: null },
    ],
  },
  {
    title: 'Een broodje kopen',
    options: [
      { label: 'Met de app van de winkel, voor 20% korting', min: 0, trace: 'De winkel weet wat je eet, wanneer, en op welk station.', weight: 2 },
      { label: 'Pinnen', min: 1, trace: 'Je bank ziet waar en wanneer je iets kocht.', weight: 1 },
      { label: 'Contant betalen', min: 2, trace: null },
    ],
  },
  {
    title: 'Naar het perron',
    options: [
      { label: 'Snelle poort met gezichtsscan', min: 0, trace: 'Een systeem heeft je gezicht gescand. Een gezicht kun je niet veranderen, zoals een wachtwoord.', weight: 3 },
      { label: 'Gewone poort, even in de rij', min: 2, trace: null },
    ],
  },
];

// The most sensitive weight you can avoid within the time limit (checked by trying every route).
function bestAvoidable() {
  let best = 0;
  const walk = (i, time, avoided) => {
    if (time > MINUTES) return;
    if (i === STEPS.length) {
      best = Math.max(best, avoided);
      return;
    }
    const worst = Math.max(...STEPS[i].options.map((o) => o.weight ?? 0));
    for (const o of STEPS[i].options) walk(i + 1, time + o.min, avoided + worst - (o.weight ?? 0));
  };
  walk(0, 0, 0);
  return best;
}

const minRest = (from) => STEPS.slice(from).reduce((sum, s) => sum + Math.min(...s.options.map((o) => o.min)), 0);

async function profile(traces) {
  const reply = await chat(
    [
      {
        role: 'system',
        content:
          'Je bent Mo, stationsmedewerker op Rotterdam Centraal, in een spel voor jongeren over privacy. Je krijgt een lijst datasporen die een reiziger achterliet. ' +
          'Vertel in maximaal drie korte zinnen, in de jij-vorm, wat bedrijven samen uit deze sporen over de reiziger kunnen afleiden. Een beetje griezelig, maar niet eng. ' +
          'Verzin geen namen, adressen of andere concrete gegevens. Eenvoudig Nederlands.',
      },
      { role: 'user', content: traces.map((t) => `- ${t}`).join('\n') },
    ],
    { temperature: 0.7, maxTokens: 140 },
  );
  return reply && reply.length > 20 && reply.length < 600 ? reply : null;
}

export function mount(el, { onFinish, character }) {
  let step = 0;
  let used = 0;
  const chosen = [];
  let destroyed = false;
  const maxAvoid = bestAvoidable();

  function render() {
    const s = STEPS[step];
    const left = MINUTES - used;
    el.innerHTML = `
      <div class="g">
        ${step === 0 ? say(character, '<p>Je trein vertrekt over 8 minuten. Overal kun je kiezen: snel, of privé maar langzamer. Alles privé past niet in de tijd. Wat laat jij achter?</p>') : ''}
        <div class="clock">
          <span class="clock__face" style="--left:${left / MINUTES}"><b>${left}</b><small>min</small></span>
          <span class="clock__steps">${STEPS.map((_, i) => `<i class="${i < step ? 'is-done' : i === step ? 'is-now' : ''}"></i>`).join('')}</span>
        </div>
        <p class="g__title">${step + 1}. ${s.title}</p>
        <div class="g__choices">${s.options
          .map((o, i) => {
            const fits = left - o.min >= minRest(step + 1);
            return `<button class="g__choice" data-o="${i}" ${fits ? '' : 'disabled'}>
              <strong>${escapeHtml(o.label)}</strong>
              <small>${o.min === 0 ? 'Geen tijd' : `${o.min} ${o.min === 1 ? 'minuut' : 'minuten'}`}${fits ? '' : ' · past niet meer'}</small>
            </button>`;
          })
          .join('')}</div>
        ${chosen.length ? `<p class="g__hint">Sporen tot nu toe: ${chosen.filter((c) => c.trace).length}</p>` : ''}
      </div>`;
    el.querySelectorAll('[data-o]').forEach((b) =>
      b.addEventListener('click', () => {
        const o = s.options[Number(b.dataset.o)];
        chosen.push({ ...o, worst: Math.max(...s.options.map((x) => x.weight ?? 0)) });
        used += o.min;
        step += 1;
        if (step < STEPS.length) render();
        else finish();
      }),
    );
  }

  async function finish() {
    const traces = chosen.filter((c) => c.trace);
    const avoided = chosen.reduce((sum, c) => sum + c.worst - (c.weight ?? 0), 0);
    el.innerHTML = `
      <div class="g">
        <p class="g__title">Je haalt de trein, met ${MINUTES - used} ${MINUTES - used === 1 ? 'minuut' : 'minuten'} over.</p>
        ${say(character, `<p class="g__thinking">Mo zoekt uit wat er over je bekend is…</p>`)}
      </div>`;
    const text = traces.length && (await isAvailable()) ? await profile(traces.map((t) => t.trace)) : null;
    if (destroyed) return;
    const line = !traces.length
      ? 'Ik weet helemaal niets over je. Knap, en je haalde je trein ook nog!'
      : text
        ? escapeHtml(text)
        : 'Dit is wat er nu over je bekend is. Los lijkt het onschuldig, maar samen vertelt het veel over je.';
    endScreen(el, {
      big: `${traces.length}`,
      sub: traces.length === 1 ? 'spoor achtergelaten' : 'sporen achtergelaten',
      character,
      line,
      extra: `${traces.length ? `<ul class="traces">${traces.map((t) => `<li class="w${t.weight}">${escapeHtml(t.trace)}</li>`).join('')}</ul>` : ''}
        ${text ? '<p class="g__ai">Dit profiel is door AI gemaakt uit jouw sporen. Zo werkt profilering ook in het echt.</p>' : ''}
        <p class="g__hint">Je kunt nooit alles vermijden. Het gaat erom dat je de gevoeligste sporen kiest om te vermijden: je gezicht, je locatie de hele dag, en reizen die aan je naam vastzitten.</p>`,
      onDone: () => onFinish({ correct: avoided, total: maxAvoid, summary: 'privacypunten' }),
    });
  }

  render();
  return () => {
    destroyed = true;
  };
}
