"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, FileDown, LoaderCircle, Mail, X } from "lucide-react";
import { copyFor, type Lang, type ServiceCode } from "@/lib/pricing";

export function StandardOfferModal({ service, lang }: { service: ServiceCode; lang: Lang }) {
  const it = lang === "it"; const copy = copyFor(service, lang); const id = useId();
  const dialog = useRef<HTMLDialogElement>(null); const trigger = useRef<HTMLButtonElement>(null); const first = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false); const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [requestId, setRequestId] = useState(""); const [error, setError] = useState(""); const [email, setEmail] = useState("");
  const close = () => { dialog.current?.close(); setOpen(false); trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return; dialog.current?.showModal(); first.current?.focus(); const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const fd = new FormData(form); setError("");
    if (!String(fd.get("firstName") || "").trim() || !String(fd.get("lastName") || "").trim() || !["Mr", "Ms"].includes(String(fd.get("title")))) { setError(it ? "Compila nome, cognome e titolo." : "Enter your first name, last name and title."); return; }
    if (!/^\S+@\S+\.\S+$/.test(String(fd.get("email") || ""))) { setError(it ? "Inserisci un indirizzo email valido." : "Enter a valid email address."); return; }
    if (!fd.get("consent")) { setError(it ? "È necessario il consenso al trattamento dei dati per inviare l’offerta." : "Consent to data processing is required to send the offer."); return; }
    setState("sending");
    try {
      const response = await fetch("/api/standard-offer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...Object.fromEntries(fd), service, lang, requestId, consent: true }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "delivery");
      setEmail(String(fd.get("email"))); setState("sent"); form.reset();
    } catch (e) {
      const code = e instanceof Error ? e.message : "delivery";
      const localized: Record<string, string> = it ? {
        attachment: "Il modulo PDF originale non è ancora disponibile. L’offerta non è stata inviata: contatta la reception o riprova più tardi.",
        mail: "L’offerta non è stata inviata: il servizio email non è disponibile. Riprova più tardi o contatta la reception.",
        limited: "Hai effettuato troppe richieste. Attendi prima di riprovare.", sending: "La richiesta è già in invio. Attendi un momento e riprova.",
      } : { attachment: "The original PDF form is not yet available. Your offer has not been sent. Contact reception or try again later.", mail: "Your offer has not been sent: the email service is unavailable. Please try again later or contact reception.", limited: "Too many requests. Please wait before trying again.", sending: "This request is already being sent. Please wait a moment and try again." };
      setError(localized[code] || (it ? "Invio non riuscito. Controlla i dati e riprova." : "Could not send. Check your details and try again.")); setState("idle");
    }
  }
  return <>
    <button type="button" ref={trigger} className="button secondary standard-offer-trigger" onClick={() => { if (state !== "sending") { setRequestId(crypto.randomUUID()); setState("idle"); setError(""); } setOpen(true); }}><Mail aria-hidden="true" />{it ? (service === "legal_unit" ? "Ricevi offerta standard" : "Richiedi preventivo standard") : "Receive a standard offer"}</button>
    <dialog ref={dialog} className="standard-offer-dialog" aria-labelledby={id} onCancel={close}>
      <div className="modal-heading"><div><span className="eyebrow">{copy.nameShort}</span><h2 id={id}>{it ? "Ricevi l’offerta via email" : "Receive the offer by email"}</h2></div><button className="modal-close" onClick={close} aria-label={it ? "Chiudi offerta" : "Close offer"}><X /></button></div>
      {state === "sent" ? <div className="standard-offer-success" role="status"><CheckCircle2 /><h3>{it ? "Offerta inviata" : "Offer sent"}</h3><p>{it ? "Abbiamo inviato l’offerta standard e il modulo PDF originale a" : "We sent the standard offer and original PDF form to"} <strong>{email}</strong>.</p><p>{it ? "Controlla anche la cartella spam." : "Please also check your spam folder."}</p><button className="button primary" onClick={close}>{it ? "Chiudi" : "Close"}</button></div> : <form onSubmit={submit} onChange={() => { if (state !== "sending") setRequestId(crypto.randomUUID()); }} noValidate className="standard-offer-form"><p className="form-note">{it ? "Riceverai prezzi, condizioni e il modulo di richiesta PDF originale. Nessun acquisto viene effettuato con questa richiesta." : "You will receive prices, terms and the original PDF application form. This request does not make a purchase."}</p><div className="form-grid"><label htmlFor={`${id}-first`}>{it ? "Nome" : "First name"}*<input id={`${id}-first`} ref={first} name="firstName" autoComplete="given-name" maxLength={100} required /></label><label htmlFor={`${id}-last`}>{it ? "Cognome" : "Last name"}*<input id={`${id}-last`} name="lastName" autoComplete="family-name" maxLength={100} required /></label><label htmlFor={`${id}-title`}>{it ? "Titolo" : "Title"}*<select id={`${id}-title`} name="title" required defaultValue=""><option value="">{it ? "Seleziona" : "Select"}</option><option value="Mr">Mr</option><option value="Ms">Ms</option></select></label><label htmlFor={`${id}-email`}>Email*<input id={`${id}-email`} name="email" type="email" autoComplete="email" maxLength={254} required /></label></div><div className="honeypot" aria-hidden="true"><input name="website" aria-label="Website" tabIndex={-1} autoComplete="off" /></div><label className="check-label"><input type="checkbox" name="consent" required /><span>{it ? "Acconsento al trattamento dei dati personali per ricevere l’offerta richiesta." : "I consent to the processing of my personal data to receive the requested offer."} <Link href={it ? "/privacy.html" : "/en/privacy.html"}>{it ? "Informativa privacy" : "Privacy notice"}</Link>*</span></label><p className="attachment-note"><FileDown />Modulo_Richiesta_Domiciliazione_ns.pdf</p><div className="field-error" role="alert">{error}</div><button className="button primary" type="submit" disabled={state === "sending"}>{state === "sending" ? <LoaderCircle className="spin" /> : <ArrowRight />}{it ? (state === "sending" ? "Invio in corso…" : "Continua") : (state === "sending" ? "Sending…" : "Continue")}</button></form>}
    </dialog>
  </>;
}
