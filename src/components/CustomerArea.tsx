"use client";

import Link from "next/link";
import { ArrowRight, ArrowLeft, Check, CheckCircle2, Download, Eye, EyeOff, FileCheck2, FileText, FolderLock, IdCard, LayoutDashboard, LoaderCircle, LockKeyhole, LogOut, Mail, Phone, ShieldCheck, Smartphone, UserRound } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { Lang } from "@/lib/site";

const messages = {
  it: {
    credentials: "Email o password non valide. Riprova.", invalid: "Controlla i dati inseriti.", code: "Il codice non è corretto. Riprova.",
    expired: "Il codice è scaduto. Accedi nuovamente per riceverne uno nuovo.", attempts: "Troppi codici errati. Accedi nuovamente.",
    limited: "Troppi tentativi. Attendi 15 minuti prima di riprovare.", wait: "Attendi almeno 60 secondi prima di richiedere un altro codice.",
    smsUnavailable: "Al momento non possiamo inviare l’SMS. Riprova più tardi o contatta la reception.", unavailable: "Il servizio non è disponibile. Riprova tra poco.",
    session: "La sessione è scaduta. Accedi nuovamente.", notFound: "Il documento non è disponibile.", forbidden: "Richiesta non consentita. Ricarica la pagina.",
    password: "Usa una password di almeno 12 caratteri (massimo 128).", resetExpired: "Il link è scaduto o è già stato utilizzato. Richiedine uno nuovo.",
  },
  en: {
    credentials: "Incorrect email or password. Please try again.", invalid: "Please check the details you entered.", code: "That code is incorrect. Please try again.",
    expired: "The code has expired. Sign in again to receive a new one.", attempts: "Too many incorrect codes. Please sign in again.",
    limited: "Too many attempts. Please wait 15 minutes before trying again.", wait: "Wait at least 60 seconds before requesting another code.",
    smsUnavailable: "We cannot send the SMS right now. Try again later or contact reception.", unavailable: "The service is unavailable. Please try again shortly.",
    session: "Your session has expired. Please sign in again.", notFound: "This document is unavailable.", forbidden: "This request is not permitted. Please reload the page.",
    password: "Use a password with at least 12 characters (128 maximum).", resetExpired: "This link has expired or has already been used. Please request a new one.",
  },
};
type Account = { name: string; email: string; companyName: string | null; phone: string; lastLoginAt: string | null };
type Contract = { id: string; title: string; titleEn: string; reference: string; sizeBytes: number; createdAt: string };
type Profile = { customer: Account; contracts: Contract[] };
type View = "loading" | "login" | "sms" | "reset" | "setup" | "dashboard";

