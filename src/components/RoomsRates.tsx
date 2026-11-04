import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { BASE_URL, contact, hrefFor, type Lang } from "@/lib/site";
import { JsonLd } from "./JsonLd";

// Facts and prices of the meeting/training rooms, in one place so the page text, the FAQ and the structured data can
// never disagree. Prices are in euro, VAT excluded. The monthly rental is shown only while the owner has a room to rent
// (Configurazione Web → "Affitto mensile sala").
export const ROOMS = { hourlyUpTo5: 25, hourlyUpTo12: 35, halfDay: 70, fullDay: 100, monthlyFrom: 750, monthlySqm: 15, monthlyMonths: 12 };
const eur = (n: number) => `${n.toLocaleString("it-IT")} €`;

export function roomsContent(lang: Lang, monthly: boolean) {
  const it = lang === "it";
  const heading = it ? "Affitto sala corsi e riunioni nel centro di Roma, vicino a Termini" : "Meeting and training room hire in central Rome, near Termini";
  const paragraphs = it ? [
    "Le sale di Roma Office Sharing si trovano al primo piano di Palazzo Gentiloni, in Via Venti Settembre 118, a pochi minuti a piedi da Roma Termini e dalla Metro A (Repubblica). Sono sale tecnologiche, con schermo e videoconferenza, adatte a corsi di formazione, colloqui di selezione, riunioni con i clienti e incontri di lavoro.",
    "L’allestimento abituale prevede un tavolo centrale da 4, 6 o 10 persone; la disposizione può essere adattata al tipo di evento. La reception assiste i partecipanti negli orari di apertura (dal lunedì al venerdì 8:30–19:00, sabato 8:30–13:00 su richiesta). Il coffee break non è previsto, ma nell’area buffet puoi prenderti un caffè.",
    ...(monthly ? [`Se ti serve una sala in modo continuativo, puoi affittarla al mese: sala da ${ROOMS.monthlySqm} mq con contratto di ${ROOMS.monthlyMonths} mesi, a partire da ${eur(ROOMS.monthlyFrom)} + IVA al mese.`] : []),
  ] : [
    "The rooms at Roma Office Sharing are on the first floor of Palazzo Gentiloni, at Via Venti Settembre 118, a few minutes’ walk from Roma Termini and Metro Line A (Repubblica). They are technology-equipped rooms with a screen and video conferencing, suited to training courses, job interviews, client meetings and business gatherings.",
    "The usual set-up is a central table for 4, 6 or 10 people; the layout can be adapted to the type of event. Reception assists participants during opening hours (Monday to Friday 8:30–19:00, Saturday 8:30–13:00 on request). Coffee breaks are not provided, but there is a buffet area where you can get a coffee.",
    ...(monthly ? [`If you need a room on an ongoing basis you can rent it by the month: a ${ROOMS.monthlySqm} sqm room on a ${ROOMS.monthlyMonths}-month agreement, from ${eur(ROOMS.monthlyFrom)} + VAT per month.`] : []),
  ];
  const faq: [string, string][] = it ? [
    ["Quanto costa affittare una sala a Roma?", `A ore: ${eur(ROOMS.hourlyUpTo5)} l’ora fino a 5 persone e ${eur(ROOMS.hourlyUpTo12)} l’ora da 5 a 10–12 persone. Mezza giornata ${eur(ROOMS.halfDay)} e intera giornata ${eur(ROOMS.fullDay)}, senza distinzione sul numero di persone. Prezzi + IVA.`],
    ["Quante persone può ospitare la sala?", "L’allestimento abituale ha un tavolo centrale da 4, 6 o 10 persone. Fino a 5 persone si applica la tariffa da 25 € l’ora, da 5 a 10–12 persone quella da 35 € l’ora."],
    ["Posso prenotare una mezza giornata o un’intera giornata?", `Sì: mezza giornata ${eur(ROOMS.halfDay)} + IVA, intera giornata ${eur(ROOMS.fullDay)} + IVA, qualunque sia il numero di partecipanti.`],
    ["Quali dotazioni hanno le sale?", "Schermo e videoconferenza, con layout adattabile al tipo di evento. Se hai esigenze particolari, indicale nella richiesta."],
    ["Il prezzo comprende il coffee break?", "No: il servizio di coffee break non è previsto. Nell’area buffet del centro è però possibile prendere un caffè."],
    ["Per quali eventi sono adatte le sale?", "Corsi e sessioni di formazione, colloqui di selezione, riunioni con clienti e meeting di lavoro."],
    ["C’è assistenza durante l’evento?", "La reception assiste i partecipanti negli orari di apertura del centro."],
    ["Dove si trovano e come si raggiungono?", "In Via Venti Settembre 118, al primo piano di Palazzo Gentiloni: a pochi minuti a piedi da Roma Termini e dalla Metro A (fermata Repubblica)."],
    ["Come prenoto una sala?", `Chiama il ${contact.phone} oppure scrivici dalla pagina Contatti indicando data, orario e numero di partecipanti: ti confermiamo disponibilità e prezzo.`],
    ...(monthly ? [
      ["Posso affittare una sala per un periodo lungo?", `Sì, con l’affitto mensile: sala da ${ROOMS.monthlySqm} mq con contratto di ${ROOMS.monthlyMonths} mesi. Chiamaci o scrivici per vedere la sala e la disponibilità.`],
      ["Quanto costa l’affitto mensile di una sala?", `A partire da ${eur(ROOMS.monthlyFrom)} + IVA al mese per una sala da ${ROOMS.monthlySqm} mq, con contratto di ${ROOMS.monthlyMonths} mesi.`],
    ] as [string, string][] : []),
  ] : [
    ["How much does it cost to hire a room in Rome?", `By the hour: €${ROOMS.hourlyUpTo5} per hour for up to 5 people and €${ROOMS.hourlyUpTo12} per hour for 5 to 10–12 people. Half day €${ROOMS.halfDay} and full day €${ROOMS.fullDay}, regardless of the number of people. Prices + VAT.`],
    ["How many people fit in the room?", "The usual set-up has a central table for 4, 6 or 10 people. Up to 5 people the €25 per hour rate applies; from 5 to 10–12 people the €35 per hour rate."],
    ["Can I book half a day or a full day?", `Yes: half day €${ROOMS.halfDay} + VAT, full day €${ROOMS.fullDay} + VAT, whatever the number of participants.`],
    ["What equipment do the rooms have?", "A screen and video conferencing, with a layout that can be adapted to the event. If you have special requirements, please mention them in your request."],
    ["Is a coffee break included?", "No: coffee breaks are not provided. There is, however, a buffet area in the centre where you can get a coffee."],
    ["What events are the rooms suited to?", "Training courses and sessions, job interviews, client meetings and business meetings."],
    ["Is there assistance during the event?", "Reception assists participants during the centre’s opening hours."],
    ["Where are the rooms and how do I get there?", "At Via Venti Settembre 118, on the first floor of Palazzo Gentiloni: a few minutes’ walk from Roma Termini and Metro Line A (Repubblica stop)."],
    ["How do I book a room?", `Call ${contact.phone} or write to us from the Contact page with the date, time and number of participants: we will confirm availability and price.`],
    ...(monthly ? [
      ["Can I rent a room for a long period?", `Yes, with the monthly rental: a ${ROOMS.monthlySqm} sqm room on a ${ROOMS.monthlyMonths}-month agreement. Call or write to us to see the room and check availability.`],
      ["How much does a monthly room rental cost?", `From €${ROOMS.monthlyFrom} + VAT per month for a ${ROOMS.monthlySqm} sqm room on a ${ROOMS.monthlyMonths}-month agreement.`],
    ] as [string, string][] : []),
  ];
  return { heading, paragraphs, faq };
}

