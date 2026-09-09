export type Lang = "it" | "en";
export type PageKind = "home" | "contact" | "legal" | "pricing" | "privacy" | "cookies" | "location" | "about" | "testimonials" | "service" | "rooms" | "secretary" | "activation" | "gallery" | "customer";

export const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.romaofficesharing.it";
export const contact = {
  address: "Via Venti Settembre, 118 int.1 - 00187 - Roma",
  phone: "+39 06 21.11.6268",
  phoneHref: "+390621116268",
  fax: "+39 06 56.56.6783",
  email: "info@romaofficesharing.it",
  pec: "cubeng@pec.it",
};

export const routeMap: Record<string, string> = {
  "index.html": "en/index.html",
  "uffici-arredati.html": "en/offices-furnished.html",
  "ufficio-giornaliero.html": "en/day-office.html",
  "ufficio-temporaneo.html": "en/temporary-office.html",
  "sale-corsi.html": "en/course-rooms.html",
  "servizi-domiciliazione.html": "en/domiliation-services.html",
  "domiciliazione-postale.html": "en/postal-domiliation.html",
  "domiciliazione-sede-legale.html": "en/legal-headquarters-domiliation.html",
  "domiciliazione-professionale.html": "en/professional-domiliation.html",
  "domiciliazione-ditta-individuale.html": "en/sole-proprietorship-domiliation.html",
  "domiciliazione-unita-locale.html": "en/local-unit-domiliation.html",
  "segreteria-virtuale.html": "en/virtual-secretary.html",
  "tariffe.html": "en/pricing.html",
  "attiva.html": "en/activate.html",
  "gallery.html": "en/gallery.html",
  "area-clienti.html": "en/customer-area.html",
  "contatti.html": "en/contact.html",
  "dove-siamo.html": "en/where-we-are.html",
  "chi-siamo.html": "en/about.html",
  "privacy.html": "en/privacy.html",
  "cookie-policy.html": "en/cookie-policy.html",
  "dicono-di-noi.html": "en/testimonials.html",
  "404.html": "en/404.html",
};
export const reverseRouteMap = Object.fromEntries(Object.entries(routeMap).map(([a, b]) => [b, a]));

export const ui = {
  it: {
    skip: "Vai al contenuto", nav: "Navigazione principale", menu: "Menu", close: "Chiudi", language: "Cambia lingua",
    home: "Home", offices: "Uffici", domiciliation: "Domiciliazione", pricing: "Tariffe", about: "Chi siamo", contact: "Contatti", gallery: "Gallery", customer: "Area Clienti",
    activate: "ATTIVA ORA", activateNow: "ATTIVA SUBITO", call: "Chiama ora: 06 2111 6268", discover: "Scopri il servizio", details: "Dettagli",
    hours: "Orari", center: "Centro e Reception", weekdays: "Lun–Ven 8:30–18:00", saturday: "Sabato 8:30–13:00 (su richiesta)",
    rights: "Tutti i diritti riservati", trademark: "ROMA OFFICE SHARING è un marchio registrato di Cube Engineering s.r.l.",
    revoke: "Puoi revocare il consenso scrivendo a cubeng@pec.it o chiamando +39 06 21116268.",
    cookieTitle: "La tua privacy, la tua scelta", cookieText: "Usiamo cookie necessari per il funzionamento del sito e, solo con il tuo consenso, cookie analitici e di marketing.",
    accept: "Accetta tutti", reject: "Solo necessari", settings: "Impostazioni", save: "Salva preferenze", necessary: "Cookie necessari", analytics: "Cookie analitici", marketing: "Cookie marketing", always: "Sempre attivi",
  },
  en: {
    skip: "Skip to content", nav: "Main navigation", menu: "Menu", close: "Close", language: "Change language",
    home: "Home", offices: "Offices", domiciliation: "Business addresses", pricing: "Pricing", about: "About", contact: "Contact", gallery: "Gallery", customer: "Customer Area",
    activate: "ACTIVATE NOW", activateNow: "ACTIVATE NOW", call: "Call now: +39 06 21.11.6268", discover: "Discover the service", details: "Details",
    hours: "Opening hours", center: "Business Centre & Reception", weekdays: "Mon–Fri 8:30–18:00", saturday: "Saturday 8:30–13:00 (on request)",
    rights: "All rights reserved", trademark: "ROMA OFFICE SHARING is a registered trademark of Cube Engineering s.r.l.",
    revoke: "You can withdraw consent by emailing cubeng@pec.it or calling +39 06 21116268.",
    cookieTitle: "Your privacy, your choice", cookieText: "We use necessary cookies to operate this site and, only with your consent, analytics and marketing cookies.",
    accept: "Accept all", reject: "Necessary only", settings: "Settings", save: "Save preferences", necessary: "Necessary cookies", analytics: "Analytics cookies", marketing: "Marketing cookies", always: "Always active",
  },
};

