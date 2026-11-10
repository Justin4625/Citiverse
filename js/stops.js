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
    intro: 'Hoi! Ik ben Privy, ik werk hier op Rotterdam Centraal. Elke dag lopen hier enorm veel mensen doorheen, en bijna iedereen laat sporen achter zonder het door te hebben.',
    problem: 'Een reiziger vroeg me vandaag: "Wie weet eigenlijk allemaal waar ik ben geweest?" Ik wist het zelf niet goed. Help jij me?',
    facts: [
      'Het huidige stationsgebouw van Rotterdam Centraal is in 2014 geopend.',
      'Het grote dak boven de sporen ligt vol zonnepanelen.',
      'Onder het Stationsplein ligt een grote fietsenstalling met plek voor duizenden fietsen.',
      'Als je incheckt met een persoonlijke OV-chipkaart, wordt je reis aan jouw naam gekoppeld.',
      'Op het station hangen camera\'s voor de veiligheid.',
      'Als je inlogt op openbare wifi, kan de aanbieder zien welk apparaat je gebruikt.',
    ],
    secret: 'Wist je dat het dak van het station zo veel zonnepanelen heeft dat het een flink deel van de stroom voor het station zelf opwekt? Zelfs het dak doet hier mee.',
    game: 'spoorloos',
    card: {
      title: 'Spoorloos',
      text: 'Je hebt 8 minuten tot je trein vertrekt. Bij elke stap kies je: snel maar met sporen, of privé maar langzamer. Daarna vertelt Privy wat er over je bekend is.',
    },
  },

  markthal: {
    theme: 'Fair',
    character: { name: 'Fairy', role: 'kraamhouder' },
    intro: 'Welkom in de Markthal! Ik ben Fairy en ik heb hier een kraam. Ik verkoop ook online, en daar gaat het er soms minder eerlijk aan toe dan op de markt.',
    problem: 'Mijn klanten trappen in nepkortingen van andere webshops. Kun jij laten zien hoe je die trucs herkent?',
    facts: [
      'De Markthal is in 2014 geopend.',
      'Het grote kunstwerk aan het plafond heet de Hoorn des Overvloeds en is gemaakt door Arno Coenen.',
      'In de boog van de Markthal zitten woningen.',
      'Een nepkorting is een korting op een prijs die nooit echt gevraagd werd.',
      'Een dark pattern is een ontwerptruc die je iets laat doen wat je eigenlijk niet wilt, zoals een afteltimer die je haast.',
      'Bij een eerlijke webshop zie je alle kosten voordat je betaalt.',
    ],
    secret: 'Kijk eens goed omhoog: in het plafondkunstwerk zijn ook bloemen en insecten verstopt. De meeste mensen lopen er gewoon onderdoor zonder ze te zien.',
    game: 'koopjesjacht',
    card: {
      title: 'Koopjesjacht',
      text: 'Je hebt €20 en een boodschappenlijst. Bij elke kraam kies je tussen twee aanbiedingen, en pas daarna zie je wat ze echt kosten.',
    },
  },

  kubuswoningen: {
    theme: 'Freedom',
    character: { name: 'Freely', role: 'bewoner en kunstenaar' },
    intro: 'Hé, ik ben Freely. Ik woon in een van deze scheve kubussen en maak hier kunst. Piet Blom durfde anders te bouwen, en ik vind dat je online ook jezelf moet kunnen zijn.',
    problem: 'Onder mijn kunst verschijnen reacties waarvan ik niet weet of ze mogen. Wat valt onder vrije meningsuiting, en wanneer gaat het over de grens?',
    facts: [
      'De Kubuswoningen zijn ontworpen door architect Piet Blom.',
      'Ze zijn in 1984 opgeleverd.',
      'Piet Blom zag elke kubus als een boom, en alle kubussen samen als een bos.',
      'Eén kubus is ingericht als museum, de Kijk-Kubus, zodat je kunt zien hoe je in een kubus woont.',
      'Vrijheid van meningsuiting betekent dat je je mening mag geven, maar niet dat alles mag: bedreigen en discrimineren mag niet.',
    ],
    secret: 'De muren in een kubus staan zo scheef dat je veel meubels niet tegen de muur kunt zetten. Bewoners moeten dus ook bij het inrichten anders durven denken.',
    game: 'moderator',
    card: {
      title: 'Moderator',
      text: 'Freely krijgt reacties onder zijn kunst. Jij beslist: laten staan of weghalen. Houd vrijheid én veiligheid in balans.',
    },
  },

  erasmusbrug: {
    theme: 'Everybody',
    character: { name: 'Every', role: 'brugwachter' },
    intro: 'Ik ben Every en ik let op de Erasmusbrug. Deze brug verbindt Noord en Zuid, en ik vind dat online ook iedereen moet kunnen meedoen.',
    problem: 'We moeten een bericht sturen dat de brug even dicht gaat, maar niet iedereen kan dat goed lezen of ontvangen. Help jij het bericht voor iedereen te maken?',
    facts: [
      'De Erasmusbrug is in 1996 geopend.',
      'Rotterdammers noemen de brug ook wel De Zwaan.',
      'De brug is ontworpen door Ben van Berkel.',
      'Een deel van de brug kan open, zodat hoge schepen erdoor kunnen.',
      'Een toegankelijk bericht is ook te begrijpen voor mensen die slechtziend zijn, de taal nog leren of geen mobiele data hebben.',
    ],
    secret: 'Kijk naar de schuine pyloon: die is 139 meter hoog. Door die vorm herkent iedereen de brug meteen, zelfs van heel ver weg.',
    game: 'over-de-brug',
    card: {
      title: 'Iedereen over de brug',
      text: 'De brug gaat dicht. Herschrijf het bericht zo dat drie heel verschillende Rotterdammers het snappen.',
    },
  },

  rechtbank: {
    theme: 'Rules',
    character: { name: 'Ruly', role: 'griffier' },
    intro: 'Goedendag, ik ben Ruly, griffier bij de rechtbank. Ik schrijf op wat er in een rechtszaak gebeurt. Hier wordt beslist wat wel en niet mag.',
    problem: 'Er ligt een zaak op mijn bureau: een foto van een jongere is zonder toestemming online gezet. Wie heeft er gelijk?',
    facts: [
      'De rechtbank Rotterdam staat aan het Wilhelminaplein op de Kop van Zuid.',
      'Een griffier helpt de rechter en schrijft op wat er tijdens een zitting gebeurt.',
      'In Nederland heb je tot je 16e toestemming van je ouders nodig als een app of website je persoonsgegevens wil gebruiken.',
      'Je hebt portretrecht: iemand mag een herkenbare foto van jou niet zomaar publiceren als je daar een redelijk belang tegen hebt.',
      'Je kunt een website of platform vragen een foto van jou te verwijderen.',
    ],
    secret: 'Veel rechtszaken zijn openbaar. Dat betekent dat je als bezoeker mag gaan kijken, zodat iedereen kan zien dat het eerlijk gaat.',
    game: 'kruisverhoor',
    card: {
      title: 'Kruisverhoor',
      text: 'Een foto is zonder toestemming gedeeld. Stel vier vragen aan de getuigen en doe dan uitspraak.',
    },
  },

  euromast: {
    theme: 'Opinion',
    character: { name: 'Opiny', role: 'gids' },
    intro: 'Hoi, ik ben Opiny, gids bij de Euromast. Van bovenaf zie je de hele stad. Zo wil ik ook dat jongeren overzicht krijgen, en dat hun mening meetelt.',
    problem: 'De stad moet een keuze maken, en er zijn twee kanten. Ik wil weten wat jij ervan vindt, en waarom.',
    facts: [
      'De Euromast is gebouwd voor de Floriade van 1960.',
      'Later is er een Space Tower bovenop gezet, waardoor de toren hoger werd.',
      'De Euromast is ongeveer 185 meter hoog.',
      'Je mening mag je altijd geven, en het helpt als je uitlegt waarom je iets vindt.',
      'Jongeren kunnen in Rotterdam meepraten over plannen voor de stad.',
    ],
    secret: 'Bij de Euromast kun je naar beneden abseilen. Durf jij dat?',
    game: 'overtuig-de-stad',
    card: {
      title: 'Overtuig de stad',
      text: 'Kies een kant en ga in debat met Opiny. Hoe sterker je argumenten, hoe hoger de lift van de Euromast gaat.',
    },
  },

  hetpark: {
    theme: 'Healthy',
    character: { name: 'Healy', role: 'hardloopcoach' },
    intro: 'Hallo, ik ben Healy, hardloopcoach. Ik train hier in Het Park. Buiten bewegen is goed voor je, maar veel apps doen er alles aan om je binnen op je scherm te houden.',
    problem: 'Een app op mijn telefoon blijft me maar meldingen sturen. Help jij me de trucs te herkennen die me vasthouden?',
    facts: [
      'Het Park ligt naast de Euromast.',
      'Het Park is in de negentiende eeuw aangelegd.',
      'Streaks, autoplay en meldingen zijn trucs om je zo lang mogelijk in een app te houden.',
      'Je kunt meldingen en autoplay bij de meeste apps zelf uitzetten.',
    ],
    secret: 'Het Park was vroeger bedoeld als wandelpark voor rijke Rotterdammers. Nu is het van iedereen.',
    game: 'ontsnap-uit-de-app',
    card: {
      title: 'Ontsnap uit de app',
      text: 'Een app wil je zo lang mogelijk vasthouden. Zet binnen een minuut de vijf trucs uit, en trap niet in de lokberichten.',
    },
  },

  politiebureau: {
    theme: 'Safe',
    character: { name: 'Safy', role: 'wijkagent' },
    intro: 'Hoi, ik ben Safy, wijkagent in het centrum. Steeds vaker krijgen we meldingen van jongeren die online zijn opgelicht.',
    problem: 'Er komen berichten binnen bij de meldkamer, en ik moet snel weten welke nep zijn. Help jij me ze te ontmaskeren?',
    facts: [
      'Bij gevaar bel je 112. Voor andere zaken kun je de politie bellen op 0900-8844.',
      'Je kunt online oplichting melden bij de politie.',
      'Een bank vraagt nooit om je pincode, wachtwoord of inlogcode via sms, mail of WhatsApp.',
      'Bij een vriend-in-nood-oplichting doet iemand zich voor als een bekende met een nieuw nummer en vraagt om geld.',
      'Een verificatiecode deel je nooit met iemand anders, ook niet met een vriend.',
      'Twijfel je over een bericht? Bel de afzender via een nummer dat je zelf opzoekt.',
    ],
    secret: 'Het belangrijkste wapen tegen oplichters is niet de politie, maar even pauzeren. Oplichters maken je altijd haastig, want als je nadenkt, val je niet voor ze.',
    game: 'nep-of-echt',
    card: {
      title: 'Nep of echt?',
      text: 'De AI maakt realistische nepberichten binnen vaste sjablonen. Jij ontmaskert ze, en Safy legt uit waaraan je ze herkent.',
    },
  },

  stadhuis: {
    theme: 'Active',
    character: { name: 'Acty', role: 'raadslid' },
    intro: 'Welkom bij het Stadhuis! Ik ben Acty, gemeenteraadslid. Hier beslissen we over de stad, en ik wil dat jongeren meepraten.',
    problem: 'Ik hoor te weinig ideeën van jongeren. Wat zou jij in Rotterdam verbeteren?',
    facts: [
      'Het Stadhuis aan de Coolsingel is gebouwd tussen 1914 en 1920.',
      'Het Stadhuis heeft het bombardement van 14 mei 1940 overleefd.',
      'De gemeenteraad van Rotterdam heeft 45 leden.',
      'Iedereen mag een gemeenteraadsvergadering bijwonen.',
    ],
    secret: 'Tijdens het bombardement van 1940 bleef het Stadhuis staan terwijl veel van het centrum verwoest werd. Daarom is het een van de weinige oude gebouwen in de binnenstad.',
    game: 'pitch-in-de-raad',
    card: {
      title: 'Pitch in de raad',
      text: 'Bedenk een idee voor je wijk en overtuig drie raadsleden. Je hebt er twee nodig.',
    },
  },

  bibliotheek: {
    theme: 'Chances',
    character: { name: 'Chancy', role: 'bibliothecaris' },
    intro: 'Hoi, ik ben Chancy, bibliothecaris. Hier kan iedereen gratis internet gebruiken, achter een computer zitten en hulp krijgen. Zo krijgt iedereen kansen.',
    problem: 'Steeds meer bedrijven laten een computer kiezen wie er op gesprek mag. Maar is dat wel eerlijk?',
    facts: [
      'De Centrale Bibliotheek is in 1983 geopend.',
      'Je herkent het gebouw aan de gele buizen aan de buitenkant.',
      'In de bibliotheek kun je gratis internet en computers gebruiken.',
      'Een selectie-algoritme leert van oude keuzes. Als die oude keuzes oneerlijk waren, neemt het algoritme dat over.',
    ],
    secret: 'Die gele buizen aan de buitenkant zijn niet alleen versiering: ze voeren lucht aan en af. Het gebouw draagt zijn techniek gewoon aan de buitenkant.',
    game: 'algoritme',
    card: {
      title: 'Jij bent het algoritme',
      text: 'Een computer kiest wie een bijbaan in de bieb krijgt. Ontdek waarom hij oneerlijk kiest, en of je dat kunt repareren.',
    },
  },
};