export function RoomsRates({ lang, monthly, pageKey }: { lang: Lang; monthly: boolean; pageKey: string }) {
  const it = lang === "it";
  const rows: [string, string][] = it ? [
    ["Fino a 5 persone", `${eur(ROOMS.hourlyUpTo5)} / ora`],
    ["Da 5 a 10–12 persone", `${eur(ROOMS.hourlyUpTo12)} / ora`],
    ["Mezza giornata", eur(ROOMS.halfDay)],
    ["Intera giornata", eur(ROOMS.fullDay)],
  ] : [
    ["Up to 5 people", `€${ROOMS.hourlyUpTo5} / hour`],
    ["5 to 10–12 people", `€${ROOMS.hourlyUpTo12} / hour`],
    ["Half day", `€${ROOMS.halfDay}`],
    ["Full day", `€${ROOMS.fullDay}`],
  ];
  const contactHref = it ? "/contatti.html" : "/en/contact.html";
  const offer = (name: string, price: number, unitCode?: string) => ({
    "@type": "Offer", name, price: price.toFixed(2), priceCurrency: "EUR", availability: "https://schema.org/InStock",
    priceSpecification: { "@type": "UnitPriceSpecification", price, priceCurrency: "EUR", valueAddedTaxIncluded: false, ...(unitCode ? { unitCode } : {}) },
  });
  const data = {
    "@context": "https://schema.org", "@type": "Service", serviceType: it ? "Affitto sala corsi e riunioni" : "Meeting and training room hire",
    name: it ? "Affitto sala corsi e riunioni a Roma" : "Meeting and training room hire in Rome", url: `${BASE_URL}${hrefFor(pageKey)}`,
    provider: { "@id": `${BASE_URL}/#business` }, areaServed: { "@type": "City", name: "Roma" },
    offers: [
      offer(it ? "Sala fino a 5 persone, tariffa oraria" : "Room for up to 5 people, hourly rate", ROOMS.hourlyUpTo5, "HUR"),
      offer(it ? "Sala da 5 a 10–12 persone, tariffa oraria" : "Room for 5 to 10–12 people, hourly rate", ROOMS.hourlyUpTo12, "HUR"),
      offer(it ? "Sala, mezza giornata" : "Room, half day", ROOMS.halfDay),
      offer(it ? "Sala, intera giornata" : "Room, full day", ROOMS.fullDay),
      ...(monthly ? [offer(it ? `Affitto mensile sala ${ROOMS.monthlySqm} mq, contratto ${ROOMS.monthlyMonths} mesi (da)` : `Monthly rental of a ${ROOMS.monthlySqm} sqm room, ${ROOMS.monthlyMonths}-month agreement (from)`, ROOMS.monthlyFrom, "MON")] : []),
    ],
  };
  return <section className="section shell rooms-rates">
    <JsonLd data={data} />
    <span className="eyebrow">{it ? "TARIFFE" : "PRICING"}</span>
    <h2>{it ? "Quanto costa affittare una sala" : "How much does a room cost"}</h2>
    <table className="price-snapshot-table"><thead><tr><th scope="col">{it ? "Formula" : "Option"}</th><th scope="col">{it ? "Prezzo + IVA" : "Price + VAT"}</th></tr></thead>
      <tbody>{rows.map(([label, price]) => <tr key={label}><td>{label}</td><td>{price}</td></tr>)}</tbody></table>
    <p className="form-note">{it ? "Mezza giornata e intera giornata hanno lo stesso prezzo per qualsiasi numero di persone. Il coffee break non è previsto; nell’area buffet puoi prenderti un caffè." : "Half-day and full-day prices are the same for any number of people. Coffee breaks are not provided; there is a buffet area where you can get a coffee."}</p>
    {monthly && <div className="rooms-monthly">
      <h3>{it ? "Affitto mensile della sala" : "Monthly room rental"}</h3>
      <p><b>{it ? `Da ${eur(ROOMS.monthlyFrom)} + IVA al mese` : `From €${ROOMS.monthlyFrom} + VAT per month`}</b> {it ? `per una sala da ${ROOMS.monthlySqm} mq, con contratto di ${ROOMS.monthlyMonths} mesi.` : `for a ${ROOMS.monthlySqm} sqm room on a ${ROOMS.monthlyMonths}-month agreement.`}</p>
      <ul className="check-list"><li><Check />{it ? "Sala disponibile ora" : "Room available now"}</li><li><Check />{it ? "Reception, schermo e videoconferenza" : "Reception, screen and video conferencing"}</li><li><Check />{it ? "Primo piano di Palazzo Gentiloni, vicino a Termini" : "First floor of Palazzo Gentiloni, near Termini"}</li></ul>
      <Link className="button primary" href={contactHref}>{it ? "Richiedi informazioni" : "Ask for information"}<ArrowRight /></Link>
    </div>}
  </section>;
}
