import { timingSafeEqual } from "node:crypto";
import { db } from "@/db";
import { siteConfig } from "@/db/schema";
import type { ProviderKey } from "./payments";
export { type PaymentSettings, enabledPaymentMethodsList, pricingPageDescription } from "./payment-copy";
import type { PaymentSettings } from "./payment-copy";

const DEFAULTS = { stripeEnabled: true, paypalEnabled: true, sumupEnabled: true, bankTransferEnabled: true, paymentsTestMode: false };

async function siteConfigRow() {
  const [row] = await db.select().from(siteConfig).limit(1);
  return row ?? DEFAULTS;
}

/** Constant-time so a mistyped token can't be distinguished from a correct one by timing. */
function testTokenMatches(testToken?: string): boolean {
  const secret = process.env.PAYMENTS_TEST_BYPASS_TOKEN;
  if (!secret || !testToken) return false;
  const a = Buffer.from(testToken); const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Raw, unmasked toggle — used once a request has already been let through to decide which
 * credential set (live or sandbox) to use, never to decide whether to let it through. */
export async function paymentsTestMode(): Promise<boolean> {
  return (await siteConfigRow()).paymentsTestMode;
}

/** What a given request should see/be allowed to use: while payments test mode is on, Stripe/
 * PayPal/SumUp are hidden from everyone except a request carrying the correct
 * PAYMENTS_TEST_BYPASS_TOKEN. Bank transfer is never affected — it doesn't touch a gateway. */
export async function getPaymentSettings(testToken?: string): Promise<PaymentSettings> {
  const row = await siteConfigRow();
  if (row.paymentsTestMode && !testTokenMatches(testToken)) {
    return { stripeEnabled: false, paypalEnabled: false, sumupEnabled: false, bankTransferEnabled: row.bankTransferEnabled };
  }
  return { stripeEnabled: row.stripeEnabled, paypalEnabled: row.paypalEnabled, sumupEnabled: row.sumupEnabled, bankTransferEnabled: row.bankTransferEnabled };
}

export async function paymentMethodEnabled(method: ProviderKey | "bank_transfer" | "on_site", testToken?: string): Promise<boolean> {
  if (method === "on_site") return true;
  const settings = await getPaymentSettings(testToken);
  if (method === "stripe") return settings.stripeEnabled;
  if (method === "paypal") return settings.paypalEnabled;
  if (method === "sumup") return settings.sumupEnabled;
  return settings.bankTransferEnabled;
}
