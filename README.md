# Citiverse

Location-based stamp rally in Rotterdam (Minor DA, Groep D). Walk to a real place and collect a digital stamp there.

Plain HTML/CSS/JS (ES modules), no build step. Map: MapLibre GL, drawn in the game's own colours (`js/mapStyle.js`) from small files in `data/`. They are baked from [3D Rotterdam](https://www.3drotterdam.nl/) © Gemeente Rotterdam (CC BY 4.0, via the Open Urban Platform catalogue) by `tools/bake_map.py`: the BGT 3D ground becomes flat surfaces with a kind (road, cycle path, pavement, green, water), the LoD1 buildings become outlines with a height. The city is cut into grid cells of about 380 x 610 m (`data/map/<x>/<y>.json`); the app loads only the cells around the player (`js/mapData.js`) and shows a coarse overview (`data/overview.geojson`) when zoomed out. The live 3D Tiles are too heavy for a phone (3 MB per ground tile); run the script again when the area or the source data changes.

- Live: https://justin4625.github.io/Citiverse/
- Test mode: tap **Test** (or add `?debug`) to turn GPS off; tap the map to walk, tap a far stop to teleport, **Reset** clears all stamps.
- Run locally: `python3 -m http.server 8000` → http://localhost:8000/?debug

## Stops, characters and minigames

Tapping **Help <naam>** at a stop opens the stop panel (`js/stop.js`): the character introduces themselves and their digital problem, you can ask them questions, play the minigame, see your XP and hear their secret. On site, **Stempel pakken** then shows the usual stamp. Tapping a stop in the stamp book plays it from a distance: half XP and no stamp.

Characters, facts, problems and secrets for all 10 stops live in `js/stops.js`. The facts still need checking before a playtest.

| Stop | Theme | Minigame | How you play | What the AI does |
| --- | --- | --- | --- | --- |
| Rotterdam Centraal | Privacy | Spoorloos | Sneak game on a station map: walk to your train past sweeping cameras, wifi and beacon zones; the private route (ticket machine, queue gate) costs time | Privy turns your traces into a profile |
| Markthal | Fair | Koopjesjacht | 15 seconds per stall; drag a magnifying glass over the small print; receipt at the end | Writes the slogans of the trick offers |
| Kubuswoningen | Freedom | Moderator | Live stream with a chat that speeds up; tap hate away before it's published, leave criticism | Freely reflects on how you moderated (comments are hand-written) |
| Erasmusbrug | Everybody | Iedereen over de brug | Rewrite a message; people walk across the bridge when they understand it; live marks show what trips them up | Voices the readers' reactions (rules decide who understands) |
| Rechtbank | Rules | Kruisverhoor | Collect evidence, then shout "Bezwaar!" when Sanne's testimony contradicts it | Answers your own questions in the witness's role |
| Euromast | Opinion | Overtuig de stad | Debate battle: play argument cards against a timer, pull the audience your way; cards flip to show the fallacy | Scores a joker argument you write yourself |
| Het Park | Healthy | Ontsnap uit de app | Switch off five tricks in a fake app's settings within 60 s while pop-ups lure you back | Writes the lure pop-ups |
| Politiebureau | Safe | Nep of echt | Swipe notifications on a lock screen with a streak multiplier; harder messages at higher levels | Writes extra fake messages within fixed templates |
| Stadhuis | Active | Pitch in de raad | Pitch your idea in the council chamber; vote lamps light up per member | Council members ask about your idea and vote on your answer |
| Centrale Bibliotheek | Chances | Jij bent het algoritme | Set sliders and watch applicants re-sort live; then repair a biased model by switching data off and retraining live | A real logistic regression trains in the browser (no language model needed) |

Every game also works without AI, with fixed content in place of the AI part.

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

## Citiverse GO artwork

The logo, the ten theme buddies, theme icons, GO stamps, stars and backgrounds in `img/dcr/` come from Digital Child Rights (Drive folder "Citiverse GO"), cropped and resized. `js/brand.js` maps each stop's theme to its buddy, icon, stamp and gradient colours. Each stop shows its buddy next to the pin and in the stop panel; a collected stop gets its theme's GO stamp; badges use the stars.

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
