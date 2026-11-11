// What happens at each stop: the character, their facts, their digital problem and the reward.
// The AI character only answers from `facts`, so everything it may say lives here.
// All facts still need checking (e.g. via data.rotterdam.nl) before a playtest.
//
// `game` is the id of a minigame in js/games/index.js. `card` describes it; a stop whose game
// is not registered shows the card instead and still gives a stamp.

export const STOPS = {
  centraal: {
    theme: 'Privacy',
    character: { name: 'Privy', role: 'stationsmedewerker' },
    intro: 'Hoi, ik ben Privy! Ik werk hier op Rotterdam Centraal. Elke dag lopen hier duizenden mensen langs. En bijna iedereen laat sporen achter zonder het te merken.',
    problem: 'Vandaag vroeg een reiziger: "Wie weet eigenlijk waar ik allemaal ben geweest?" Ik wist het zelf niet precies. Zoek jij het met me uit?',
    facts: [
      'Het huidige stationsgebouw van Rotterdam Centraal is in 2014 geopend.',
      'Het grote dak boven de sporen ligt vol zonnepanelen.',
      'Onder het Stationsplein ligt een grote fietsenstalling met plek voor duizenden fietsen.',
      'Als je incheckt met een persoonlijke OV-chipkaart, wordt je reis aan jouw naam gekoppeld.',
      'Op het station hangen camera\'s voor de veiligheid.',
      'Als je inlogt op openbare wifi, kan de aanbieder zien welk apparaat je gebruikt.',
    ],
    secret: 'Het dak boven de sporen ligt vol zonnepanelen. Die maken een flink deel van de stroom die het station zelf gebruikt.',
    game: 'spoorloos',
    card: {
      title: 'Spoorloos',
      text: 'Loop door het station naar je trein. Je hebt maar een beperkt aantal stappen. Kies je de snelle weg, dan laat je sporen achter. De privé weg kost meer stappen.',
    },
  },

  markthal: {
    theme: 'Fair',
    character: { name: 'Fairy', role: 'kraamhouder' },
    intro: 'Hoi, ik ben Fairy! Ik heb een kraam hier in de Markthal. Ik verkoop ook online, en daar gaat het niet altijd eerlijk.',
    problem: 'Mijn klanten trappen in nepkortingen van andere webshops. Kun jij laten zien hoe je die trucs doorhebt?',
    facts: [
      'De Markthal is in 2014 geopend.',
      'Het grote kunstwerk aan het plafond heet de Hoorn des Overvloeds en is gemaakt door Arno Coenen.',
      'In de boog van de Markthal zitten woningen.',
      'Een nepkorting is een korting op een prijs die nooit echt gevraagd werd.',
      'Een dark pattern is een ontwerptruc die je iets laat doen wat je eigenlijk niet wilt, zoals een afteltimer die je haast.',
      'Bij een eerlijke webshop zie je alle kosten voordat je betaalt.',
    ],
    secret: 'Kijk eens goed naar het plafond. Tussen het fruit en de groente zitten ook bloemen en insecten verstopt. Bijna niemand ziet ze.',
    game: 'koopjesjacht',
    card: {
      title: 'Koopjesjacht',
      text: 'Je hebt €20 en een boodschappenlijstje. Bij elke kraam kies je uit twee aanbiedingen. Pas daarna zie je wat ze echt kosten.',
    },
  },

  kubuswoningen: {
    theme: 'Freedom',
    character: { name: 'Freely', role: 'bewoner en kunstenaar' },
    intro: 'Hé, ik ben Freely. Ik woon in zo\'n scheve kubus en ik maak hier kunst. Piet Blom durfde anders te bouwen. Zo wil ik online ook gewoon mezelf kunnen zijn.',
    problem: 'Onder mijn kunst komen reacties. Bij sommige weet ik niet of dat wel mag. Wanneer is het gewoon je mening, en wanneer ga je te ver?',
    facts: [
      'De Kubuswoningen zijn ontworpen door architect Piet Blom.',
      'Ze zijn in 1984 opgeleverd.',
      'Piet Blom zag elke kubus als een boom, en alle kubussen samen als een bos.',
      'Eén kubus is ingericht als museum, de Kijk-Kubus, zodat je kunt zien hoe je in een kubus woont.',
      'Vrijheid van meningsuiting betekent dat je je mening mag geven, maar niet dat alles mag: bedreigen en discrimineren mag niet.',
    ],
    secret: 'De muren van een kubus staan zo scheef dat je een kast niet zomaar tegen de muur zet. Ook bij het inrichten moet je hier anders denken.',
    game: 'moderator',
    card: {
      title: 'Moderator',
      text: 'Onder de kunst van Freely komen reacties. Jij kiest: laten staan of weghalen. Iedereen mag zijn mening geven, maar niemand mag zich onveilig voelen.',
    },
  },

  erasmusbrug: {
    theme: 'Everybody',
    character: { name: 'Every', role: 'brugwachter' },
    intro: 'Hoi, ik ben Every. Ik let op de Erasmusbrug. Deze brug verbindt Noord en Zuid. Online moet ook iedereen mee kunnen doen, vind ik.',
    problem: 'De brug gaat even dicht en we moeten iedereen een bericht sturen. Maar niet iedereen kan dat goed lezen. Help jij om het voor iedereen duidelijk te maken?',
    facts: [
      'De Erasmusbrug is in 1996 geopend.',
      'Rotterdammers noemen de brug ook wel De Zwaan.',
      'De brug is ontworpen door Ben van Berkel.',
      'Een deel van de brug kan open, zodat hoge schepen erdoor kunnen.',
      'Een toegankelijk bericht is ook te begrijpen voor mensen die slechtziend zijn, de taal nog leren of geen mobiele data hebben.',
    ],
    secret: 'De schuine paal van de brug is 139 meter hoog. Door die vorm herken je de brug al van heel ver.',
    game: 'over-de-brug',
    card: {
      title: 'Iedereen over de brug',
      text: 'De brug gaat dicht. Schrijf het bericht zo dat drie heel verschillende Rotterdammers het snappen.',
    },
  },

  rechtbank: {
    theme: 'Rules',
    character: { name: 'Ruly', role: 'griffier' },
    intro: 'Hoi, ik ben Ruly. Ik ben griffier bij de rechtbank: ik schrijf op wat er in een rechtszaak gebeurt. Hier wordt beslist wat wel en niet mag.',
    problem: 'Er ligt een zaak op mijn bureau. Iemand heeft een foto van een jongere online gezet zonder het te vragen. Wie heeft er gelijk?',
    facts: [
      'De rechtbank Rotterdam staat aan het Wilhelminaplein op de Kop van Zuid.',
      'Een griffier helpt de rechter en schrijft op wat er tijdens een zitting gebeurt.',
      'In Nederland heb je tot je 16e toestemming van je ouders nodig als een app of website je persoonsgegevens wil gebruiken.',
      'Je hebt portretrecht: iemand mag een herkenbare foto van jou niet zomaar publiceren als je daar een redelijk belang tegen hebt.',
      'Je kunt een website of platform vragen een foto van jou te verwijderen.',
    ],
    secret: 'Veel rechtszaken zijn openbaar. Je mag dus gewoon gaan kijken. Zo kan iedereen zien dat het eerlijk gaat.',
    game: 'kruisverhoor',
    card: {
      title: 'Kruisverhoor',
      text: 'Een foto is gedeeld zonder toestemming. Stel de getuigen vier vragen. Daarna beslis jij wie er gelijk heeft.',
    },
  },

  euromast: {
    theme: 'Opinion',
    character: { name: 'Opiny', role: 'gids' },
    intro: 'Hoi, ik ben Opiny, gids bij de Euromast. Van hierboven zie je de hele stad. Ik wil dat jongeren ook zo\'n overzicht krijgen, en dat er naar hun mening geluisterd wordt.',
    problem: 'De stad moet een keuze maken, en er zijn twee kanten. Wat vind jij? En waarom?',
    facts: [
      'De Euromast is gebouwd voor de Floriade van 1960.',
      'Later is er een Space Tower bovenop gezet, waardoor de toren hoger werd.',
      'De Euromast is ongeveer 185 meter hoog.',
      'Je mening mag je altijd geven, en het helpt als je uitlegt waarom je iets vindt.',
      'Jongeren kunnen in Rotterdam meepraten over plannen voor de stad.',
    ],
    secret: 'Je kunt vanaf de Euromast naar beneden abseilen. Durf jij dat?',
    game: 'overtuig-de-stad',
    card: {
      title: 'Overtuig de stad',
      text: 'Kies een kant en ga de discussie aan met Opiny. Hoe beter je argumenten, hoe hoger de lift van de Euromast gaat.',
    },
  },

  hetpark: {
    theme: 'Healthy',
    character: { name: 'Healy', role: 'hardloopcoach' },
    intro: 'Hoi, ik ben Healy, hardloopcoach. Ik train hier in Het Park. Buiten bewegen is goed voor je. Maar veel apps doen er alles aan om je binnen op je scherm te houden.',
    problem: 'Een app op mijn telefoon blijft me maar meldingen sturen. Zie jij met welke trucs hij me vasthoudt?',
    facts: [
      'Het Park ligt naast de Euromast.',
      'Het Park is in de negentiende eeuw aangelegd.',
      'Streaks, autoplay en meldingen zijn trucs om je zo lang mogelijk in een app te houden.',
      'Je kunt meldingen en autoplay bij de meeste apps zelf uitzetten.',
    ],
    secret: 'Vroeger was Het Park vooral voor rijke Rotterdammers. Nu mag iedereen er komen.',
    game: 'ontsnap-uit-de-app',
    card: {
      title: 'Ontsnap uit de app',
      text: 'Een app wil je zo lang mogelijk vasthouden. Zet de vijf trucs uit. En trap niet in de lokberichten.',
    },
  },

  politiebureau: {
    theme: 'Safe',
    character: { name: 'Safy', role: 'wijkagent' },
    intro: 'Hoi, ik ben Safy, wijkagent in het centrum. We krijgen steeds meer meldingen van jongeren die online zijn opgelicht.',
    problem: 'Er komen berichten binnen bij de meldkamer. Ik moet snel weten welke nep zijn. Help jij me?',
    facts: [
      'Bij gevaar bel je 112. Voor andere zaken kun je de politie bellen op 0900-8844.',
      'Je kunt online oplichting melden bij de politie.',
      'Een bank vraagt nooit om je pincode, wachtwoord of inlogcode via sms, mail of WhatsApp.',
      'Bij een vriend-in-nood-oplichting doet iemand zich voor als een bekende met een nieuw nummer en vraagt om geld.',
      'Een verificatiecode deel je nooit met iemand anders, ook niet met een vriend.',
      'Twijfel je over een bericht? Bel de afzender via een nummer dat je zelf opzoekt.',
    ],
    secret: 'Het beste wapen tegen oplichters is niet de politie. Het is even wachten voordat je iets doet. Oplichters willen dat je je haast, want als je nadenkt, trap je er niet in.',
    game: 'nep-of-echt',
    card: {
      title: 'Nep of echt?',
      text: 'De AI maakt nepberichten die echt lijken. Jij moet ze eruit pikken. Safy legt uit waar je ze aan herkent.',
    },
  },

  stadhuis: {
    theme: 'Active',
    character: { name: 'Acty', role: 'raadslid' },
    intro: 'Hoi, ik ben Acty! Ik zit in de gemeenteraad. Hier in het Stadhuis beslissen we hoe Rotterdam eruitziet.',
    problem: 'Alleen komen er bijna nooit jongeren met ideeën. Wat zou jij anders doen in je buurt?',
    facts: [
      'Het Stadhuis aan de Coolsingel is gebouwd tussen 1914 en 1920.',
      'Het Stadhuis heeft het bombardement van 14 mei 1940 overleefd.',
      'De gemeenteraad van Rotterdam heeft 45 leden.',
      'Iedereen mag een gemeenteraadsvergadering bijwonen.',
    ],
    secret: 'In 1940 werd bijna het hele centrum platgebombardeerd. Het Stadhuis bleef gewoon staan. Daarom is het een van de weinige oude gebouwen die je hier nog ziet.',
    game: 'pitch-in-de-raad',
    card: {
      title: 'Pitch in de raad',
      text: 'Bedenk een plan voor je buurt. Drie raadsleden stemmen erover. Krijg er twee mee.',
    },
  },

  bibliotheek: {
    theme: 'Chances',
    character: { name: 'Chancy', role: 'bibliothecaris' },
    intro: 'Hoi, ik ben Chancy. Ik werk hier in de bieb. Iedereen mag hier gratis internetten, op een computer werken en hulp vragen. Zo krijgt iedereen een kans.',
    problem: 'Steeds meer bedrijven laten een computer kiezen wie ze uitnodigen voor een sollicitatie. Maar is dat wel eerlijk?',
    facts: [
      'De Centrale Bibliotheek is in 1983 geopend.',
      'Je herkent het gebouw aan de gele buizen aan de buitenkant.',
      'In de bibliotheek kun je gratis internet en computers gebruiken.',
      'Een selectie-algoritme leert van oude keuzes. Als die oude keuzes oneerlijk waren, neemt het algoritme dat over.',
    ],
    secret: 'Die gele buizen aan de buitenkant zijn niet alleen voor de sier. Er gaat lucht doorheen. Het gebouw heeft zijn techniek gewoon aan de buitenkant hangen.',
    game: 'algoritme',
    card: {
      title: 'Jij bent het algoritme',
      text: 'Een computer kiest wie een bijbaantje in de bieb krijgt. Zoek uit waarom hij oneerlijk kiest, en of je dat kunt oplossen.',
    },
  },
};
