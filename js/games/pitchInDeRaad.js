// "Pitch in de raad" (Active, Stadhuis, Fatima).
// Think of an idea for your neighbourhood and pitch it to three council members, who each care
// about something else: money, the neighbours, and safety. You need 2 of the 3 votes.
// AI: the council members ask questions about your own idea and judge your typed answer.
// Without AI they ask fixed questions and you choose an answer.
// Ideas are counted anonymously on this device, so a demo laptop shows what young people want.

import { chat, isAvailable, stripPersonal } from '../ai.js';
import { escapeHtml, say, endScreen, parseJson, shuffle, tally } from './kit.js';

const TOPICS = [
  {
    id: 'chillen',
    label: 'Een plek om te chillen',
    ideas: ['Een overdekte hangplek met bankjes en wifi in het park', 'Een jongerencafé in een leeg winkelpand', 'Een basketbalveld dat \'s avonds verlicht is'],
  },
  {
    id: 'fietsen',
    label: 'Veilig fietsen naar school',
    ideas: ['Een fietspad dat gescheiden is van de auto\'s', 'Een fietsenstalling met camera bij het station', 'Een oversteek met verkeerslicht bij school'],
  },
  {
    id: 'sporten',
    label: 'Gratis sporten',
    ideas: ['Gratis sportlessen in de buurthuizen', 'Een calisthenics-park op het plein', 'Een skatebaan onder het viaduct'],
  },
  {
    id: 'schoon',
    label: 'Schonere straten',
    ideas: ['Meer afvalbakken met een app die laat zien wanneer ze vol zijn', 'Een opruimdag met muziek en eten', 'Statiegeld-automaten in de wijk'],
  },
];

const MEMBERS = [
  {
    id: 'bram',
    name: 'Bram',
    cares: 'het geld van de stad',
    question: 'Wat kost het, en wie betaalt het?',
    answers: [
      { text: 'We gebruiken een plek die er al is. Een deel betalen we uit het geld dat de gemeente voor jongeren heeft, en jongeren helpen zelf mee.', vote: true },
      { text: 'Het kost niet zoveel, denk ik.', vote: false, why: 'Bram wil weten waar het geld vandaan komt. "Denk ik" overtuigt hem niet.' },
      { text: 'Geld is niet belangrijk, het gaat om jongeren.', vote: false, why: 'Voor Bram is geld juist het belangrijkste. Je gaat niet in op zijn vraag.' },
    ],
  },
  {
    id: 'esther',
    name: 'Esther',
    cares: 'de buurtbewoners',
    question: 'Wat merken de buren ervan? Denk aan geluid of rommel.',
    answers: [
      { text: 'We praten eerst met de buren, er komen afvalbakken, en na tien uur \'s avonds is het rustig.', vote: true },
      { text: 'De buren moeten maar wennen.', vote: false, why: 'Esther vertegenwoordigt de buren. Zo krijg je ze niet mee.' },
      { text: 'Daar heb ik nog niet over nagedacht.', vote: false, why: 'Eerlijk, maar Esther wil een plan zien.' },
    ],
  },
  {
    id: 'youssef',
    name: 'Youssef',
    cares: 'veiligheid',
    question: 'Hoe zorg je dat het veilig is, ook \'s avonds?',
    answers: [
      { text: 'Er komt goede verlichting, en het jongerenwerk komt regelmatig langs.', vote: true },
      { text: 'Jongeren zorgen zelf wel voor elkaar.', vote: false, why: 'Mooi gedacht, maar Youssef wil weten wat je regelt als het misgaat.' },
      { text: 'Er gebeurt toch nooit iets.', vote: false, why: 'Dat kun je niet beloven. Youssef wil een plan.' },
    ],
  },
];

