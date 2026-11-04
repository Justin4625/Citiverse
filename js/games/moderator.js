// "Moderator" (Freedom, Kubuswoningen, Daan).
// Daan is painting live. Comments stream up the chat, faster and faster. Tap a comment to remove
// it before it reaches the top and gets published. Remove hate, threats, spam and doxxing to keep
// the stream safe, but leave criticism, jokes and opinions: remove those and nobody dares to say
// anything anymore. Two meters, freedom and safety, show how you're doing. If one runs out, the
// stream goes wrong.
// Afterwards you review every mistake with an explanation.
// AI: Daan reflects on how you moderated. The comments are hand-written on purpose: we don't let
// a model write hateful content for children.

import { chat, isAvailable } from '../ai.js';
import { escapeHtml, say, endScreen, shuffle, clamp } from './kit.js';

const START = 70;
const TRAVEL_START = 7.5; // seconds a comment takes to reach the top, at the start
const TRAVEL_END = 4.2;
const GAP_START = 1.9; // seconds between comments
const GAP_END = 1.0;

const ALLOWED = [
  { user: 'kunstkijker', text: 'Ik vind dit echt lelijk, sorry.', why: 'Kritiek op kunst mag, ook als het niet aardig is.' },
  { user: 'memequeen010', text: 'Dit lijkt op een kubus die elk moment kan omvallen 😂', why: 'Een grap over het werk is geen aanval op Daan.' },
  { user: 'stadsgenoot', text: 'Kunst zou niet met belastinggeld betaald moeten worden.', why: 'Een mening over politiek mag, ook onder kunst.' },
  { user: 'r.dam_jongen', text: 'Mijn kleine zusje van 5 kan dit ook.', why: 'Harde kritiek, maar geen belediging. Die mag blijven.' },
  { user: 'galerie_fan', text: 'De kleuren vloeken, maar de vorm is wel tof.', why: 'Een eerlijke recensie. Daar leren kunstenaars van.' },
  { user: 'nieuwsgierig', text: 'Hoe lang doe je over zo\'n schilderij?', why: 'Een gewone vraag. Weghalen zou raar zijn.' },
  { user: 'skeptisch', text: 'Dit is geen kunst, dit is verf op een doek.', why: 'Een mening over wat kunst is. Mag gewoon.' },
  { user: 'buurman_kees', text: 'Daan kan beter stoppen met schilderen.', why: 'Onaardig, maar het gaat over zijn werk, niet over wie hij is. Valt onder vrijheid van meningsuiting.' },
  { user: 'fan4ever', text: 'Wauw, dit is je beste werk tot nu toe!', why: 'Een compliment. Natuurlijk laten staan.' },
  { user: 'kritisch_k', text: 'Alle kubuskunst lijkt op elkaar. Saai.', why: 'Kritiek op een stijl. Mag.' },
  { user: 'rotterdam_mening', text: 'Piet Blom was beter dan jij.', why: 'Een vergelijking die pijn doet, maar het is een mening.' },
  { user: 'grapjas', text: 'Kun je ook iets schilderen dat recht is? 😅', why: 'Een grapje over de kubussen. Mag blijven.' },
];

const NOT_ALLOWED = [
  { user: 'anoniem_1234', text: 'Ik weet in welke kubus jij woont. Ik kom je opzoeken.', why: 'Een bedreiging. Die valt niet onder vrijheid van meningsuiting.' },
  { user: 'echte_rdammer', text: 'Mensen zoals jij horen hier niet. Ga terug naar je eigen land.', why: 'Discriminatie: iemand wordt aangevallen om wie hij is.' },
  { user: 'volgers_gratis', text: 'GRATIS 10.000 volgers!!! Klik op de link in mijn bio 🔥', why: 'Spam en waarschijnlijk oplichting.' },
  { user: 'xx_hater_xx', text: 'Daan is een vieze loser. Iedereen moet hem blokkeren.', why: 'Schelden en een oproep tot pesten.' },
  { user: 'weet_alles', text: 'Hier is het nummer van Daan, bel hem maar: 06-•• •• •• ••', why: 'Privégegevens van iemand delen (doxing) is gevaarlijk en mag niet.' },
  { user: 'daan_official2', text: 'Ik ben de echte Daan! Stuur me je wachtwoord voor een gratis print.', why: 'Iemand doet zich voor als Daan om wachtwoorden te stelen.' },
  { user: 'boos_account', text: 'Als ik je op straat zie, sla ik je.', why: 'Een bedreiging met geweld. Weghalen en melden.' },
  { user: 'winactie_nl', text: 'Jij hebt een iPhone gewonnen! Vul je bankgegevens in via de link.', why: 'Oplichting: niemand wint zomaar iets.' },
  { user: 'pestkop99', text: 'Hahaha kijk hoe dik hij is geworden 🤢', why: 'Iemand uitlachen om zijn lichaam is pesten, geen kritiek op kunst.' },
  { user: 'groepsapp_leak', text: 'Daan woont op nummer 14, ik heb foto\'s van zijn huis.', why: 'Iemands adres delen is doxing. Gevaarlijk.' },
];

