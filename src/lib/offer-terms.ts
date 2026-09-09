import { copyFor, formatEur, validity, type ProductOffer, type Lang } from "./pricing";
export type OfferTerms = { heading: string; included: string[]; extrasHeading: string; extras: string[]; paragraphs: string[]; paymentHeading: string; payment: string[]; deposit: string };
export function offerTerms(product: ProductOffer, lang: Lang): OfferTerms {
  const it = lang === "it";
  const price = (code: string) => { const a = product.addons.find(a => a.code === code); if (!a) throw new Error(`Missing catalogue addon: ${code}`); return a; };
  const amount = (cents: number) => `${new Intl.NumberFormat(it ? "it-IT" : "en-GB", { maximumFractionDigits: 2 }).format(cents / 100)}€`;
  if (product.code === "legal_unit") return {
    heading: it ? "La domiciliazione sede legale comprende:" : "The registered office address service includes:",
    included: [copyFor(product.code, lang).description, it ? "Utilizzo dell’indirizzo dopo la conferma di attivazione del centro." : "Use of the address after the centre confirms activation."],
    extrasHeading: it ? "Condizioni dell’offerta" : "Offer terms", extras: [],
    paragraphs: [validity(product, lang), it ? `Sconto una-tantum del ${product.newActivationDiscountBps / 100}% per nuove attivazioni sulle durate contrassegnate, entro la validità dell’offerta. I rinnovi non includono lo sconto nuove attivazioni.` : `A one-off ${product.newActivationDiscountBps / 100}% new-activation discount applies to marked durations within the offer period. This discount does not apply to renewals.`, additionalNote(product, lang), it ? `Prezzi IVA ${product.vatBps / 100}% esclusa. L’utilizzo dell’indirizzo è soggetto al contratto e alla verifica della documentazione.` : `Prices exclude ${product.vatBps / 100}% VAT. Address use is subject to the agreement and document checks.`],
    paymentHeading: it ? "Pagamento anticipato" : "Payment in advance", payment: [it ? "Bonifico bancario o pagamento online tramite Stripe, PayPal o SumUp." : "Bank transfer or online payment via Stripe, PayPal or SumUp."], deposit: "",
  };
  const secretary = price("virtual_secretary"), archive = price("archive");
  return {
    heading: it ? "La domiciliazione postale comprende:" : "The business mailing address service includes:",
    included: it ? [
      "Recapito postale",
      "Logo aziendale esposto al piano (su richiesta)",
      "Scansione corrispondenza, atti giudiziari e raccomandate in modalità busta chiusa per privacy, con inoltro a Vs indirizzo email entro le 24h dal ricevimento",
      "Apertura e scansione della corrispondenza su richiesta (10 aperture/mese incluse)",
    ] : [
      "Business mailing address",
      "Company logo displayed on the floor (on request)",
      "Scanning of the sealed envelopes of correspondence, court documents and registered mail to protect privacy, forwarded to your email address within 24 hours of receipt",
      "Opening and scanning of correspondence on request (10 openings per month included)",
    ],
    extrasHeading: it ? "Servizi opzionali a pagamento :" : "Optional paid services:",
    extras: it ? [
      `Segreteria Virtuale, con numero telefonico dedicato e risposta a nome della Vs società: ${amount(secretary.priceCents)}/mese (+ ${amount(secretary.annualCents)} per canone annuo numero Voip)`,
      `Apertura corrispondenza extra ${amount(price("extra_opening").priceCents)} per busta`,
      `Servizio archivio documentazione (faldoni tipo doxa dimensioni 8x23x33cm, max ${archive.maxQuantity} faldoni): ${amount(archive.priceCents)}/mese per faldone`,
      `Linea fax con numero personale: ${amount(price("personal_fax").priceCents)}/mese`,
      `Invio raccomandate a nome della società (con firma digitale): ${amount(price("registered_mail").priceCents)} l’una + costo raccomandata`,
      `Invio fax a nome della società (con firma digitale): ${amount(price("fax_send").priceCents)} l’uno`,
      `Inoltro corrispondenza in giacenza a Vs sede (${amount(price("mail_forwarding").priceCents)} servizio + costo spedizione tramite corriere o poste)`,
    ] : [
      `Virtual secretary with a dedicated telephone number and calls answered in your company’s name: ${formatEur(secretary.priceCents, lang)}/month (+ ${formatEur(secretary.annualCents, lang)} annual VoIP number fee)`,
      `Additional mail opening: ${formatEur(price("extra_opening").priceCents, lang)} per envelope`,
      `Document archive (Doxa-type binders, 8x23x33cm, up to ${archive.maxQuantity} binders): ${formatEur(archive.priceCents, lang)}/month per binder`,
      `Fax line with a personal number: ${formatEur(price("personal_fax").priceCents, lang)}/month`,
      `Registered letters sent on behalf of the company (with digital signature): ${formatEur(price("registered_mail").priceCents, lang)} each + postage`,
      `Faxes sent on behalf of the company (with digital signature): ${formatEur(price("fax_send").priceCents, lang)} each`,
      `Forwarding stored mail to your office (${formatEur(price("mail_forwarding").priceCents, lang)} service charge + courier or postal shipping cost)`,
    ],
    paragraphs: it ? [
      "Ove non indicato, i costi si intendono tutti iva esclusa",
      "Nel caso di servizi aggiuntivi, come ad esempio un numero su Roma con risposta a Suo nome, il canone mensile (e quindi il totale da versare) andrà maggiorato del relativo costo. All'interno del contratto andrà segnata la relativa opzione nell'allegato 1.",
      "Come anticipato provvediamo ad allegare alla presente il modulo richiesta domiciliazione postale. Questo va restituito, nel caso, correttamente compilato con i dati del referente. Ricevuto il modulo compilato provvederemo ad inviarLe il contratto unitamente ai dati per il pagamento.",
      "Le condizioni di pagamento sono le seguenti:", "- Pagamento anticipato",
    ] : [
      "Unless stated otherwise, all prices exclude VAT.",
      "For additional services, such as a Rome telephone number answered in your name, the monthly fee (and therefore the total amount payable) will increase by the relevant charge. The corresponding option must be marked in Annex 1 of the agreement.",
      "As discussed, we attach the business mailing address request form. If you wish to proceed, please return it correctly completed with the contact person’s details. On receipt of the completed form, we will send you the agreement together with the payment details.",
      "Payment terms:", "- Payment in advance",
    ],
    paymentHeading: it ? "Le modalità di pagamento sono le seguenti:" : "Payment methods:",
    payment: it ? ["Bonifico Bancario", "Contanti / Bancomat / Carta di credito (in sede)", "Carta di Credito (Da remoto)"] : ["Bank transfer", "Cash / debit card / credit card (on site)", "Credit card (remotely)"],
    deposit: it ? "NOTA: non è previsto deposito cauzionale" : "NOTE: no security deposit is required",
  };
}
export function additionalNote(product: ProductOffer, lang: Lang) {
  return lang === "it" ? `E' previsto uno sconto del ${product.additionalDiscountBps / 100}% per domiciliazioni aggiuntive aventi stesso referente/amministratore` : `A ${product.additionalDiscountBps / 100}% discount applies to additional address services with the same contact person/administrator.`;
}
export function termsText(product: ProductOffer, lang: Lang) {
  const t = offerTerms(product, lang);
  return [t.heading, ...t.included.map(v => `• ${v}`), "", t.extrasHeading, ...t.extras.map(v => `• ${v}`), "", ...t.paragraphs, "", t.paymentHeading, ...t.payment.map(v => `- ${v}`), "", t.deposit].filter(v => v !== undefined).join("\n");
}