export const services = {
  it: [
    { icon: "desk", title: "Uffici arredati", text: "Uffici pronti all’uso, eleganti e funzionali, disponibili anche per un solo giorno.", href: "/uffici-arredati.html" },
    { icon: "building", title: "Domiciliazione Sede Legale", text: "Eleggi o trasferisci la sede della tua attività a Roma, con ricezione della corrispondenza e ritiro tramite il rappresentante o un delegato.", href: "/domiciliazione-sede-legale.html" },
    { icon: "mail", title: "Domiciliazione Postale", text: "Un indirizzo professionale per ricevere e custodire la tua posta, separato da quello di casa. Ritiro o inoltro da concordare con la reception.", href: "/domiciliazione-postale.html" },
    { icon: "monitor", title: "Uffici Virtuali", text: "Presenza professionale, segreteria e servizi d’ufficio senza costi fissi.", href: "/segreteria-virtuale.html" },
  ],
  en: [
    { icon: "desk", title: "Furnished Offices", text: "Elegant, functional and ready-to-use offices, available even for a single day.", href: "/en/offices-furnished.html" },
    { icon: "building", title: "Registered Office Address", text: "Establish or relocate your company’s registered office in Rome, with business mail received and held for collection by you or your representative.", href: "/en/legal-headquarters-domiliation.html" },
    { icon: "mail", title: "Business Mailing Address", text: "A professional address for receiving and safely holding business mail, separate from your home. Arrange collection or forwarding with reception.", href: "/en/postal-domiliation.html" },
    { icon: "monitor", title: "Virtual Offices", text: "A professional presence, secretarial support and office services without fixed overheads.", href: "/en/virtual-secretary.html" },
  ],
};

