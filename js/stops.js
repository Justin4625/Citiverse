// What happens at each stop: the character, their facts, their digital problem and the reward.
// The AI character only answers from `facts`, so everything it may say lives here.
// All facts still need checking (e.g. via data.rotterdam.nl) before a playtest.
//
// `game` is the id of a playable minigame in js/games/, or null. Stops without a game
// show `card` (the minigame description) and still give a stamp.

export const STOPS = {
  centraal: {
    theme: 'Privacy',
    character: { name: 'Mo', role: 'stationsmedewerker' },
    intro: 'Hoi! Ik ben Mo, ik werk hier op Rotterdam Centraal. Elke dag lopen hier enorm veel mensen doorheen, en bijna iedereen laat sporen achter zonder het door te hebben.',
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
    game: null,
    card: {
      title: 'Datasporen',
      text: 'Volg een verzonnen reiziger door het station. Welke systemen weten wat van hem: OV-chip, camera\'s, wifi en apps? Jij kiest wat hij had kunnen afschermen, en Mo vertelt wat er met elk spoor kan.',
    },
  },

  markthal: {
    theme: 'Fair',
    character: { name: 'Yasmina', role: 'kraamhouder' },
    intro: 'Welkom in de Markthal! Ik ben Yasmina en ik heb hier een kraam. Ik verkoop ook online, en daar gaat het er soms minder eerlijk aan toe dan op de markt.',
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
    game: null,
    card: {
      title: 'Eerlijk of oplichterij?',
      text: 'De AI maakt webshopacties en reclames binnen vaste sjablonen. Jij spot de nepkorting, de verborgen kosten en de dark patterns.',
    },
  },

  kubuswoningen: {
    theme: 'Freedom',
    character: { name: 'Daan', role: 'bewoner en kunstenaar' },
    intro: 'Hé, ik ben Daan. Ik woon in een van deze scheve kubussen en maak hier kunst. Piet Blom durfde anders te bouwen, en ik vind dat je online ook jezelf moet kunnen zijn.',
    problem: 'Onder mijn kunst verschijnen reacties waarvan ik niet weet of ze mogen. Wat valt onder vrije meningsuiting, en wanneer gaat het over de grens?',
    facts: [
      'De Kubuswoningen zijn ontworpen door architect Piet Blom.',
      'Ze zijn in 1984 opgeleverd.',
      'Piet Blom zag elke kubus als een boom, en alle kubussen samen als een bos.',
      'Eén kubus is ingericht als museum, de Kijk-Kubus, zodat je kunt zien hoe je in een kubus woont.',
      'Vrijheid van meningsuiting betekent dat je je mening mag geven, maar niet dat alles mag: bedreigen en discrimineren mag niet.',
    ],
    secret: 'De muren in een kubus staan zo scheef dat je veel meubels niet tegen de muur kunt zetten. Bewoners moeten dus ook bij het inrichten anders durven denken.',
    game: null,
    card: {
      title: 'Mag dit online?',
      text: 'Posts, memes en meningen: valt het onder vrije meningsuiting of gaat het over de grens? De AI legt uit waar de grens ligt.',
    },
  },

  erasmusbrug: {
    theme: 'Everybody',
    character: { name: 'Sem', role: 'brugwachter' },
    intro: 'Ik ben Sem en ik let op de Erasmusbrug. Deze brug verbindt Noord en Zuid, en ik vind dat online ook iedereen moet kunnen meedoen.',
    problem: 'We moeten een bericht sturen dat de brug even dicht gaat, maar niet iedereen kan dat goed lezen of ontvangen. Help jij het bericht voor iedereen te maken?',
    facts: [
      'De Erasmusbrug is in 1996 geopend.',
      'Rotterdammers noemen de brug ook wel De Zwaan.',
      'De brug is ontworpen door Ben van Berkel.',
      'Een deel van de brug kan open, zodat hoge schepen erdoor kunnen.',
      'Een toegankelijk bericht is ook te begrijpen voor mensen die slechtziend zijn, de taal nog leren of geen mobiele data hebben.',
    ],
    secret: 'Kijk naar de schuine pyloon: die is 139 meter hoog. Door die vorm herkent iedereen de brug meteen, zelfs van heel ver weg.',
    game: null,
    card: {
      title: 'Bouw de brug',
      text: 'Maak een bericht of appscherm toegankelijk voor iemand die slechtziend is, de taal niet goed spreekt of geen mobiele data heeft. De AI test of het werkt.',
    },
  },

  rechtbank: {
    theme: 'Rules',
    character: { name: 'Joost', role: 'griffier' },
    intro: 'Goedendag, ik ben Joost, griffier bij de rechtbank. Ik schrijf op wat er in een rechtszaak gebeurt. Hier wordt beslist wat wel en niet mag.',
    problem: 'Er ligt een zaak op mijn bureau: een foto van een jongere is zonder toestemming online gezet. Wie heeft er gelijk?',
    facts: [
      'De rechtbank Rotterdam staat aan het Wilhelminaplein op de Kop van Zuid.',
      'Een griffier helpt de rechter en schrijft op wat er tijdens een zitting gebeurt.',
      'In Nederland heb je tot je 16e toestemming van je ouders nodig als een app of website je persoonsgegevens wil gebruiken.',
      'Je hebt portretrecht: iemand mag een herkenbare foto van jou niet zomaar publiceren als je daar een redelijk belang tegen hebt.',
      'Je kunt een website of platform vragen een foto van jou te verwijderen.',
    ],
    secret: 'Veel rechtszaken zijn openbaar. Dat betekent dat je als bezoeker mag gaan kijken, zodat iedereen kan zien dat het eerlijk gaat.',
    game: null,
    card: {
      title: 'De rechtszaak',
      text: 'Een foto van een jongere wordt zonder toestemming gedeeld. De AI speelt beide advocaten, jij bent de rechter en ontdekt welke regels er gelden.',
    },
  },

  euromast: {
    theme: 'Opinion',
    character: { name: 'Lotte', role: 'gids' },
    intro: 'Hoi, ik ben Lotte, gids bij de Euromast. Van bovenaf zie je de hele stad. Zo wil ik ook dat jongeren overzicht krijgen, en dat hun mening meetelt.',
    problem: 'De stad moet een keuze maken, en er zijn twee kanten. Ik wil weten wat jij ervan vindt, en waarom.',
    facts: [
      'De Euromast is gebouwd voor de Floriade van 1960.',
      'Later is er een Space Tower bovenop gezet, waardoor de toren hoger werd.',
      'De Euromast is ongeveer 185 meter hoog.',
      'Je mening mag je altijd geven, en het helpt als je uitlegt waarom je iets vindt.',
      'Jongeren kunnen in Rotterdam meepraten over plannen voor de stad.',
    ],
    secret: 'Bij de Euromast kun je naar beneden abseilen. Durf jij dat?',
    game: null,
    card: {
      title: 'Stadsdilemma',
      text: 'Een echte Rotterdamse kwestie. De AI geeft beide kanten, jij kiest en onderbouwt je mening, en daarna zie je wat andere jongeren kozen.',
    },
  },

  hetpark: {
    theme: 'Healthy',
    character: { name: 'Ingrid', role: 'hardloopcoach' },
    intro: 'Hallo, ik ben Ingrid, hardloopcoach. Ik train hier in Het Park. Buiten bewegen is goed voor je, maar veel apps doen er alles aan om je binnen op je scherm te houden.',
    problem: 'Een app op mijn telefoon blijft me maar meldingen sturen. Help jij me de trucs te herkennen die me vasthouden?',
    facts: [
      'Het Park ligt naast de Euromast.',
      'Het Park is in de negentiende eeuw aangelegd.',
      'Streaks, autoplay en meldingen zijn trucs om je zo lang mogelijk in een app te houden.',
      'Je kunt meldingen en autoplay bij de meeste apps zelf uitzetten.',
    ],
    secret: 'Het Park was vroeger bedoeld als wandelpark voor rijke Rotterdammers. Nu is het van iedereen.',
    game: null,
    card: {
      title: 'Aandachtsval',
      text: 'Een nep-app probeert je zo lang mogelijk vast te houden met streaks, autoplay en meldingen. Herken de trucs en zet ze uit.',
    },
  },

  politiebureau: {
    theme: 'Safe',
    character: { name: 'Karin', role: 'wijkagent' },
    intro: 'Hoi, ik ben Karin, wijkagent in het centrum. Steeds vaker krijgen we meldingen van jongeren die online zijn opgelicht.',
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
      text: 'De AI maakt realistische nepberichten binnen vaste sjablonen. Jij ontmaskert ze, en Karin legt uit waaraan je ze herkent.',
    },
  },

  stadhuis: {
    theme: 'Active',
    character: { name: 'Fatima', role: 'raadslid' },
    intro: 'Welkom bij het Stadhuis! Ik ben Fatima, gemeenteraadslid. Hier beslissen we over de stad, en ik wil dat jongeren meepraten.',
    problem: 'Ik hoor te weinig ideeën van jongeren. Wat zou jij in Rotterdam verbeteren?',
    facts: [
      'Het Stadhuis aan de Coolsingel is gebouwd tussen 1914 en 1920.',
      'Het Stadhuis heeft het bombardement van 14 mei 1940 overleefd.',
      'De gemeenteraad van Rotterdam heeft 45 leden.',
      'Iedereen mag een gemeenteraadsvergadering bijwonen.',
    ],
    secret: 'Tijdens het bombardement van 1940 bleef het Stadhuis staan terwijl veel van het centrum verwoest werd. Daarom is het een van de weinige oude gebouwen in de binnenstad.',
    game: null,
    card: {
      title: 'Jouw idee voor de stad',
      text: 'Bedenk wat jij in de stad zou verbeteren. De AI helpt je het idee scherp te maken en te pitchen. Alle ideeën samen laten zien wat jongeren willen.',
    },
  },

  bibliotheek: {
    theme: 'Chances',
    character: { name: 'Ruben', role: 'bibliothecaris' },
    intro: 'Hoi, ik ben Ruben, bibliothecaris. Hier kan iedereen gratis internet gebruiken, achter een computer zitten en hulp krijgen. Zo krijgt iedereen kansen.',
    problem: 'Steeds meer bedrijven laten een computer kiezen wie er op gesprek mag. Maar is dat wel eerlijk?',
    facts: [
      'De Centrale Bibliotheek is in 1983 geopend.',
      'Je herkent het gebouw aan de gele buizen aan de buitenkant.',
      'In de bibliotheek kun je gratis internet en computers gebruiken.',
      'Een selectie-algoritme leert van oude keuzes. Als die oude keuzes oneerlijk waren, neemt het algoritme dat over.',
    ],
    secret: 'Die gele buizen aan de buitenkant zijn niet alleen versiering: ze voeren lucht aan en af. Het gebouw draagt zijn techniek gewoon aan de buitenkant.',
    game: null,
    card: {
      title: 'Jij bent het algoritme',
      text: 'Jij selecteert sollicitanten met een AI-regel en ontdekt dat die oneerlijk uitpakt. De AI laat zien waar de vooroordelen vandaan komen.',
    },
  },
};
