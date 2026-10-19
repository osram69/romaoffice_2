import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { contact, reverseRouteMap, type Lang } from "@/lib/site";

// Extra on-page copy for the short service pages (offices, day office, temporary office, meeting
// rooms, virtual secretary). Facts come from the site's own service descriptions; prices and
// availability are deliberately not stated here — they are "on request" elsewhere on the site.
type Extra = { heading: string; paragraphs: string[]; faq: [string, string][]; related: [string, string][] };
const ADDRESS_IT = "Via Venti Settembre 118, 00187 Roma";

const extras: Record<string, Record<Lang, Extra>> = {
  "uffici-arredati.html": {
    it: {
      heading: "Uffici arredati nel centro di Roma, pronti da usare",
      paragraphs: [
        "Gli uffici di Roma Office Sharing si trovano al primo piano di Palazzo Gentiloni, in Via Venti Settembre 118, a pochi minuti a piedi dalla stazione Roma Termini e dalla fermata Repubblica della Metro A. Sono ambienti arredati, con connessione veloce, reception e utenze incluse: arrivi e lavori, senza lavori di allestimento né contratti di fornitura da gestire.",
        "Puoi scegliere la formula più adatta al tuo modo di lavorare: dall’ufficio giornaliero, quando serve uno spazio per un solo giorno, all’ufficio temporaneo per settimane o mesi. Se ti serve solo l’indirizzo per la tua attività, scopri anche i servizi di domiciliazione.",
      ],
      faq: [
        ["Dove si trovano gli uffici arredati?", `Al primo piano di Palazzo Gentiloni, in ${ADDRESS_IT}: a pochi minuti da Roma Termini e dalla fermata Repubblica della Metro A.`],
        ["Che cosa è incluso?", "Ufficio arredato, connessione veloce, reception e utenze. Per servizi aggiuntivi, come la segreteria virtuale, puoi chiedere un preventivo."],
        ["Posso usare l’ufficio solo per un giorno?", "Sì: con l’ufficio giornaliero (day office) puoi usare uno spazio anche per un solo giorno. Per periodi più lunghi c’è l’ufficio temporaneo."],
        ["Come verifico disponibilità e condizioni?", `Dipendono dal tipo di spazio e dal periodo: scrivici dalla pagina Contatti o chiama il ${contact.phone} e ti rispondiamo con una proposta.`],
      ],
      related: [["Ufficio giornaliero", "/ufficio-giornaliero.html"], ["Ufficio temporaneo", "/ufficio-temporaneo.html"], ["Sale corsi e riunioni", "/sale-corsi.html"], ["Domiciliazione sede legale", "/domiciliazione-sede-legale-roma.html"]],
    },
    en: {
      heading: "Furnished offices in central Rome, ready to use",
      paragraphs: [
        "Roma Office Sharing is on the first floor of Palazzo Gentiloni, at Via Venti Settembre 118, a few minutes’ walk from Roma Termini station and the Repubblica stop on Metro Line A. The offices are furnished, with fast internet, reception and utilities included: you arrive and start working, with no fit-out or supply contracts to manage.",
        "Choose the option that suits how you work: from a day office when you need a space for a single day, to a temporary office for weeks or months. If you only need an address for your business, explore our registered office and mailing address services too.",
      ],
      faq: [
        ["Where are the furnished offices?", "On the first floor of Palazzo Gentiloni, Via Venti Settembre 118, 00187 Rome: a few minutes from Roma Termini and the Repubblica stop on Metro Line A."],
        ["What is included?", "A furnished office, fast internet, reception and utilities. For extra services, such as a virtual secretary, you can ask for a quote."],
        ["Can I use an office for just one day?", "Yes: with a day office you can use a space for a single day. For longer periods there is the temporary office."],
        ["How do I check availability and terms?", `They depend on the type of space and the period: write to us from the Contact page or call ${contact.phone} and we will reply with a proposal.`],
      ],
      related: [["Day office", "/en/day-office.html"], ["Temporary office", "/en/temporary-office.html"], ["Training and meeting rooms", "/en/course-rooms.html"], ["Registered office address", "/en/legal-headquarters-domiliation.html"]],
    },
  },
  "ufficio-giornaliero.html": {
    it: {
      heading: "Il day office a Roma, quando ti serve davvero",
      paragraphs: [
        "L’ufficio giornaliero è la soluzione per chi ha bisogno di uno spazio professionale solo per qualche ora o per una giornata: un incontro con un cliente, una trattativa, una giornata di lavoro lontano da casa. L’ambiente è riservato e dotato di servizi e connettività, in Palazzo Gentiloni, a pochi minuti da Roma Termini.",
        "La prenotazione è rapida e non richiede contratti lunghi né investimenti iniziali. Se la tua esigenza diventa continuativa, puoi passare all’ufficio temporaneo o a un ufficio arredato; se ti serve un indirizzo per la tua attività puoi aggiungere la domiciliazione.",
      ],
      faq: [
        ["Per chi è pensato l’ufficio giornaliero?", "Per professionisti, consulenti, imprese e lavoratori da remoto che hanno bisogno di uno spazio a Roma per un giorno o per periodi brevi."],
        ["Che cosa è incluso?", "Un ambiente riservato con servizi e connettività inclusi. La reception è a disposizione durante gli orari di apertura del centro."],
        ["Come prenoto?", `Contattaci per verificare la disponibilità del giorno che ti serve: ti rispondiamo con le condizioni. Scrivici dalla pagina Contatti o chiama il ${contact.phone}.`],
        ["Posso incontrare i clienti nell’ufficio?", "Sì, è uno spazio adatto a riunioni e colloqui. Per gruppi più numerosi o per corsi, scopri le sale corsi e riunioni."],
      ],
      related: [["Uffici arredati", "/uffici-arredati.html"], ["Ufficio temporaneo", "/ufficio-temporaneo.html"], ["Sale corsi e riunioni", "/sale-corsi.html"], ["Dove siamo", "/dove-siamo.html"]],
    },
    en: {
      heading: "A day office in Rome, exactly when you need it",
      paragraphs: [
        "A day office is for anyone who needs a professional space for a few hours or a day: a client meeting, a negotiation, a working day away from home. The space is private and comes with services and connectivity, in Palazzo Gentiloni, a few minutes from Roma Termini.",
        "Booking is quick and needs no long contract or upfront investment. If your need becomes ongoing, you can move to a temporary or furnished office; if you need an address for your business, you can add a registered office or mailing address.",
      ],
      faq: [
        ["Who is a day office for?", "Professionals, consultants, companies and remote workers who need a space in Rome for a day or for short periods."],
        ["What is included?", "A private space with services and connectivity. Reception is available during the centre’s opening hours."],
        ["How do I book?", `Contact us to check availability for the day you need: we reply with the terms. Write to us from the Contact page or call ${contact.phone}.`],
        ["Can I meet clients in the office?", "Yes, it is a suitable space for meetings and interviews. For larger groups or training, see our training and meeting rooms."],
      ],
      related: [["Furnished offices", "/en/offices-furnished.html"], ["Temporary office", "/en/temporary-office.html"], ["Training and meeting rooms", "/en/course-rooms.html"], ["Where we are", "/en/where-we-are.html"]],
    },
  },
  "ufficio-temporaneo.html": {
    it: {
      heading: "Un ufficio a Roma per settimane o mesi, senza investimenti iniziali",
      paragraphs: [
        "L’ufficio temporaneo è pensato per chi ha bisogno di una sede di lavoro per un periodo definito: l’avvio di un progetto, una commessa a Roma, una fase di prova prima di scegliere una sede stabile. Hai un ufficio arredato e pronto all’uso, con costi certi e contratti flessibili, senza spese di allestimento.",
        "Dalla reception ai servizi del centro, tutto è già organizzato in Palazzo Gentiloni, in Via Venti Settembre 118, a pochi minuti da Roma Termini. L’immagine è professionale fin dal primo giorno: puoi ricevere clienti e partner in un ambiente curato.",
      ],
      faq: [
        ["Per quanto tempo posso usare un ufficio temporaneo?", "Per settimane o mesi, con contratti flessibili. La durata si concorda in base alle tue esigenze: contattaci per una proposta."],
        ["Ci sono costi iniziali?", "No, non servono investimenti iniziali. I costi sono certi e definiti prima di iniziare."],
        ["Posso aggiungere altri servizi?", "Sì, ad esempio la domiciliazione dell’indirizzo, la segreteria virtuale o l’uso delle sale riunioni, da concordare separatamente."],
        ["Come verifico la disponibilità?", `Chiamaci al ${contact.phone} o scrivici dalla pagina Contatti: la disponibilità dipende dal periodo richiesto.`],
      ],
      related: [["Ufficio giornaliero", "/ufficio-giornaliero.html"], ["Uffici arredati", "/uffici-arredati.html"], ["Segreteria virtuale", "/segreteria-virtuale.html"], ["Domiciliazione sede legale", "/domiciliazione-sede-legale-roma.html"]],
    },
    en: {
      heading: "An office in Rome for weeks or months, with no upfront investment",
      paragraphs: [
        "A temporary office is for anyone who needs a place to work for a set period: the start of a project, an assignment in Rome, a trial phase before choosing a permanent base. You get a furnished, ready-to-use office with predictable costs and flexible contracts, with no fit-out expense.",
        "From reception to the centre’s services, everything is already in place in Palazzo Gentiloni, Via Venti Settembre 118, a few minutes from Roma Termini. You look professional from day one: you can receive clients and partners in a well-kept setting.",
      ],
      faq: [
        ["How long can I use a temporary office?", "For weeks or months, with flexible contracts. The term is agreed according to your needs: contact us for a proposal."],
        ["Are there upfront costs?", "No upfront investment is needed. Costs are predictable and agreed before you start."],
        ["Can I add other services?", "Yes, for example a registered office or mailing address, a virtual secretary or use of the meeting rooms, agreed separately."],
        ["How do I check availability?", `Call us on ${contact.phone} or write from the Contact page: availability depends on the period you need.`],
      ],
      related: [["Day office", "/en/day-office.html"], ["Furnished offices", "/en/offices-furnished.html"], ["Virtual secretary", "/en/virtual-secretary.html"], ["Registered office address", "/en/legal-headquarters-domiliation.html"]],
    },
  },
  "sale-corsi.html": {
    it: {
      heading: "Sale per corsi, colloqui e riunioni nel centro di Roma",
      paragraphs: [
        "Le sale di Roma Office Sharing sono spazi modulari e tecnologici, adatti a corsi di formazione, colloqui di selezione, riunioni con clienti e incontri di lavoro. Dispongono di schermo e videoconferenza, il layout può essere configurato in base all’evento e la reception assiste i partecipanti.",
        "La sede, in Via Venti Settembre 118, è raggiungibile in pochi minuti a piedi da Roma Termini e dalla Metro A (Repubblica): comoda per chi arriva da fuori città. Puoi combinare la sala con un ufficio giornaliero o con altri servizi del centro.",
      ],
      faq: [
        ["Quali dotazioni hanno le sale?", "Schermo e videoconferenza, con layout configurabile in base al tipo di evento. Se hai esigenze particolari, indicale nella richiesta."],
        ["Per quali eventi sono adatte?", "Corsi e sessioni di formazione, colloqui, riunioni e meeting di lavoro."],
        ["C’è assistenza durante l’evento?", "La reception offre assistenza ai partecipanti negli orari di apertura del centro."],
        ["Come prenoto e quanto costa?", `Il prezzo dipende da sala, durata e allestimento: richiedi un preventivo dalla pagina Contatti o chiamando il ${contact.phone}.`],
      ],
      related: [["Uffici arredati", "/uffici-arredati.html"], ["Ufficio giornaliero", "/ufficio-giornaliero.html"], ["Dove siamo", "/dove-siamo.html"], ["Contatti", "/contatti.html"]],
    },
    en: {
      heading: "Rooms for training, interviews and meetings in central Rome",
      paragraphs: [
        "The rooms at Roma Office Sharing are modular, technology-equipped spaces suited to training courses, job interviews, client meetings and business gatherings. They have a screen and videoconferencing, the layout can be configured for your event, and reception assists your participants.",
        "The centre, at Via Venti Settembre 118, is a few minutes’ walk from Roma Termini and Metro Line A (Repubblica): convenient for anyone arriving from out of town. You can combine a room with a day office or other services at the centre.",
      ],
      faq: [
        ["What equipment do the rooms have?", "A screen and videoconferencing, with a layout that can be configured for the type of event. If you have special requirements, please mention them in your request."],
        ["What events are they suitable for?", "Training courses and sessions, interviews, meetings and business gatherings."],
        ["Is there assistance during the event?", "Reception assists participants during the centre’s opening hours."],
        ["How do I book and how much does it cost?", `The price depends on the room, duration and set-up: request a quote from the Contact page or by calling ${contact.phone}.`],
      ],
      related: [["Furnished offices", "/en/offices-furnished.html"], ["Day office", "/en/day-office.html"], ["Where we are", "/en/where-we-are.html"], ["Contact", "/en/contact.html"]],
    },
  },
  "segreteria-virtuale.html": {
    it: {
      heading: "Una segreteria che risponde per te, a nome della tua società",
      paragraphs: [
        "La segreteria virtuale è un servizio con numero telefonico dedicato e risposta personalizzata a nome della tua società: chi ti chiama trova una voce professionale e i messaggi ti vengono inoltrati. Dai l’immagine di una struttura organizzata, senza assumere una persona.",
        "Si abbina bene alla domiciliazione della sede legale: un indirizzo a Roma per la posta e un numero per le telefonate, gestiti dallo stesso centro. Il servizio non deve avere la stessa durata del contratto di domiciliazione: si può richiedere a partire da 6 mesi, con rinnovo.",
      ],
      faq: [
        ["Che cosa include la segreteria virtuale?", "Un numero telefonico dedicato, la risposta personalizzata a nome della tua società e l’inoltro dei messaggi."],
        ["Per quanto tempo posso attivarla?", "A partire da 6 mesi, rinnovabile. Non deve avere la stessa durata del contratto di domiciliazione."],
        ["Serve anche la domiciliazione?", "No, ma si abbinano bene: se ti serve un indirizzo per la sede legale o per la posta, scopri i servizi di domiciliazione."],
        ["Come chiedo un preventivo?", `Contattaci dalla pagina Contatti o chiama il ${contact.phone}: ti inviamo le condizioni del servizio.`],
      ],
      related: [["Domiciliazione sede legale", "/domiciliazione-sede-legale-roma.html"], ["Domiciliazione postale", "/domiciliazione-postale.html"], ["Tariffe e offerte", "/tariffe.html"], ["Contatti", "/contatti.html"]],
    },
    en: {
      heading: "A secretary that answers for you, in your company’s name",
      paragraphs: [
        "The virtual secretary is a service with a dedicated telephone number and a personalised greeting in your company’s name: callers reach a professional voice and messages are forwarded to you. You present a well-organised business without hiring anyone.",
        "It pairs well with a registered office address: an address in Rome for your mail and a number for your calls, handled by the same centre. The service does not have to run for the same term as the address contract: it can be requested for a minimum of 6 months, renewable.",
      ],
      faq: [
        ["What does the virtual secretary include?", "A dedicated telephone number, a personalised greeting in your company’s name and message forwarding."],
        ["How long can I activate it for?", "From 6 months, renewable. It does not have to match the term of your address contract."],
        ["Do I need an address service too?", "No, but they work well together: if you need a registered office or mailing address, see our domiciliation services."],
        ["How do I ask for a quote?", `Contact us from the Contact page or call ${contact.phone}: we will send you the terms of the service.`],
      ],
      related: [["Registered office address", "/en/legal-headquarters-domiliation.html"], ["Business mailing address", "/en/postal-domiliation.html"], ["Pricing and offers", "/en/pricing.html"], ["Contact", "/en/contact.html"]],
    },
  },
};

export function ServiceExtras({ pageKey, lang }: { pageKey: string; lang: Lang }) {
  const it = lang === "it";
  const content = extras[reverseRouteMap[pageKey] || pageKey]?.[lang];
  if (!content) return null;
  return <>
    <section className="section shell service-extra">
      <span className="eyebrow">{it ? "IN PRATICA" : "IN PRACTICE"}</span>
      <h2>{content.heading}</h2>
      {content.paragraphs.map(text => <p key={text}>{text}</p>)}
      <p className="service-extra-links">{it ? "Scopri anche: " : "See also: "}{content.related.map(([label, href], i) => <span key={href}>{i > 0 && " · "}<Link href={href}>{label}</Link></span>)}</p>
    </section>
    <section className="section shell address-faq">
      <div><span className="eyebrow">FAQ</span><h2>{it ? "Le risposte, prima di scegliere." : "Answers before you decide."}</h2><Link className="arrow-link" href={it ? "/contatti.html" : "/en/contact.html"}>{it ? "Hai altre domande? Scrivici" : "More questions? Write to us"}<ArrowRight /></Link></div>
      <div>{content.faq.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
    </section>
  </>;
}
