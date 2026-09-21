import { db } from "@/db";
import { siteConfig } from "@/db/schema";
import type { ProviderKey } from "./payments";
export { type PaymentSettings, enabledPaymentMethodsList, pricingPageDescription } from "./payment-copy";
import type { PaymentSettings } from "./payment-copy";

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