export type PageDef = { title: string; eyebrow: string; description: string; kind: PageKind; intro?: string; bullets?: string[]; noIndex?: boolean };
const itPages: Record<string, PageDef> = {
  "gallery.html": { title: "Dentro Roma Office Sharing", eyebrow: "GALLERY", description: "Esplora i nostri uffici e le sale corsi e riunioni. Spazi per lavorare, incontrarsi e far crescere la tua attività a Roma.", kind: "gallery" },
  "area-clienti.html": { title: "Area Clienti", eyebrow: "IL TUO SPAZIO RISERVATO", description: "Accedi con email, password e codice SMS per scaricare i tuoi contratti in modo sicuro.", kind: "customer", noIndex: true },
  "index.html": { title: "Uffici e domiciliazione nel cuore di Roma", eyebrow: "ROMA OFFICE SHARING", description: "Business Center a due passi dalla Stazione Roma Termini... Ubicato al primo piano del palazzo Gentiloni, dotato di ampi uffici e tecnologie all’avanguardia, sale riunioni, sale corsi e aree relax.", kind: "home" },
  "uffici-arredati.html": { title: "Uffici arredati a Roma", eyebrow: "SPAZI DI LAVORO", description: "Il tuo ufficio pronto, nel centro di Roma", kind: "service", intro: "Postazioni e uffici privati completamente arredati, con connessione veloce, reception e utenze incluse.", bullets: ["Soluzioni flessibili da una postazione a un intero ufficio", "Wi‑Fi, climatizzazione e pulizia inclusi", "Reception e gestione ospiti"] },
  "ufficio-giornaliero.html": { title: "Ufficio giornaliero", eyebrow: "FLESSIBILITÀ", description: "Uno spazio professionale quando serve, anche per un solo giorno.", kind: "service", bullets: ["Prenotazione rapida", "Ambiente riservato", "Servizi e connettività inclusi"] },
  "ufficio-temporaneo.html": { title: "Ufficio temporaneo", eyebrow: "SOLUZIONI SU MISURA", description: "Il tuo ufficio per settimane o mesi, senza investimenti iniziali.", kind: "service", bullets: ["Contratti flessibili", "Costi certi", "Immagine professionale"] },
  "sale-corsi.html": { title: "Sale corsi e riunioni", eyebrow: "INCONTRARSI A ROMA", description: "Spazi modulari e tecnologici per corsi, colloqui e meeting.", kind: "rooms", bullets: ["Schermo e videoconferenza", "Layout configurabile", "Assistenza reception"] },
  "servizi-domiciliazione.html": { title: "Servizi di domiciliazione", eyebrow: "LA TUA SEDE A ROMA", description: "Un indirizzo a Roma, servizi di ricezione posta e una reception a cui affidarti. Scegli tra sede legale, recapito postale e soluzioni per professionisti.", kind: "service", bullets: ["Domiciliazione postale", "Sede legale", "Domiciliazione professionale e unità locale"] },
  "domiciliazione-postale.html": { title: "Domiciliazione Postale Roma", eyebrow: "CORRISPONDENZA", description: "Ricevi la posta aziendale presso un indirizzo prestigioso e affidabile.", kind: "service", bullets: ["Notifica della nuova corrispondenza", "Custodia riservata", "Ritiro o inoltro su richiesta"] },
  "domiciliazione-sede-legale.html": { title: "Domiciliazione Sede Legale Roma", eyebrow: "SEDE LEGALE", description: "Stabilisci la sede legale della tua attività in un palazzo di prestigio nel centro di Roma.", kind: "legal" },
  "domiciliazione-professionale.html": { title: "Domiciliazione professionale", eyebrow: "PER PROFESSIONISTI", description: "Un recapito professionale separato dalla residenza, nel cuore di Roma.", kind: "service", bullets: ["Uso dell’indirizzo professionale", "Gestione posta", "Immagine autorevole"] },
  "domiciliazione-ditta-individuale.html": { title: "Domiciliazione ditta individuale", eyebrow: "PER IMPRENDITORI", description: "Una sede professionale per la tua impresa individuale.", kind: "service", bullets: ["Indirizzo commerciale", "Gestione corrispondenza", "Servizi attivabili su misura"] },
  "domiciliazione-unita-locale.html": { title: "Domiciliazione unità locale", eyebrow: "PRESENZA A ROMA", description: "Apri un’unità locale a Roma con supporto professionale.", kind: "service", bullets: ["Indirizzo nel centro di Roma", "Assistenza documentale", "Spazi disponibili su richiesta"] },
  "segreteria-virtuale.html": { title: "Segreteria virtuale", eyebrow: "SEMPRE PRESENTI", description: "Un servizio professionale per gestire chiamate e comunicazioni.", kind: "secretary", bullets: ["Risposta personalizzata", "Inoltro messaggi", "Supporto flessibile"] },
  "tariffe.html": { title: "Tariffe e offerte", eyebrow: "TARIFFE", description: "Tutte le offerte: domiciliazione sede legale e unità locale, uffici e servizi. Attivazione online con pagamento PayPal, Stripe, SumUp o bonifico.", kind: "pricing" },
  "attiva.html": { title: "Attiva la domiciliazione", eyebrow: "ATTIVAZIONE ONLINE", description: "Compila il modulo di richiesta, verifica il tuo numero di telefono con il codice SMS e paga con PayPal, Stripe, SumUp o bonifico bancario.", kind: "activation" },
  "contatti.html": { title: "Parliamo del tuo prossimo ufficio", eyebrow: "CONTATTI", description: "Scrivici o chiamaci: il nostro team ti risponderà al più presto.", kind: "contact" },
  "dove-siamo.html": { title: "Nel cuore di Roma", eyebrow: "DOVE SIAMO", description: "A pochi minuti da Termini, facilmente raggiungibili da tutta la città.", kind: "location" },
  "chi-siamo.html": { title: "Lo spazio dove le imprese crescono", eyebrow: "CHI SIAMO", description: "Dal 2014 siamo parte della crescita dei nostri clienti.", kind: "about" },
  "privacy.html": { title: "Informativa Privacy", eyebrow: "PRIVACY", description: "Informativa sul trattamento dei dati personali ai sensi del Regolamento UE 2016/679.", kind: "privacy" },
  "cookie-policy.html": { title: "Cookie Policy", eyebrow: "PRIVACY", description: "Informazioni sui cookie utilizzati da questo sito e sulle tue scelte.", kind: "cookies" },
  "dicono-di-noi.html": { title: "Dicono di noi", eyebrow: "TESTIMONIANZE", description: "Le esperienze di professionisti e aziende che lavorano con noi.", kind: "testimonials" },
  "404.html": { title: "Pagina non trovata", eyebrow: "ERRORE 404", description: "La pagina che cerchi non è disponibile.", kind: "service" },
};
const translations: Record<string, PageDef> = {
  "en/gallery.html": { title: "Inside Roma Office Sharing", eyebrow: "GALLERY", description: "Explore our offices and training and meeting rooms. Spaces to work, meet and grow your business in Rome.", kind: "gallery" },
  "en/customer-area.html": { title: "Customer Area", eyebrow: "YOUR PRIVATE SPACE", description: "Sign in with your email, password and SMS code to securely download your contracts.", kind: "customer", noIndex: true },
  "en/index.html": { title: "Offices and business addresses in the heart of Rome", eyebrow: "ROMA OFFICE SHARING", description: "A business centre just steps from Roma Termini Station. Located on the first floor of the historic Palazzo Gentiloni, it offers spacious offices with cutting-edge technology, meeting and training rooms, and comfortable break-out areas.", kind: "home" },
  "en/offices-furnished.html": { title: "Furnished offices in Rome", eyebrow: "WORKSPACES", description: "Your ready-to-use office in central Rome", kind: "service", intro: "Fully furnished private offices and desks with fast internet, reception and utilities included.", bullets: ["Flexible solutions from one desk to a full office", "Wi‑Fi, air conditioning and cleaning included", "Reception and guest management"] },
  "en/day-office.html": { title: "Day office", eyebrow: "FLEXIBILITY", description: "A professional workspace when you need it—even for one day.", kind: "service", bullets: ["Fast booking", "Private setting", "Services and connectivity included"] },
  "en/temporary-office.html": { title: "Temporary office", eyebrow: "TAILORED SOLUTIONS", description: "Your office for weeks or months, with no upfront investment.", kind: "service", bullets: ["Flexible agreements", "Predictable costs", "Professional image"] },
  "en/course-rooms.html": { title: "Training and meeting rooms", eyebrow: "MEET IN ROME", description: "Modular, technology-enabled spaces for training, interviews and meetings.", kind: "rooms", bullets: ["Screen and video conferencing", "Flexible layouts", "Reception support"] },
  "en/domiliation-services.html": { title: "Registered office & mailing address services", eyebrow: "YOUR ADDRESS IN ROME", description: "A Rome business address, reliable mail handling and a reception team you can count on. Choose a registered office address, a mailing address or a service for your professional practice.", kind: "service", bullets: ["Business mailing address", "Registered office", "Professional and local unit addresses"] },
  "en/postal-domiliation.html": { title: "Business Mailing Address Rome", eyebrow: "BUSINESS MAIL", description: "Receive company mail at a prestigious, dependable address.", kind: "service", bullets: ["New-mail notifications", "Confidential safekeeping", "Collection or forwarding on request"] },
  "en/legal-headquarters-domiliation.html": { title: "Registered Office Rome", eyebrow: "REGISTERED OFFICE", description: "Establish your registered office in a prestigious building in central Rome.", kind: "legal" },
  "en/professional-domiliation.html": { title: "Professional business address", eyebrow: "FOR PROFESSIONALS", description: "A professional address separate from your home, in the heart of Rome.", kind: "service", bullets: ["Use of professional address", "Mail management", "Credible business image"] },
  "en/sole-proprietorship-domiliation.html": { title: "Business address for sole proprietors", eyebrow: "FOR ENTREPRENEURS", description: "A professional base for your sole proprietorship.", kind: "service", bullets: ["Business address", "Mail management", "Tailored add-on services"] },
  "en/local-unit-domiliation.html": { title: "Local unit address in Rome", eyebrow: "A PRESENCE IN ROME", description: "Open a Rome local unit with professional support.", kind: "service", bullets: ["Central Rome address", "Document support", "Workspaces on request"] },
  "en/virtual-secretary.html": { title: "Virtual secretary", eyebrow: "ALWAYS AVAILABLE", description: "Professional support for managing calls and communications.", kind: "secretary", bullets: ["Personalised answering", "Message forwarding", "Flexible support"] },
  "en/pricing.html": { title: "Pricing and offers", eyebrow: "PRICING", description: "All our offers: registered office and local unit addresses, offices and services. Online activation with PayPal, Stripe, SumUp or bank transfer.", kind: "pricing" },
  "en/activate.html": { title: "Activate your business address service", eyebrow: "ONLINE ACTIVATION", description: "Complete the request form, verify your phone number with an SMS code and pay by PayPal, Stripe, SumUp or bank transfer.", kind: "activation" },
  "en/contact.html": { title: "Let’s discuss your next office", eyebrow: "CONTACT", description: "Write or call us—our team will reply as soon as possible.", kind: "contact" },
  "en/where-we-are.html": { title: "In the heart of Rome", eyebrow: "FIND US", description: "Minutes from Termini and easy to reach from across the city.", kind: "location" },
  "en/about.html": { title: "The place where businesses grow", eyebrow: "ABOUT US", description: "We have been part of our clients’ growth since 2014.", kind: "about" },
  "en/privacy.html": { title: "Privacy Notice", eyebrow: "PRIVACY", description: "Information on personal data processing under EU Regulation 2016/679.", kind: "privacy" },
  "en/cookie-policy.html": { title: "Cookie Policy", eyebrow: "PRIVACY", description: "Information about cookies used by this website and your choices.", kind: "cookies" },
  "en/testimonials.html": { title: "What clients say", eyebrow: "TESTIMONIALS", description: "Experiences from professionals and companies who work with us.", kind: "testimonials" },
  "en/404.html": { title: "Page not found", eyebrow: "ERROR 404", description: "The page you are looking for is unavailable.", kind: "service" },
};
export const pages: Record<string, PageDef> = { ...itPages, ...translations };

