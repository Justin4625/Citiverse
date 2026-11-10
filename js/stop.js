// The panel that opens at a stop: meet the character, ask them questions, play the minigame,
// see your XP and hear the secret. On site, "Stempel pakken" then closes the panel and hands
// back to the map's own stamp celebration. From a distance you get half XP and no stamp.

import { STOPS } from './stops.js';
import { photoUrl } from './locations.js';
import { chat, isAvailable, stripPersonal } from './ai.js';
import { recordQuestion } from './progress.js';
import { GAMES } from './games/index.js';
import { escapeHtml } from './games/kit.js';
import { buddyUrl, iconUrl, themeVars } from './brand.js';

const MAX_HISTORY = 8;

export function hasStop(id) {
  return Boolean(STOPS[id]);
}

export function characterOf(id) {
  return STOPS[id]?.character ?? null;
}

function systemPrompt(loc, stop) {
  const { name, role } = stop.character;
  return [
    `Je bent ${name}, een Citiverse Buddy van Digital Child Rights en ${role} bij ${loc.name} in Rotterdam. Je speelt een personage in een stempeltocht voor jongeren van 10 tot 20 jaar over digitale rechten. Jouw thema is ${stop.theme}.`,
    'Regels:',
    '- Praat Nederlands, vriendelijk en eenvoudig (taalniveau B1). Antwoord in maximaal drie korte zinnen.',
    '- Gebruik alleen de feiten hieronder. Weet je iets niet, zeg dan eerlijk dat je het niet weet. Verzin nooit cijfers, namen of regels.',
    '- Vraag nooit naar persoonlijke gegevens zoals naam, adres, school, telefoonnummer of wachtwoord. Deelt de jongere die toch, zeg dan dat dat online niet slim is.',
    '- Blijf in je rol. Gaat een vraag niet over jouw plek of jouw thema, verwijs dan vriendelijk terug naar je plek.',
    `- Het digitale probleem waar je mee zit: ${stop.problem}`,
    'Feiten:',
    ...stop.facts.map((f) => `- ${f}`),
  ].join('\n');
}

const CLOSE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

