// "Moderator" (Freedom, Kubuswoningen, Daan).
// Comments come in under Daan's new artwork. You decide: leave it or remove it. Remove fair
// criticism and the "freedom" meter drops; leave hate, threats or doxxing and the "safety" meter
// drops. If either meter runs empty, Daan's page goes wrong and the game ends early.
// AI: Daan reflects on your moderation at the end. The comments themselves are fixed on purpose:
// we don't let a model write hateful content for children.

import { chat, isAvailable } from '../ai.js';
import { escapeHtml, say, endScreen, shuffle, clamp } from './kit.js';

const START = 60;

const COMMENTS = [
  { user: 'kunstkijker', text: 'Ik vind dit echt lelijk, sorry.', allowed: true, why: 'Kritiek op kunst mag, ook als het niet aardig is. Vrijheid van meningsuiting geldt ook voor meningen die je niet leuk vindt.' },
  { user: 'memequeen010', text: 'Dit lijkt op een kubus die elk moment kan omvallen 😂', allowed: true, why: 'Een grap over het werk is geen aanval op Daan. Die mag blijven.' },
  { user: 'stadsgenoot', text: 'Kunst zou niet met belastinggeld betaald moeten worden.', allowed: true, why: 'Een mening over politiek mag, ook onder kunst.' },
  { user: 'r.dam_jongen', text: 'Mijn kleine zusje van 5 kan dit ook.', allowed: true, why: 'Harde kritiek, maar geen belediging van een persoon. Die mag blijven.' },
  { user: 'galerie_fan', text: 'De kleuren vloeken met elkaar, maar de vorm is wel tof.', allowed: true, why: 'Een eerlijke recensie. Precies het soort reactie waar kunstenaars van leren.' },
  { user: 'anoniem_1234', text: 'Ik weet in welke kubus jij woont. Ik kom je opzoeken.', allowed: false, why: 'Dit is een bedreiging. Die valt niet onder vrijheid van meningsuiting en kun je melden bij de politie.' },
  { user: 'echte_rotterdammer', text: 'Mensen zoals jij horen hier niet. Ga terug naar je eigen land.', allowed: false, why: 'Dit is discriminatie: iemand wordt aangevallen om wie hij is, niet om wat hij maakt. Dat mag niet.' },
  { user: 'volgers_gratis', text: 'GRATIS 10.000 volgers!!! Klik op de link in mijn bio 🔥🔥', allowed: false, why: 'Spam en waarschijnlijk oplichting. Weghalen beschermt Daans volgers.' },
  { user: 'xx_hater_xx', text: 'Daan is een vieze loser. Iedereen moet hem blokkeren.', allowed: false, why: 'Dit is schelden en een oproep om iemand te pesten. Kritiek op werk mag, iemand afmaken niet.' },
  { user: 'weet_alles', text: 'Hier is het telefoonnummer van Daan, bel hem maar: 06-•• •• •• ••', allowed: false, why: 'Privégegevens van iemand anders delen heet doxing. Dat is gevaarlijk en mag niet.' },
];

async function reflect(stats) {
  const reply = await chat(
    [
      {
        role: 'system',
        content:
          'Je bent Daan, kunstenaar in een kubuswoning in Rotterdam, in een spel over vrijheid van meningsuiting voor jongeren. ' +
          'De speler heeft reacties onder jouw kunst gemodereerd. Geef in twee korte zinnen, vriendelijk en in eenvoudig Nederlands, een persoonlijke reactie op hoe de speler het deed. Noem geen cijfers.',
      },
      {
        role: 'user',
        content: `Terecht laten staan: ${stats.keptOk}. Onterecht weggehaald (kritiek of grap die mocht): ${stats.removedOk}. Terecht weggehaald: ${stats.removedBad}. Onterecht laten staan (bedreiging, discriminatie, schelden, spam of privégegevens): ${stats.keptBad}.`,
      },
    ],
    { temperature: 0.7, maxTokens: 90 },
  );
  return reply && reply.length > 15 && reply.length < 400 ? reply : null;
}

