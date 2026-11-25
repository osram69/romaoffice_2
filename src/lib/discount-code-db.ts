import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { discountCodes } from "@/db/schema";
import { codeRunning, codeUsable, normalizeCode, parseMonths, toPromo, type AppliedDiscount, type DiscountCodeRow, type DiscountScope, type Promo } from "./discount-code";
import type { Lang, ServiceCode } from "./pricing";

const toRow = (r: typeof discountCodes.$inferSelect): DiscountCodeRow => ({
  code: r.code, label: r.label, percentBps: r.percentBps, services: (["legal_unit", "postal"].includes(r.services) ? r.services : "all") as DiscountScope,
  validFrom: r.validFrom, validTo: r.validTo, enabled: r.enabled, promoBanner: r.promoBanner, bannerIt: r.bannerIt, bannerEn: r.bannerEn, months: parseMonths(r.months),
});

export async function listDiscountCodes(): Promise<DiscountCodeRow[]> {
  return (await db.select().from(discountCodes).orderBy(desc(discountCodes.createdAt), desc(discountCodes.id))).map(toRow);
}

/** The code the customer typed, if it can be used right now for this service; null otherwise (never says which check failed). */
export async function findUsableDiscount(input: string, service: ServiceCode): Promise<AppliedDiscount | null> {
  const wanted = normalizeCode(input); if (!wanted) return null;
  const [row] = await db.select().from(discountCodes).where(eq(discountCodes.code, wanted)).limit(1);
  return row && codeUsable(toRow(row), service) ? { code: row.code, bps: row.percentBps, months: parseMonths(row.months) ?? undefined } : null;
}

/**
 * The code to advertise with a banner, if one is running today (the most recently created wins). Never throws: before the
 * migration is run, or if the database hiccups, the site simply shows no banner.
 */
export async function getActivePromo(lang: Lang, service?: ServiceCode): Promise<Promo | null> {
  try {
    const rows = (await db.select().from(discountCodes).where(eq(discountCodes.promoBanner, true)).orderBy(desc(discountCodes.createdAt), desc(discountCodes.id))).map(toRow);
    const row = rows.find(r => (service ? codeUsable(r, service) : codeRunning(r)));
    return row ? toPromo(row, lang) : null;
  } catch { return null; }
}
