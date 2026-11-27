# Citiverse demo: design

Date: 2026-11-27. Status: approved by the user 2026-11-27 (incl. creating the public repo + Pages).

## Intent

A short, guided demo of Citiverse that people play on their own phone, to showcase the game
(e.g. at the AI Symposium, 11 Dec 2026). It shows everything the game has (map, Buddies, a
minigame with practice round, stamps, XP/profile, the stamp book and routes) in two stops,
without GPS and without the local AI model. It lives apart from the full game.

## Goals

- Anyone can open one link on their phone and play it through in a few minutes, anywhere
  (no GPS, no walking, no laptop with Ollama).
- A fixed, guided flow that cannot be skipped and cannot break: every step waits for the right
  action, and buttons that are not "unlocked" yet are grey and do nothing.
- Same look, Buddies, voices and minigames as the real game.

## Non-goals

- No GPS, no free walking, no test mode, no reset button.
- No AI: no chat with the Buddy, no Ollama calls. Games use their built-in fixed content.
- No replaying a minigame, no more than two stops.
- No changes to the real game repo for this.

## Anti-goals (failure even if it "works")

- A visitor gets stuck (a step that never completes, a sheet that can't be closed, a dead button).
- A visitor can skip or wander out of the tutorial and lose the thread.
- It feels like a test page (debug UI, English, AI errors, GPS prompts).

## Constraints

- Plain HTML/CSS/JS ES modules, no build, same as the game. GitHub Pages, relative paths.
- Phone first: test at 390x844 and 390x667. Nothing in a game may scroll (existing rule).
- Dutch UI, plain Dutch for 11-15 year olds, no AI-sounding phrases (existing text rules).
- ElevenLabs free plan: about 4,000 characters left this month for new recorded lines.

## Approaches

- **A. Separate repo, copy of the game (chosen).** New public repo `Justin4625/Citiverse-demo`
  with its own Pages link. Copy the current game (commit 855866f), strip GPS/test mode/AI/replay,
  add the demo flow. Trade-off: fully independent and stable; improvements in the real game
  must be copied over by hand.
- B. Same repo, `demo.html` sharing the code. Fixes flow into the demo automatically, but the
  game code gets demo checks everywhere and game changes can silently break the demo.
- Chosen: A, by the user ("staat dan los van deze volledige game"), and because a showcase
  must above all be stable.

## The flow (decided by the user)

1. **Start screen**: the same splash as the game. Tap Start.
2. **Map + demo notice**: the map shows, and a message appears straight away: this is a demo;
   the real game works with GPS (you walk to the places yourself); in this demo you are guided.
   One button to continue.
3. **Spawn**: you appear at a random stop (one of the 10), close enough to play it.
4. **Buddy intro**: that stop's Buddy talks to you and tells you where you are.
5. **Map tutorial**: rotate the map, zoom in, zoom out.
6. **Play stop 1**: tap the stop, play its minigame as in the real game (practice round first,
   then the real game), then collect the stamp. Replaying is not possible; only "Stempel pakken".
7. **Profile tutorial**: tap your profile (the logo with level, top left) and see your progress.
8. **GO tutorial**: tap the GO button (bottom middle). In the stamp book, choose the next stop:
   the stop nearest to stop 1. Its route shows on the map.
9. **Auto walk**: the Twinny walks along the route by itself. Meanwhile you may zoom and rotate,
   but you cannot move yourself.
10. **Play stop 2**: tap it, play, collect the stamp.
11. **End**: end of the demo, with a thank-you for playing.

The tutorial is unskippable. Buttons that are not unlocked yet are grey and not clickable
until their step unlocks them. The settings button only shows "Bronnen" (credits).

**Guide Buddy (user, after review):** on the map and in the menus the tutorial is not loose
text: a Buddy says it, shown as the Buddy figure with a speech bubble. The minigames' own
practice rounds stay as they are.

## My calls (the user can correct these)

- **Which Buddy guides**: the Buddy of the spawn stop guides the whole demo (it already greeted
  you there), in its own recorded voice. Tutorial lines are therefore recorded in all 3 designed
  voices (~10 lines x 3, ~1,800 characters); with the intros, notice and end lines the total is
  ~2,600 of the ~4,000 credits left.

- **Guidance look**: reuse the practice-round guide (`js/games/guide.js`: dim layer, spotlight,
  hand, bubble with "Oké") for every tutorial step, so the demo and the games feel the same.
  Bubbles get the read-aloud button like everywhere else.
- **Steps wait for the real action**: rotate step completes when the map has turned at least
  ~45 degrees; zoom-in when zoom rose ~0.7; zoom-out when it fell ~0.7; tap steps when the
  spotlighted element was tapped. While a step waits, only the spotlighted element (and the map,
  for gesture steps) takes input.
- **Unlock order**: map gestures (step 5), stop 1 (step 6), profile (step 7), GO + only the
  "Route" button of stop 2 (step 8), stop 2 (when the walk arrives). Settings (Bronnen only) is
  always available between steps. Locked items: greyed (reduced opacity + greyscale), clicks
  ignored, a short wobble on tap so it does not feel broken.
- **Other stops**: visible on the map and in the stamp book but locked (grey, no route, tapping
  does nothing).
- **Stop 2 = nearest to stop 1** by straight-line distance. The route comes from the existing
  router (`js/route.js`, FOSSGIS foot router); offline it falls back to a straight line.
- **Walk speed**: normal walking pace, but the whole walk takes at most ~20 s; a far stop just
  means a faster Twinny. The camera follows the Twinny. Arriving in range unlocks stop 2 and the
  Buddy calls ("<Buddy> heeft je hulp nodig. Tik op de stop!").
- **Buddy intro text** (step 4): two speech bubbles from the Buddy. First the existing intro
  ("Hoi, ik ben <Buddy>! Ik werk hier als <role>. <hook>", already recorded), then a new short
  line "Je staat nu bij <stop>." recorded per Buddy in that Buddy's voice (10 lines, ~350
  characters). The demo notice and end lines use the narrator voice; tutorial tips use
  the guide Buddy's voice (see above), all via `tools/voices.mjs`. Total stays well under the ~4,000 credits left.