// onCollect(loc): save the stamp. onPlayed(loc, result, { onSite, gameId }): record XP, returns
// the outcome from progress.recordGame. getDifficulty(): 0..4 from the player's level.
// onAchievements(list): show achievements unlocked outside a game (e.g. by asking questions).
export function createStopPanel(root, { onCollect, onPlayed, getDifficulty, onAchievements }) {
  let loc = null;
  let stop = null;
  let history = [];
  let cleanupGame = null;
  let collected = false;
  let onSite = true;

  root.addEventListener('click', (e) => {
    if (e.target === root || e.target.closest('[data-close]')) close();
  });

  function shell(bodyHtml, { banner = false } = {}) {
    const { name, role } = stop.character;
    root.innerHTML = `
      <div class="stop-panel__card" style="${themeVars(loc.id)}">
        <div class="sheet__grip" aria-hidden="true"></div>
        ${banner ? `<div class="stop-panel__banner"><img src="${photoUrl(loc)}" alt="" style="object-position:${loc.focus}"><img class="stop-panel__icon" src="${iconUrl(loc.id)}" alt="Thema ${escapeHtml(stop.theme)}"></div>` : ''}
        <header class="stop-panel__head">
          <span class="stop-panel__badge" aria-hidden="true"><img src="${buddyUrl(loc.id)}" alt=""></span>
          <div class="stop-panel__who">
            <small>${escapeHtml(loc.name)} · ${escapeHtml(stop.theme)}</small>
            <strong>${name}</strong>
            <span>${role}</span>
          </div>
          <button class="sheet__close" data-close aria-label="Sluiten">${CLOSE_ICON}</button>
        </header>
        ${onSite ? '' : '<p class="remote-note">Je speelt op afstand: je krijgt de helft van de XP. De stempel haal je op locatie.</p>'}
        <div class="stop-panel__body">${bodyHtml}</div>
      </div>`;
    root.hidden = false;
    root.querySelector('.stop-panel__card').scrollTop = 0;
    return root.querySelector('.stop-panel__body');
  }

  function showIntro() {
    const game = GAMES[stop.game];
    const body = shell(
      `
      <p class="speech">${escapeHtml(stop.intro)}</p>
      <p class="speech">${escapeHtml(stop.problem)}</p>
      ${game ? `<p class="game-name"><small>Minigame</small><strong>${escapeHtml(stop.card.title)}</strong></p>` : ''}
      <div class="stop-panel__actions">
        <button class="btn btn--action" data-go="help">${game ? `Help ${stop.character.name}` : 'Bekijk de minigame'}</button>
        <button class="btn" data-go="chat">Stel ${stop.character.name} een vraag</button>
      </div>`,
      { banner: true },
    );
    body.querySelector('[data-go="help"]').addEventListener('click', game ? showGame : showCard);
    body.querySelector('[data-go="chat"]').addEventListener('click', showChat);
  }

  function showCard() {
    const body = shell(`
      <div class="game-card">
        <small>Minigame · komt eraan</small>
        <strong>${escapeHtml(stop.card.title)}</strong>
        <p>${escapeHtml(stop.card.text)}</p>
      </div>
      <div class="stop-panel__actions">
        <button class="btn btn--action" data-go="reward">Verder</button>
        <button class="btn" data-go="back">Terug</button>
      </div>`);
    body.querySelector('[data-go="reward"]').addEventListener('click', () => showReward(null, null));
    body.querySelector('[data-go="back"]').addEventListener('click', showIntro);
  }

  function showGame() {
    const body = shell('<div class="game-host"></div>');
    cleanupGame = GAMES[stop.game](body.querySelector('.game-host'), {
      character: { ...stop.character, buddy: buddyUrl(loc.id) },
      difficulty: getDifficulty(),
      onSite,
      onFinish: (result) => {
        cleanupGame?.();
        cleanupGame = null;
        const outcome = onPlayed(loc, result, { onSite, gameId: stop.game });
        showReward(result, outcome);
      },
    });
  }

  function showReward(result, outcome) {
    const levelUp = outcome && outcome.levelAfter.index > outcome.levelBefore.index;
    const xpLine = !outcome
      ? ''
      : outcome.xpGained > 0
        ? `<div class="xp-gain"><b>+${outcome.xpGained} XP</b>${onSite ? '' : '<span>op afstand: halve XP</span>'}</div>`
        : '<div class="xp-gain xp-gain--none"><span>Geen extra XP: je had hier al een beter resultaat.</span></div>';
    const body = shell(`
      ${result ? `<div class="result"><b>${result.correct}/${result.total}</b><span>${escapeHtml(result.summary ?? 'goed')}</span></div>` : ''}
      ${xpLine}
      ${levelUp ? `<div class="level-up"><small>Level omhoog</small><strong>Level ${outcome.levelAfter.number}: ${outcome.levelAfter.name}</strong></div>` : ''}
      ${outcome?.newAchievements.length ? `<div class="unlocked">${outcome.newAchievements.map((a) => `<span class="badge"><b>${escapeHtml(a.name)}</b><small>${escapeHtml(a.text)}</small></span>`).join('')}</div>` : ''}
      <div class="secret">
        <small>Het geheim van ${stop.character.name}</small>
        <p>${escapeHtml(stop.secret)}</p>
      </div>
      <div class="stop-panel__actions">
        ${onSite && !collected
          ? '<button class="btn btn--action" data-go="collect">Stempel pakken</button>'
          : '<button class="btn btn--action" data-close>Terug naar de kaart</button>'}
        <button class="btn" data-go="again">Nog een keer spelen</button>
      </div>`);
    body.querySelector('[data-go="collect"]')?.addEventListener('click', () => {
      const target = loc;
      close();
      onCollect(target);
    });
    body.querySelector('[data-go="again"]').addEventListener('click', GAMES[stop.game] ? showGame : showIntro);
  }

  async function showChat() {
    const name = stop.character.name;
    const body = shell(`
      <div class="chat" aria-live="polite"></div>
      <div class="chat__chips">
        <button class="chat__chip">Wat doe jij hier?</button>
        <button class="chat__chip">Vertel iets over deze plek</button>
        <button class="chat__chip">Wat heeft dit met ${escapeHtml(stop.theme)} te maken?</button>
      </div>
      <form class="chat__form">
        <input id="chatInput" class="chat__input" maxlength="200" placeholder="Typ je vraag aan ${name}…" autocomplete="off">
        <button class="btn btn--action" type="submit">Stuur</button>
      </form>
      <p class="chat__note">Deel hier geen naam, adres of telefoonnummer. ${name} wordt gespeeld door een AI die op deze computer draait.</p>
      <div class="stop-panel__actions"><button class="btn" data-go="back">Terug</button></div>`);
    const log = body.querySelector('.chat');
    const input = body.querySelector('.chat__input');
    const form = body.querySelector('.chat__form');
    body.querySelector('[data-go="back"]').addEventListener('click', showIntro);

    const add = (who, text) => {
      const p = document.createElement('p');
      p.className = `chat__msg chat__msg--${who}`;
      p.textContent = text;
      log.append(p);
      log.scrollTop = log.scrollHeight;
      return p;
    };

    for (const m of history) add(m.role === 'user' ? 'me' : 'them', m.content);
    if (!history.length) add('them', `Vraag maar raak! Ik vertel je graag meer over ${loc.name}.`);

    if (!(await isAvailable())) {
      add('them', `${name} is nu even niet bereikbaar: de AI staat uit. Speel de minigame of kom later terug.`);
      form.querySelector('button').disabled = true;
      input.disabled = true;
      body.querySelectorAll('.chat__chip').forEach((c) => (c.disabled = true));
      return;
    }

    async function ask(raw) {
      const { text, removed } = stripPersonal(raw.trim());
      if (!text) return;
      add('me', text);
      if (removed) add('note', 'Persoonlijke gegevens zijn weggehaald voordat je vraag verstuurd werd.');
      history.push({ role: 'user', content: text });
      const pending = add('them', '…');
      input.disabled = true;
      const reply = await chat([{ role: 'system', content: systemPrompt(loc, stop) }, ...history.slice(-MAX_HISTORY)]);
      pending.textContent = reply ?? 'Sorry, dat lukte even niet. Probeer het nog eens.';
      if (reply) {
        history.push({ role: 'assistant', content: reply });
        const unlocked = recordQuestion();
        if (unlocked.length) onAchievements(unlocked);
      } else {
        history.pop();
      }
      input.disabled = false;
      input.focus();
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const value = input.value;
      input.value = '';
      ask(value);
    });
    body.querySelectorAll('.chat__chip').forEach((chip) => chip.addEventListener('click', () => ask(chip.textContent)));
  }

  function open(location, { isCollected, isOnSite }) {
    cleanupGame?.();
    cleanupGame = null;
    loc = location;
    stop = STOPS[loc.id];
    collected = isCollected;
    onSite = isOnSite;
    history = [];
    showIntro();
  }

  function close() {
    cleanupGame?.();
    cleanupGame = null;
    root.hidden = true;
    root.innerHTML = '';
  }

  return { open, close };
}
