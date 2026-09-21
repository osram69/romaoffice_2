import { FileCheck2 } from "lucide-react";
import { privacySections, ui, type Lang } from "@/lib/site";

// Shared between the standalone /privacy.html and /cookie-policy.html pages (for direct links,
// SEO and sharing) and the in-page popups opened from consent checkboxes and the footer, so the
// two can never drift out of sync.
export function PrivacyNoticeContent({ lang }: { lang: Lang }) {
  const it = lang === "it";
  return <>
    <div className="notice"><FileCheck2 aria-hidden="true" /><p>{it ? "Il testo italiano della presente informativa è la versione autorevole." : "This is a faithful English translation. In case of discrepancy, the Italian original is authoritative."}</p></div>
    <h2>{it ? "INFORMATIVA PRIVACY" : "PRIVACY NOTICE"}</h2>
    {privacySections[lang].map(([h, b]) => <section key={h}><h3>{h}</h3><p>{b}</p></section>)}
    <section className="customer-privacy-addendum">
      <h3>{it ? "Area Clienti — accessi e documenti" : "Customer Area — sign-in and documents"}</h3>
      <p>{it ? "L’area riservata utilizza email, password memorizzata in forma derivata non reversibile, cellulare registrato e codici SMS temporanei per verificare l’identità del cliente. Il servizio consente di scaricare esclusivamente i contratti associati al proprio account. Il caricamento di documenti di identità non è attualmente attivo." : "The private area uses your email, a non-reversible derived password hash, registered mobile and temporary SMS codes to verify your identity. You can download only contracts assigned to your own account. Identity-document uploads are not currently enabled."}</p>
      <p>{it ? "I cookie tecnici di autenticazione sono necessari per il servizio: la verifica SMS dura fino a 5 minuti e la sessione fino a 2 ore. I contratti sono conservati in uno spazio privato cifrato; gli eventi di accesso e download sono registrati per sicurezza. La pulizia programmata elimina i log oltre 90 giorni. Per assistenza, variazione del cellulare o esercizio dei diritti contatta il Titolare." : "Necessary authentication cookies support the service: the SMS challenge lasts up to 5 minutes and the session up to 2 hours. Contracts are held in encrypted private storage; login and download events are recorded for security. Scheduled cleanup removes logs older than 90 days. Contact the controller for support, registered-mobile changes or to exercise your rights."}</p>
    </section>
    <p><b>{ui[lang].revoke}</b></p>
  </>;
}

export function CookiePolicyContent({ lang }: { lang: Lang }) {
  const it = lang === "it";
  return <>
    <h2>{it ? "Cosa sono i cookie" : "What cookies are"}</h2>
    <p>{it ? "I cookie sono piccoli file memorizzati dal browser. Questo sito usa cookie tecnici necessari e, con consenso, categorie analitiche e di marketing. Lo script di Google Tag Manager, che può attivare questi strumenti, si carica solo dopo il tuo consenso: i cookie effettivamente impostati dipendono da quali strumenti sono configurati al suo interno in un dato momento." : "Cookies are small files stored by your browser. This site uses necessary technical cookies and, with consent, analytics and marketing categories. The Google Tag Manager script, which can activate these tools, loads only after your consent: the cookies actually set depend on which tools are configured within it at any given time."}</p>
    <h3>{it ? "Categorie e durata" : "Categories and duration"}</h3>
    <div className="table-wrap"><table><thead><tr><th>{it ? "Categoria" : "Category"}</th><th>{it ? "Finalità" : "Purpose"}</th><th>{it ? "Durata" : "Duration"}</th></tr></thead><tbody>
      <tr><td>{it ? "Necessari" : "Necessary"}</td><td>{it ? "Preferenze consenso e sicurezza" : "Consent preferences and security"}</td><td>6 {it ? "mesi" : "months"}</td></tr>
      <tr><td>{it ? "Analitici" : "Analytics"}</td><td>{it ? "Statistiche aggregate, solo previo consenso" : "Aggregate metrics, only with consent"}</td><td>13 {it ? "mesi" : "months"}</td></tr>
      <tr><td>Marketing</td><td>{it ? "Contenuti e campagne, solo previo consenso" : "Content and campaigns, only with consent"}</td><td>6 {it ? "mesi" : "months"}</td></tr>
    </tbody></table></div>
    <h3>Google reCAPTCHA</h3>
    <p>{it ? "Il modulo Contatti utilizza Google reCAPTCHA per prevenire invii automatizzati. Lo script si carica solo quando invii il modulo, indipendentemente dal consenso cookie, perché necessario alla sicurezza del servizio: Google riceve il tuo indirizzo IP e dati sul tuo utilizzo del sito per calcolare un punteggio antispam. Non è un cookie di profilazione pubblicitaria." : "The Contact form uses Google reCAPTCHA to prevent automated submissions. The script loads only when you submit the form, regardless of cookie consent, because it is necessary for the service's security: Google receives your IP address and data about your use of the site to compute an anti-spam score. It is not an advertising or profiling cookie."}</p>
    <h3>{it ? "Cookie dell’Area Clienti" : "Customer Area cookies"}</h3>
    <p>{it ? "ros_customer_challenge: cookie tecnico per la verifica SMS, fino a 5 minuti. ros_customer_session: cookie tecnico di sessione, fino a 2 ore, rimosso alla disconnessione. Entrambi sono HttpOnly, SameSite=Strict e Secure in produzione; non sono cookie pubblicitari." : "ros_customer_challenge: necessary SMS-verification cookie, up to 5 minutes. ros_customer_session: necessary sign-in session cookie, up to 2 hours, removed on sign-out. Both are HttpOnly, SameSite=Strict and Secure in production; neither is an advertising cookie."}</p>
    <h3>{it ? "Gestire o revocare il consenso" : "Manage or withdraw consent"}</h3>
    <p>{it ? "Usa il pulsante seguente in qualsiasi momento. Puoi anche eliminare i cookie dal browser." : "Use the button below at any time. You can also erase cookies in your browser."}</p>
    <button className="button primary" data-cookie-settings>{ui[lang].settings}</button>
    <p>{ui[lang].revoke}</p>
  </>;
}