- **Refresh / closing the tab**: progress is saved per step in localStorage; reopening resumes at
  the last completed step (same spawn stop). A refresh during a minigame restarts that stop's
  game (practice round included). A refresh during the walk places the Twinny at stop 2 (walk
  done). Collecting a stamp and its XP is recorded once per stop id, so nothing counts twice.
  If storage is unavailable, it restarts from the start screen. Stamps/XP live in the demo's own
  storage keys, separate from the game.
- **End screen**: "Bedankt voor het spelen!" with the two stamps earned, total XP, one line that
  the full game has 10 stops across Rotterdam, and a "Speel opnieuw" button (new random spawn,
  clears demo progress), so the next person can play on the same phone.
- **Difficulty**: games run at difficulty 0. AI is hard-off (no Ollama probes at all, so no
  network errors on phones); the "Stel een vraag" chat is removed.
- **Removed from the copy**: test mode + its switch, "Stempels wissen", ?debug tools, GPS
  (`watchPosition`), the chat, "Nog een keer spelen", the 10-stamp finale.
- **Offline**: the service worker precaches the app shell, photos, Buddy images and all
  `audio/` mp3s on first visit. The 3D Rotterdam map and the router still need internet; the
  router falls back to a straight line. A working connection is assumed for the map.
- **Source of the copy**: `git archive` of commit 855866f of the game repo (not the working
  copy, which has an untracked `.impeccable/`).
- **Repo**: `Justin4625/Citiverse-demo`, public, main branch, GitHub Pages, same file layout as
  the game; includes `audio/` and the voice tool (key stays in ~/.config/elevenlabs.key).

## Left to the builder

- Exact tutorial texts (short, plain Dutch, max ~12 words per bubble), within the flow above.
- How the guide is extended for gesture steps and for elements outside the stop panel.
- How locking is implemented (one demo state module is suggested: current step, unlocked set).
- Test script: a headless run through the whole flow at 390x844 and 390x667, including a
  refresh in the middle of each step.
