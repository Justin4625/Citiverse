# Citiverse

Location-based stamp rally in Rotterdam (Minor DA, Groep D). Walk to a real place and collect a digital stamp there.

Plain HTML/CSS/JS (ES modules), no build step. Map: MapLibre GL on OpenFreeMap tiles.

- Live: https://justin4625.github.io/Citiverse/
- Test mode: tap **Test** (or add `?debug`) to turn GPS off; tap the map to walk, tap a far stop to teleport, **Reset** clears all stamps.
- Run locally: `python3 -m http.server 8000` → http://localhost:8000/?debug

## Stops, characters and minigames

Tapping **Help <naam>** at a stop opens the stop panel (`js/stop.js`): the character introduces themselves and their digital problem, you can ask them questions, play the minigame, see your XP and hear their secret. On site, **Stempel pakken** then shows the usual stamp. Tapping a stop in the stamp book plays it from a distance: half XP and no stamp.

Characters, facts, problems and secrets for all 10 stops live in `js/stops.js`. The facts still need checking before a playtest.

| Stop | Theme | Minigame | What the AI does | Without AI |
| --- | --- | --- | --- | --- |
| Rotterdam Centraal | Privacy | Spoorloos (`spoorloos.js`) | Mo turns your data traces into a profile | Lists the traces |
| Markthal | Fair | Koopjesjacht (`koopjesjacht.js`) | Writes the slogans of the trick offers | Fixed slogans |
| Kubuswoningen | Freedom | Moderator (`moderator.js`) | Daan reflects on how you moderated | Fixed reflection |
| Erasmusbrug | Everybody | Iedereen over de brug (`overDeBrug.js`) | Voices the three readers' reactions (rules decide who understands) | Fixed reactions |
| Rechtbank | Rules | Kruisverhoor (`kruisverhoor.js`) | Answers your own questions in the witness's role, from their facts | Question cards only |
| Euromast | Opinion | Overtuig de stad (`overtuigDeStad.js`) | Scores an argument you write yourself | Argument cards only |
| Het Park | Healthy | Ontsnap uit de app (`ontsnapUitDeApp.js`) | Writes the lure pop-ups | Fixed pop-ups |
| Politiebureau | Safe | Nep of echt (`nepOfEcht.js`) | Writes extra fake messages within fixed templates | Built-in messages |
| Stadhuis | Active | Pitch in de raad (`pitchInDeRaad.js`) | Council members ask about your idea and vote on your answer | Fixed questions and answer cards |
| Centrale Bibliotheek | Chances | Jij bent het algoritme (`algoritme.js`) | A real logistic regression trains in the browser and learns a bias | Same (no language model needed) |

A minigame is a module with `mount(element, { character, difficulty, onSite, onFinish })` that calls `onFinish({ correct, total, summary })` and returns a cleanup function. Register it in `js/games/index.js`. Shared helpers are in `js/games/kit.js`.

### XP, levels and badges

`js/progress.js`: a game gives 50 XP for finishing plus up to 150 for the share you got right; from a distance it counts half. Replaying a stop only adds the difference with your best result there. Five levels (Nieuwkomer to Havenbaas); Nep of echt gets harder as your level rises. Ten badges. Tap the level chip at the top left for the **Voortgang** sheet. **Reset** in test mode clears stamps and progress.

Everything (stamps, XP, badges, and anonymous tallies such as the Euromast poll and the Stadhuis ideas) is stored only on the device.

### Local AI (Ollama)

The character chat and the extra Nep of echt messages use a local model via [Ollama](https://ollama.com). Without it everything still works: the chat says the character is unavailable and the game uses its built-in messages.

```bash
ollama pull mistral
ollama serve
python3 -m http.server 8000   # then open http://localhost:8000/?debug
```

URL params, remembered on the device: `?model=llama3.2` (default `mistral`), `?ai=http://192.168.1.20:11434`, `?ai=off`. For any page that is not on `localhost`, start Ollama with `OLLAMA_ORIGINS=*`. Phones only give GPS to HTTPS pages, so the GitHub Pages version has GPS but cannot reach a laptop's Ollama; outdoor play with AI needs Ollama behind HTTPS.

Personal details (phone numbers, e-mail addresses, postcodes) are removed from questions before they reach the model. Nothing else leaves the device.

## Photo credits

Stop photos come from Wikimedia Commons (cropped and resized), see `credit` in `js/locations.js` and the "Photo credits" section in the stamp book:

- Rotterdam Centraal: Hein56didden, CC BY-SA 3.0
- Markthal: DaHuzyBru, CC BY-SA 4.0
- Kubuswoningen: Choinowski, CC BY-SA 4.0
- Erasmusbrug: Michielverbeek, CC BY-SA 4.0
- Rechtbank: Marcel Douwe Dekker, CC BY-SA 2.0
- Euromast: W. Bulach, CC BY-SA 4.0
- Het Park: Jan Geerling, CC BY-SA 4.0
- Politiebureau: Jan Geerling, CC BY-SA 4.0
- Stadhuis: Ttzavaras, CC BY-SA 4.0
- Centrale Bibliotheek: Frans Berkelaar, CC BY-SA 2.0
