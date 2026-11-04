# Citiverse

Location-based stamp rally in Rotterdam (Minor DA, Groep D). Walk to a real place and collect a digital stamp there.

Plain HTML/CSS/JS (ES modules), no build step. Map: MapLibre GL on OpenFreeMap tiles.

- Live: https://justin4625.github.io/Citiverse/
- Test mode: tap **Test** (or add `?debug`) to turn GPS off; tap the map to walk, tap a far stop to teleport, **Reset** clears all stamps.
- Run locally: `python3 -m http.server 8000` → http://localhost:8000/?debug

## Stops, characters and minigames

Tapping **Help <naam>** at a stop opens the stop panel (`js/stop.js`): the character introduces themselves and their digital problem, you can ask them questions, play the minigame, and hear their secret. **Stempel pakken** then closes the panel and shows the usual stamp.

- Characters, facts, problems, secrets and minigame descriptions for all 10 themes live in `js/stops.js`. The facts still need checking before a playtest. A location without an entry there keeps the old one-tap stamp.
- Playable: **Nep of echt?** at the Politiebureau (`js/games/nepOfEcht.js`, messages in `nepOfEchtContent.js`). Other stops show a card describing their minigame.
- A minigame is a module with `mount(element, { onFinish, character })` that calls `onFinish({ score, correct, total })` and returns a cleanup function. Register it in `GAMES` in `js/stop.js`.

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
