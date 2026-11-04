import Link from "next/link";
import { headers } from "next/headers";
import type { Metadata } from "next";

// A real 404 (status 404, not indexed) instead of a permanent redirect to the home page, which search engines treat
// as a "soft 404". Known old URLs keep their explicit redirects in next.config.ts.
export const metadata: Metadata = { title: "Pagina non trovata | Roma Office Sharing", robots: { index: false, follow: false } };

export default async function NotFound() {
  const path = (await headers()).get("x-pathname") || "/";
  const it = !path.startsWith("/en");
  const links: [string, string][] = it
    ? [["Domiciliazione sede legale a Roma", "/domiciliazione-sede-legale-roma.html"], ["Domiciliazione postale", "/domiciliazione-postale.html"], ["Affitto sale corsi e riunioni", "/sale-corsi.html"], ["Uffici arredati", "/uffici-arredati.html"], ["Tariffe", "/tariffe.html"], ["Contatti", "/contatti.html"]]
    : [["Registered office address in Rome", "/en/legal-headquarters-domiliation.html"], ["Business mailing address", "/en/postal-domiliation.html"], ["Meeting and training rooms", "/en/course-rooms.html"], ["Furnished offices", "/en/offices-furnished.html"], ["Pricing", "/en/pricing.html"], ["Contact", "/en/contact.html"]];
  return (
    <main id="main" className="section shell">
      <span className="eyebrow">{it ? "ERRORE 404" : "ERROR 404"}</span>
      <h1>{it ? "Pagina non trovata" : "Page not found"}</h1>
      <p className="lead">{it ? "L’indirizzo che hai aperto non esiste o è stato spostato. Ecco le pagine principali del sito:" : "The address you opened does not exist or has moved. Here are the main pages of the site:"}</p>
      <ul className="check-list">{links.map(([label, href]) => <li key={href}><Link href={href}>{label}</Link></li>)}</ul>
      <p><Link className="arrow-link" href={it ? "/" : "/en/index.html"}>{it ? "Torna alla home" : "Back to the home page"}</Link></p>
    </main>
  );
}
