import { normalizeTaxCode } from "./codice-fiscale";

/**
 * Short, human-readable "numero di pratica" shown to customers in emails, the PDF and the bank
 * transfer causale — display only, never used to look up an order (the real identifier for that
 * is orders.publicId, a UUID kept internal to URLs/webhooks/OTP matching).
 */
export function shortOrderRef(taxCode: string, createdAt: Date): string {
  const normalized = normalizeTaxCode(taxCode).replace(/[^A-Z0-9]/g, "");
  const prefix = (normalized.slice(0, 6) || "XXXXXX").padEnd(6, "X");
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome", year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(createdAt);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "00";
  return `${prefix}-${get("year")}${get("month")}${get("day")}-${get("hour")}${get("minute")}`;
}