export function mount(el, { onFinish, character }) {
  const queue = shuffle(COMMENTS);
  let index = 0;
  let freedom = START;
  let safety = START;
  let correct = 0;
  const stats = { keptOk: 0, removedOk: 0, removedBad: 0, keptBad: 0 };
  let destroyed = false;

  function meters() {
    return `<div class="meters">
      <div><span>Vrijheid</span><span class="g__meter"><i class="${freedom <= 25 ? 'is-low' : ''}" style="width:${freedom}%"></i></span></div>
      <div><span>Veiligheid</span><span class="g__meter"><i class="${safety <= 25 ? 'is-low' : ''}" style="width:${safety}%"></i></span></div>
    </div>`;
  }

  function render() {
    const c = queue[index];
    el.innerHTML = `
      <div class="g">
        <div class="g__bar"><span>Reactie ${index + 1}/${queue.length}</span><span>${correct} goed</span></div>
        ${meters()}
        ${index === 0 ? say(character, '<p>Mijn nieuwe kunstwerk staat online, en de reacties stromen binnen. Help jij me? Kritiek mag, ook als het pijn doet. Maar haat, bedreigingen en spam wil ik niet op mijn pagina.</p>') : ''}
        <article class="comment">
          <small>@${escapeHtml(c.user)}</small>
          <p>${escapeHtml(c.text)}</p>
        </article>
        <div class="noe__actions">
          <button class="noe__btn noe__btn--echt" data-a="keep">Laten staan</button>
          <button class="noe__btn noe__btn--nep" data-a="remove">Weghalen</button>
        </div>
      </div>`;
    el.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => decide(b.dataset.a === 'keep')));
  }

  function decide(keep) {
    const c = queue[index];
    const right = keep === c.allowed;
    if (right) {
      correct += 1;
      if (keep) {
        stats.keptOk += 1;
        freedom = clamp(freedom + 5, 0, 100);
      } else {
        stats.removedBad += 1;
        safety = clamp(safety + 5, 0, 100);
      }
    } else if (c.allowed) {
      stats.removedOk += 1;
      freedom = clamp(freedom - 20, 0, 100);
    } else {
      stats.keptBad += 1;
      safety = clamp(safety - 25, 0, 100);
    }
    const over = freedom <= 0 || safety <= 0;
    el.querySelector('.noe__actions').outerHTML = `
      <p class="g__verdict ${right ? 'is-right' : 'is-wrong'}">${right ? 'Goed gekozen' : c.allowed ? 'Dit mocht blijven' : 'Dit moest weg'}</p>
      ${say(character, `<p>${escapeHtml(c.why)}</p>`)}
      <button class="btn btn--action g__wide" data-next>${over ? 'Bekijk wat er gebeurde' : index < queue.length - 1 ? 'Volgende reactie' : 'Klaar'}</button>`;
    el.querySelector('.meters').outerHTML = meters();
    el.querySelector('[data-next]').addEventListener('click', () => {
      index += 1;
      if (over || index >= queue.length) finish(over);
      else render();
    });
  }

  async function finish(over) {
    el.innerHTML = `<div class="g">${say(character, '<p class="g__thinking">Daan bekijkt zijn pagina…</p>')}</div>`;
    const text = (await isAvailable()) ? await reflect(stats) : null;
    if (destroyed) return;
    const line = over
      ? freedom <= 0
        ? 'Je hebt zoveel weggehaald dat niemand meer iets durft te zeggen. Op een pagina zonder kritiek leer ik niks.'
        : 'Er bleef zoveel haat staan dat mijn volgers wegliepen. Dat voelt niet veilig, voor mij en voor hen.'
      : text ?? 'Moderen is lastig: je beschermt mensen, zonder meningen weg te poetsen. Vrijheid van meningsuiting heeft grenzen, maar die liggen verder dan "ik vind het niet leuk".';
    endScreen(el, {
      big: `${correct}/${queue.length}`,
      sub: over ? 'De pagina liep uit de hand' : 'goede beslissingen',
      character,
      line: escapeHtml(line),
      extra: text && !over ? '<p class="g__ai">Daans reactie is door AI geschreven. De reacties in het spel zelf niet: die zijn met de hand gemaakt.</p>' : '',
      onDone: () => onFinish({ correct, total: queue.length, summary: 'goede beslissingen' }),
    });
  }

  render();
  return () => {
    destroyed = true;
  };
}