export function CustomerArea({ lang }: { lang: Lang }) {
  const it = lang === "it";
  const [view, setView] = useState<View>("loading");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState(""); const [phone, setPhone] = useState(""); const [resetToken, setResetToken] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [cooldown, setCooldown] = useState(0);
  const [downloading, setDownloading] = useState("");
  const titleRef = useRef<HTMLHeadingElement>(null);
  const textError = (code: string) => messages[lang][code as keyof typeof messages.it] || messages[lang].unavailable;
  const loadProfile = useCallback(async () => {
    try {
      const r = await fetch("/api/customer/me", { cache: "no-store" });
      if (!r.ok) { setProfile(null); setView("login"); return; }
      setProfile(await r.json()); setView("dashboard");
    } catch { setView("login"); }
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href); const setup = url.searchParams.get("setup");
    if (setup) {
      setResetToken(setup); setView("setup"); url.searchParams.delete("setup"); window.history.replaceState({}, "", url.pathname + url.search);
    } else void loadProfile();
  }, [loadProfile]);
  useEffect(() => { if (view !== "loading") titleRef.current?.focus(); }, [view]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(s => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function api(action: string, body: object) {
    const r = await fetch(`/api/customer/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, lang }) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "unavailable");
    return data;
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(""); setNotice("");
    if ((view === "login" || view === "reset") && !/^\S+@\S+\.\S+$/.test(email.trim())) { setError(it ? "Inserisci un indirizzo email valido." : "Enter a valid email address."); return; }
    if (view === "login" && !password) { setError(it ? "Inserisci la password." : "Enter your password."); return; }
    if (view === "setup" && (password.length < 12 || password.length > 128)) { setError(textError("password")); return; }
    if (view === "sms" && !/^\d{6}$/.test(otp)) { setError(it ? "Inserisci il codice SMS a 6 cifre." : "Enter the 6-digit SMS code."); return; }
    setBusy(true);
    try {
      if (view === "login") {
        const data = await api("login", { email, password });
        setPassword(""); setOtp(""); setPhone(data.phone); setCooldown(60); setView("sms");
      } else if (view === "sms") {
        await api("verify", { code: otp }); setOtp(""); await loadProfile();
      } else if (view === "reset") {
        await api("password", { action: "request", email });
        setNotice(it ? "Se l’email corrisponde a un account, riceverai un link personale per impostare la password. Controlla anche la posta indesiderata." : "If this email matches an account, you will receive a personal password link. Please also check your spam folder.");
      } else if (view === "setup") {
        await api("password", { action: "set", token: resetToken, password }); setPassword(""); setResetToken(""); setView("login");
        setNotice(it ? "Password impostata. Accedi per ricevere il codice SMS." : "Password set. Sign in to receive your SMS code.");
      }
    } catch (e) { setError(textError(e instanceof Error ? e.message : "unavailable")); }
    finally { setBusy(false); }
  }
  async function resend() {
    setBusy(true); setError("");
    try { await api("resend", {}); setCooldown(60); setOtp(""); setNotice(it ? "Un nuovo codice è stato inviato al cellulare registrato." : "A new code was sent to your registered mobile."); }
    catch (e) { setError(textError(e instanceof Error ? e.message : "unavailable")); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError("");
    try { await api("logout", {}); setProfile(null); setPassword(""); setOtp(""); setView("login"); setNotice(""); }
    catch (e) { setError(textError(e instanceof Error ? e.message : "unavailable")); } finally { setBusy(false); }
  }
  async function download(contract: Contract) {
    setDownloading(contract.id); setError("");
    try {
      const r = await fetch(`/api/customer/contract?id=${contract.id}`, { cache: "no-store" });
      if (r.status === 401) { setProfile(null); setView("login"); throw new Error("session"); }
      if (!r.ok) throw new Error("notFound");
      const blob = await r.blob(); const url = URL.createObjectURL(blob); const a = document.createElement("a");
      a.href = url; a.download = `contract-${contract.reference}.pdf`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(it ? "Download del contratto avviato." : "Your contract download has started.");
    } catch (e) { setError(textError(e instanceof Error ? e.message : "unavailable")); } finally { setDownloading(""); }
  }
  const status = <><div className="customer-error" role="alert">{error}</div><div className="customer-notice" role="status">{notice}</div></>;
  if (view === "loading") return <div className="customer-loading" role="status"><LoaderCircle className="spin" />{it ? "Caricamento area riservata…" : "Loading your customer area…"}</div>;
  if (view === "dashboard" && profile) return <div className="customer-dashboard">
    <aside className="dashboard-side">
      <div className="member-avatar">{profile.customer.name.split(" ").filter(Boolean).slice(0, 2).map(n => n[0]).join("")}</div>
      <b>{profile.customer.name}</b><span>{profile.customer.companyName || (it ? "Cliente Roma Office Sharing" : "Roma Office Sharing customer")}</span>
      <div className="dashboard-nav"><a href="#customer-overview"><LayoutDashboard />{it ? "Panoramica" : "Overview"}</a><a href="#customer-contracts"><FileCheck2 />{it ? "I miei contratti" : "My contracts"}</a><a href="#customer-future"><FolderLock />{it ? "Altri documenti" : "Other documents"}<small>{it ? "Presto" : "Soon"}</small></a></div>
      <div className="session-badge"><ShieldCheck />{it ? "Accesso verificato via SMS" : "SMS-verified sign-in"}</div>
      <button className="dashboard-logout" disabled={busy} onClick={logout}><LogOut />{it ? "Esci dall’area clienti" : "Sign out"}</button>
    </aside>
    <div className="dashboard-content" id="customer-overview">
      <span className="eyebrow">{it ? "IL TUO SPAZIO PERSONALE" : "YOUR PERSONAL SPACE"}</span>
      <h2 ref={titleRef} tabIndex={-1}>{it ? "Bentornato," : "Welcome back,"} {profile.customer.name.split(" ")[0]}.</h2>
      <p className="dashboard-lead">{it ? "I tuoi contratti, al sicuro e sempre a portata di mano." : "Your contracts, secure and always within reach."}</p>
      <div className="dashboard-stats"><div><FileCheck2 /><span>{it ? "Contratti disponibili" : "Available contracts"}<b>{profile.contracts.length.toString().padStart(2, "0")}</b></span></div><div><Smartphone /><span>{it ? "Cellulare verificato" : "Verified mobile"}<b>{profile.customer.phone}</b></span></div><div><ShieldCheck /><span>{it ? "Protezione account" : "Account protection"}<b>{it ? "Password + SMS" : "Password + SMS"}</b></span></div></div>
      {status}
      <section className="dashboard-contracts" id="customer-contracts"><div className="dashboard-section-heading"><div><span className="eyebrow">{it ? "DOCUMENTI" : "DOCUMENTS"}</span><h3>{it ? "I miei contratti" : "My contracts"}</h3></div><span className="file-type-badge">PDF</span></div>
        {profile.contracts.length ? <div className="contract-list">{profile.contracts.map(contract => <article key={contract.id} className="contract-row"><span className="contract-icon"><FileText /></span><div><h4>{it ? contract.title : contract.titleEn}</h4><p>{contract.reference} · {new Date(contract.createdAt).toLocaleDateString(it ? "it-IT" : "en-GB")} · {Math.max(1, Math.round(contract.sizeBytes / 1024))} KB</p></div><button className="button primary" disabled={!!downloading} onClick={() => download(contract)}>{downloading === contract.id ? <LoaderCircle className="spin" /> : <Download />}{it ? "Scarica contratto" : "Download contract"}</button></article>)}</div> : <div className="document-empty"><FileCheck2 /><h4>{it ? "Il tuo contratto sarà qui" : "Your contract will appear here"}</h4><p>{it ? "Non ci sono ancora contratti disponibili. La reception li pubblicherà in quest’area dopo la verifica e il completamento della pratica." : "No contracts are available yet. Reception will publish them here after your application has been reviewed and completed."}</p></div>}
      </section>
      <div className="future-documents" id="customer-future"><section><FolderLock /><span className="coming-soon">{it ? "PROSSIMAMENTE" : "COMING SOON"}</span><h3>{it ? "Altri download" : "Other downloads"}</h3><p>{it ? "Uno spazio dedicato a modulistica e documenti relativi ai tuoi servizi." : "A dedicated space for forms and documents relating to your services."}</p><span className="future-state"><LockKeyhole />{it ? "Non ancora disponibile" : "Not available yet"}</span></section><section><IdCard /><span className="coming-soon">{it ? "PROSSIMAMENTE" : "COMING SOON"}</span><h3>{it ? "Documenti d’identità" : "Identity documents"}</h3><p>{it ? "Qui potrai caricare i documenti richiesti in modo sicuro. Il caricamento non è ancora attivo." : "You will be able to securely upload the documents we need here. Uploads are not enabled yet."}</p><span className="future-state"><LockKeyhole />{it ? "Caricamento non attivo" : "Uploads not enabled"}</span></section></div>
      <div className="dashboard-help"><Mail /><div><b>{it ? "Hai bisogno di assistenza?" : "Need assistance?"}</b><p>{it ? "Per il contratto o per aggiornare il cellulare registrato, contatta la reception." : "For help with your contract or to update your registered mobile, contact reception."}</p></div><a href="mailto:info@romaofficesharing.it">{it ? "Contattaci" : "Contact us"}<ArrowRight /></a></div>
    </div>
  </div>;

  return <div className="customer-login-layout">
    <aside className="customer-welcome"><span className="eyebrow">{it ? "UN ACCESSO, TUTTO A PORTATA DI MANO" : "ONE SIGN-IN. EVERYTHING WITHIN REACH."}</span><h2>{it ? "Il tuo business.\nIl tuo spazio riservato." : "Your business.\nYour private space."}</h2><p>{it ? "Accedi ai tuoi contratti in ogni momento, con la tranquillità di un’area dedicata e protetta." : "Access your contracts whenever you need them, with the reassurance of a dedicated, protected space."}</p><ul><li><FileCheck2 /><div><b>{it ? "Contratti sempre disponibili" : "Contracts always available"}</b><span>{it ? "Scarica le copie PDF pubblicate dalla reception." : "Download the PDF copies published by reception."}</span></div></li><li><Smartphone /><div><b>{it ? "Un livello di protezione in più" : "An extra layer of protection"}</b><span>{it ? "Dopo la password, un codice al tuo cellulare." : "After your password, a code to your mobile."}</span></div></li><li><ShieldCheck /><div><b>{it ? "I tuoi documenti restano privati" : "Your documents stay private"}</b><span>{it ? "Accesso riservato soltanto al tuo account." : "Access is restricted to your account."}</span></div></li></ul><div className="customer-welcome-bottom"><LockKeyhole />{it ? "Area riservata ai clienti Roma Office Sharing" : "Exclusively for Roma Office Sharing customers"}</div></aside>
    <div className="customer-login-card">
      <span className="login-icon">{view === "sms" ? <Smartphone /> : view === "setup" ? <CheckCircle2 /> : <UserRound />}</span>
      <div className="login-progress"><span className={view === "sms" ? "complete" : ""}>{view === "sms" ? <Check /> : "01"}{it ? "Credenziali" : "Credentials"}</span><span className={view === "sms" ? "complete" : ""}>02 {it ? "Codice SMS" : "SMS code"}</span></div>
      <h2 ref={titleRef} tabIndex={-1}>{view === "sms" ? (it ? "Verifica il tuo accesso" : "Verify your sign-in") : view === "reset" ? (it ? "Recupera la password" : "Reset your password") : view === "setup" ? (it ? "Imposta la tua password" : "Set your password") : (it ? "Accedi all’Area Clienti" : "Sign in to your Customer Area")}</h2>
      <p className="login-description">{view === "sms" ? (it ? `Abbiamo inviato un codice a ${phone}, il cellulare registrato sul tuo account. Il codice scade dopo 5 minuti.` : `We sent a code to ${phone}, the mobile registered to your account. The code expires after 5 minutes.`) : view === "setup" ? (it ? "Scegli una password di almeno 12 caratteri. Per accedere sarà richiesto anche il codice SMS." : "Choose a password with at least 12 characters. An SMS code will also be required to sign in.") : view === "reset" ? (it ? "Inserisci l’email registrata per ricevere il link personale di recupero." : "Enter your registered email to receive a personal reset link.") : (it ? "Inserisci l’email e la password associate al tuo account." : "Enter the email and password associated with your account.")}</p>
      <form noValidate onSubmit={submit}>
        {(view === "login" || view === "reset") && <label htmlFor="customer-email">Email<input required id="customer-email" type="email" autoComplete="username" value={email} maxLength={254} onChange={e => setEmail(e.target.value)} placeholder={it ? "nome@azienda.it" : "name@company.com"} /></label>}
        {(view === "login" || view === "setup") && <label htmlFor="customer-password">{it ? (view === "setup" ? "Nuova password" : "Password") : (view === "setup" ? "New password" : "Password")}<span className="password-input"><input required id="customer-password" type={showPassword ? "text" : "password"} minLength={view === "setup" ? 12 : 1} maxLength={128} autoComplete={view === "setup" ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} /><button type="button" aria-label={it ? (showPassword ? "Nascondi password" : "Mostra password") : (showPassword ? "Hide password" : "Show password")} onClick={() => setShowPassword(s => !s)}>{showPassword ? <EyeOff /> : <Eye />}</button></span></label>}
        {view === "sms" && <label htmlFor="customer-code">{it ? "Codice SMS a 6 cifre" : "6-digit SMS code"}<input id="customer-code" required className="customer-otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="000000" /></label>}
        {view === "login" && <button className="forgot-link" type="button" onClick={() => { setView("reset"); setError(""); setNotice(""); setPassword(""); }}>{it ? "Hai dimenticato la password?" : "Forgot your password?"}</button>}
        {status}
        <button className="button primary login-submit" disabled={busy || (view === "sms" && otp.length !== 6)}>{busy ? <LoaderCircle className="spin" /> : view === "sms" ? <ShieldCheck /> : <ArrowRight />}{view === "sms" ? (it ? "Verifica e accedi" : "Verify & sign in") : view === "reset" ? (it ? "Invia link di recupero" : "Send reset link") : view === "setup" ? (it ? "Salva password" : "Save password") : (it ? "Continua con SMS" : "Continue with SMS")}</button>
      </form>
      {view === "sms" && <div className="login-resend"><span>{it ? "Non hai ricevuto il codice?" : "Didn’t receive your code?"}</span><button className="text-button" disabled={busy || cooldown > 0} onClick={resend}>{cooldown ? (it ? `Invia di nuovo tra ${cooldown}s` : `Resend in ${cooldown}s`) : (it ? "Invia un nuovo codice" : "Send a new code")}</button></div>}
      {view !== "login" && <button className="login-back text-button" onClick={() => { setView("login"); setError(""); setNotice(""); setPassword(""); setOtp(""); }}><ArrowLeft />{it ? "Torna all’accesso" : "Back to sign-in"}</button>}
      <div className="login-note"><LockKeyhole /><p>{it ? "L’accesso è riservato ai clienti registrati dalla reception. Non hai ricevuto le credenziali?" : "Access is for customers registered by reception. Haven’t received your account details?"} <a href="mailto:info@romaofficesharing.it">{it ? "Contattaci" : "Contact us"}</a>.</p></div>
      <p className="login-privacy"><Link href={it ? "/privacy.html" : "/en/privacy.html"}>{it ? "Informativa privacy" : "Privacy notice"}</Link><span>·</span><a href="tel:+390621116268"><Phone />+39 06 21.11.6268</a></p>
    </div>
  </div>;
}
