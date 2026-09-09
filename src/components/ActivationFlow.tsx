"use client";
import Link from "next/link";
import { CheckCircle2, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { copyFor, activationHref, validity, formatEur, quote, offerActive, type Catalog, type ServiceCode, type SelectedAddon, type Lang } from "@/lib/pricing";
import { OfferTermsConsent } from "./OfferTerms";
import { SignaturePad } from "./Interactive";
type FormState = {
  companyExists: boolean; companyName: string; companyVat: string; companyTaxCode: string; companyAddress: string; companyRegister: string;
  representativeName: string; representativeRole: string; representativeTaxCode: string; email: string; phone: string;
  months: number; startDate: string; newActivation: boolean; additionalDomiciliation: boolean; consent: boolean; website: string; termsAccepted: boolean; addons: SelectedAddon[];
};

type FinalizeResult = { paymentMethod: string; orderRef: string; emailSent: boolean; pdfBase64?: string; message?: string; totalCents?: number; bankTransferDetails?: string; paymentUnavailable?: boolean };

export function ActivationFlow({ lang, catalog: initialCatalog, initialService }: { lang: Lang; catalog: Catalog; initialService: ServiceCode }) {
  const it = lang === "it";
  const [catalog, setCatalog] = useState(initialCatalog);
  const service = initialService; const product = catalog[service]; const postal = service === "postal";
  const copy = copyFor(service, lang);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => { if (!cooldown) return; const timer = setTimeout(() => setCooldown(c => c - 1), 1000); return () => clearTimeout(timer); }, [cooldown]);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [payment, setPayment] = useState<"stripe" | "paypal" | "sumup" | "bank_transfer" | "on_site">("stripe");
  const [result, setResult] = useState<FinalizeResult | null>(null);
  const [form, setForm] = useState<FormState>({
    companyExists: false, companyName: "", companyVat: "", companyTaxCode: "", companyAddress: "", companyRegister: "",
    representativeName: "", representativeRole: it ? "Legale rappresentante" : "Legal representative", representativeTaxCode: "", email: "", phone: "",
    months: postal ? 6 : 12, startDate: "", newActivation: !postal, additionalDomiciliation: false, consent: false, website: "", termsAccepted: false, addons: [],
  });

  const t = {
    steps: [it ? "Dati richiesta" : "Request data", it ? "Verifica SMS" : "SMS verification", it ? "Invio e pagamento" : "Submit & payment", it ? "Conferma" : "Confirmation"],
    companyTitle: it ? "Dati azienda / ditta individuale (se già esistente)" : "Company / sole proprietorship data (if already existing)",
    companyHint: it ? "Compila solo se la società o la ditta è già costituita." : "Fill in only if the company or business already exists.",
    companyExists: it ? "L’azienda è già costituita" : "The company is already incorporated",
    companyName: it ? "Denominazione / Ragione sociale" : "Company name",
    companyVat: it ? "Partita IVA" : "VAT number", companyTaxCode: it ? "Codice fiscale" : "Tax code",
    companyAddress: it ? "Sede attuale" : "Current registered address", companyRegister: it ? "REA / Registro imprese" : "REA / Company register",
    repTitle: it ? "Legale rappresentante / Amministratore (obbligatorio)" : "Legal representative / administrator (mandatory)",
    repName: it ? "Nome e cognome" : "Full name", repRole: it ? "Ruolo" : "Role",
    repTaxCode: it ? "Codice fiscale" : "Tax code", email: "Email", phone: it ? "Cellulare (per il codice SMS)" : "Mobile number (for the SMS code)",
    phoneHint: it ? "Inserisci il numero in formato internazionale, ad es. +39 333 1234567." : "Enter the number in international format, e.g. +39 333 1234567.",
    contractTitle: it ? "Contratto di domiciliazione" : "Registered office address agreement",
    duration: it ? "Durata del contratto" : "Contract duration", startDate: it ? "Data di inizio contratto" : "Contract start date",
    newActivation: it ? "Nuova attivazione (nuovo cliente/società)" : "New activation (new client/company)",
    additional: it ? "Domiciliazione aggiuntiva con stesso referente/amministratore" : "Additional address service with the same contact/administrator",
    consent: it ? "Acconsento al trattamento dei dati personali per la gestione della richiesta e dell’eventuale contratto" : "I consent to the processing of personal data to handle this request and any agreement",
    sendCode: it ? "INVIA IL CODICE DI VERIFICA" : "SEND VERIFICATION CODE",
    otpLabel: it ? "Codice ricevuto via SMS (6 cifre)" : "Code received by SMS (6 digits)",
    verify: it ? "VERIFICA IL CODICE" : "VERIFY CODE", resend: it ? "Invia di nuovo" : "Resend",
    back: it ? "Modifica i dati" : "Edit data",
    payTitle: it ? "Invio della richiesta e pagamento" : "Submit request and payment",
    payHint: it ? "La richiesta verrà inviata via email. Puoi pagare con PayPal, Stripe o SumUp oppure scegliere il bonifico bancario." : "Your request will be sent by email. You can pay by PayPal, Stripe or SumUp, or choose a bank transfer.",
    submit: it ? "INVIA RICHIESTA E PROCEDI" : "SUBMIT REQUEST & CONTINUE",
    required: it ? "Campo obbligatorio" : "Required field",
    invalidEmail: it ? "Inserisci un indirizzo email valido" : "Enter a valid email address",
    invalidPhone: it ? "Inserisci un cellulare valido con prefisso internazionale, ad esempio +39." : "Enter a valid mobile number with an international prefix, for example +39.",
    invalidDate: it ? "Inserisci una data valida (non nel passato, entro 24 mesi)" : "Enter a valid date (not in the past, within 24 months)",
  };

  const priced = useMemo(() => quote(product, { months: form.months, newActivation: form.newActivation, additionalDomiciliation: form.additionalDomiciliation, addons: form.addons }), [product, form.months, form.newActivation, form.additionalDomiciliation, form.addons]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const state = params.get("payment");
    const order = params.get("order");
    const provider = params.get("provider");
    if (!state || !order) return;
    window.history.replaceState({}, "", window.location.pathname);
    if (state === "return" && provider) {
      setStatus(it ? "Verifica del pagamento in corso…" : "Verifying payment…");
      fetch("/api/verify-payment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order, provider, sessionId: params.get("session_id") }) })
        .then(r => r.json()).then(d => setStatus(d.paid ? (it ? "Pagamento confermato. Grazie!" : "Payment confirmed. Thank you!") : (it ? "Pagamento non ancora confermato: riceverai conferma via email oppure puoi riprovare." : "Payment not confirmed yet: you will receive an email confirmation, or try again."))).catch(() => setStatus(it ? "Verifica non riuscita." : "Verification failed."));
    } else if (state === "cancelled") setStatus(it ? "Pagamento annullato. Puoi riprendere la procedura quando vuoi." : "Payment cancelled. You can resume whenever you like.");
  }, [it]);

  function validate() {
    const next: Record<string, string> = {};
    if (form.representativeName.trim().length < 2) next.representativeName = t.required;
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = t.invalidEmail;
    if (!/^\+[1-9]\d{7,14}$/.test(form.phone.trim().replace(/^00/, "+").replace(/[\s.()\/-]/g, ""))) next.phone = t.invalidPhone;
    if (!product.tiers.some(x => x.months === form.months)) next.months = t.required;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.startDate)) next.startDate = t.invalidDate;
    else {
      const value = new Date(`${form.startDate}T12:00:00`);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const max = new Date(today.getFullYear() + 2, today.getMonth(), today.getDate());
      if (value < today || value > max) next.startDate = t.invalidDate;
    }
    if (form.companyExists && form.companyName.trim().length < 2) next.companyName = t.required;
    if (!form.consent) next.consent = t.required;
    if (postal && !form.termsAccepted) next.terms = it ? "Leggi e accetta integralmente le condizioni dell’offerta postale prima di proseguire." : "Read and accept the full mailing-service offer terms before continuing.";
    return next;
  }

  async function sendCode() {
    const next = validate(); setErrors(next);
    if (Object.keys(next).length) { requestAnimationFrame(() => document.getElementById(`err-${Object.keys(next)[0]}`)?.focus()); return; }
    setBusy(true); setStatus(it ? "Invio del codice in corso…" : "Sending your code…");
    try {
      const res = await fetch("/api/domiciliation-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, lang, service, catalogVersion: product.version, termsVersion: product.version, orderId: orderId || undefined }) });
      const data = await res.json();
      if (res.status === 409 && data.catalog) { setCatalog(data.catalog); setForm(f => ({ ...f, termsAccepted: false })); setStatus(it ? "Le tariffe sono state aggiornate. Controlla il nuovo riepilogo e accetta nuovamente le condizioni." : "Prices have changed. Review the new summary and accept the terms again."); return; }
      if (!res.ok) throw new Error(data.error || "error");
      setOrderId(data.orderId);
      const otpRes = await fetch("/api/send-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: data.orderId, phone: form.phone }) });
      if (!otpRes.ok) { setStatus(it ? "Impossibile inviare l’SMS al momento. I dati sono salvati: riprova o contatta la reception." : "SMS sending is unavailable right now. Your details are saved: retry or contact reception."); return; }
      setStatus(it ? "Codice inviato al tuo numero. Inseriscilo entro 10 minuti." : "Code sent to your number. Enter it within 10 minutes."); setCooldown(60);
      setStep(2);
    } catch {
      setStatus(it ? "Invio non riuscito: controlla i dati o chiamaci al 06 2111 6268." : "Could not send: please check your details or call +39 06 21.11.6268.");
    } finally { setBusy(false); }
  }

  async function resendCode() {
    setBusy(true); setStatus("");
    try { const r = await fetch("/api/send-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, phone: form.phone }) }); if (!r.ok) throw new Error(); setCooldown(60); setOtp(""); setStatus(it ? "Nuovo codice inviato." : "New code sent."); }
    catch { setStatus(it ? "Invio non riuscito o limite raggiunto. Attendi prima di riprovare." : "Could not resend, or the limit was reached. Please wait before retrying."); }
    finally { setBusy(false); }
  }
  async function verifyCode() {
    setBusy(true);
    try {
      const res = await fetch("/api/verify-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, phone: form.phone, code: otp }) });
      if (!res.ok) { setStatus(it ? "Codice non valido o scaduto." : "Invalid or expired code."); return; }
      setStatus(""); setStep(3);
    } catch { setStatus(it ? "Verifica non riuscita." : "Verification failed."); } finally { setBusy(false); }
  }

  async function finalize() {
    setBusy(true); setStatus("");
    try {
      const res = await fetch("/api/domiciliation-request/finalize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, paymentMethod: payment }) });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "prices-changed") { setStatus(it ? "Tariffe o condizioni aggiornate. Ricarica la pagina e controlla il nuovo riepilogo prima di proseguire." : "Prices or terms have changed. Reload and review the new summary before continuing."); return; }
        if (data.error === "otp-required") { setStatus(it ? "La verifica SMS è scaduta: ricomincia la richiesta per ricevere un nuovo codice." : "SMS verification has expired. Start a new application to receive another code."); return; }
        throw new Error(data.error || "error");
      }
      if (data.url) { window.location.href = data.url; return; }
      setResult(data); setStep(4);
    } catch {
      setStatus(it ? "Invio non riuscito. Riprova o chiamaci." : "Submission failed. Please retry or call us.");
    } finally { setBusy(false); }
  }

  const err = (key: string) => errors[key] ? <span id={`err-${key}`} className="field-error" role="alert" tabIndex={-1}>{errors[key]}</span> : null;
  const aria = (key: string) => ({ "aria-invalid": errors[key] ? true : undefined, "aria-describedby": errors[key] ? `err-${key}` : undefined });

  return <div className="activation" data-service={service}>
    <div className="activation-service-selector" role="group" aria-label={it ? "Servizio da attivare" : "Service to activate"}>{(["legal_unit", "postal"] as ServiceCode[]).map(s => <Link key={s} href={activationHref(s, lang)} className={s === service ? "selected" : ""} aria-current={s === service ? "page" : undefined}>{copyFor(s, lang).nameShort}</Link>)}</div>
    <ol className="activation-steps">
      {t.steps.map((label, index) => <li key={label} className={step >= index + 1 ? "active" : ""} aria-current={step === index + 1 ? "step" : undefined}><span>{index + 1}</span>{label}</li>)}
    </ol>

    <div className="activation-grid">
      <div className="activation-form">
        {step === 1 && <form noValidate onSubmit={e => { e.preventDefault(); sendCode(); }}>
          <fieldset><legend>{t.companyTitle}</legend>
            <p className="form-note">{t.companyHint}</p>
            <label className="check-label"><input type="checkbox" checked={form.companyExists} onChange={e => setForm({ ...form, companyExists: e.target.checked })} /> <span>{t.companyExists}</span></label>
            {form.companyExists && <>
              <label>{t.companyName}<input id="field-companyName" value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} {...aria("companyName")} />{err("companyName")}</label>
              <div className="form-grid">
                <label>{t.companyVat}<input value={form.companyVat} onChange={e => setForm({ ...form, companyVat: e.target.value })} /></label>
                <label>{t.companyTaxCode}<input value={form.companyTaxCode} onChange={e => setForm({ ...form, companyTaxCode: e.target.value })} /></label>
              </div>
              <label>{t.companyAddress}<input value={form.companyAddress} onChange={e => setForm({ ...form, companyAddress: e.target.value })} /></label>
              <label>{t.companyRegister}<input value={form.companyRegister} onChange={e => setForm({ ...form, companyRegister: e.target.value })} /></label>
            </>}
          </fieldset>

          <fieldset><legend>{t.repTitle}</legend>
            <label>{t.repName}*<input id="field-representativeName" value={form.representativeName} onChange={e => setForm({ ...form, representativeName: e.target.value })} autoComplete="name" {...aria("representativeName")} />{err("representativeName")}</label>
            <div className="form-grid">
              <label>{t.repRole}<select value={form.representativeRole} onChange={e => setForm({ ...form, representativeRole: e.target.value })}>
                {[it ? "Legale rappresentante" : "Legal representative", it ? "Amministratore" : "Administrator", it ? "Titolare" : "Owner", it ? "Delegato" : "Delegate"].map(r => <option key={r} value={r}>{r}</option>)}
              </select></label>
              <label>{t.repTaxCode}<input value={form.representativeTaxCode} onChange={e => setForm({ ...form, representativeTaxCode: e.target.value })} /></label>
            </div>
            <div className="form-grid">
              <label>{t.email}*<input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} autoComplete="email" {...aria("email")} />{err("email")}</label>
              <label>{t.phone}*<input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} autoComplete="tel" placeholder="+39 …" {...aria("phone")} />{err("phone")}
                <small className="form-note">{t.phoneHint}</small></label>
            </div>
          </fieldset>

          <fieldset><legend>{copy.name}</legend>
            <label>{t.duration}*<select value={form.months} onChange={e => setForm({ ...form, months: Number(e.target.value) })}>
              {product.tiers.map(tier => <option key={tier.months} value={tier.months}>{copy.months(tier.months)} — {formatEur(offerActive(product) ? (tier.offerCents ?? tier.listCents) : tier.listCents, lang)} {it ? "+ IVA" : "+ VAT"}</option>)}
            </select></label>
            <label>{t.startDate}*<input type="date" value={form.startDate} min={new Date().toISOString().slice(0, 10)} onChange={e => setForm({ ...form, startDate: e.target.value })} {...aria("startDate")} />{err("startDate")}</label>
            {!postal && <label className="check-label"><input type="checkbox" checked={form.newActivation} onChange={e => setForm({ ...form, newActivation: e.target.checked })} /> <span>{t.newActivation}</span></label>}
            <label className="check-label"><input type="checkbox" checked={form.additionalDomiciliation} onChange={e => setForm({ ...form, additionalDomiciliation: e.target.checked })} /> <span>{t.additional}</span></label>
            <label className="check-label"><input type="checkbox" checked={form.consent} onChange={e => setForm({ ...form, consent: e.target.checked })} {...aria("consent")} /> <span>{t.consent}*</span></label>{err("consent")}
          </fieldset>
          {postal && <fieldset className="postal-addons"><legend>{it ? "Servizi opzionali — Allegato 1" : "Optional services — Annex 1"}</legend><p className="form-note">{it ? "I canoni selezionati si sommano al prezzo della domiciliazione. I servizi a consumo saranno addebitati solo se richiesti." : "Selected fees are added to the address-service price. Usage-based services are charged only when requested."}</p>{product.addons.filter(addon => addon.selectable).map(addon => {
            const selected = form.addons.find(a => a.code === addon.code);
            return <div className="postal-addon" key={addon.code}><label className="check-label"><input type="checkbox" checked={!!selected} onChange={e => setForm(f => ({ ...f, addons: e.target.checked ? [...f.addons, { code: addon.code, quantity: 1 }] : f.addons.filter(a => a.code !== addon.code) }))} /><span><b>{it ? addon.titleIt : addon.titleEn}</b><small>{formatEur(addon.priceCents, lang)}/{it ? "mese" : "month"}{addon.code === "archive" ? (it ? " per faldone" : " per binder") : ""}{addon.annualCents > 0 ? ` + ${formatEur(addon.annualCents, lang)}/${it ? "anno numero VoIP" : "year for the VoIP number"}` : ""} {it ? "+ IVA" : "+ VAT"}</small></span></label>{selected && addon.maxQuantity > 1 && <label>{it ? "Numero di faldoni" : "Number of binders"}<select value={selected.quantity} onChange={e => setForm(f => ({ ...f, addons: f.addons.map(a => a.code === addon.code ? { ...a, quantity: Number(e.target.value) } : a) }))}>{Array.from({length: addon.maxQuantity}, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select></label>}</div>;
          })}<p className="form-note">{it ? "Il canone annuo del numero VoIP è dovuto anche per il contratto semestrale. Aperture extra, invii e spedizioni sono esclusi dal pagamento iniziale e applicati a consumo." : "The annual VoIP number fee is also due on a six-month contract. Extra openings, outgoing items and shipping are excluded from the initial payment and charged on use."}</p></fieldset>}
          {postal && <><OfferTermsConsent product={product} lang={lang} accepted={form.termsAccepted} onAccept={() => setForm(f => ({ ...f, termsAccepted: true }))}/>{err("terms")}<p className="form-note">{it ? "La procedura online sostituisce la restituzione del modulo via email: i dati e l’accettazione vengono inviati al centro. Attivazione soggetta a verifica e contratto." : "The online process replaces returning the form by email: your details and acceptance are sent to the centre. Activation is subject to review and agreement."}</p></>}
<div className="honeypot" aria-hidden="true"><label>Website<input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} tabIndex={-1} autoComplete="off" /></label></div>
          <button className="button primary" disabled={busy}>{busy && <LoaderCircle className="spin" />}{t.sendCode}</button>
        </form>}

        {step === 2 && <div className="activation-block">
          <h3>{t.otpLabel}</h3>
          <p className="form-note">{it ? `Codice inviato a ${form.phone}.` : `Code sent to ${form.phone}.`}</p>
          <label>{it ? "Codice" : "Code"}<input inputMode="numeric" maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ""))} className="otp-input" /></label>
          <div className="inline-actions">
            <button className="button primary" onClick={verifyCode} disabled={busy || otp.length !== 6}>{busy && <LoaderCircle className="spin" />}{t.verify}</button>
            <button className="text-button" onClick={resendCode} disabled={busy || cooldown > 0}><RefreshCw /> {cooldown ? `${t.resend} (${cooldown}s)` : t.resend}</button>
            <button className="text-button" onClick={() => setStep(1)}>{t.back}</button>
          </div>
        </div>}

        {step === 3 && <div className="activation-block">
          <h3>{t.payTitle}</h3>
          <p className="form-note">{t.payHint}</p>
          <fieldset><legend>{it ? "Modalità di pagamento" : "Payment method"}</legend>
            <div className="option-grid payment-options">
              <label className={payment === "stripe" ? "selected" : ""}><input type="radio" name="payment" checked={payment === "stripe"} onChange={() => setPayment("stripe")} />Stripe</label>
              <label className={payment === "paypal" ? "selected" : ""}><input type="radio" name="payment" checked={payment === "paypal"} onChange={() => setPayment("paypal")} />PayPal</label>
              <label className={payment === "sumup" ? "selected" : ""}><input type="radio" name="payment" checked={payment === "sumup"} onChange={() => setPayment("sumup")} />SumUp</label>
              <label className={payment === "bank_transfer" ? "selected" : ""}><input type="radio" name="payment" checked={payment === "bank_transfer"} onChange={() => setPayment("bank_transfer")} />{it ? "Bonifico bancario" : "Bank transfer"}</label>
              {postal && <label className={payment === "on_site" ? "selected" : ""}><input type="radio" name="payment" checked={payment === "on_site"} onChange={() => setPayment("on_site")} />{it ? "In sede: contanti / Bancomat / carta" : "On site: cash / debit card / credit card"}</label>}
            </div>
          </fieldset>
          {postal && <p className="form-note">{it ? "Pagamento anticipato. Nessun deposito cauzionale. Puoi utilizzare Stripe o SumUp per pagare con carta da remoto." : "Payment in advance. No security deposit. Use Stripe or SumUp to pay remotely by card."}</p>}
          {payment === "bank_transfer" && <p className="form-note">{it ? "Invieremo alla tua email tutti i dati di pagamento con il modulo di richiesta allegato in PDF." : "We will email you all payment details with the request form attached as a PDF."}</p>}
          <div className="inline-actions">
            <button className="button primary" onClick={finalize} disabled={busy}>{busy && <LoaderCircle className="spin" />}{t.submit}</button>
            <button className="text-button" onClick={() => setStep(1)}>{t.back}</button>
          </div>
        </div>}

        {step === 4 && result && <div className="success-panel">
          <CheckCircle2 />
          <b>{it ? "Richiesta registrata" : "Request recorded"}</b>
          <p>{it ? `Riferimento pratica: ${result.orderRef}` : `Reference: ${result.orderRef}`}</p>
          {result.paymentMethod === "bank_transfer" && <div className="bank-details">
            <p>{it ? "Email inviata con i dati di pagamento: " : "Payment details email sent: "}<b>{result.emailSent ? (it ? "sì" : "yes") : it ? "non inviata (vedi PDF)" : "not sent (see PDF)"}</b></p>
            <p className="form-note">{it ? "Se non hai ricevuto l’email, scarica qui il riepilogo con i dati di pagamento." : "If you did not receive the email, download the payment summary here."}</p>
          </div>}
          {result.pdfBase64 && <a className="button secondary" href={`data:application/pdf;base64,${result.pdfBase64}`} download={`richiesta-${result.orderRef}.pdf`}>{it ? "SCARICA IL MODULO PDF" : "DOWNLOAD PDF FORM"}</a>}
          {result.message && <p className="form-note">{result.message}</p>}
          {!postal && <SignaturePad lang={lang} orderId={result.orderRef} name={form.representativeName} />}
          {result.bankTransferDetails && <pre className="payment-instructions">{result.bankTransferDetails}</pre>}
          {result.paymentUnavailable && <button className="button secondary" onClick={() => setStep(3)}>{it ? "Scegli un’altra modalità di pagamento" : "Choose another payment method"}</button>}
          <p className="form-note"><ShieldCheck /> {it ? "I tuoi dati sono trattati secondo l’informativa privacy." : "Your data is processed according to our privacy notice."}</p>
        </div>}

        <div aria-live="polite" className={`form-status ${status ? "" : "idle"}`}>{status}</div>
      </div>

      <aside className="activation-summary" aria-label={it ? "Riepilogo prezzi" : "Price summary"}>
        <h3>{copy.name}</h3>
        <p className="form-note">{copy.description}</p>
        {priced && <>
          <div className="price-box">
            <p><span>{it ? "Durata" : "Duration"}</span><b>{copy.months(priced.months)}</b></p>
            <p><span>{it ? "Tariffa di listino" : "Standard rate"}</span><b>{formatEur(priced.listCents, lang)} {it ? "+ IVA" : "+ VAT"}</b></p>
            {priced.offerApplied && <p className="offer-line"><span>{it ? "Offerta" : "Offer"}</span><b>{formatEur(priced.baseCents, lang)} {it ? "+ IVA" : "+ VAT"}</b></p>}
            {priced.newActivationDiscountCents > 0 && <p><span>{it ? "Sconto nuove attivazioni (10%)" : "New activation discount (10%)"}</span><b>-{formatEur(priced.newActivationDiscountCents, lang)}</b></p>}
            {priced.additionalDomiciliationDiscountCents > 0 && <p><span>{it ? "Sconto domiciliazioni aggiuntive (10%)" : "Additional address service discount (10%)"}</span><b>-{formatEur(priced.additionalDomiciliationDiscountCents, lang)}</b></p>}
            {priced.addonLines.map(line => <p key={line.code}><span>{it ? line.titleIt : line.titleEn} × {line.quantity}</span><b>{formatEur(line.totalCents, lang)}</b></p>)}
            <p><span>{it ? "Imponibile" : "Net amount"}</span><b>{formatEur(priced.netCents, lang)}</b></p>
            <p><span>{it ? "IVA" : "VAT"} {product.vatBps / 100}%</span><b>{formatEur(priced.vatCents, lang)}</b></p>
            <p className="total"><span>{it ? "Totale" : "Total"}</span><b>{formatEur(priced.totalCents, lang)}</b></p>
            <small>{it ? `Rinnovi successivi: ${formatEur(priced.renewalBaseCents, lang)} + IVA. ${validity(product, lang)}.` : `Subsequent renewals: ${formatEur(priced.renewalBaseCents, lang)} + VAT. ${validity(product, lang)}.`}</small>
          </div>
          {!offerActive(product) && <p className="form-note">{it ? "Le offerte promo sono scadute: vengono applicate le tariffe di listino." : "Promotional offers have expired: standard rates apply."}</p>}
        </>}
        {postal && <p className="no-deposit">{it ? "Nessun deposito cauzionale" : "No security deposit"}</p>}
        <ul className="check-list">
          <li><ShieldCheck />{it ? "Verifica del numero via SMS" : "Mobile verification by SMS"}</li>
          <li><ShieldCheck />{it ? "Pagamento sicuro: PayPal, Stripe, SumUp o bonifico" : "Secure payment: PayPal, Stripe, SumUp or bank transfer"}</li>
          <li><ShieldCheck />{it ? "Modulo di richiesta in PDF via email" : "Request form PDF sent by email"}</li>
        </ul>
      </aside>
    </div>
  </div>;
}