export function resolvePath(parts?: string[]) {
  if (parts?.join("/") === "en") return { key: "en/index.html", lang: "en" as Lang };
  if (!parts?.length) return { key: "index.html", lang: "it" as Lang };
  const key = parts.join("/");
  if (pages[key]) return { key, lang: key.startsWith("en/") ? "en" as Lang : "it" as Lang };
  return { key: parts[0] === "en" ? "en/404.html" : "404.html", lang: parts[0] === "en" ? "en" as Lang : "it" as Lang };
}
export function hrefFor(key: string) { return key === "index.html" ? "/" : `/${key}`; }
export function alternateFor(key: string) { return hrefFor((routeMap[key] || reverseRouteMap[key]) ?? "index.html"); }

export const privacySections = {
  it: [
    ["1. Titolare del trattamento", "Il Titolare del trattamento è Cube Engineering s.r.l., con sede legale in Via San Martino Della Battaglia, 31 - 00185 Roma, contattabile all’indirizzo cubeng@pec.it e al numero +39 06 21116268."],
    ["2. Tipologie di dati trattati", "Trattiamo dati identificativi e di contatto, dati contenuti nelle comunicazioni, dati contrattuali e di pagamento, dati tecnici di navigazione e, nei servizi di firma, numero telefonico, esito OTP, firma e metadati del documento."],
    ["3. Finalità e basi giuridiche", "I dati sono trattati per rispondere alle richieste e adottare misure precontrattuali; eseguire contratti e fornire i servizi; adempiere obblighi legali, fiscali e contabili; tutelare diritti in base al legittimo interesse; inviare comunicazioni promozionali e usare cookie non necessari esclusivamente previo consenso."],
    ["4. Modalità del trattamento e sicurezza", "Il trattamento avviene con strumenti cartacei e informatici, secondo principi di liceità, correttezza, trasparenza, minimizzazione e limitazione della conservazione. Sono adottate misure tecniche e organizzative adeguate, inclusi controllo degli accessi, cifratura ove appropriata, backup e registrazione degli eventi."],
    ["5. Destinatari e trasferimenti", "I dati possono essere comunicati a personale autorizzato, consulenti, fornitori IT, hosting, pagamenti, email, SMS e firma elettronica, nominati responsabili ove richiesto, nonché alle autorità per obbligo di legge. Gli eventuali trasferimenti fuori dallo SEE avvengono sulla base di decisioni di adeguatezza o Clausole Contrattuali Standard."],
    ["6. Periodo di conservazione", "Le richieste di contatto sono conservate fino a 24 mesi; i dati contrattuali, fiscali e di pagamento per 10 anni; log OTP normalmente per 12 mesi; documenti firmati per la durata prevista dalla legge o necessaria alla tutela dei diritti; preferenze cookie per 6 mesi. Alla scadenza i dati sono cancellati o anonimizzati."],
    ["7. Natura del conferimento", "Il conferimento dei dati contrassegnati come obbligatori è necessario per rispondere o fornire il servizio. Il mancato conferimento impedisce di procedere. Il consenso marketing e cookie è facoltativo e revocabile senza pregiudicare i trattamenti precedenti."],
    ["8. Diritti dell’interessato", "Puoi chiedere accesso, rettifica, cancellazione, limitazione, portabilità e opposizione, nonché revocare il consenso, scrivendo a cubeng@pec.it o chiamando +39 06 21116268. Hai diritto di proporre reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it)."],
    ["9. Aggiornamenti e processo decisionale", "Non utilizziamo processi decisionali esclusivamente automatizzati che producano effetti giuridici. La presente informativa può essere aggiornata; la data dell’ultima revisione è 15 gennaio 2025."],
  ],
  en: [
    ["1. Data controller", "The controller is Cube Engineering s.r.l., registered office at Via San Martino Della Battaglia, 31 - 00185 Rome, available at cubeng@pec.it and +39 06 21116268."],
    ["2. Categories of data", "We process identification and contact details, correspondence, contract and payment data, technical browsing data and, for signing services, telephone number, OTP result, signature and document metadata."],
    ["3. Purposes and legal bases", "Data is processed to respond to enquiries and take pre-contractual steps; perform contracts and provide services; comply with legal, tax and accounting obligations; protect legal rights under legitimate interest; and send marketing or use non-essential cookies only with consent."],
    ["4. Processing and security", "Processing uses paper and electronic systems in accordance with lawfulness, fairness, transparency, minimisation and storage limitation. Appropriate safeguards include access controls, encryption where appropriate, backups and event logging."],
    ["5. Recipients and transfers", "Data may be disclosed to authorised staff, advisers and IT, hosting, payment, email, SMS and e-signature suppliers appointed as processors where required, and authorities when legally required. Transfers outside the EEA rely on adequacy decisions or Standard Contractual Clauses."],
    ["6. Retention", "Enquiries are retained for up to 24 months; contractual, tax and payment records for 10 years; OTP logs normally for 12 months; signed documents for the legally required period or as needed to protect rights; cookie preferences for 6 months. Data is then erased or anonymised."],
    ["7. Requirement to provide data", "Fields marked mandatory are needed to reply or provide a service. Without them we cannot proceed. Marketing and cookie consent is optional and may be withdrawn without affecting prior processing."],
    ["8. Your rights", "You may request access, correction, erasure, restriction, portability and object, or withdraw consent, by emailing cubeng@pec.it or calling +39 06 21116268. You may complain to the Italian Data Protection Authority (www.garanteprivacy.it)."],
    ["9. Updates and automated decisions", "We do not use solely automated decisions producing legal effects. This notice may be updated; last revised 15 January 2025."],
  ],
};
