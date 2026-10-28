# Citiverse

Location-based stamp rally in Rotterdam (Minor DA, Groep D). Walk to a real place and collect a digital stamp there.

Plain HTML/CSS/JS (ES modules), no build step. Map: MapLibre GL on OpenFreeMap tiles.

- Live: https://justin4625.github.io/Citiverse/
- Test mode: tap **Test** (or add `?debug`) to turn GPS off; tap the map to walk, tap a far stop to teleport, **Reset** clears all stamps.
- Run locally: `python3 -m http.server 8000` → http://localhost:8000/?debug

## Photo credits

Stop photos come from Wikimedia Commons (cropped and resized), see `credit` in `js/locations.js` and the "Photo credits" section in the stamp book:

- Rotterdam Centraal: Hein56didden, CC BY-SA 3.0
- Markthal: DaHuzyBru, CC BY-SA 4.0
- Kubuswoningen: Choinowski, CC BY-SA 4.0
- Erasmusbrug: Michielverbeek, CC BY-SA 4.0
- Euromast: W. Bulach, CC BY-SA 4.0