async function aiQuestion(member, idea) {
  const reply = await chat(
    [
      {
        role: 'system',
        content: `Je bent ${member.name}, gemeenteraadslid in Rotterdam. Je let vooral op ${member.cares}. Een jongere pitcht een idee. Stel één korte, vriendelijke vraag over je eigen aandachtspunt, in eenvoudig Nederlands. Alleen de vraag, maximaal 20 woorden.`,
      },
      { role: 'user', content: `Het idee: ${idea}` },
    ],
    { temperature: 0.5, maxTokens: 60 },
  );
  const q = reply?.replace(/^["']|["']$/g, '').trim();
  return q && q.length > 8 && q.length < 200 ? q : null;
}

async function aiVote(member, idea, question, answer) {
  const reply = await chat(
    [
      {
        role: 'system',
        content:
          `Je bent ${member.name}, gemeenteraadslid. Je let vooral op ${member.cares}. Je beoordeelt het antwoord van een jongere (10 tot 20 jaar) eerlijk maar vriendelijk. ` +
          'Stem "voor" als het antwoord concreet ingaat op je vraag, ook als het niet perfect is. Stem "tegen" als het vaag is, niet ingaat op je vraag, of onbeleefd is. ' +
          'Antwoord alleen met JSON: {"stem": "voor" of "tegen", "reden": "één korte zin, eenvoudig Nederlands"}',
      },
      { role: 'user', content: `Idee: ${idea}\nJouw vraag: ${question}\nAntwoord van de jongere: ${answer}` },
    ],
    { json: true, temperature: 0.2, maxTokens: 100 },
  );
  const data = parseJson(reply);
  if (!['voor', 'tegen'].includes(data?.stem) || typeof data?.reden !== 'string') return null;
  return { vote: data.stem === 'voor', why: data.reden.slice(0, 240) };
}

export function mount(el, { onFinish, character }) {
  let topic = null;
  let idea = '';
  let index = 0;
  const votes = [];
  let aiOn = false;
  let destroyed = false;
  isAvailable().then((ok) => (aiOn = ok));

  function chooseTopic() {
    el.innerHTML = `
      <div class="g">
        ${say(character, '<p>Wat zou jij in je wijk veranderen? Kies een onderwerp. Daarna pitch je je idee bij drie raadsleden. Je hebt er twee nodig.</p>')}
        <div class="g__choices">${TOPICS.map((t) => `<button class="g__choice" data-t="${t.id}"><strong>${t.label}</strong></button>`).join('')}</div>
      </div>`;
    el.querySelectorAll('[data-t]').forEach((b) =>
      b.addEventListener('click', () => {
        topic = TOPICS.find((t) => t.id === b.dataset.t);
        chooseIdea();
      }),
    );
  }

  function chooseIdea() {
    el.innerHTML = `
      <div class="g">
        <p class="g__title">${topic.label}</p>
        <p class="g__hint">Kies een idee of schrijf je eigen idee.</p>
        <div class="g__choices">${topic.ideas.map((i) => `<button class="g__choice" data-i>${escapeHtml(i)}</button>`).join('')}</div>
        <form class="g__own">
          <textarea id="ownIdea" maxlength="200" placeholder="Mijn idee…"></textarea>
          <button class="btn" type="submit">Dit is mijn idee</button>
        </form>
        <p class="g__hint">Schrijf geen namen of adressen. Ideeën worden zonder naam bewaard op dit apparaat.</p>
      </div>`;
    el.querySelectorAll('[data-i]').forEach((b) =>
      b.addEventListener('click', () => {
        idea = b.textContent;
        start();
      }),
    );
    el.querySelector('.g__own').addEventListener('submit', (e) => {
      e.preventDefault();
      const { text } = stripPersonal(el.querySelector('#ownIdea').value.trim());
      if (text.length < 8) return;
      idea = text;
      start();
    });
  }

  function start() {
    tally('ideeen', topic.id);
    member();
  }

  // The council chamber: three seats with vote lamps, and you at the lectern.
  function bar() {
    return `<div class="council">
      <div class="council__seats">${MEMBERS.map((m, i) => {
        const v = votes[i];
        return `<span class="council__seat${v === true ? ' is-yes' : v === false ? ' is-no' : i === index ? ' is-now' : ''}" style="--i:${i}">
          <i class="council__lamp"></i><b>${m.name[0]}</b><small>${m.name}</small><em>${escapeHtml(m.cares)}</em></span>`;
      }).join('')}</div>
      <div class="council__lectern"><small>Jouw voorstel</small><p>${escapeHtml(idea)}</p></div>
      <div class="council__tally"><span class="yes">${votes.filter((v) => v === true).length} voor</span><span class="no">${votes.filter((v) => v === false).length} tegen</span></div>
    </div>`;
  }

  async function member() {
    const m = MEMBERS[index];
    el.innerHTML = `
      <div class="g">
        ${bar()}
        <div class="say"><span class="say__avatar" aria-hidden="true">${m.name[0]}</span><div class="say__text"><p><strong>${m.name}</strong> · let op ${m.cares}</p><p class="m-q">${aiOn ? '<span class="g__thinking">denkt na over je idee…</span>' : escapeHtml(m.question)}</p></div></div>
        <div class="m-answer"></div>
      </div>`;
    const question = aiOn ? (await aiQuestion(m, idea)) ?? m.question : m.question;
    if (destroyed) return;
    el.querySelector('.m-q').textContent = question;

    const box = el.querySelector('.m-answer');
    if (aiOn) {
      box.innerHTML = `<form class="g__own">
          <textarea id="pitchAnswer" maxlength="280" placeholder="Jouw antwoord aan ${m.name}…"></textarea>
          <button class="btn btn--action" type="submit">Antwoord</button>
        </form>`;
      box.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const { text } = stripPersonal(box.querySelector('textarea').value.trim());
        if (text.length < 5) return;
        box.querySelectorAll('button, textarea').forEach((x) => (x.disabled = true));
        box.insertAdjacentHTML('beforeend', `<p class="g__thinking">${m.name} overlegt…</p>`);
        const res = await aiVote(m, idea, question, text);
        if (destroyed) return;
        if (!res) return cards(m, box, 'Dat lukte even niet. Kies een antwoord.');
        decided(m, res.vote, res.why, true);
      });
    } else {
      cards(m, box);
    }
  }

  function cards(m, box, note) {
    box.innerHTML = `${note ? `<p class="g__hint">${note}</p>` : ''}<div class="g__choices">${shuffle(m.answers)
      .map((a) => `<button class="g__choice" data-vote="${a.vote}">${escapeHtml(a.text)}</button>`)
      .join('')}</div>`;
    box.querySelectorAll('[data-vote]').forEach((b) =>
      b.addEventListener('click', () => {
        const a = m.answers.find((x) => x.text === b.textContent);
        decided(m, a.vote, a.vote ? `Concreet antwoord. Daar kan ik mee verder.` : a.why, false);
      }),
    );
  }

  function decided(m, vote, why, ai) {
    votes[index] = vote;
    const last = index === MEMBERS.length - 1;
    el.querySelector('.m-answer').innerHTML = `
      <p class="g__verdict ${vote ? 'is-right' : 'is-wrong'}">${m.name} stemt ${vote ? 'voor' : 'tegen'}</p>
      <div class="say"><span class="say__avatar" aria-hidden="true">${m.name[0]}</span><div class="say__text"><p>${escapeHtml(why)}</p></div></div>
      ${ai ? '<p class="g__ai">Deze stem is bepaald door de AI.</p>' : ''}
      <button class="btn btn--action g__wide" data-next>${last ? 'Naar de uitslag' : 'Volgende raadslid'}</button>`;
    el.querySelector('.council').outerHTML = bar();
    el.querySelector('[data-next]').addEventListener('click', () => {
      index += 1;
      if (last) finish();
      else member();
    });
  }

  function finish() {
    const yes = votes.filter(Boolean).length;
    const count = tally('ideeen')[topic.id] ?? 1;
    endScreen(el, {
      big: yes >= 2 ? 'Aangenomen' : 'Verworpen',
      sub: `${yes} van de 3 stemmen voor`,
      character,
      line: escapeHtml(
        yes >= 2
          ? 'Gefeliciteerd! Je idee is aangenomen. In het echt kun je ook meepraten: iedereen mag inspreken bij de gemeenteraad.'
          : 'Jammer, deze keer niet. Raadsleden willen concrete antwoorden: wat kost het, wat merken de buren, en is het veilig? Probeer het nog eens.',
      ),
      extra: `<p class="g__hint">Op dit apparaat zijn ${count} ${count === 1 ? 'idee' : 'ideeën'} ingediend over "${escapeHtml(topic.label.toLowerCase())}".</p>`,
      onDone: () => onFinish({ correct: yes, total: 3, summary: 'stemmen voor' }),
    });
  }

  chooseTopic();
  return () => {
    destroyed = true;
  };
}
