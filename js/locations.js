// Stamp locations. Coordinates are approximate — double-check them on site.
export const RADIUS_M = 80;

// photo: img/<id>.jpg from Wikimedia Commons. focus: CSS object-position that keeps the landmark
// in view when the photo is cropped to a circle. landmark: [lat, lng] inside the stop's own
// building on the 3D Rotterdam map, which map.js paints in the theme colour. ground: for a bridge
// or a park, points on its deck ('deck') or its grass ('green'); those shapes get the tint instead.
// credit: required by the CC BY-SA licences.
export const LOCATIONS = [
  {
    id: 'centraal', name: 'Rotterdam Centraal', area: 'Stationsplein', lat: 51.9233, lng: 4.4695, focus: '70% 40%', landmark: [51.9246, 4.4688],
    credit: { author: 'Hein56didden', license: 'CC BY-SA 3.0', url: 'https://commons.wikimedia.org/wiki/File:Centraal_Station_Rotterdam.jpg' },
  },
  {
    id: 'markthal', name: 'Markthal', area: 'Blaak', lat: 51.9200, lng: 4.4866, focus: '50% 55%', landmark: [51.9200, 4.4866],
    credit: { author: 'DaHuzyBru', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:Markthal,_Rotterdam,_September_2024_05.jpg' },
  },
  {
    id: 'kubuswoningen', name: 'Kubuswoningen', area: 'Overblaak', lat: 51.9203, lng: 4.4904, focus: '40% 45%', landmark: [51.9203, 4.4904],
    credit: { author: 'Choinowski', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:Kubuswoningen_Rotterdam_in_2017.jpg' },
  },
  {
    id: 'erasmusbrug', name: 'Erasmusbrug', area: 'Nieuwe Maas', lat: 51.9093, lng: 4.4868, focus: '58% 40%',
    ground: { on: 'deck', at: [[51.9112, 4.4829], [51.9096, 4.4862], [51.9080, 4.4895]] },
    credit: { author: 'Michielverbeek', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:Rotterdam,_de_Erasmusbrug_vanaf_de_Holland-Amerikakade_IMG_1164_2022-04-17_19.32.jpg' },
  },
  {
    id: 'rechtbank', name: 'Rechtbank', area: 'Kop van Zuid', lat: 51.9074, lng: 4.4922, focus: '45% 50%', landmark: [51.90748, 4.49229],
    credit: { author: 'Marcel Douwe Dekker', license: 'CC BY-SA 2.0', url: 'https://commons.wikimedia.org/wiki/File:2025_Gerechtsgebouw_Rechtbank_Rotterdam_aan_Wilhelminaplein,_Rotterdam.jpg' },
  },
  {
    id: 'euromast', name: 'Euromast', area: 'Het Park', lat: 51.9054, lng: 4.4666, focus: '45% 45%', landmark: [51.9054, 4.4666],
    credit: { author: 'W. Bulach', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:.00_2435_Euromast_-_Rotterdam.jpg' },
  },
  {
    id: 'hetpark', name: 'Het Park', area: 'Parkhaven', lat: 51.9062, lng: 4.4704, focus: '50% 55%',
    ground: { on: 'green', at: [[51.9062, 4.4704], [51.9045, 4.4690], [51.9075, 4.4722], [51.9040, 4.4725]] },
    credit: { author: 'Jan Geerling', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:1604_Het_Park,_Rotterdam_039.jpg' },
  },
  {
    id: 'politiebureau', name: 'Politiebureau', area: 'Doelwater', lat: 51.9235, lng: 4.4797, focus: '45% 40%', landmark: [51.92375, 4.48005],
    credit: { author: 'Jan Geerling', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:1503_Politiebureau_Doelwater,_Rotterdam_128.jpg' },
  },
  {
    id: 'stadhuis', name: 'Stadhuis', area: 'Coolsingel', lat: 51.9222, lng: 4.4786, focus: '50% 40%', landmark: [51.92265, 4.47956],
    credit: { author: 'Ttzavaras', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:Rotterdam_stadhuis_2015.JPG' },
  },
  {
    id: 'bibliotheek', name: 'Centrale Bibliotheek', area: 'Binnenrotte', lat: 51.92115, lng: 4.4891, focus: '40% 50%', landmark: [51.92115, 4.4891],
    credit: { author: 'Frans Berkelaar', license: 'CC BY-SA 2.0', url: 'https://commons.wikimedia.org/wiki/File:Centrale_bibliotheek_van_Rotterdam_en_Blaaktoren_-_City_of_Rotterdam_(21999005883).jpg' },
  },
];

export const photoUrl = (loc) => `img/${loc.id}.jpg`;
