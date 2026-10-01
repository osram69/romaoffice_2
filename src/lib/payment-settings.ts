import { db } from "@/db";
import { siteConfig } from "@/db/schema";
import type { ProviderKey } from "./payments";
export { type PaymentSettings, enabledPaymentMethodsList, pricingPageDescription } from "./payment-copy";
import type { CardProcessor, PaymentSettings } from "./payment-copy";

const DEFAULTS = { cardProcessor: "stripe" as CardProcessor, paypalEnabled: true, bankTransferEnabled: true, cardProcessorTestMode: false, paypalTestMode: false };

async function siteConfigRow() {
  const [row] = await db.select().from(siteConfig).limit(1);
  return row ?? DEFAULTS;
}

/** Which providers currently use their sandbox (*_TEST) credentials — see src/lib/payments.ts.
 * Deliberately independent of whether the provider is enabled/visible: a sandboxed provider stays
 * in the public checkout like any other (staff's explicit choice), it just doesn't move real money
 * while on. Stripe and SumUp share one switch (cardProcessorTestMode) since only one of them is
 * ever the active card processor — the inactive one's "true" here is moot, it's never reachable. */
export async function getProviderTestModes(): Promise<Record<ProviderKey, boolean>> {
  const row = await siteConfigRow();
  const cardProcessor = row.cardProcessor as CardProcessor;
  return {
    stripe: cardProcessor === "stripe" && row.cardProcessorTestMode,
    sumup: cardProcessor === "sumup" && row.cardProcessorTestMode,
    paypal: row.paypalTestMode,
  };
}

export async function getPaymentSettings(): Promise<PaymentSettings> {
  const row = await siteConfigRow();
  return {
    cardProcessor: row.cardProcessor as CardProcessor, cardProcessorTestMode: row.cardProcessorTestMode,
    paypalEnabled: row.paypalEnabled, paypalTestMode: row.paypalTestMode,
    bankTransferEnabled: row.bankTransferEnabled,
  };
}

export async function paymentMethodEnabled(method: ProviderKey | "bank_transfer" | "on_site"): Promise<boolean> {
  if (method === "on_site") return true;
  const settings = await getPaymentSettings();
  if (method === "stripe") return settings.cardProcessor === "stripe";
  if (method === "sumup") return settings.cardProcessor === "sumup";
  if (method === "paypal") return settings.paypalEnabled;
  return settings.bankTransferEnabled;
}
