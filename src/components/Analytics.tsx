"use client";
import { useEffect } from "react";
import { readConsent, setConsentDefaults, track, updateConsent } from "@/lib/analytics";

function loadGtm(id: string) {
  if (document.getElementById("gtm-script")) return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
  const script = document.createElement("script");
  script.id = "gtm-script"; script.async = true; script.src = `https://www.googletagmanager.com/gtm.js?id=${id}`;
  document.head.appendChild(script);
}

// Consent Mode v2 (basic): defaults are denied and updated from the cookie banner choice before
// GTM is injected; GTM is never loaded without analytics consent.
// No <noscript> fallback: it would load the tag unconditionally for the rare no-JS visitor,
// bypassing the consent check every other visitor goes through.
export function Analytics() {
  useEffect(() => {
    const id = process.env.NEXT_PUBLIC_GTM_ID;
    if (!id) return;
    setConsentDefaults();
    const saved = readConsent();
    if (saved?.analytics) { updateConsent(saved); loadGtm(id); }
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ analytics?: boolean; marketing?: boolean }>).detail;
      updateConsent(detail);
      if (detail?.analytics) loadGtm(id);
    };
    window.addEventListener("cookieConsentChanged", handler);
    const click = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      const href = link.getAttribute("href") || "";
      if (href.startsWith("tel:")) track("click_phone", { link_url: href });
      else if (href.includes("wa.me/")) track("click_whatsapp", { link_url: href.split("?")[0] });
      else if (href.startsWith("mailto:")) track("click_email", { link_url: href.split("?")[0] });
    };
    document.addEventListener("click", click);
    return () => { window.removeEventListener("cookieConsentChanged", handler); document.removeEventListener("click", click); };
  }, []);
  return null;
}
