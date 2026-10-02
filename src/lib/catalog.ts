import { createHash } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { serviceCatalog, servicePrices, serviceAddons, siteConfig } from "@/db/schema";
import { termsText } from "./offer-terms";
import type { CardProcessor, PaymentSettings } from "./payment-copy";
import type { Catalog, ProductOffer, ServiceCode } from "./pricing";

/** Fresh database reads: publishing a rate never requires a frontend rebuild. */
export async function getCatalog(): Promise<Catalog> {
  const [services, tiers, addons, [config]] = await Promise.all([
    db.select().from(serviceCatalog).where(eq(serviceCatalog.active, true)),
    db.select().from(servicePrices).where(eq(servicePrices.active, true)).orderBy(asc(servicePrices.months)),
    db.select().from(serviceAddons).orderBy(asc(serviceAddons.sortOrder)),
    db.select().from(siteConfig).limit(1),
  ]);
  const onlineDiscountEnabled = config?.onlineDiscountEnabled ?? false;
  const onlineDiscountBps = config?.onlineDiscountBps ?? 1000;
  const paymentSettings: PaymentSettings = {
    cardProcessor: (config?.cardProcessor ?? "stripe") as CardProcessor, cardProcessorTestMode: config?.cardProcessorTestMode ?? false,
    paypalEnabled: config?.paypalEnabled ?? true, paypalTestMode: config?.paypalTestMode ?? false, bankTransferEnabled: config?.bankTransferEnabled ?? true,
  };
  const products: Partial<Catalog> = {};
  for (const code of ["legal_unit", "postal"] as ServiceCode[]) {
    const row = services.find(s => s.code === code);
    if (!row) throw new Error(`Catalogue not configured: ${code}. Run scripts/seed-catalog.ts.`);
    const offer: ProductOffer = {
      code, vatBps: row.vatBps, additionalDiscountBps: row.additionalDiscountBps, additionalDiscountEnabled: row.additionalDiscountEnabled,
      newActivationDiscountBps: row.newActivationDiscountBps, newActivationDiscountEnabled: row.newActivationDiscountEnabled, offerValidUntil: row.offerValidUntil?.toISOString() ?? null,
      termsRevision: row.termsRevision, version: "",
      smart3x24Active: row.smart3x24Active, smart6x24Active: row.smart6x24Active,
      onlineDiscountEnabled, onlineDiscountBps, includedOpenings: row.includedOpenings, paymentSettings,
      tiers: tiers.filter(t => t.service === code).map(t => ({ months: t.months, listCents: t.listCents, offerCents: t.offerCents, newActivation: t.newActivation, additionalDomiciliation: t.additionalDomiciliation })),
      addons: addons.filter(a => a.service === code).map(a => ({ code: a.code, titleIt: a.titleIt, titleEn: a.titleEn, priceCents: a.priceCents, annualCents: a.annualCents, billing: a.billing, maxQuantity: a.maxQuantity, selectable: a.selectable })),
    };
    if (!offer.tiers.length || offer.tiers.some(t => t.listCents < 0 || (t.offerCents !== null && t.offerCents < 0))) throw new Error("Invalid catalogue prices");
    offer.version = createHash("sha256").update(JSON.stringify({ offer, it: termsText(offer, "it"), en: termsText(offer, "en") })).digest("hex");
    products[code] = offer;
  }
  return products as Catalog;
}
export async function getOffer(service: ServiceCode) { return (await getCatalog())[service]; }