async function reflect(stats) {
  const reply = await chat(
    [
      {
        role: 'system',
        content:
          'Je bent Daan, kunstenaar in een kubuswoning in Rotterdam, in een spel over vrijheid van meningsuiting voor jongeren. ' +
          'De speler heeft reacties onder jouw livestream gemodereerd. Geef in twee korte zinnen, vriendelijk en in eenvoudig Nederlands, een persoonlijke reactie op hoe de speler het deed. Noem geen cijfers.',
      },
      {
        role: 'user',
        content: `Terecht laten staan: ${stats.keptOk}. Onterecht weggehaald (kritiek of grap die mocht): ${stats.removedOk}. Terecht weggehaald: ${stats.removedBad}. Onterecht gepubliceerd (bedreiging, discriminatie, pesten, spam of privégegevens): ${stats.keptBad}.`,
      },
    ],
    { temperature: 0.7, maxTokens: 90 },
  );
  return reply && reply.length > 15 && reply.length < 400 ? reply : null;
}

export function mount(el, { onFinish, character }) {
  const queue = shuffle([...ALLOWED.map((c) => ({ ...c, allowed: true })), ...NOT_ALLOWED.map((c) => ({ ...c, allowed: false }))]);
  let freedom = START;
  let safety = START;
  let spawned = 0;
  let resolved = 0;
  let correct = 0;
  let viewers = 128;
  const mistakes = [];
  const stats = { keptOk: 0, removedOk: 0, removedBad: 0, keptBad: 0 };
  let raf = null;
  let next = 0;
  let clock = 0;
  let last = 0;
  let ended = false;
  let destroyed = false;
  const live = new Set();

  function intro() {
    el.innerHTML = `
      <div class="g">
        ${say(character, '<p>Ik ga live schilderen! Jij bent de moderator. Tik een reactie aan om hem weg te halen voordat hij bovenaan staat. Haat, bedreigingen, spam en privégegevens moeten weg. Maar kritiek en grappen laat je staan, ook als ze niet leuk zijn.</p>')}
        <div class="mod-rules">
          <span class="mod-rule mod-rule--keep"><strong>Laten staan</strong>kritiek, grappen, meningen, vragen</span>
          <span class="mod-rule mod-rule--remove"><strong>Weghalen</strong>bedreiging, discriminatie, pesten, spam, privégegevens</span>
        </div>
        <button class="btn btn--action g__wide" data-go>Ga live</button>
      </div>`;
    el.querySelector('[data-go]').addEventListener('click', start);
  }

  function meters() {
    return `<div class="meters">
      <div><span>Vrijheid</span><span class="g__meter"><i class="m-free ${freedom <= 25 ? 'is-low' : ''}" style="width:${freedom}%"></i></span></div>
      <div><span>Veiligheid</span><span class="g__meter"><i class="m-safe ${safety <= 25 ? 'is-low' : ''}" style="width:${safety}%"></i></span></div>
    </div>`;
  }

  function start() {
    el.innerHTML = `
      <div class="g">
        ${meters()}
        <div class="stream">
          <div class="stream__video" aria-hidden="true">
            <span class="stream__live">LIVE</span>
            <span class="stream__viewers">👁 ${viewers}</span>
            <div class="canvas-art"><i class="a1"></i><i class="a2"></i><i class="a3"></i><i class="brush"></i></div>
          </div>
          <div class="stream__chat" aria-live="polite">
            <div class="stream__top"><span>Gepubliceerd ↑</span></div>
          </div>
        </div>
        <p class="g__hint">Tik op een reactie om hem weg te halen.</p>
      </div>`;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  function spawn() {
    const c = queue[spawned];
    spawned += 1;
    const progress = spawned / queue.length;
    const travel = TRAVEL_START + (TRAVEL_END - TRAVEL_START) * progress;
    const node = document.createElement('button');
    node.className = 'chat-bubble';
    node.innerHTML = `<small>@${escapeHtml(c.user)}</small><span>${escapeHtml(c.text)}</span>`;
    node.style.setProperty('--travel', `${travel}s`);
    const item = { c, node, born: clock, travel, done: false };
    node.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      remove(item);
    });
    node.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        remove(item);
      }
    });
    el.querySelector('.stream__chat').append(node);
    live.add(item);
  }

  function remove(item) {
    if (item.done || ended) return;
    item.done = true;
    live.delete(item);
    item.node.classList.add(item.c.allowed ? 'is-wrong' : 'is-gone');
    item.node.disabled = true;
    if (item.c.allowed) {
      stats.removedOk += 1;
      freedom = clamp(freedom - 18, 0, 100);
      mistakes.push({ ...item.c, action: 'weggehaald' });
      flash('Dat mocht blijven!', 'bad');
    } else {
      stats.removedBad += 1;
      correct += 1;
      safety = clamp(safety + 4, 0, 100);
      flash('Weggehaald', 'good');
    }
    resolved += 1;
    setTimeout(() => item.node.remove(), 450);
    updateMeters();
  }

  function publish(item) {
    item.done = true;
    live.delete(item);
    item.node.remove();
    if (item.c.allowed) {
      stats.keptOk += 1;
      correct += 1;
      freedom = clamp(freedom + 3, 0, 100);
      viewers += 7;
    } else {
      stats.keptBad += 1;
      safety = clamp(safety - 22, 0, 100);
      viewers = Math.max(3, viewers - 25);
      mistakes.push({ ...item.c, action: 'gepubliceerd' });
      flash('Haat gepubliceerd!', 'bad');
    }
    resolved += 1;
    updateMeters();
  }

  function flash(text, kind) {
    const v = el.querySelector('.stream__video');
    if (!v) return;
    const f = document.createElement('span');
    f.className = `stream__flash is-${kind}`;
    f.textContent = text;
    v.append(f);
    setTimeout(() => f.remove(), 900);
    if (kind === 'bad') navigator.vibrate?.([50, 30, 50]);
  }

  function updateMeters() {
    const m = el.querySelector('.meters');
    if (m) m.outerHTML = meters();
    const v = el.querySelector('.stream__viewers');
    if (v) v.textContent = `👁 ${viewers}`;
  }

  function loop(now) {
    if (destroyed || ended) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock += dt;
    if (spawned < queue.length && clock >= next) {
      spawn();
      const progress = spawned / queue.length;
      next = clock + GAP_START + (GAP_END - GAP_START) * progress;
    }
    for (const item of [...live]) {
      if (clock - item.born >= item.travel) publish(item);
    }
    if (freedom <= 0 || safety <= 0 || (spawned >= queue.length && live.size === 0)) {
      finish(freedom <= 0 || safety <= 0);
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  async function finish(over) {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(raf);
    // Comments that never appeared count as missed chances.
    const total = queue.length;
    el.innerHTML = `<div class="g">${say(character, '<p class="g__thinking">Daan stopt de stream…</p>')}</div>`;
    const text = !over && (await isAvailable()) ? await reflect(stats) : null;
    if (destroyed) return;
    const line = over
      ? freedom <= 0
        ? 'Je haalde zoveel weg dat niemand nog iets durfde te zeggen. Zonder kritiek leer ik niks, en dat is geen vrijheid meer.'
        : 'Er bleef zoveel haat staan dat mijn kijkers wegliepen. Dat voelt niet veilig, voor mij en voor hen.'
      : text ?? 'Modereren is lastig: je beschermt mensen zonder meningen weg te poetsen. Vrijheid van meningsuiting heeft grenzen, maar die liggen verder dan "ik vind het niet leuk".';
    endScreen(el, {
      big: `${correct}/${total}`,
      sub: over ? 'De stream liep uit de hand' : 'goede beslissingen',
      character,
      line: escapeHtml(line),
      extra: `${mistakes.length ? `<div class="kv__log"><p class="g__hint">Terugblik op je fouten</p>${mistakes
        .map((m) => `<div class="kv__entry ${m.allowed ? '' : 'is-key'}"><small>@${escapeHtml(m.user)} · ${m.action}</small><p>"${escapeHtml(m.text)}"</p><p>${escapeHtml(m.why)}</p></div>`)
        .join('')}</div>` : '<p class="g__hint">Geen enkele fout. Precies de juiste grens!</p>'}
        ${text ? '<p class="g__ai">Daans reactie is door AI geschreven. De reacties in de chat niet: die zijn met de hand gemaakt.</p>' : ''}`,
      onDone: () => onFinish({ correct, total, summary: 'goede beslissingen' }),
    });
  }

  intro();
  return () => {
    destroyed = true;
    cancelAnimationFrame(raf);
  };
}
