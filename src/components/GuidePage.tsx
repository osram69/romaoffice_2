import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { BASE_URL, hrefFor, pages, reverseRouteMap, routeMap, type Lang } from "@/lib/site";
import { GUIDE_UPDATED, guideFor, guideKeys, type GuideSection } from "@/lib/guides";
import type { Catalog } from "@/lib/pricing";
import { PriceSnapshot } from "./AddressServices";
import { FaqJsonLd, JsonLd } from "./JsonLd";

const slug = (text: string) => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const itKeyOf = (key: string) => reverseRouteMap[key] || key;

function Section({ s }: { s: GuideSection }) {
  return <section className="guide-section" id={slug(s.h)}>
    <h2>{s.h}</h2>
    {s.p?.map(text => <p key={text}>{text}</p>)}
    {s.ul && <ul className="check-list">{s.ul.map(item => <li key={item}><Check />{item}</li>)}</ul>}
    {s.ol && <ol className="guide-steps">{s.ol.map(item => <li key={item}>{item}</li>)}</ol>}
    {s.table && <div className="guide-table-wrap"><table className="guide-table"><thead><tr>{s.table.head.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{s.table.rows.map(row => <tr key={row[0]}>{row.map((cell, i) => i === 0 ? <th key={i} scope="row">{cell}</th> : <td key={i}>{cell}</td>)}</tr>)}</tbody></table></div>}
    {s.note && <p className="guide-note">{s.note}</p>}
  </section>;
}

export function GuidePage({ pageKey, lang, catalog }: { pageKey: string; lang: Lang; catalog: Catalog }) {
  const it = lang === "it"; const g = guideFor(itKeyOf(pageKey), lang);
  if (!g) return null;
  const product = catalog.legal_unit; const activateHref = it ? "/attiva.html?service=legal_unit" : "/en/activate.html?service=legal_unit";
  const updated = new Date(GUIDE_UPDATED).toLocaleDateString(it ? "it-IT" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const articleLd = {
    "@context": "https://schema.org", "@type": "Article", headline: g.h1, description: pages[pageKey].description, inLanguage: it ? "it-IT" : "en-GB",
    datePublished: GUIDE_UPDATED, dateModified: GUIDE_UPDATED, mainEntityOfPage: `${BASE_URL}${hrefFor(pageKey)}`,
    author: { "@id": `${BASE_URL}/#business` }, publisher: { "@id": `${BASE_URL}/#business` },
  };
  return <>
    <JsonLd data={articleLd} />
    <FaqJsonLd items={g.faq} />
    <section className="section shell guide-head">
      <span className="eyebrow">{g.eyebrow}</span>
      <h1>{g.h1}</h1>
      <p className="lead">{g.lead}</p>
      <p className="guide-meta">{it ? `Aggiornato il ${updated} · A cura di Roma Office Sharing (Cube Engineering s.r.l.), dal 2014 a Roma` : `Updated ${updated} · By Roma Office Sharing (Cube Engineering s.r.l.), in Rome since 2014`}</p>
      <dl className="guide-facts">{g.facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <div className="offer-actions"><Link href={activateHref} className="button primary">{it ? "Attiva Online" : "Activate Online"}<ArrowRight /></Link><Link className="button secondary" href={it ? "/contatti.html" : "/en/contact.html"}>{it ? "Chiedi informazioni" : "Request information"}</Link></div>
    </section>
    <div className="section shell guide-body">
      {g.sections.map((s, i) => <div key={s.h}>
        <Section s={s} />
        {i === g.priceAfter && <PriceSnapshot product={product} lang={lang} activateHref={activateHref} />}
      </div>)}
    </div>
    <section className="section shell address-faq">
      <div><span className="eyebrow">FAQ</span><h2>{it ? "Le risposte, prima di scegliere." : "Answers before you decide."}</h2>
        <p className="service-extra-links">{it ? "Approfondisci: " : "Read more: "}{g.related.map(([label, href], i) => <span key={href}>{i > 0 && " · "}<Link href={href}>{label}</Link></span>)}</p>
        <Link className="arrow-link" href={it ? "/contatti.html" : "/en/contact.html"}>{it ? "Hai altre domande? Scrivici" : "More questions? Write to us"}<ArrowRight /></Link></div>
      <div>{g.faq.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
    </section>
  </>;
}

/** Cards that point to the guides, shown on the hub page and on the registered-office page. */
export function GuideLinks({ lang, exclude }: { lang: Lang; exclude?: string }) {
  const it = lang === "it";
  const keys = guideKeys.filter(k => k !== itKeyOf(exclude || ""));
  return <section className="section shell guide-links">
    <div className="section-heading"><div><span className="eyebrow">{it ? "GUIDE E APPROFONDIMENTI" : "GUIDES"}</span><h2>{it ? "Per ogni esigenza, la guida giusta" : "The right guide for every need"}</h2></div><p>{it ? "Procedure, documenti, costi e limiti spiegati passo per passo, per cambiare sede, partire con una startup, operare dall’estero o scegliere una sede virtuale." : "Procedures, documents, costs and limits explained step by step: changing your seat, starting a startup, operating from abroad or choosing a virtual office."}</p></div>
    <div className="service-grid">{keys.map(k => { const key = it ? k : routeMap[k]; const p = pages[key]; return <article className="service-card" key={k}><h3>{p.title}</h3><p>{p.description}</p><Link href={hrefFor(key)}>{it ? "Leggi la guida" : "Read the guide"}<ArrowRight /><span className="sr-only">: {p.title}</span></Link></article>; })}</div>
  </section>;
}
