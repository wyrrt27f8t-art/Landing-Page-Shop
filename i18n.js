/*
 * Mehrsprachigkeit ohne Build-Schritt.
 *
 * Texte stehen hier zentral. Im HTML markiert data-i18n="schlüssel" die Stelle,
 * an der ein Text eingesetzt wird. Die Sprache ergibt sich in dieser Reihenfolge:
 * ?lang= in der Adresse, zuvor getroffene Wahl, Browsersprache, sonst Deutsch.
 *
 * Deutsch ist die Ursprungsfassung. Bei rechtlichen Texten ist sie massgebend.
 */

const SPRACHEN = ["de", "fr", "it", "en"];
const STANDARD = "de";

const TEXTE = {
  de: {
    "nav.car": "MAFO CAR",
    "nav.walk": "MAFO WALK",
    "nav.cta": "Vorbestellen",

    "hero.kicker": "MAFO CAR — Dog Travel Organizer",
    "hero.title": "Ordnung fürs Auto.",
    "hero.lead": "Der praktische Travel Organizer, der mit deinem Hund reist – griffbereit, durchdacht und gemacht für jede Fahrt und jeden Spaziergang.",
    "hero.priceNote": "inkl. Versand in der Schweiz · verfügbar ab Herbst 2026",
    "hero.cta": "Reserviere dir dein Exemplar",

    "features.title": "Warum MAFO CAR",
    "features.1.title": "Durchdacht organisiert",
    "features.1.text": "Eigene Taschen für Leine, Decke und alles, was sonst noch mitmuss – griffbereit statt lose im Kofferraum.",
    "features.2.title": "Napfstation an Bord",
    "features.2.text": "Zwei Silikonnäpfe sind dabei, dazu eine wasserfeste Matte für Futter- und Trinknapf.",
    "features.3.title": "Kotbeutel griffbereit",
    "features.3.text": "Integrierte Öffnung für die Rolle – ein Griff, und du hast den Beutel in der Hand.",
    "features.4.title": "Tragen oder umhängen",
    "features.4.text": "Tragegriffe und abnehmbarer Schultergurt – vom Kofferraum direkt zum Spaziergang.",
    "features.5.title": "Für unterwegs gemacht",
    "features.5.text": "Robust und wetterfest – bereit für jeden Ausflug mit deinem Hund.",
    "features.6.title": "Swiss Design",
    "features.6.text": "Entwickelt in der Schweiz, mit Liebe zum Detail – für Hundebesitzer, die Qualität schätzen.",

    "size.title": "Passt er in dein Auto?",
    "size.p1": "Mit 33 cm Breite und 17 cm Tiefe steht MAFO CAR aufrecht im Kofferraum, ohne die Ladefläche zu blockieren – und lässt sich am Schultergurt in einem Zug herausnehmen.",
    "size.p2": "Die wasserfeste Matte misst ausgerollt 60 × 40 cm. Genug Platz für beide Näpfe nebeneinander, ohne dass Wasser ins Gras oder auf den Kofferraumboden läuft.",
    "size.specTitle": "Masse und Lieferumfang",
    "size.spec1Label": "Tasche",
    "size.spec1": "33 × 17 × 38 cm (B × T × H)",
    "size.spec2Label": "Wasserfeste Matte",
    "size.spec2": "60 × 40 cm",
    "size.spec3Label": "Zwei Silikonnäpfe",
    "size.spec3": "Ø 13 cm, 5 cm hoch, faltbar",
    "size.spec4Label": "Schultergurt",
    "size.spec4": "abnehmbar, plus zwei Tragegriffe",
    "size.note": "Masse gerundet – geringe Abweichungen möglich.",

    "walk.kicker": "MAFO WALK — 3-in-1 Trinkflasche",
    "walk.title1": "Eine Flasche.",
    "walk.title2": "Zwei Näpfe.",
    "walk.lead": "Wasser, Futter und Flasche in einem Stück – für jeden Spaziergang, jede Wanderung, jeden Tag zu zweit.",
    "walk.descTitle": "Kein Kompromiss unterwegs",
    "walk.desc1": "Wasser, Futter, Flasche – bisher drei Dinge, die du einzeln mitschleppen musstest. MAFO WALK schraubt sie zu einem einzigen Stück zusammen.",
    "walk.desc2": "Unten sitzen zwei Edelstahlnäpfe, die sich mit einem Dreh lösen: einer für Wasser, einer fürs Futter. Darüber die doppelwandige Vakuumflasche mit 950 ml – genug für einen langen Tag zu zweit. Innen keramikbeschichtet, damit das Wasser nach Wasser schmeckt und nicht nach Metall.",
    "walk.desc3": "Die Vakuumisolierung hält kalt, was kalt bleiben soll, und warm, was warm bleiben soll. Im Hochsommer auf der Wanderung genauso wie im Januar am Waldrand.",
    "walk.specTitle": "Auf einen Blick",
    "walk.spec1Label": "950 ml",
    "walk.spec1": "Füllmenge (32 oz)",
    "walk.spec2Label": "Doppelwandiges Vakuum",
    "walk.spec2": "– hält kalt und warm",
    "walk.spec3Label": "Zwei Edelstahlnäpfe",
    "walk.spec3": "zum Abschrauben",
    "walk.spec4Label": "Keramik-Innenbeschichtung",
    "walk.spec4": "– kein Metallgeschmack",
    "walk.spec5Label": "BPA-frei",
    "walk.spec5": "",
    "walk.specNote": "Nicht spülmaschinen- und nicht mikrowellengeeignet.",
    "walk.formTitle": "Reserviere dein MAFO WALK",
    "walk.priceNote": "MAFO WALK 3-in-1 Trinkflasche · inkl. Versand in der Schweiz",

    "order.title": "Reserviere dein MAFO",
    "order.lead": "Verfügbar ab Herbst 2026. Sichere dir jetzt unverbindlich deinen Platz in der ersten Serie – keine Zahlung nötig, wir melden uns rechtzeitig.",
    "order.priceListNote": "inkl. Versand in der Schweiz · Zahlung erst bei Auslieferung im Herbst 2026",
    "order.productLabel": "Woran hast du Interesse?",
    "order.optCar": "MAFO CAR — Travel Organizer",
    "order.optWalk": "MAFO WALK — 3-in-1 Trinkflasche",
    "order.optBoth": "Beide",
    "order.name": "Name",
    "order.email": "E-Mail-Adresse",
    "order.submit": "Reserviere dir dein Exemplar",
    "order.noteStrong": "Die Vorbestellung ist unverbindlich",
    "order.note": " – keine Zahlung, keine Kaufpflicht, jederzeit widerrufbar. Mit dem Absenden erklärst du dich einverstanden, dass wir dich per E-Mail zu MAFO kontaktieren. Mehr dazu in der ",
    "order.privacyLink": "Datenschutzerklärung",
    "order.sending": "Wird gesendet...",
    "order.missing": "Bitte Name und E-Mail-Adresse ausfüllen.",
    "order.success": "Schön, bist du dabei! Dein Exemplar ist reserviert – wir melden uns bei dir, sobald MAFO CAR bereit für die erste Fahrt ist.",
    "order.error": "Da ist etwas schiefgelaufen. Bitte versuch es später nochmal oder schreib uns direkt an info@mafo-pet.ch.",

    "footer.rights": "© 2026 MAFO, Schweiz",
    "footer.imprint": "Impressum",
    "footer.privacy": "Datenschutz",
    "footer.language": "Sprache",
    "footer.back": "Zurück zur Startseite",
  },

  fr: {
    "nav.car": "MAFO CAR",
    "nav.walk": "MAFO WALK",
    "nav.cta": "Réserver",

    "hero.kicker": "MAFO CAR — Organiseur de voyage pour chien",
    "hero.title": "De l'ordre dans la voiture.",
    "hero.lead": "L'organiseur pratique qui voyage avec ton chien – à portée de main, bien pensé, conçu pour chaque trajet et chaque promenade.",
    "hero.priceNote": "livraison en Suisse incluse · disponible dès l'automne 2026",
    "hero.cta": "Réserve ton exemplaire",

    "features.title": "Pourquoi MAFO CAR",
    "features.1.title": "Tout à sa place",
    "features.1.text": "Des poches dédiées pour la laisse, la couverture et tout le reste – à portée de main plutôt qu'en vrac dans le coffre.",
    "features.2.title": "Station gamelles intégrée",
    "features.2.text": "Deux gamelles en silicone sont incluses, avec un tapis imperméable pour la nourriture et l'eau.",
    "features.3.title": "Sachets toujours accessibles",
    "features.3.text": "Une ouverture intégrée pour le rouleau – un geste, et le sachet est dans ta main.",
    "features.4.title": "À porter ou en bandoulière",
    "features.4.text": "Poignées de transport et sangle d'épaule amovible – du coffre directement à la promenade.",
    "features.5.title": "Fait pour la route",
    "features.5.text": "Robuste et résistant aux intempéries – prêt pour chaque sortie avec ton chien.",
    "features.6.title": "Swiss Design",
    "features.6.text": "Conçu en Suisse, avec le souci du détail – pour les propriétaires de chiens qui apprécient la qualité.",

    "size.title": "Entre-t-il dans ta voiture ?",
    "size.p1": "Avec 33 cm de largeur et 17 cm de profondeur, MAFO CAR tient debout dans le coffre sans bloquer la surface de chargement – et se retire d'un seul geste grâce à la sangle.",
    "size.p2": "Le tapis imperméable mesure 60 × 40 cm une fois déroulé. De quoi poser les deux gamelles côte à côte, sans que l'eau ne finisse dans l'herbe ou au fond du coffre.",
    "size.specTitle": "Dimensions et contenu",
    "size.spec1Label": "Sac",
    "size.spec1": "33 × 17 × 38 cm (l × p × h)",
    "size.spec2Label": "Tapis imperméable",
    "size.spec2": "60 × 40 cm",
    "size.spec3Label": "Deux gamelles en silicone",
    "size.spec3": "Ø 13 cm, 5 cm de haut, pliables",
    "size.spec4Label": "Sangle d'épaule",
    "size.spec4": "amovible, plus deux poignées",
    "size.note": "Dimensions arrondies – de légers écarts sont possibles.",

    "walk.kicker": "MAFO WALK — Gourde 3 en 1",
    "walk.title1": "Une gourde.",
    "walk.title2": "Deux gamelles.",
    "walk.lead": "L'eau, la nourriture et la gourde en une seule pièce – pour chaque promenade, chaque randonnée, chaque journée à deux.",
    "walk.descTitle": "Aucun compromis en chemin",
    "walk.desc1": "L'eau, la nourriture, la gourde – jusqu'ici trois objets à transporter séparément. MAFO WALK les réunit en un seul.",
    "walk.desc2": "En bas se trouvent deux gamelles en acier inoxydable qui se détachent d'un tour de main : une pour l'eau, une pour la nourriture. Au-dessus, la gourde isotherme à double paroi de 950 ml – de quoi tenir une longue journée à deux. Revêtement céramique à l'intérieur, pour que l'eau ait le goût de l'eau et non du métal.",
    "walk.desc3": "L'isolation sous vide garde au frais ce qui doit rester frais, et au chaud ce qui doit rester chaud. En pleine chaleur estivale comme en janvier à la lisière du bois.",
    "walk.specTitle": "En un coup d'œil",
    "walk.spec1Label": "950 ml",
    "walk.spec1": "de contenance (32 oz)",
    "walk.spec2Label": "Double paroi sous vide",
    "walk.spec2": "– garde au frais et au chaud",
    "walk.spec3Label": "Deux gamelles en inox",
    "walk.spec3": "à dévisser",
    "walk.spec4Label": "Revêtement céramique",
    "walk.spec4": "– aucun goût métallique",
    "walk.spec5Label": "Sans BPA",
    "walk.spec5": "",
    "walk.specNote": "Ne convient ni au lave-vaisselle ni au micro-ondes.",
    "walk.formTitle": "Réserve ton MAFO WALK",
    "walk.priceNote": "MAFO WALK gourde 3 en 1 · livraison en Suisse incluse",

    "order.title": "Réserve ton MAFO",
    "order.lead": "Disponible dès l'automne 2026. Réserve dès maintenant ta place dans la première série, sans engagement – aucun paiement, nous te recontactons à temps.",
    "order.priceListNote": "livraison en Suisse incluse · paiement seulement à la livraison, à l'automne 2026",
    "order.productLabel": "Qu'est-ce qui t'intéresse ?",
    "order.optCar": "MAFO CAR — Organiseur de voyage",
    "order.optWalk": "MAFO WALK — Gourde 3 en 1",
    "order.optBoth": "Les deux",
    "order.name": "Nom",
    "order.email": "Adresse e-mail",
    "order.submit": "Réserve ton exemplaire",
    "order.noteStrong": "La précommande est sans engagement",
    "order.note": " – aucun paiement, aucune obligation d'achat, annulable à tout moment. En envoyant ce formulaire, tu acceptes que nous te contactions par e-mail au sujet de MAFO. Plus d'informations dans la ",
    "order.privacyLink": "déclaration de confidentialité",
    "order.sending": "Envoi en cours...",
    "order.missing": "Merci d'indiquer ton nom et ton adresse e-mail.",
    "order.success": "Ravis de t'avoir avec nous ! Ton exemplaire est réservé – nous te contacterons dès que MAFO CAR sera prêt pour son premier trajet.",
    "order.error": "Une erreur est survenue. Réessaie plus tard ou écris-nous directement à info@mafo-pet.ch.",

    "footer.rights": "© 2026 MAFO, Suisse",
    "footer.imprint": "Mentions légales",
    "footer.privacy": "Confidentialité",
    "footer.language": "Langue",
    "footer.back": "Retour à l'accueil",
  },

  it: {
    "nav.car": "MAFO CAR",
    "nav.walk": "MAFO WALK",
    "nav.cta": "Preordina",

    "hero.kicker": "MAFO CAR — Organizer da viaggio per cani",
    "hero.title": "Ordine in auto.",
    "hero.lead": "L'organizer pratico che viaggia con il tuo cane – a portata di mano, ben pensato, fatto per ogni viaggio e ogni passeggiata.",
    "hero.priceNote": "spedizione in Svizzera inclusa · disponibile dall'autunno 2026",
    "hero.cta": "Riserva il tuo esemplare",

    "features.title": "Perché MAFO CAR",
    "features.1.title": "Tutto al suo posto",
    "features.1.text": "Scomparti dedicati per guinzaglio, coperta e tutto il resto – a portata di mano invece che sparsi nel bagagliaio.",
    "features.2.title": "Ciotole già incluse",
    "features.2.text": "Due ciotole in silicone sono comprese, con un tappetino impermeabile per cibo e acqua.",
    "features.3.title": "Sacchetti sempre pronti",
    "features.3.text": "Apertura integrata per il rotolo – un gesto, e hai il sacchetto in mano.",
    "features.4.title": "Da portare a mano o a tracolla",
    "features.4.text": "Maniglie e tracolla staccabile – dal bagagliaio direttamente alla passeggiata.",
    "features.5.title": "Fatto per stare fuori",
    "features.5.text": "Robusto e resistente alle intemperie – pronto per ogni gita con il tuo cane.",
    "features.6.title": "Swiss Design",
    "features.6.text": "Progettato in Svizzera, con cura per il dettaglio – per chi ha un cane e apprezza la qualità.",

    "size.title": "Entra nella tua auto?",
    "size.p1": "Con 33 cm di larghezza e 17 cm di profondità, MAFO CAR sta in piedi nel bagagliaio senza occupare il piano di carico – e si estrae in un solo gesto grazie alla tracolla.",
    "size.p2": "Il tappetino impermeabile misura 60 × 40 cm una volta srotolato. Spazio sufficiente per entrambe le ciotole affiancate, senza che l'acqua finisca sull'erba o sul fondo del bagagliaio.",
    "size.specTitle": "Dimensioni e contenuto",
    "size.spec1Label": "Borsa",
    "size.spec1": "33 × 17 × 38 cm (L × P × A)",
    "size.spec2Label": "Tappetino impermeabile",
    "size.spec2": "60 × 40 cm",
    "size.spec3Label": "Due ciotole in silicone",
    "size.spec3": "Ø 13 cm, 5 cm di altezza, pieghevoli",
    "size.spec4Label": "Tracolla",
    "size.spec4": "staccabile, più due maniglie",
    "size.note": "Misure arrotondate – lievi scostamenti possibili.",

    "walk.kicker": "MAFO WALK — Borraccia 3 in 1",
    "walk.title1": "Una borraccia.",
    "walk.title2": "Due ciotole.",
    "walk.lead": "Acqua, cibo e borraccia in un unico pezzo – per ogni passeggiata, ogni escursione, ogni giornata insieme.",
    "walk.descTitle": "Nessun compromesso fuori casa",
    "walk.desc1": "Acqua, cibo, borraccia – finora tre cose da portare separatamente. MAFO WALK le unisce in un solo pezzo.",
    "walk.desc2": "In basso ci sono due ciotole in acciaio inox che si staccano con un giro: una per l'acqua, una per il cibo. Sopra, la borraccia termica a doppia parete da 950 ml – abbastanza per una lunga giornata in due. Rivestimento interno in ceramica, perché l'acqua sappia di acqua e non di metallo.",
    "walk.desc3": "L'isolamento sottovuoto mantiene freddo ciò che deve restare freddo e caldo ciò che deve restare caldo. In piena estate in montagna come a gennaio ai margini del bosco.",
    "walk.specTitle": "In sintesi",
    "walk.spec1Label": "950 ml",
    "walk.spec1": "di capacità (32 oz)",
    "walk.spec2Label": "Doppia parete sottovuoto",
    "walk.spec2": "– mantiene freddo e caldo",
    "walk.spec3Label": "Due ciotole in acciaio inox",
    "walk.spec3": "da svitare",
    "walk.spec4Label": "Rivestimento in ceramica",
    "walk.spec4": "– nessun sapore metallico",
    "walk.spec5Label": "Senza BPA",
    "walk.spec5": "",
    "walk.specNote": "Non adatta a lavastoviglie né a microonde.",
    "walk.formTitle": "Riserva il tuo MAFO WALK",
    "walk.priceNote": "MAFO WALK borraccia 3 in 1 · spedizione in Svizzera inclusa",

    "order.title": "Riserva il tuo MAFO",
    "order.lead": "Disponibile dall'autunno 2026. Assicurati ora il tuo posto nella prima serie, senza impegno – nessun pagamento, ti contattiamo per tempo.",
    "order.priceListNote": "spedizione in Svizzera inclusa · pagamento solo alla consegna, nell'autunno 2026",
    "order.productLabel": "Che cosa ti interessa?",
    "order.optCar": "MAFO CAR — Organizer da viaggio",
    "order.optWalk": "MAFO WALK — Borraccia 3 in 1",
    "order.optBoth": "Entrambi",
    "order.name": "Nome",
    "order.email": "Indirizzo e-mail",
    "order.submit": "Riserva il tuo esemplare",
    "order.noteStrong": "Il preordine è senza impegno",
    "order.note": " – nessun pagamento, nessun obbligo di acquisto, annullabile in qualsiasi momento. Inviando il modulo acconsenti a essere contattato via e-mail riguardo a MAFO. Maggiori informazioni nell'",
    "order.privacyLink": "informativa sulla privacy",
    "order.sending": "Invio in corso...",
    "order.missing": "Inserisci nome e indirizzo e-mail.",
    "order.success": "Che bello averti con noi! Il tuo esemplare è riservato – ti contatteremo appena MAFO CAR sarà pronto per il primo viaggio.",
    "order.error": "Qualcosa è andato storto. Riprova più tardi oppure scrivici direttamente a info@mafo-pet.ch.",

    "footer.rights": "© 2026 MAFO, Svizzera",
    "footer.imprint": "Note legali",
    "footer.privacy": "Privacy",
    "footer.language": "Lingua",
    "footer.back": "Torna alla pagina iniziale",
  },

  en: {
    "nav.car": "MAFO CAR",
    "nav.walk": "MAFO WALK",
    "nav.cta": "Pre-order",

    "hero.kicker": "MAFO CAR — Dog Travel Organizer",
    "hero.title": "Order in your car.",
    "hero.lead": "The practical travel organizer that rides along with your dog – within reach, well thought out, made for every drive and every walk.",
    "hero.priceNote": "shipping within Switzerland included · available from autumn 2026",
    "hero.cta": "Reserve your one",

    "features.title": "Why MAFO CAR",
    "features.1.title": "Everything in its place",
    "features.1.text": "Dedicated pockets for the lead, the blanket and whatever else comes along – within reach instead of loose in the boot.",
    "features.2.title": "Bowls already included",
    "features.2.text": "Two silicone bowls come with it, plus a waterproof mat for food and water.",
    "features.3.title": "Poop bags at hand",
    "features.3.text": "A built-in opening for the roll – one pull, and the bag is in your hand.",
    "features.4.title": "Carry it or sling it",
    "features.4.text": "Carry handles and a detachable shoulder strap – straight from the boot to the walk.",
    "features.5.title": "Built for the outdoors",
    "features.5.text": "Sturdy and weatherproof – ready for every trip with your dog.",
    "features.6.title": "Swiss Design",
    "features.6.text": "Designed in Switzerland with an eye for detail – for dog owners who value quality.",

    "size.title": "Will it fit your car?",
    "size.p1": "At 33 cm wide and 17 cm deep, MAFO CAR stands upright in the boot without taking up the loading area – and lifts out in one go by the shoulder strap.",
    "size.p2": "Rolled out, the waterproof mat measures 60 × 40 cm. Room enough for both bowls side by side, without water ending up in the grass or on the boot floor.",
    "size.specTitle": "Dimensions and contents",
    "size.spec1Label": "Bag",
    "size.spec1": "33 × 17 × 38 cm (W × D × H)",
    "size.spec2Label": "Waterproof mat",
    "size.spec2": "60 × 40 cm",
    "size.spec3Label": "Two silicone bowls",
    "size.spec3": "Ø 13 cm, 5 cm tall, collapsible",
    "size.spec4Label": "Shoulder strap",
    "size.spec4": "detachable, plus two carry handles",
    "size.note": "Measurements rounded – slight deviations possible.",

    "walk.kicker": "MAFO WALK — 3-in-1 water bottle",
    "walk.title1": "One bottle.",
    "walk.title2": "Two bowls.",
    "walk.lead": "Water, food and bottle in a single piece – for every walk, every hike, every day the two of you spend together.",
    "walk.descTitle": "No compromise out there",
    "walk.desc1": "Water, food, bottle – until now three things to carry separately. MAFO WALK screws them into one.",
    "walk.desc2": "At the bottom sit two stainless steel bowls that come off with a twist: one for water, one for food. Above them the double-walled vacuum bottle holding 950 ml – enough for a long day out together. Ceramic-lined inside, so water tastes of water and not of metal.",
    "walk.desc3": "The vacuum insulation keeps cold things cold and warm things warm. On a hike in high summer just as much as in January at the edge of the woods.",
    "walk.specTitle": "At a glance",
    "walk.spec1Label": "950 ml",
    "walk.spec1": "capacity (32 oz)",
    "walk.spec2Label": "Double-walled vacuum",
    "walk.spec2": "– keeps cold and warm",
    "walk.spec3Label": "Two stainless steel bowls",
    "walk.spec3": "screw off",
    "walk.spec4Label": "Ceramic inner coating",
    "walk.spec4": "– no metallic taste",
    "walk.spec5Label": "BPA-free",
    "walk.spec5": "",
    "walk.specNote": "Not dishwasher or microwave safe.",
    "walk.formTitle": "Reserve your MAFO WALK",
    "walk.priceNote": "MAFO WALK 3-in-1 bottle · shipping within Switzerland included",

    "order.title": "Reserve your MAFO",
    "order.lead": "Available from autumn 2026. Claim your place in the first run now, with no obligation – no payment, and we'll be in touch in good time.",
    "order.priceListNote": "shipping within Switzerland included · payment only on delivery in autumn 2026",
    "order.productLabel": "What are you interested in?",
    "order.optCar": "MAFO CAR — Travel Organizer",
    "order.optWalk": "MAFO WALK — 3-in-1 water bottle",
    "order.optBoth": "Both",
    "order.name": "Name",
    "order.email": "Email address",
    "order.submit": "Reserve your one",
    "order.noteStrong": "The pre-order is non-binding",
    "order.note": " – no payment, no obligation to buy, cancel any time. By submitting you agree that we may contact you by email about MAFO. More on this in the ",
    "order.privacyLink": "privacy policy",
    "order.sending": "Sending...",
    "order.missing": "Please fill in your name and email address.",
    "order.success": "Lovely to have you on board! Your one is reserved – we'll be in touch as soon as MAFO CAR is ready for its first drive.",
    "order.error": "Something went wrong. Please try again later, or write to us directly at info@mafo-pet.ch.",

    "footer.rights": "© 2026 MAFO, Switzerland",
    "footer.imprint": "Imprint",
    "footer.privacy": "Privacy",
    "footer.language": "Language",
    "footer.back": "Back to the home page",
  },
};

