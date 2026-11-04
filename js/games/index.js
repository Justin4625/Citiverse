// Every playable minigame, by the `game` id used in js/stops.js.
// A minigame is a module with mount(element, { character, difficulty, onSite, onFinish }) that
// calls onFinish({ correct, total, summary? }) when done and returns a cleanup function.

import { mount as spoorloos } from './spoorloos.js';
import { mount as koopjesjacht } from './koopjesjacht.js';
import { mount as moderator } from './moderator.js';
import { mount as overDeBrug } from './overDeBrug.js';
import { mount as kruisverhoor } from './kruisverhoor.js';
import { mount as overtuigDeStad } from './overtuigDeStad.js';
import { mount as ontsnapUitDeApp } from './ontsnapUitDeApp.js';
import { mount as nepOfEcht } from './nepOfEcht.js';
import { mount as pitchInDeRaad } from './pitchInDeRaad.js';
import { mount as algoritme } from './algoritme.js';

export const GAMES = {
  spoorloos,
  koopjesjacht,
  moderator,
  'over-de-brug': overDeBrug,
  kruisverhoor,
  'overtuig-de-stad': overtuigDeStad,
  'ontsnap-uit-de-app': ontsnapUitDeApp,
  'nep-of-echt': nepOfEcht,
  'pitch-in-de-raad': pitchInDeRaad,
  algoritme,
};
