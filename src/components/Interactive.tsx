"use client";

import { CheckCircle2, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { FormEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Lang } from "@/lib/site";

export function ContactForm({ lang }: { lang: Lang }) {
  const it = lang === "it";
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const labels = {
    name: it ? "Nome e Cognome o Ragione Sociale*" : "Name and Surname or Company Name*", email: "Email*", phone: it ? "Telefono (consigliato)" : "Phone (recommended)",
    subject: it ? "Argomento" : "Subject", message: it ? "Messaggio*" : "Message*", consent: it ? "Acconsento al trattamento dei dati personali" : "I consent to the processing of personal data",
    submit: it ? "INVIA RICHIESTA" : "SEND ENQUIRY", required: it ? "Campo obbligatorio" : "Required field", invalidEmail: it ? "Inserisci un indirizzo email valido" : "Enter a valid email address",
    nameTooShort: it ? "Inserisci almeno 2 caratteri" : "Enter at least 2 characters", messageTooShort: it ? "Il messaggio deve avere almeno 5 caratteri" : "The message must be at least 5 characters long",
  };
  function validateName(value: string) { const v = value.trim(); return !v ? labels.required : v.length < 2 ? labels.nameTooShort : ""; }
  function validateEmail(value: string) { return /^\S+@\S+\.\S+$/.test(value) ? "" : labels.invalidEmail; }
  function validateMessage(value: string) { const v = value.trim(); return !v ? labels.required : v.length < 5 ? labels.messageTooShort : ""; }
  function setFieldError(key: string, message: string) { setErrors(prev => { if (!message) { if (!(key in prev)) return prev; const { [key]: _drop, ...rest } = prev; return rest; } return { ...prev, [key]: message }; }); }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const fd = new FormData(form); const next: Record<string, string> = {};
    const nameErr = validateName(String(fd.get("name") || "")); if (nameErr) next.name = nameErr;
    const messageErr = validateMessage(String(fd.get("message") || "")); if (messageErr) next.message = messageErr;
    const emailErr = validateEmail(String(fd.get("email") || "")); if (emailErr) next.email = emailErr;
    if (!fd.get("consent")) next.consent = labels.required;
    setErrors(next); if (Object.keys(next).length) { document.getElementById(`err-${Object.keys(next)[0]}`)?.focus(); return; }
    setState("loading");
    try {
      const body = Object.fromEntries(fd.entries());
      const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, lang }) });
      if (!res.ok) throw new Error(); setState("success"); form.reset();
    } catch { setState("error"); }
  }
  const err = (key: string) => errors[key] ? <span id={`err-${key}`} className="field-error" role="alert" tabIndex={-1}>{errors[key]}</span> : null;
  return <form className="contact-form" noValidate onSubmit={submit}>
    <div className="form-grid">
      <label>{labels.name}<input name="name" autoComplete="name" onBlur={e => setFieldError("name", validateName(e.target.value))} aria-invalid={!!errors.name} aria-describedby={errors.name ? "err-name" : undefined} />{err("name")}</label>
      <label>{labels.email}<input name="email" type="email" autoComplete="email" onBlur={e => setFieldError("email", validateEmail(e.target.value))} aria-invalid={!!errors.email} aria-describedby={errors.email ? "err-email" : undefined} />{err("email")}</label>
      <label>{labels.phone}<input name="phone" type="tel" autoComplete="tel" /></label>
      <label>{labels.subject}<select name="subject"><option>{it ? "Informazioni Generali" : "General Information"}</option><option>{it ? "Uffici Arredati" : "Furnished Offices"}</option><option>{it ? "Domiciliazioni" : "Business addresses"}</option><option>{it ? "Tariffe" : "Pricing"}</option><option>{it ? "Contratti Smart" : "Smart-Start agreements"}</option><option>{it ? "Corsi" : "Training"}</option><option>{it ? "Altro" : "Other"}</option></select></label>
    </div>
    <label>{labels.message}<textarea name="message" rows={6} onBlur={e => setFieldError("message", validateMessage(e.target.value))} aria-invalid={!!errors.message} aria-describedby={errors.message ? "err-message" : undefined} />{err("message")}</label>
