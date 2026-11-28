"use client";
import { useId, useRef, useState, useEffect, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, LoaderCircle } from "lucide-react";
import { copyFor, formatEur, quote, type Lang, type ProductOffer } from "@/lib/pricing";
import { normalizePhone } from "@/lib/request";
import { track } from "@/lib/analytics";
import { isValidTaxCode } from "@/lib/codice-fiscale";
import { LegalLinkModal } from "./LegalLinkModal";
import { PrivacyNoticeContent } from "./LegalContent";

type Step = "form" | "code" | "done";
const LEGAL_FORMS: [string, string, string][] = [["srl_spa_snc", "S.r.l./S.p.a./S.n.c.", "S.r.l./S.p.a./S.n.c."], ["ditta_individuale", "Ditta individuale", "Sole proprietorship"], ["associazione", "Associazione", "Association"], ["altro", "Altro", "Other"]];
const CHECKED_FIELDS = new Set(["companyName", "legalForm", "companyAddress", "companyCity", "companyCap", "companyProvince", "companyTaxCode", "companyVat", "companyRegister", "companyEmail", "companyPec", "companySdi", "representativeName", "birthPlace", "birthDate", "residenceAddress", "residenceCity", "residenceCap", "residenceProvince", "representativeTaxCode", "email", "representativePhone", "months", "startDate", "companyExists"]);

