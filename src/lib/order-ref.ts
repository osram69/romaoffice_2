import { normalizeTaxCode } from "./codice-fiscale";
import type { ServiceCode } from "./pricing";

// Suffix distinguishing which service the practice number refers to: "DSL" (Domiciliazione Sede
// Legale) or "DP" (Domiciliazione Postale) — spelled out in the codice-fiscale-style acronym the
// company already uses for this, e.g. "SRRPRC-260921-1103-DSL".
const SERVICE_SUFFIX: Record<ServiceCode, string> = { legal_unit: "DSL", postal: "DP" };

/**
 * Short, human-readable "numero di pratica" shown to customers in emails, the PDF and the bank
 * transfer causale — display only, never used to look up an order (the real identifier for that
 * is orders.publicId, a UUID kept internal to URLs/webhooks/OTP matching).
 */
export function shortOrderRef(taxCode: string, createdAt: Date, service: ServiceCode): string {
  const normalized = normalizeTaxCode(taxCode).replace(/[^A-Z0-9]/g, "");
  const prefix = (normalized.slice(0, 6) || "XXXXXX").padEnd(6, "X");
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome", year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(createdAt);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "00";
  return `${prefix}-${get("year")}${get("month")}${get("day")}-${get("hour")}${get("minute")}-${SERVICE_SUFFIX[service]}`;
}
