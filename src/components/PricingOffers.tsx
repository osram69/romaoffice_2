import Link from "next/link";
import { ArrowRight, Building2, FileDown, Mail } from "lucide-react";
import { copyFor, quote, offerActive, formatEur, monthlyEquivalent, renewalNote, activationHref, validity, type ProductOffer, type Lang } from "@/lib/pricing";
import { additionalNote } from "@/lib/offer-terms";
import { OfferTermsBody } from "./OfferTerms";
import { StandardOfferModal } from "./StandardOfferModal";
import { ManualRequestModal } from "./ManualRequestModal";

export const REQUEST_MODULE_FILENAME = "Modulo_Richiesta_Domiciliazione_ns.pdf";

export function PricingOffer({ product, lang }: { product: ProductOffer; lang: Lang }) {
  const it = lang === "it"; const copy = copyFor(product.code, lang); const active = offerActive(product); const postal = product.code === "postal";
  const example = quote(product, { months: 12, newActivation: true });
  return <article className={`offer-card ${postal ? "postal-offer" : "legal-offer"}`} id={`offer-${product.code}`}>
    <div className="offer-head"><div><span className="offer-badge">{postal ? <Mail /> : <Building2 />}{it ? "ATTIVABILE ONLINE" : "AVAILABLE ONLINE"}</span><h3>{copy.name}</h3><p>{copy.description}</p></div><div className="offer-actions"><Link className="button primary" href={activationHref(product.code, lang)}>{it ? "Attiva Online" : "Activate Online"}<ArrowRight /></Link><ManualRequestModal product={product} lang={lang} /><StandardOfferModal service={product.code} lang={lang} /><a className="button secondary" href={`/${REQUEST_MODULE_FILENAME}`} download>{it ? "Scarica il modulo" : "Download the form"}<FileDown /></a></div></div>
    <div className="table-wrap"><table className="price-table"><caption className="sr-only">{copy.name} — {it ? "prezzi IVA esclusa" : "prices excluding VAT"}</caption><thead><tr><th scope="col">{copy.duration}</th><th scope="col">{copy.rate}</th><th scope="col">{postal ? (it ? "Attuale offerta" : "Current offer") : copy.offer}</th></tr></thead><tbody>{product.tiers.map(tier => <tr key={tier.months} className={active && tier.offerCents !== null ? "highlight" : ""}><th scope="row">{copy.months(tier.months)}</th><td>{formatEur(tier.listCents, lang)} <small>{it ? "+ IVA" : "+ VAT"}</small><small className="monthly-equivalent">≈ {monthlyEquivalent(tier.listCents, tier.months, lang)}/{it ? "mese" : "mo"}</small></td><td>{tier.offerCents !== null ? <><b>{formatEur(tier.offerCents, lang)} <small>{it ? "+ IVA" : "+ VAT"}</small></b>{tier.newActivation && active && <span className="offer-flag"> (*)</span>}<small className="monthly-equivalent">≈ {monthlyEquivalent(tier.offerCents, tier.months, lang)}/{it ? "mese" : "mo"}</small></> : <span>—</span>}</td></tr>)}</tbody></table></div>
    <p className="offer-validity">{validity(product, lang)}{!active && (it ? " — offerte scadute: si applica il listino." : " — expired: standard rates apply.")}</p>
    <p className="offer-renewal-note"><b>{it ? "Al rinnovo: " : "At renewal: "}</b>{renewalNote(product, lang)}</p>
    <div className="offer-notes">{!postal && <><p>{it ? `(*) SCONTO NUOVE ATTIVAZIONI: sulle tariffe evidenziate (6 e 12 mesi), entro la validità dell’offerta, è previsto uno sconto ulteriore una-tantum del ${product.newActivationDiscountBps / 100}% per i nuovi clienti/società.` : `(*) NEW ACTIVATION DISCOUNT: an additional one-off ${product.newActivationDiscountBps / 100}% discount applies to the highlighted 6- and 12-month rates for new clients/companies during the offer period.`}</p>{example && example.newActivationDiscountCents > 0 && <p>{it ? `ESEMPIO: Contratto 12 mesi, attivazione al costo di ${formatEur(example.netCents, lang)} + IVA e rinnovi successivi al costo di ${formatEur(example.renewalBaseCents, lang)} + IVA.` : `EXAMPLE: 12-month agreement, activation at ${formatEur(example.netCents, lang)} + VAT; subsequent renewals at ${formatEur(example.renewalBaseCents, lang)} + VAT.`}</p>}</>}<p>{additionalNote(product, lang)}</p><p className="muted">{it ? `Tutti i prezzi sono IVA ${product.vatBps / 100}% esclusa.` : `All prices exclude ${product.vatBps / 100}% VAT.`}</p></div>
    {!postal && <SmartStartCard lang={lang} />}
    <details className="postal-terms-preview"><summary>{it ? `Leggi cosa comprende ${copy.nameShort} e le condizioni complete` : `Read what ${copy.nameShort} includes and the full terms`}</summary><OfferTermsBody product={product} lang={lang} /></details>
    <Faq lang={lang} postal={postal} />
  </article>;
}

