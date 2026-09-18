"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, ClipboardList, LoaderCircle, X } from "lucide-react";
import { copyFor, formatEur, type Lang, type ProductOffer } from "@/lib/pricing";

export function ManualRequestModal({ product, lang }: { product: ProductOffer; lang: Lang }) {
  const it = lang === "it"; const copy = copyFor(product.code, lang); const id = useId(); const postal = product.code === "postal";
  const vatPlaceholder = postal ? undefined : (it ? "o “in costituzione”" : "or “being formed”");
  const dialog = useRef<HTMLDialogElement>(null); const trigger = useRef<HTMLButtonElement>(null); const first = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false); const [state, setState] = useState<"idle" | "sending" | "sent">("idle"); const [error, setError] = useState(""); const [email, setEmail] = useState("");
  const close = () => { dialog.current?.close(); setOpen(false); trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return; dialog.current?.showModal(); first.current?.focus(); const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const fd = new FormData(form); setError("");
    if (!fd.get("consent")) { setError(it ? "È necessario il consenso al trattamento dei dati per inviare la richiesta." : "Consent to data processing is required to send the request."); return; }
    setState("sending");
    try {
      const response = await fetch("/api/manual-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...Object.fromEntries(fd), service: product.code, lang, requestId: crypto.randomUUID(), consent: true }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "delivery");
      setEmail(String(fd.get("email"))); setState("sent"); form.reset();
    } catch (e) {
      const code = e instanceof Error ? e.message : "delivery";
      const localized: Record<string, string> = it ? {
        mail: "La richiesta non è stata inviata: il servizio email non è disponibile. Riprova più tardi o contatta la reception.",
        limited: "Hai effettuato troppe richieste. Attendi prima di riprovare.", invalid: "Controlla i dati inseriti e riprova.",
      } : { mail: "Your request has not been sent: the email service is unavailable. Please try again later or contact reception.", limited: "Too many requests. Please wait before trying again.", invalid: "Check the details you entered and try again." };
      setError(localized[code] || (it ? "Invio non riuscito. Controlla i dati e riprova." : "Could not send. Check your details and try again.")); setState("idle");
    }
  }
  return <>
    <button type="button" ref={trigger} className="button secondary manual-request-trigger" onClick={() => { if (state !== "sending") { setState("idle"); setError(""); } setOpen(true); }}><ClipboardList aria-hidden="true" />{it ? "Compila il modulo online" : "Fill in the online form"}</button>
    <dialog ref={dialog} className="standard-offer-dialog" aria-labelledby={id} onCancel={close}>
      <div className="modal-heading"><div><span className="eyebrow">{copy.nameShort}</span><h2 id={id}>{it ? "Richiedi l’attivazione" : "Request activation"}</h2></div><button className="modal-close" onClick={close} aria-label={it ? "Chiudi modulo" : "Close form"}><X /></button></div>
      {state === "sent" ? <div className="standard-offer-success" role="status"><CheckCircle2 /><h3>{it ? "Richiesta inviata" : "Request sent"}</h3><p>{it ? "Abbiamo ricevuto i dati e Le confermeremo l’attivazione via email a" : "We received your details and will confirm activation by email to"} <strong>{email}</strong>.</p><p>{it ? "Le invieremo il contratto da firmare e i dati per il pagamento. Nessun pagamento è stato effettuato ora." : "We will send the agreement to sign and the payment details. No payment has been taken now."}</p><button className="button primary" onClick={close}>{it ? "Chiudi" : "Close"}</button></div> : <form onSubmit={submit} noValidate className="standard-offer-form"><p className="form-note">{postal ? (it ? "Il servizio postale è riservato a un soggetto già esistente: indichi i dati completi. Prepareremo il contratto e Le scriveremo per la firma e il pagamento. Nessun acquisto viene effettuato con questa richiesta." : "The mailing service is only available to an already-existing individual or company: please provide full details. We will prepare the agreement and write back for signature and payment. This request does not make a purchase.") : (it ? "Compili i dati della Sua attività: prepareremo il contratto e Le scriveremo per la firma e il pagamento. Nessun acquisto viene effettuato con questa richiesta." : "Enter your company's details: we will prepare the agreement and write back for signature and payment. This request does not make a purchase.")}</p><div className="form-grid"><label htmlFor={`${id}-company`}>{it ? "Denominazione" : "Company name"}*<input id={`${id}-company`} ref={first} name="companyName" maxLength={200} required /></label><label htmlFor={`${id}-vat`}>{it ? "Partita IVA" : "VAT number"}*<input id={`${id}-vat`} name="vatNumber" maxLength={30} required placeholder={vatPlaceholder} /></label><label htmlFor={`${id}-tax`}>{it ? "Codice Fiscale" : "Tax code"}*<input id={`${id}-tax`} name="taxCode" maxLength={30} required placeholder={vatPlaceholder} /></label><label htmlFor={`${id}-rep`}>{it ? "Rappresentante/Titolare" : "Representative/Owner"}*<input id={`${id}-rep`} name="representativeName" autoComplete="name" maxLength={150} required /></label><label htmlFor={`${id}-email`}>Email*<input id={`${id}-email`} name="email" type="email" autoComplete="email" maxLength={254} required /></label><label htmlFor={`${id}-months`}>{it ? "Durata e tariffa" : "Duration and rate"}*<select id={`${id}-months`} name="months" required defaultValue=""><option value="" disabled>{it ? "Seleziona" : "Select"}</option>{product.tiers.map(tier => <option key={tier.months} value={tier.months}>{copy.months(tier.months)} — {formatEur(tier.offerCents ?? tier.listCents, lang)} {it ? "+ IVA" : "+ VAT"}</option>)}</select></label></div><label htmlFor={`${id}-notes`}>{it ? "Note (facoltativo)" : "Notes (optional)"}<textarea id={`${id}-notes`} name="notes" maxLength={1000} rows={3} /></label><div className="honeypot" aria-hidden="true"><input name="website" aria-label="Website" tabIndex={-1} autoComplete="off" /></div><label className="check-label"><input type="checkbox" name="consent" required /><span>{it ? "Acconsento al trattamento dei dati personali per la gestione della richiesta." : "I consent to the processing of my personal data to handle this request."} <Link href={it ? "/privacy.html" : "/en/privacy.html"} target="_blank" rel="noopener noreferrer">{it ? "Informativa privacy" : "Privacy notice"}</Link>*</span></label><div className="field-error" role="alert">{error}</div><button className="button primary" type="submit" disabled={state === "sending"}>{state === "sending" ? <LoaderCircle className="spin" /> : <ArrowRight />}{it ? (state === "sending" ? "Invio in corso…" : "Invia richiesta") : (state === "sending" ? "Sending…" : "Send request")}</button></form>}
    </dialog>
  </>;
}
