// Messages for "Nep of echt?". All brands, numbers and web addresses are made up on purpose,
// so the game never imitates a real company. +44 7700 900xxx is a range reserved for fiction.
//
// level: 1 = easy, 3 = hard. `tells` are the signs Karin points out for fake messages,
// `why` explains why a real message is safe.

export const MESSAGES = [
  // ---------- Fake ----------
  {
    id: 'bank-blokkade', kind: 'sms', from: 'MaasBank', level: 1, fake: true,
    text: 'Uw rekening wordt VANDAAG geblokkeerd! Verifieer direct uw gegevens via maasbank-veilig.info/inlog om dit te voorkomen.',
    tells: ['Haast: "vandaag" en hoofdletters moeten je laten schrikken.', 'Een bank stuurt nooit een inloglink via sms.', 'Het webadres is niet van de bank zelf.'],
  },
  {
    id: 'vriend-nieuw-nummer', kind: 'whatsapp', from: '+44 7700 900481', level: 1, fake: true,
    text: 'Heyy dit is mijn nieuwe nummer! Mijn telefoon is in de Maas gevallen 😭 kun je me €20 sturen via dit betaalverzoek? Morgen terug, beloofd. Zeg niks tegen de anderen ok',
    tells: ['Een onbekend, buitenlands nummer dat zegt dat het een vriend is.', 'Er wordt meteen om geld gevraagd.', '"Zeg niks tegen de anderen": oplichters willen niet dat je het checkt.'],
  },
  {
    id: 'gewonnen', kind: 'sms', from: 'PrijzenTeam', level: 1, fake: true,
    text: 'Gefeliciteerd!! Jij bent gekozen als winnaar van een gloednieuwe telefoon 📱 Claim hem binnen 10 minuten op prijs-claim-nl.com',
    tells: ['Je hebt nergens aan meegedaan, dus je kunt ook niets winnen.', 'Te mooi om waar te zijn.', 'Een afteltijd van 10 minuten zet je onder druk.'],
  },
  {
    id: 'pakket-kosten', kind: 'sms', from: 'PakketDirect', level: 2, fake: true,
    text: 'Je pakket kon niet worden bezorgd. Betaal €1,99 extra verzendkosten om een nieuwe bezorgdag te kiezen: pakketdirect.bezorg-nl.com',
    tells: ['Een klein bedrag lijkt onschuldig, maar zo krijgen ze je bankgegevens.', 'Een bezorger vraagt geen extra geld via een sms-link.', 'Het echte bedrijf staat niet aan het begin van het webadres.'],
  },
  {
    id: 'gratis-coins', kind: 'dm', from: 'FreeCoins010', level: 2, fake: true,
    text: '🎮 GRATIS 5000 coins voor je favoriete game! Log in met je game-account op free-coins-010.net en ze staan er binnen een uur op.',
    tells: ['Gratis coins bestaan niet: dit is een truc om je account over te nemen.', 'Ze vragen je in te loggen op een andere site dan die van de game.'],
  },
  {
    id: 'code-doorsturen', kind: 'whatsapp', from: 'Sam 🏀', level: 2, fake: true,
    text: 'Yo, ik heb per ongeluk een code naar jouw nummer laten sturen. Kun je me die 6 cijfers even doorsturen? Is voor mijn account',
    tells: ['Met die code kan iemand jouw account overnemen.', 'Ook als het je vriend lijkt: zijn account kan al gehackt zijn.', 'Een verificatiecode deel je nooit, met niemand.'],
  },
  {
    id: 'nepnieuws-brug', kind: 'nieuws', from: 'RTM Nieuws Direct', level: 3, fake: true,
    text: 'BREEKPUNT: Erasmusbrug gaat volgende maand voorgoed dicht, gemeente bevestigt. Deel dit snel met iedereen die naar Zuid moet!',
    tells: ['Je kent deze nieuwsbron niet.', 'Schokkend nieuws met de oproep om het snel te delen.', 'Check het bij een nieuwssite die je kent: daar staat het niet.'],
  },
  {
    id: 'school-account', kind: 'mail', from: 'schooladministratie@maaslyceum.nl.verify-mail.com', level: 3, fake: true,
    text: 'Beste leerling, je schoolaccount verloopt vandaag om 23:59. Log opnieuw in via de knop hieronder om je cijfers en rooster te behouden.',
    tells: ['Lees het adres tot het einde: het eindigt op verify-mail.com, niet op de site van school.', 'Haast: het verloopt vandaag.', 'Je school vraagt je niet om via een mail opnieuw in te loggen.'],
  },
  {
    id: 'ambassadeur', kind: 'dm', from: 'StreetStyle.Official', level: 3, fake: true,
    text: 'Hoi! We vinden je profiel echt tof 🔥 We zoeken ambassadeurs voor ons merk. Je krijgt gratis kleding! Alleen even €15 inschrijfkosten betalen via de link in onze bio.',
    tells: ['Je hoeft nooit te betalen om ergens geld of spullen mee te verdienen.', 'Complimenten maken je minder kritisch: dat is precies de bedoeling.'],
  },

  // ---------- Real ----------
  {
    id: 'mentor-studiemiddag', kind: 'app', from: 'Schoolapp: je mentor', level: 1, fake: false,
    text: 'Herinnering: morgen zijn de lessen om 12:00 uit vanwege een studiemiddag. Fijne middag!',
    why: 'Het komt via de schoolapp, er staat geen link in en er wordt niets van je gevraagd.',
  },
  {
    id: 'mama-eten', kind: 'whatsapp', from: 'Mama ❤️', level: 1, fake: false,
    text: 'Ben je om 6 uur thuis? We eten pasta 🍝',
    why: 'Een bekend nummer dat al in je telefoon staat, en er wordt niets gevraagd behalve een gewone vraag.',
  },
  {
    id: 'pakket-tijdvak', kind: 'sms', from: 'PakketDirect', level: 2, fake: false,
    text: 'Je pakket wordt vandaag tussen 14:00 en 16:00 bezorgd. Volg je pakket in de PakketDirect-app.',
    why: 'Er staat geen link in, er hoeft niets betaald te worden en je wordt naar de eigen app verwezen.',
  },
  {
    id: 'bank-ontvangen', kind: 'app', from: 'MaasBank-app', level: 2, fake: false,
    text: 'Je hebt €12,50 ontvangen van Opa. Bekijk het in je overzicht.',
    why: 'Een melding in de app van je bank zelf, en je hoeft niets in te vullen of te betalen.',
  },
  {
    id: 'bieb-boek', kind: 'mail', from: 'bibliotheek@biebrotterdam.nl', level: 2, fake: false,
    text: 'Je geleende boek moet over 3 dagen terug. Verlengen kan in de app of aan de balie.',
    why: 'Het adres klopt, er is geen haast en je kunt het ook zonder link regelen.',
  },
  {
    id: 'code-niet-delen', kind: 'sms', from: 'GameHub', level: 3, fake: false,
    text: 'Je verificatiecode is 482913. Deel deze code met niemand, ook niet met medewerkers van GameHub.',
    why: 'Dit is de code die je zelf aanvroeg. Er staat juist bij dat je hem niet mag delen. Een oplichter zou daarom vragen.',
  },
  {
    id: 'tram-omleiding', kind: 'nieuws', from: 'Je nieuwsapp', level: 3, fake: false,
    text: 'Vanaf maandag rijden trams in het centrum een omleiding vanwege werkzaamheden. Kijk voor je reis in de reisplanner.',
    why: 'Gewone informatie zonder paniek, zonder oproep om te delen en zonder link naar een vreemde site.',
  },
];

