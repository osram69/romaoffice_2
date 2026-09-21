import type { Lang } from "./site";

// Kept separate from payment-settings.ts on purpose: that file imports the Postgres client (via
// @/db) at module scope, so anything importing from it — even a pure helper — pulls that
// server-only dependency into any client component that uses it. This file has no such import,
// so ActivationFlow.tsx (a client component) can use enabledPaymentMethodsList() directly.
export type PaymentSettings = { stripeEnabled: boolean; paypalEnabled: boolean; sumupEnabled: boolean; bankTransferEnabled: boolean };

function joinList(items: string[], conjunction: string): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} ${conjunction} ${items[items.length - 1]}`;
}

/** Just the joined list of enabled methods, e.g. "PayPal, Stripe, SumUp o bonifico" — for spots (like the activation page's checklist) that need the list without a full sentence. */
export function enabledPaymentMethodsList(settings: PaymentSettings, lang: Lang): string {
  const it = lang === "it";
  const parts: string[] = [];
  if (settings.stripeEnabled) parts.push("Stripe");
  if (settings.paypalEnabled) parts.push("PayPal");
  if (settings.sumupEnabled) parts.push("SumUp");
  if (settings.bankTransferEnabled) parts.push(it ? "bonifico" : "bank transfer");
  return joinList(parts, it ? "o" : "or");
}

/** The /tariffe.html (and /en/pricing.html) hero paragraph, reflecting only the payment methods currently enabled in Configurazione Web. */
export function pricingPageDescription(settings: PaymentSettings, lang: Lang): string {
  const it = lang === "it";
  const intro = it ? "Tutte le offerte: domiciliazione sede legale e unità locale, uffici e servizi." : "All offers: registered office and local unit address, offices and services.";
  const list = enabledPaymentMethodsList(settings, lang);
  if (!list) return `${intro} ${it ? "Attivazione online disponibile: contattaci per i metodi di pagamento." : "Online activation available: contact us for payment methods."}`;
  return `${intro} ${it ? `Attivazione online con pagamento ${list}.` : `Online activation with payment via ${list}.`}`;
}