<div className="honeypot" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <label className="check-label"><input name="consent" type="checkbox" value="true" /> <span>{labels.consent} <Link href={it ? "/privacy.html" : "/en/privacy.html"} target="_blank" rel="noopener noreferrer">{it ? "(leggi l’informativa privacy)" : "(read the privacy notice)"}</Link>*</span></label>{err("consent")}
    <button className="button primary" disabled={state === "loading"}>{state === "loading" && <LoaderCircle className="spin" />}{labels.submit}</button>
    <div aria-live="polite" className={`form-status ${state}`}>{state === "success" ? (it ? "Grazie! La richiesta è stata inviata." : "Thank you! Your enquiry has been sent.") : state === "error" ? (it ? "Invio non riuscito. Riprova o chiamaci." : "Submission failed. Please retry or call us.") : ""}</div>
  </form>;
}

export function SignaturePad({ lang, orderId }: { lang: Lang; orderId: string }) {
  const it = lang === "it";
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  useEffect(() => {
    const c = canvas.current; if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio; c.height = 180 * ratio;
    const ctx = c.getContext("2d"); if (ctx) ctx.scale(ratio, ratio);
  }, []);
  const point = (e: PointerEvent<HTMLCanvasElement>) => { const c = canvas.current!; const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
  function start(e: PointerEvent<HTMLCanvasElement>) { drawing.current = true; const ctx = canvas.current!.getContext("2d")!; const [x, y] = point(e); ctx.beginPath(); ctx.moveTo(x, y); e.currentTarget.setPointerCapture(e.pointerId); }
  function move(e: PointerEvent<HTMLCanvasElement>) { if (!drawing.current) return; const ctx = canvas.current!.getContext("2d")!; const [x, y] = point(e); ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.strokeStyle = "#183229"; ctx.lineTo(x, y); ctx.stroke(); }
  async function save() {
    const c = canvas.current; if (!c) return;
    setState("busy");
    try {
      const res = await fetch("/api/save-signature", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, signature: c.toDataURL("image/png") }) });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = `signed-${orderId}.pdf`; link.click();
      URL.revokeObjectURL(url);
      setState("done");
    } catch { setState("error"); }
  }
  return <div className="signature-flow">
    <h3>{it ? "Firma la richiesta (opzionale)" : "Sign the request (optional)"}</h3>
    <p className="form-note">{it ? "Disegna la firma e scarica il PDF firmato. Per la piena validità legale è consigliato un provider di firma elettronica qualificata." : "Draw your signature and download the signed PDF. For full legal validity a qualified e-signature provider is recommended."}</p>
    <canvas ref={canvas} className="signature-canvas" aria-label={it ? "Area firma" : "Signature area"} onPointerDown={start} onPointerMove={move} onPointerUp={() => (drawing.current = false)} />
    <div className="inline-actions">
      <button className="text-button" onClick={() => { const c = canvas.current; c?.getContext("2d")?.clearRect(0, 0, c.width, c.height); setState("idle"); }}>{it ? "Cancella" : "Clear"}</button>
      <button className="button primary" onClick={save} disabled={state === "busy"}>{state === "busy" && <LoaderCircle className="spin" />}{it ? "FIRMA E SCARICA PDF" : "SIGN & DOWNLOAD PDF"}</button>
    </div>
    <div aria-live="polite" className={`form-status ${state === "done" ? "success" : state === "error" ? "error" : ""}`}>{state === "done" ? (it ? "PDF firmato generato." : "Signed PDF generated.") : state === "error" ? (it ? "Generazione non riuscita." : "Generation failed.") : ""}</div>
  </div>;
}
