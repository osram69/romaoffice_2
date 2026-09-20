import { db } from "@/db";
import { siteConfig } from "@/db/schema";
import type { ProviderKey } from "./payments";
import type { Lang } from "./site";

export type PaymentSettings = { stripeEnabled: boolean; paypalEnabled: boolean; sumupEnabled: boolean; bankTransferEnabled: boolean };

const DEFAULTS: PaymentSettings = { stripeEnabled: true, paypalEnabled: true, sumupEnabled: true, bankTransferEnabled: true };

/** Fresh database read, same convention as getCatalog(): publishing a change never requires a rebuild. */
export async function getPaymentSettings(): Promise<PaymentSettings> {
  const [row] = await db.select().from(siteConfig).limit(1);
  if (!row) return DEFAULTS;
  return { stripeEnabled: row.stripeEnabled, paypalEnabled: row.paypalEnabled, sumupEnabled: row.sumupEnabled, bankTransferEnabled: row.bankTransferEnabled };
}

export async function paymentMethodEnabled(method: ProviderKey | "bank_transfer" | "on_site"): Promise<boolean> {
  if (method === "on_site") return true;
  const settings = await getPaymentSettings();
  if (method === "stripe") return settings.stripeEnabled;
  if (method === "paypal") return settings.paypalEnabled;
  if (method === "sumup") return settings.sumupEnabled;
  return settings.bankTransferEnabled;
}

function joinList(items: string[], conjunction: string): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} ${conjunction} ${items[items.length - 1]}`;
}

/** The /tariffe.html (and /en/pricing.html) hero paragraph, reflecting only the payment methods currently enabled in Configurazione Web. */
export function pricingPageDescription(settings: PaymentSettings, lang: Lang): string {
  const it = lang === "it";
  const parts: string[] = [];
  if (settings.stripeEnabled) parts.push("Stripe");
  if (settings.paypalEnabled) parts.push("PayPal");
  if (settings.sumupEnabled) parts.push("SumUp");
  if (settings.bankTransferEnabled) parts.push(it ? "bonifico" : "bank transfer");
  const intro = it ? "Tutte le offerte: domiciliazione sede legale e unità locale, uffici e servizi." : "All offers: registered office and local unit address, offices and services.";
  if (!parts.length) return `${intro} ${it ? "Attivazione online disponibile: contattaci per i metodi di pagamento." : "Online activation available: contact us for payment methods."}`;
  const list = joinList(parts, it ? "o" : "or");
  return `${intro} ${it ? `Attivazione online con pagamento ${list}.` : `Online activation with payment via ${list}.`}`;
}