function gewuenschteSprache() {
  const ausAdresse = new URLSearchParams(location.search).get("lang");
  if (SPRACHEN.includes(ausAdresse)) return ausAdresse;

  try {
    const gemerkt = localStorage.getItem("mafo-sprache");
    if (SPRACHEN.includes(gemerkt)) return gemerkt;
  } catch (e) {
    /* Privater Modus: kein Speicher, kein Problem. */
  }

  for (const bevorzugt of navigator.languages || [navigator.language || ""]) {
    const kurz = bevorzugt.slice(0, 2).toLowerCase();
    if (SPRACHEN.includes(kurz)) return kurz;
  }
  return STANDARD;
}

function setzeSprache(sprache) {
  const woerter = TEXTE[sprache] || TEXTE[STANDARD];

  document.documentElement.lang = sprache;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const text = woerter[el.dataset.i18n];
    if (text !== undefined) el.textContent = text;
  });

  // Titel und Beschreibung, sofern die Seite eigene hinterlegt hat
  const kopf = document.querySelector('[data-i18n-title]');
  if (kopf) {
    const schluessel = kopf.dataset.i18nTitle;
    if (woerter[schluessel]) document.title = woerter[schluessel];
  }

  document.querySelectorAll(".lang-switch button").forEach((b) => {
    b.setAttribute("aria-current", b.dataset.lang === sprache ? "true" : "false");
  });

  try {
    localStorage.setItem("mafo-sprache", sprache);
  } catch (e) {
    /* siehe oben */
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setzeSprache(gewuenschteSprache());

  document.querySelectorAll(".lang-switch button").forEach((b) => {
    b.addEventListener("click", () => setzeSprache(b.dataset.lang));
  });
});

window.MAFO_TEXTE = TEXTE;
window.mafoSprache = () => document.documentElement.lang || STANDARD;
