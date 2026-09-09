"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowUpRight, LockKeyhole, Menu, Phone, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { alternateFor, contact, hrefFor, resolvePath, ui, type Lang } from "@/lib/site";
import { BrandWords } from "./BrandWords";

function useLocale(fallback: Lang) {
  const pathname = usePathname();
  return pathname ? resolvePath(pathname.split("/").filter(Boolean)) : { lang: fallback, key: fallback === "it" ? "index.html" : "en/index.html" };
}
export function Header({ lang: initialLang }: { lang: Lang; alternate: string }) {
  const { lang, key } = useLocale(initialLang); const t = ui[lang]; const it = lang === "it";
  const query = useSearchParams(); const isActivation = key === "attiva.html" || key === "en/activate.html";
  const serviceQuery = isActivation && query.get("service") === "postal" ? "?service=postal" : "";
  const alternate = alternateFor(key) + serviceQuery; const current = hrefFor(key) + serviceQuery;
  const [open, setOpen] = useState(false); const dialog = useRef<HTMLDialogElement>(null); const trigger = useRef<HTMLButtonElement>(null);
  const home = it ? "/" : "/en/index.html"; const area = it ? "/area-clienti.html" : "/en/customer-area.html";
  const links = it
    ? [["/", t.home], ["/uffici-arredati.html", t.offices], ["/servizi-domiciliazione.html", t.domiciliation], ["/tariffe.html", t.pricing], ["/gallery.html", t.gallery], ["/chi-siamo.html", t.about], ["/contatti.html", t.contact]]
    : [["/en/index.html", t.home], ["/en/offices-furnished.html", t.offices], ["/en/domiliation-services.html", t.domiciliation], ["/en/pricing.html", t.pricing], ["/en/gallery.html", t.gallery], ["/en/about.html", t.about], ["/en/contact.html", t.contact]];
  const close = () => { dialog.current?.close(); setOpen(false); trigger.current?.focus(); };
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => {
    if (!open) return;
    dialog.current?.showModal(); const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  const languageLinks = <div className="lang-switch" role="group" aria-label={t.language}>
    <Link href={it ? current : alternate} hrefLang="it" lang="it" aria-label="Italiano" aria-current={it ? "page" : undefined}>IT</Link><span aria-hidden="true">/</span><Link href={it ? alternate : current} hrefLang="en" lang="en" aria-label="English" aria-current={!it ? "page" : undefined}>EN</Link>
  </div>;
  return <>
    <a href="#main" className="skip-link">{t.skip}</a>
    <header className="site-header">
      <div className="header-utility"><div><span>PALAZZO GENTILONI <span aria-hidden="true">·</span> ROMA</span><a href={`tel:${contact.phoneHref}`}><Phone aria-hidden="true" />{t.call}</a></div></div>
      <div className="header-inner"><Link href={home} className="brand" aria-label={it ? "Roma Office Sharing — Home" : "Roma Office Sharing — Home"}><Image className="brand-logo" src="/LogoFull_trasp.svg" alt="ROMA OFFICESHARING — Business Center" width={580} height={100} priority unoptimized /></Link>
        <nav className="main-nav desktop-nav" aria-label={t.nav}>{links.map(([href, label]) => <Link key={href} href={href} aria-current={href === current ? "page" : undefined}>{label}</Link>)}</nav>
        <div className="header-actions">{languageLinks}<Link href={area} className="customer-link" aria-label={t.customer}><LockKeyhole aria-hidden="true" /><span>{t.customer}</span></Link><a href={`tel:${contact.phoneHref}`} className="phone-pill header-mobile-phone" aria-label={t.call}><Phone aria-hidden="true" /></a><button ref={trigger} className="nav-toggle" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="mobile-navigation" aria-label={t.menu}><Menu /></button></div>
      </div>
    </header>
    <dialog ref={dialog} className="mobile-nav-dialog" id="mobile-navigation" aria-label={t.nav} onCancel={close} onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="mobile-nav-top"><Image src="/LogoFull_trasp.svg" className="brand-logo" alt="Roma Office Sharing" width={580} height={100} unoptimized /><button onClick={close} aria-label={t.close} autoFocus><X /></button></div><nav aria-label={t.nav}>{links.map(([href, label]) => <Link key={href} href={href} onClick={close} aria-current={href === current ? "page" : undefined}>{label}<ArrowUpRight aria-hidden="true" /></Link>)}</nav><Link href={area} className="button primary mobile-customer-link" onClick={close}><LockKeyhole />{t.customer}</Link><a className="mobile-call" href={`tel:${contact.phoneHref}`}><Phone />{t.call}</a>
    </dialog>
  </>;
}
export function Footer({ lang: initialLang }: { lang: Lang }) {
  const { lang } = useLocale(initialLang); const it = lang === "it"; const t = ui[lang]; const prefix = it ? "" : "/en";
  return <footer className="site-footer"><div className="footer-grid shell">
    <div><div className="footer-brand"><BrandWords /></div><p>{t.trademark}</p><p>Via San Martino Della Battaglia, 31 - 00185 - Roma<br />{it ? "P. IVA / REA" : "VAT / REA"}: <span className="placeholder">{it ? "[inserire dati societari]" : "[company details to be added]"}</span></p></div>
    <div><h2>{t.contact}</h2><address>{contact.address}<br /><a href={`tel:${contact.phoneHref}`}>{contact.phone}</a><br />Fax: {contact.fax}<br /><a href={`mailto:${contact.email}`}>{contact.email}</a></address></div>
    <div><h2>{t.hours}</h2><p>{t.center}<br />{t.weekdays}<br />{t.saturday}</p><Link href={it ? "/gallery.html" : "/en/gallery.html"}>Gallery</Link><br /><Link href={it ? "/area-clienti.html" : "/en/customer-area.html"}>{t.customer}</Link></div>
    <div><h2>{it ? "Informazioni" : "Information"}</h2><p><Link href={`${prefix}/privacy.html`}>{it ? "Privacy" : "Privacy notice"}</Link><br /><Link href={`${prefix}/cookie-policy.html`}>Cookie Policy</Link><br /><button className="text-button" data-cookie-settings>{t.settings}</button></p><p className="small">{t.revoke}</p></div>
  </div><div className="footer-bottom shell">© 2025 Cube Engineering s.r.l. — {t.rights}</div></footer>;
}

type Consent = { necessary: true; analytics: boolean; marketing: boolean; savedAt?: number };
const defaultConsent: Consent = { necessary: true, analytics: false, marketing: false };
export function CookieConsent({ lang: initialLang }: { lang: Lang }) {
  const { lang } = useLocale(initialLang); const t = ui[lang];
  const [visible, setVisible] = useState(false); const [settings, setSettings] = useState(false); const [consent, setConsent] = useState<Consent>(defaultConsent);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("ros_cookie_consent") || "null");
      if (!saved || !saved.savedAt || Date.now() - saved.savedAt > 183 * 86400000) setVisible(true); else setConsent(saved);
    } catch { setVisible(true); }
    const handler = (event: MouseEvent) => { if ((event.target as HTMLElement).closest("[data-cookie-settings]")) { setVisible(true); setSettings(true); } };
    document.addEventListener("click", handler); return () => document.removeEventListener("click", handler);
  }, []);
  const save = (next: Consent) => { const value = { ...next, savedAt: Date.now() }; try { localStorage.setItem("ros_cookie_consent", JSON.stringify(value)); } catch {} setConsent(value); setVisible(false); setSettings(false); window.dispatchEvent(new CustomEvent("cookieConsentChanged", { detail: value })); };
  if (!visible) return null;
  return <div className="cookie-wrap" role="region" aria-label={t.cookieTitle}><div className="cookie-card"><div><span className="eyebrow">COOKIE</span><h2>{t.cookieTitle}</h2><p>{t.cookieText}</p></div>{settings && <div className="cookie-options"><label><span>{t.necessary}<small>{t.always}</small></span><input type="checkbox" checked disabled /></label><label><span>{t.analytics}</span><input type="checkbox" checked={consent.analytics} onChange={e => setConsent({ ...consent, analytics: e.target.checked })} /></label><label><span>{t.marketing}</span><input type="checkbox" checked={consent.marketing} onChange={e => setConsent({ ...consent, marketing: e.target.checked })} /></label></div>}<div className="cookie-actions"><button className="button secondary" onClick={() => save(defaultConsent)}>{t.reject}</button>{settings ? <button className="button primary" onClick={() => save(consent)}>{t.save}</button> : <><button className="button ghost" onClick={() => setSettings(true)}>{t.settings}</button><button className="button primary" onClick={() => save({ necessary: true, analytics: true, marketing: true })}>{t.accept}</button></>}</div></div></div>;
}