/** Online "Modulo richiesta domiciliazione": all the fields of the paper form, then an SMS code on the mobile number that acts as the signature. */
export function ManualRequestForm({ product, lang, onDone }: { product: ProductOffer; lang: Lang; onDone?: () => void }) {
  const it = lang === "it"; const id = useId(); const postal = product.code === "postal"; const copy = copyFor(product.code, lang);
  const form = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState<Step>("form"); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [companyExists, setCompanyExists] = useState(postal); const [months, setMonths] = useState("");
  const [requestId, setRequestId] = useState(""); const [phone, setPhone] = useState(""); const [email, setEmail] = useState("");
  const [code, setCode] = useState(""); const [wait, setWait] = useState(0); const [verified, setVerified] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const showSmart3x24 = !postal && !companyExists && product.smart3x24Active; const showSmart6x24 = !postal && !companyExists && product.smart6x24Active;
  const tiers = product.tiers.filter(t => !postal || t.months === 6 || t.months === 12);
  useEffect(() => { if (wait <= 0) return; const timer = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(timer); }, [wait]);
  const aria = (key: string) => ({ "aria-invalid": fieldErrors[key] ? true : undefined, "aria-describedby": fieldErrors[key] ? `${id}-err-${key}` : undefined });
  const err = (key: string) => fieldErrors[key] ? <span id={`${id}-err-${key}`} className="field-error" role="alert">{fieldErrors[key]}</span> : null;
  const text = (name: string, label: string, props: { required?: boolean; maxLength?: number; type?: string; placeholder?: string; autoComplete?: string; min?: string; max?: string; className?: string; note?: string } = {}) => {
    const { required = true, note, className, ...rest } = props;
    return <label htmlFor={`${id}-${name}`} className={className}>{label}{required ? "*" : ""}<input id={`${id}-${name}`} name={name} required={required} maxLength={props.maxLength ?? 200} {...rest} {...aria(name)} />{err(name)}{note && <small className="form-note">{note}</small>}</label>;
  };
  const messages: Record<string, string> = it ? {
    limited: "Troppi tentativi. Riprova più tardi o contatta la reception.", wait: "Attendi un minuto prima di richiedere un nuovo codice.", smsUnavailable: "Invio SMS non disponibile. Riprova più tardi o contatta la reception.",
    "invalid-or-expired-code": "Codice errato o scaduto.", "request-session": "Sessione scaduta: invia di nuovo il modulo.", "already-submitted": "Questa richiesta è già stata inviata.", invalid: "Controlla i campi evidenziati e riprova.",
  } : {
    limited: "Too many attempts. Try again later or contact reception.", wait: "Please wait a minute before requesting a new code.", smsUnavailable: "SMS sending is unavailable. Try again later or contact reception.",
    "invalid-or-expired-code": "Wrong or expired code.", "request-session": "Session expired: please send the form again.", "already-submitted": "This request has already been sent.", invalid: "Check the highlighted fields and try again.",
  };
  const post = async (url: string, body: unknown) => { const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await r.json().catch(() => ({})); return { ok: r.ok, data } as { ok: boolean; data: Record<string, unknown> }; };
  const fail = (data: Record<string, unknown>) => setError(messages[String(data.error)] || (it ? "Operazione non riuscita. Riprova." : "Something went wrong. Please try again."));

  function clientErrors(fd: FormData) {
    const e: Record<string, string> = {}; const v = (k: string) => String(fd.get(k) || "").trim();
    if (!/^\S+@\S+\.\S+$/.test(v("email"))) e.email = it ? "Inserisci un indirizzo email valido." : "Enter a valid email address.";
    if (!/^\+[1-9]\d{7,14}$/.test(normalizePhone(v("representativePhone")))) e.representativePhone = it ? "Inserisci un cellulare valido con prefisso internazionale, ad esempio +39." : "Enter a valid mobile number with an international prefix, for example +39.";
    if (!isValidTaxCode(v("representativeTaxCode"))) e.representativeTaxCode = it ? "Codice Fiscale non valido." : "Invalid tax code.";
    if (!/^\d{5}$/.test(v("residenceCap"))) e.residenceCap = it ? "CAP non valido (5 cifre)." : "Invalid postal code (5 digits).";
    if (!/^[A-Za-z]{2}$/.test(v("residenceProvince"))) e.residenceProvince = it ? "Sigla di 2 lettere." : "2-letter code.";
    if (!v("birthDate") || v("birthDate") >= today) e.birthDate = it ? "Inserisci una data di nascita valida." : "Enter a valid birth date.";
    if (!v("startDate") || v("startDate") < today) e.startDate = it ? "Inserisci una data valida, non nel passato." : "Enter a valid date, not in the past.";
    if (companyExists) {
      if (!/^\d{5}$/.test(v("companyCap"))) e.companyCap = it ? "CAP non valido (5 cifre)." : "Invalid postal code (5 digits).";
      if (!/^[A-Za-z]{2}$/.test(v("companyProvince"))) e.companyProvince = it ? "Sigla di 2 lettere." : "2-letter code.";
      if (!/^\d{11}$/.test(v("companyTaxCode")) && !isValidTaxCode(v("companyTaxCode"))) e.companyTaxCode = it ? "Codice Fiscale non valido." : "Invalid tax code.";
      if (!/^(IT)?\d{11}$/i.test(v("companyVat"))) e.companyVat = it ? "Partita IVA non valida (11 cifre)." : "Invalid VAT number (11 digits).";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v("companyEmail"))) e.companyEmail = it ? "Email non valida." : "Invalid email.";
      const pec = v("companyPec"); const sdi = v("companySdi");
      if (!pec && !sdi) e.companyPec = it ? "Indica la PEC oppure il codice SDI." : "Enter the PEC or the SDI code.";
      if (sdi && !/^[A-Za-z0-9]{7}$/.test(sdi)) e.companySdi = it ? "Il codice SDI ha 7 caratteri." : "The SDI code has 7 characters.";
    }
    return e;
  }

  async function sendCode(id: string) {
    const sent = await post("/api/manual-request/send-otp", { requestId: id });
    // "wait": a code was just sent (e.g. the customer went back to correct a typo); the one already received is still valid.
    if (sent.ok || sent.data.error === "wait") { setWait(60); setCode(""); setStep("code"); return true; }
    fail(sent.data); return false;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); const fd = new FormData(event.currentTarget);
    const nextErrors = clientErrors(fd); setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) { setError(it ? "Controlla i dati evidenziati." : "Check the highlighted fields."); return; }
    if (!fd.get("consent")) { setError(it ? "È necessario il consenso al trattamento dei dati per inviare la richiesta." : "Consent to data processing is required to send the request."); return; }
    setBusy(true);
    try {
      const body = { ...Object.fromEntries(fd), service: product.code, lang, companyExists, consent: true, ...(requestId ? { requestId } : {}) };
      const saved = await post("/api/manual-request", body);
      if (!saved.ok) {
        const fields = Array.isArray(saved.data.fields) ? (saved.data.fields as string[]).filter(f => CHECKED_FIELDS.has(f)) : [];
        setFieldErrors(Object.fromEntries(fields.map(f => [f, it ? "Valore non valido." : "Invalid value."]))); fail(saved.data); return;
      }
      const id = String(saved.data.requestId); setRequestId(id); setPhone(normalizePhone(String(fd.get("representativePhone")))); setEmail(String(fd.get("email")).trim().toLowerCase());
      await sendCode(id);
    } catch { setError(it ? "Connessione non riuscita. Riprova." : "Connection failed. Please try again."); } finally { setBusy(false); }
  }
  async function verify(event?: FormEvent) {
    event?.preventDefault(); setError(""); if (!verified && !/^\d{6}$/.test(code)) { setError(it ? "Inserisci il codice di 6 cifre ricevuto via SMS." : "Enter the 6-digit code sent by SMS."); return; }
    setBusy(true);
    try {
      const result = await post("/api/manual-request/verify", { requestId, ...(verified ? {} : { code }) });
      if (!result.ok) { fail(result.data); return; }
      setVerified(true);
      if (result.data.emailSent) { setStep("done"); track("generate_lead", { form: "manual_request", service: product.code, lang }); }
      else setError(it ? "Il numero è verificato e la richiesta è registrata, ma non siamo riusciti a inviarti l’email di conferma. Riprova tra poco o contatta la reception." : "Your number is verified and the request is recorded, but we could not send the confirmation email. Try again shortly or contact reception.");
    } catch { setError(it ? "Connessione non riuscita. Riprova." : "Connection failed. Please try again."); } finally { setBusy(false); }
  }
  async function resend() { setError(""); setBusy(true); try { await sendCode(requestId); } finally { setBusy(false); } }

  if (step === "done") return <div className="standard-offer-success" role="status"><CheckCircle2 /><h3>{it ? "Richiesta inviata" : "Request sent"}</h3><p>{it ? "Il tuo cellulare è verificato e abbiamo ricevuto i dati. Ti abbiamo inviato una conferma a" : "Your mobile number is verified and we received your details. We sent a confirmation to"} <strong>{email}</strong>.</p><p>{it ? "Ti invieremo il contratto da firmare e i dati per il pagamento. Nessun pagamento è stato effettuato ora." : "We will send the agreement to sign and the payment details. No payment has been taken now."}</p>{onDone && <button type="button" className="button primary" onClick={onDone}>{it ? "Chiudi" : "Close"}</button>}</div>;

  return <>
    {step === "code" && <form onSubmit={verify} noValidate className="standard-offer-form">
      <h3>{it ? "Conferma con il codice SMS" : "Confirm with the SMS code"}</h3>
      <p className="form-note">{it ? <>Abbiamo inviato un codice di 6 cifre al numero <strong>{phone}</strong>. Inserendolo confermi e firmi la richiesta.</> : <>We sent a 6-digit code to <strong>{phone}</strong>. Entering it confirms and signs your request.</>}</p>
      {!verified && <label htmlFor={`${id}-code`}>{it ? "Codice SMS" : "SMS code"}*<input id={`${id}-code`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} autoFocus /></label>}
      <div className="field-error" role="alert">{error}</div>
      <button className="button primary" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <ArrowRight />}{verified ? (it ? "Riprova invio email" : "Retry confirmation email") : (it ? "Conferma e invia la richiesta" : "Confirm and send the request")}</button>
      {!verified && <div className="offer-actions">
        <button type="button" className="text-button" disabled={busy || wait > 0} onClick={resend}>{wait > 0 ? (it ? `Invia di nuovo il codice (${wait}s)` : `Send the code again (${wait}s)`) : (it ? "Invia di nuovo il codice" : "Send the code again")}</button>
        <button type="button" className="text-button" disabled={busy} onClick={() => { setError(""); setStep("form"); }}>{it ? "Modifica i dati (o il numero)" : "Edit details (or the number)"}</button>
      </div>}
    </form>}
    <form ref={form} hidden={step !== "form"} onSubmit={submit} noValidate className="standard-offer-form">
      <p className="form-note">{postal ? (it ? "Il servizio postale è riservato a un soggetto già esistente: indica i dati completi. Prepareremo il contratto e ti scriveremo per la firma e il pagamento. Nessun acquisto viene effettuato con questa richiesta." : "The mailing service is only available to an already-existing individual or company: please provide full details. We will prepare the agreement and write back for signature and payment. This request does not make a purchase.") : (it ? "Compila i dati della tua attività: prepareremo il contratto e ti scriveremo per la firma e il pagamento. Nessun acquisto viene effettuato con questa richiesta. Il cellulare viene verificato con un codice SMS." : "Enter your company's details: we will prepare the agreement and write back for signature and payment. This request does not make a purchase. Your mobile number is verified with an SMS code.")}</p>
      <h3>{it ? "Società" : "Company"}</h3>
      <div className="form-grid">
        {text("companyName", it ? "Denominazione società costituita/costituenda" : "Company name (existing or being formed)")}
        <label htmlFor={`${id}-legalForm`}>{it ? "Forma giuridica" : "Legal form"}*<select id={`${id}-legalForm`} name="legalForm" required defaultValue="" {...aria("legalForm")}><option value="" disabled>{it ? "Seleziona" : "Select"}</option>{LEGAL_FORMS.map(([value, a, b]) => <option key={value} value={value}>{it ? a : b}</option>)}</select>{err("legalForm")}</label>
      </div>
      {!postal && <label className="check-label"><input type="checkbox" checked={companyExists} onChange={e => { setCompanyExists(e.target.checked); setMonths(""); }} /> <span>{it ? "La società è già costituita" : "The company is already incorporated"}</span></label>}
      {companyExists && <fieldset className="form-grid"><legend>{it ? "Dati della società già costituita" : "Details of the incorporated company"}</legend>
        {text("companyAddress", it ? "Sede in Via" : "Registered address", { maxLength: 240, autoComplete: "off" })}
        {text("companyCity", it ? "Città" : "City", { maxLength: 80 })}
        {text("companyCap", "CAP", { maxLength: 5 })}
        {text("companyProvince", it ? "Prov." : "Province", { maxLength: 2, placeholder: "RM" })}
        {text("companyTaxCode", it ? "Codice Fiscale" : "Tax code", { maxLength: 30 })}
        {text("companyVat", it ? "Partita IVA" : "VAT number", { maxLength: 30 })}
        {text("companyRegister", it ? "Reg. Imprese" : "Business register no.", { maxLength: 120 })}
        {text("companyEmail", "Email", { type: "email", maxLength: 254 })}
        {text("companyPec", "PEC", { type: "email", required: false, maxLength: 254 })}
        {text("companySdi", it ? "Codice identificativo (SDI)" : "SDI code", { required: false, maxLength: 7, note: it ? "Indica la PEC oppure il codice SDI (basta uno dei due)." : "Enter the PEC or the SDI code (one of the two is enough)." })}
      </fieldset>}
      <h3>{it ? "Referente / Amministratore / Amm. Pro Tempore / Liquidatore" : "Contact person / Administrator / Liquidator"}</h3>
      <p className="form-note">{it ? "Tutti i campi sono obbligatori." : "All fields are mandatory."}</p>
      <div className="form-grid">
        {text("representativeName", it ? "Sig./Sig.ra (nome e cognome)" : "Full name", { autoComplete: "name", maxLength: 150 })}
        {text("birthPlace", it ? "Nato/a a" : "Born in", { maxLength: 100 })}
        {text("birthDate", it ? "Data di nascita" : "Date of birth", { type: "date", max: today })}
        {text("residenceAddress", it ? "Residente in Via" : "Home address", { autoComplete: "street-address", maxLength: 240 })}
        {text("residenceCity", it ? "Città" : "City", { maxLength: 80 })}
        {text("residenceCap", "CAP", { maxLength: 5 })}
        {text("residenceProvince", it ? "Prov." : "Province", { maxLength: 2, placeholder: "RM" })}
        {text("representativeTaxCode", it ? "Codice Fiscale" : "Tax code", { maxLength: 40 })}
        {text("email", "Email", { type: "email", autoComplete: "email", maxLength: 254 })}
        {text("representativePhone", it ? "Cellulare" : "Mobile number", { type: "tel", autoComplete: "tel", placeholder: "+39 …", maxLength: 40, note: it ? "In formato internazionale, ad es. +39 333 1234567. Riceverai un codice SMS." : "In international format, e.g. +39 333 1234567. You will receive an SMS code." })}
      </div>
      <h3>{it ? "Contratto" : "Agreement"}</h3>
      <div className="form-grid">
        <label htmlFor={`${id}-months`}>{it ? "Tipo di contratto scelto" : "Agreement type"}*<select id={`${id}-months`} name="months" required value={months} onChange={e => setMonths(e.target.value)} {...aria("months")}><option value="" disabled>{it ? "Seleziona" : "Select"}</option>{tiers.map(tier => { const priced = quote(product, { months: tier.months }); return <option key={tier.months} value={tier.months}>{copy.months(tier.months)} — {priced ? formatEur(priced.netCents, lang) : formatEur(tier.offerCents ?? tier.listCents, lang)} {it ? "+ IVA" : "+ VAT"}</option>; })}{showSmart3x24 && <option value="smart3x24">Smart 3+24 {it ? "(solo società da costituire)" : "(companies to be formed only)"}</option>}{showSmart6x24 && <option value="smart6x24">Smart 6+24 {it ? "(solo società da costituire)" : "(companies to be formed only)"}</option>}</select>{err("months")}</label>
        {text("startDate", it ? "Data inizio contratto / autorizzazione uso indirizzo" : "Agreement start date", { type: "date", min: today })}
      </div>
      <label htmlFor={`${id}-notes`}>{it ? "Note (facoltativo)" : "Notes (optional)"}<textarea id={`${id}-notes`} name="notes" maxLength={1000} rows={3} /></label>
      <div className="honeypot" aria-hidden="true"><input name="website" aria-label="Website" tabIndex={-1} autoComplete="off" /></div>
      <div className="consent-box"><label className="check-label"><input type="checkbox" name="consent" required /><span>{it ? "Ho preso visione dell’informativa privacy e acconsento al trattamento dei dati personali per la gestione della richiesta." : "I have read the privacy notice and consent to the processing of my personal data to handle this request."} <LegalLinkModal className="consent-link" label={it ? "Informativa privacy" : "Privacy notice"} title={it ? "Informativa Privacy" : "Privacy Notice"}><PrivacyNoticeContent lang={lang} /></LegalLinkModal>*</span></label></div>
      <div className="field-error" role="alert">{step === "form" ? error : ""}</div>
      <button className="button primary" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <ArrowRight />}{busy ? (it ? "Invio in corso…" : "Sending…") : (it ? "Continua: verifica il cellulare" : "Continue: verify your mobile")}</button>
      <p className="form-note">{it ? "* campi obbligatori" : "* required fields"}</p>
    </form>
  </>;
}
