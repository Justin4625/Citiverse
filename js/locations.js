// Stamp locations. Coordinates are approximate — double-check them on site.
export const RADIUS_M = 60;

// photo: img/<id>.jpg from Wikimedia Commons. focus: CSS object-position that keeps the landmark
// in view when the photo is cropped to a circle. credit: required by the CC BY-SA licences.
export const LOCATIONS = [
  {
    id: 'centraal', name: 'Rotterdam Centraal', area: 'Stationsplein', lat: 51.9233, lng: 4.4695, focus: '70% 40%',
    credit: { author: 'Hein56didden', license: 'CC BY-SA 3.0', url: 'https://commons.wikimedia.org/wiki/File:Centraal_Station_Rotterdam.jpg' },
  },
  {
    id: 'markthal', name: 'Markthal', area: 'Blaak', lat: 51.9200, lng: 4.4866, focus: '50% 55%',
    credit: { author: 'DaHuzyBru', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:Markthal,_Rotterdam,_September_2024_05.jpg' },
  },
  {
    id: 'kubuswoningen', name: 'Kubuswoningen', area: 'Overblaak', lat: 51.9203, lng: 4.4904, focus: '40% 45%',
    credit: { author: 'Choinowski', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:Kubuswoningen_Rotterdam_in_2017.jpg' },
  },
  {
    id: 'erasmusbrug', name: 'Erasmusbrug', area: 'Nieuwe Maas', lat: 51.9093, lng: 4.4868, focus: '58% 40%',
    credit: { author: 'Michielverbeek', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:Rotterdam,_de_Erasmusbrug_vanaf_de_Holland-Amerikakade_IMG_1164_2022-04-17_19.32.jpg' },
  },
  {
    id: 'euromast', name: 'Euromast', area: 'Het Park', lat: 51.9054, lng: 4.4666, focus: '45% 45%',
    credit: { author: 'W. Bulach', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:.00_2435_Euromast_-_Rotterdam.jpg' },
  },
];

export const photoUrl = (loc) => `img/${loc.id}.jpg`;
