import type { Lang, ServiceCode } from "./pricing";

/** Discount codes (Configurazione Web > Codici sconto). Pure helpers, usable in the browser as well as on the server. */
export type DiscountScope = "all" | ServiceCode;
export type DiscountCodeRow = {
  code: string; label: string; percentBps: number; services: DiscountScope; validFrom: string | null; validTo: string | null;
  enabled: boolean; promoBanner: boolean; bannerIt: string | null; bannerEn: string | null;
};
/** What the price calculation needs from a validated code. */
export type AppliedDiscount = { code: string; bps: number };
/** What the public site needs to advertise a code. */
export type Promo = { code: string; bps: number; services: DiscountScope; text: string };

export const MAX_DISCOUNT_BPS = 10000;
export const normalizeCode = (value: string) => value.trim().toUpperCase().replace(/\s+/g, "");
export const validCodeFormat = (value: string) => /^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(value);
export const todayRome = (now = new Date()) => now.toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });

/** Enabled, inside its validity window (inclusive, Rome calendar days) and valid for that service. */
export function codeUsable(row: DiscountCodeRow, service: ServiceCode, today = todayRome()): boolean {
  if (!row.enabled || row.percentBps <= 0) return false;
  if (row.services !== "all" && row.services !== service) return false;
  if (row.validFrom && today < row.validFrom) return false;
  if (row.validTo && today > row.validTo) return false;
  return true;
}
/** A code that is running today for at least one service (used to decide whether a banner may be shown). */
export function codeRunning(row: DiscountCodeRow, today = todayRome()): boolean {
  return codeUsable(row, "legal_unit", today) || codeUsable(row, "postal", today);
}

export function promoText(row: DiscountCodeRow, lang: Lang): string {
  const custom = (lang === "it" ? row.bannerIt : row.bannerEn)?.trim();
  if (custom) return custom;
  const pct = `${row.percentBps / 100}%`;
  return lang === "it" ? `Promozione: ${pct} di sconto extra con il codice ${row.code}.` : `Promotion: extra ${pct} off with code ${row.code}.`;
}
export function toPromo(row: DiscountCodeRow, lang: Lang): Promo {
  return { code: row.code, bps: row.percentBps, services: row.services, text: promoText(row, lang) };
}
/** Link from the public site to the activation page with the code already filled in. */
export function promoHref(promo: Promo, lang: Lang): string {
  const base = lang === "it" ? "/attiva.html" : "/en/activate.html";
  return `${base}?${promo.services === "postal" ? "service=postal&" : ""}codice=${encodeURIComponent(promo.code)}`;
}
