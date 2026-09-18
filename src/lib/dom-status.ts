import type { InferSelectModel } from "drizzle-orm";
import type { domClients } from "@/db/schema";

type DomClient = InferSelectModel<typeof domClients>;

/** Some legacy records literally stored the text "null" instead of leaving the
 * field empty (a data-entry artifact in the source system, not ours) — treat it
 * the same as no value everywhere we display or pre-fill these fields. */
export function cleanText(value: string | null | undefined): string {
  if (!value) return "";
  return /^null$/i.test(value.trim()) ? "" : value;
}

/** Traffic-light summary of how much of the paperwork is on file, derived from the
 * document flags we actually store (the legacy PresenzaFile bitmask's exact meaning
 * isn't documented reliably enough to reproduce, so this is a fresh, honest count). */
export function docStatus(client: DomClient): "red" | "yellow" | "green" | "empty" {
  const flags = [client.contrFirmato, client.moduloCont, client.docAmmPres, client.allegato1Pres, client.visuraPres];
  const present = flags.filter(Boolean).length;
  if (present === 0) return "empty";
  if (present >= flags.length) return "green";
  if (present >= Math.ceil(flags.length / 2)) return "yellow";
  return "red";
}
