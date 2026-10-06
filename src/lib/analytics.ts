type Params = Record<string, string | number | boolean | undefined>;
declare global { interface Window { dataLayer?: unknown[] } }

type ConsentValue = { analytics?: boolean; marketing?: boolean } | null;

export function readConsent(): ConsentValue {
  try { return JSON.parse(localStorage.getItem("ros_cookie_consent") || "null"); } catch { return null; }
}

// Google Consent Mode v2 signals. GTM itself is only injected after analytics consent
// (see Analytics.tsx), so these calls go to the dataLayer as gtag-style arguments objects.
function gtag(..._args: unknown[]) { (window.dataLayer = window.dataLayer || []).push(arguments); }

export function setConsentDefaults() {
  gtag("consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied", wait_for_update: 500 });
}

export function updateConsent(consent: ConsentValue) {
  const analytics = consent?.analytics ? "granted" : "denied";
  const marketing = consent?.marketing ? "granted" : "denied";
  gtag("consent", "update", { analytics_storage: analytics, ad_storage: marketing, ad_user_data: marketing, ad_personalization: marketing });
}

// Pushes a GA4-style event to the dataLayer, only when the visitor accepted analytics cookies.
export function track(event: string, params: Params = {}) {
  if (typeof window === "undefined" || !readConsent()?.analytics) return;
  (window.dataLayer = window.dataLayer || []).push({ event, ...params });
}

// Same as track(), but fires at most once per key for the browser (e.g. one purchase per order).
export function trackOnce(key: string, event: string, params: Params = {}) {
  try { if (localStorage.getItem(`ros-tracked-${key}`)) return; localStorage.setItem(`ros-tracked-${key}`, "1"); } catch { /* storage unavailable: send anyway */ }
  track(event, params);
}