function SmartStartCard({ lang }: { lang: Lang }) {
  const it = lang === "it";
  return <div className="smart-start-card">
    <span className="eyebrow">{it ? "NOVITÀ — SOLO SOCIETÀ DA COSTITUIRE" : "NEW — FOR COMPANIES BEING FORMED ONLY"}</span>
    <h4>{it ? "Contratto Smart-Start: risparmia di più nei primi mesi" : "Smart-Start agreement: save more in the first months"}</h4>
    <p>{it ? "Pensato per chi sta aprendo una nuova attività: una prima tranche a canone ridotto, poi un contratto standard di 24 mesi. Riservato a nuove partite IVA o società non ancora costituite." : "Designed for a brand-new business: a first instalment at a reduced monthly fee, followed by a standard 24-month agreement. Reserved for new VAT numbers or companies not yet incorporated."}</p>
    <div className="smart-start-tiers">
      <div><b>Smart-Start 3+24</b><p>{it ? "Prima tranche: 3 mesi a 20 €/mese (60 € + IVA) — poi 24 mesi a 1.000 € + IVA" : "First instalment: 3 months at €20/month (€60 + VAT) — then 24 months at €1,000 + VAT"}</p></div>
      <div><b>Smart-Start 6+24</b><p>{it ? "Prima tranche: 6 mesi a 20 €/mese (120 € + IVA) — poi 24 mesi a 1.080 € + IVA" : "First instalment: 6 months at €20/month (€120 + VAT) — then 24 months at €1,080 + VAT"}</p></div>
    </div>
    <p className="form-note">{it ? "Il contratto Smart-Start ha una struttura a due tranche non gestibile dal pagamento online automatico: richiedilo con il modulo online o telefonicamente, lo prepariamo su misura." : "The Smart-Start agreement has a two-instalment structure that the automated online checkout cannot handle: request it via the online form or by phone and we will prepare it for you."}</p>
  </div>;
}

function Faq({ lang, postal }: { lang: Lang; postal: boolean }) {
  const it = lang === "it";
  const common: [string, string][] = it ? [
    ["Serve un deposito cauzionale?", "No, nessun contratto di domiciliazione o segreteria prevede un deposito cauzionale."],
  ] : [
    ["Do I need to pay a security deposit?", "No, none of our address or secretarial agreements require a security deposit."],
  ];
  const legal: [string, string][] = it ? [
    ["Qual è la differenza tra sede legale primaria, sede secondaria e unità locale?", "La sede legale primaria è l'indirizzo ufficiale di una società nuova o che si trasferisce; la sede secondaria è una seconda sede legale formale per una società già esistente altrove; l'unità locale è un punto operativo (utile ad esempio per una gara d'appalto) e presuppone un'attività reale sul posto — per questo, a differenza delle prime due, ha senso solo abbinata a ore di ufficio effettivamente utilizzabili (vedi il servizio opzionale sopra)."],
    ["Posso disdire quando voglio?", "Puoi recedere con un preavviso di 30 giorni rispetto alla scadenza naturale del contratto, tramite PEC o raccomandata A/R. I canoni già versati non vengono restituiti per il periodo non goduto."],
    ["La domiciliazione include l'accesso fisico a un ufficio?", "No: il servizio è di solo recapito e gestione della corrispondenza. Per lavorare in sede o ricevere clienti puoi aggiungere l'ufficio temporaneo attrezzato come servizio opzionale."],
  ] : [
    ["What's the difference between a primary registered office, a secondary office and a local unit?", "A primary registered office is the official address for a new or relocating company; a secondary office is a second formal registered address for a company already established elsewhere; a local unit is an operating location (useful, for example, to bid for a public tender) and presumes genuine on-site activity — unlike the first two, it only makes sense paired with usable office hours (see the optional service above)."],
    ["Can I cancel whenever I want?", "You can give notice 30 days before the agreement's natural expiry, by certified email (PEC) or registered post. Fees already paid are not refunded for the unused period."],
    ["Does the service include physical access to an office?", "No: this is a mail-handling and correspondence service only. To work on site or receive clients, you can add the equipped temporary office as an optional service."],
  ];
  const postalOnly: [string, string][] = it ? [
    ["Posso usare l'indirizzo come sede legale?", "No: la domiciliazione postale/commerciale non può essere comunicata alla Camera di Commercio o all'Agenzia delle Entrate (non va \"in visura\"). Puoi usarla su biglietti da visita e materiale pubblicitario, non come sede legale."],
    ["Posso disdire quando voglio?", "Sì, secondo i termini di preavviso indicati nelle condizioni complete dell'offerta, consultabili qui sopra."],
  ] : [
    ["Can I use the address as my registered office?", "No: the business mailing/commercial address cannot be filed with the Chamber of Commerce or the Revenue Agency (it does not appear on the company register). You can use it on business cards and marketing material, not as a registered office."],
    ["Can I cancel whenever I want?", "Yes, according to the notice terms set out in the full offer terms above."],
  ];
  const items = postal ? [...common, ...postalOnly] : [...common, ...legal];
  return <div className="pricing-faq"><h4>{it ? "Domande frequenti" : "Frequently asked questions"}</h4>{items.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>;
}