// Templates the AI may fill in. The AI only writes the text: sender, web address and the
// explanation (`tells`) stay fixed, so Karin's explanation is always correct.
export const TEMPLATES = [
  {
    id: 'ai-bank', kind: 'sms', from: 'MaasBank', domain: 'maasbank-check.info', level: 2,
    brief: 'De bank meldt dat er iets mis is met je rekening en dat je snel moet inloggen via de link.',
    tells: ['De bank zet je onder druk om snel te handelen.', 'Een bank stuurt nooit een inloglink via sms.', 'Het webadres is niet van de bank zelf.'],
  },
  {
    id: 'ai-vriend', kind: 'whatsapp', from: '+44 7700 900726', domain: null, level: 2,
    brief: 'Iemand zegt dat hij een vriend is met een nieuw nummer, vertelt een smoes en vraagt om geld via een betaalverzoek.',
    tells: ['Een onbekend nummer dat zegt dat het een bekende is.', 'Er wordt om geld gevraagd.', 'Check het door je vriend te bellen op zijn oude nummer.'],
  },
  {
    id: 'ai-pakket', kind: 'sms', from: 'PakketDirect', domain: 'pakketdirect-herbezorgen.com', level: 3,
    brief: 'Je pakket ligt klaar maar er is een probleem, en je moet een klein bedrag betalen via de link.',
    tells: ['Een klein bedrag betalen via een sms-link is een bekende truc.', 'Het webadres is niet het echte adres van de bezorger.'],
  },
  {
    id: 'ai-game', kind: 'dm', from: 'GameRewards.NL', domain: 'game-rewards-nl.net', level: 3,
    brief: 'Een account belooft gratis spullen voor een populaire game als je inlogt met je game-account.',
    tells: ['Gratis spullen in ruil voor je inloggegevens: zo nemen ze je account over.', 'Je moet inloggen op een andere site dan die van de game.'],
  },
];
