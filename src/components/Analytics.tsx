"use client";
import { useEffect } from "react";

declare global { interface Window { dataLayer?: unknown[] } }

function loadGtm(id: string) {
  if (document.getElementById("gtm-script")) return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
  const script = document.createElement("script");
  script.id = "gtm-script"; script.async = true; script.src = `https://www.googletagmanager.com/gtm.js?id=${id}`;
  document.head.appendChild(script);
}

// No <noscript> fallback: it would load the tag unconditionally for the rare no-JS visitor,
// bypassing the consent check every other visitor goes through.
export function Analytics() {
  useEffect(() => {
    const id = process.env.NEXT_PUBLIC_GTM_ID;
    if (!id) return;
    try {
      const saved = JSON.parse(localStorage.getItem("ros_cookie_consent") || "null");
      if (saved?.analytics) loadGtm(id);
    } catch { /* no stored consent yet */ }
    const handler = (event: Event) => { const detail = (event as CustomEvent<{ analytics?: boolean }>).detail; if (detail?.analytics) loadGtm(id); };
    window.addEventListener("cookieConsentChanged", handler);
    return () => window.removeEventListener("cookieConsentChanged", handler);
  }, []);
  return null;
}
