"use client";

import { CheckCircle2, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { FormEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Lang } from "@/lib/site";

export function ContactForm({ lang }: { lang: Lang }) {
  const it = lang === "it";
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const labels = {
    name: it ? "Nome e Cognome o Ragione Sociale*" : "Name and Surname or Company Name*", email: "Email*", email2: it ? "Conferma email*" : "Confirm email*", phone: it ? "Telefono (consigliato)" : "Phone (recommended)",
    subject: it ? "Argomento" : "Subject", message: it ? "Messaggio*" : "Message*", consent: it ? "Acconsento al trattamento dei dati personali" : "I consent to the processing of personal data",
    submit: it ? "INVIA RICHIESTA" : "SEND ENQUIRY", required: it ? "Campo obbligatorio" : "Required field", invalidEmail: it ? "Inserisci un indirizzo email valido" : "Enter a valid email address", mismatch: it ? "Gli indirizzi email non coincidono" : "Email addresses do not match",
  };
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const fd = new FormData(form); const next: Record<string, string> = {};
    ["name", "message"].forEach(k => { if (!String(fd.get(k) || "").trim()) next[k] = labels.required; });
    if (!/^\S+@\S+\.\S+$/.test(String(fd.get("email") || ""))) next.email = labels.invalidEmail;
    if (fd.get("email") !== fd.get("emailConfirm")) next.emailConfirm = labels.mismatch;
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
      <label>{labels.name}<input name="name" autoComplete="name" aria-invalid={!!errors.name} aria-describedby={errors.name ? "err-name" : undefined} />{err("name")}</label>
      <label>{labels.email}<input name="email" type="email" autoComplete="email" aria-invalid={!!errors.email} aria-describedby={errors.email ? "err-email" : undefined} />{err("email")}</label>
      <label>{labels.email2}<input name="emailConfirm" type="email" autoComplete="email" aria-invalid={!!errors.emailConfirm} aria-describedby={errors.emailConfirm ? "err-emailConfirm" : undefined} />{err("emailConfirm")}</label>
      <label>{labels.phone}<input name="phone" type="tel" autoComplete="tel" /></label>
      <label>{labels.subject}<select name="subject"><option>{it ? "Informazioni Generali" : "General Information"}</option><option>{it ? "Uffici Arredati" : "Furnished Offices"}</option><option>{it ? "Domiciliazioni" : "Business addresses"}</option><option>{it ? "Tariffe" : "Pricing"}</option><option>{it ? "Corsi" : "Training"}</option><option>{it ? "Altro" : "Other"}</option></select></label>
    </div>
    <label>{labels.message}<textarea name="message" rows={6} aria-invalid={!!errors.message} aria-describedby={errors.message ? "err-message" : undefined} />{err("message")}</label>
<div className="honeypot" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <label className="check-label"><input name="consent" type="checkbox" value="true" /> <span>{labels.consent}*</span></label>{err("consent")}
    <p className="form-note">{it ? "Consulta la Privacy Policy. reCAPTCHA è attivabile tramite configurazione." : "See our Privacy Policy. reCAPTCHA can be enabled in configuration."}</p>
    <button className="button primary" disabled={state === "loading"}>{state === "loading" && <LoaderCircle className="spin" />}{labels.submit}</button>
    <div aria-live="polite" className={`form-status ${state}`}>{state === "success" ? (it ? "Grazie! La richiesta è stata inviata." : "Thank you! Your enquiry has been sent.") : state === "error" ? (it ? "Invio non riuscito. Riprova o chiamaci." : "Submission failed. Please retry or call us.") : ""}</div>
  </form>;
}

export function SignaturePad({ lang, orderId, name }: { lang: Lang; orderId: string; name: string }) {
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
      const res = await fetch("/api/save-signature", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, name, signature: c.toDataURL("image/png") }) });
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
