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

// Bit order confirmed from the legacy ajax_upload_enc.php: ['con','mod','all','doc','avc','rev'].
export const PRESENZA_FILE_BITS = { con: 1, mod: 2, all: 4, doc: 8, avc: 16, rev: 32 } as const;
const COMPLETE_MASK = PRESENZA_FILE_BITS.con | PRESENZA_FILE_BITS.mod | PRESENZA_FILE_BITS.all | PRESENZA_FILE_BITS.doc | PRESENZA_FILE_BITS.avc; // 31 — everything but the revoca

/** Traffic-light summary of the paperwork on file, from the legacy PresenzaFile bitmask
 * (verified against ajax_upload_enc.php / ParserReport.php): 31 = complete except revoca. */
export function docStatus(client: DomClient): "red" | "yellow" | "green" {
  const pf = client.presenzaFile & COMPLETE_MASK;
  if (pf === COMPLETE_MASK) return "green";
  if (pf === 0) return "red";
  return "yellow";
}

export function presenzaFileLabels(presenzaFile: number): string[] {
  const labels: [number, string][] = [
    [PRESENZA_FILE_BITS.con, "Contratto"],
    [PRESENZA_FILE_BITS.mod, "Modulo"],
    [PRESENZA_FILE_BITS.all, "Allegato"],
    [PRESENZA_FILE_BITS.doc, "Doc. amministratore"],
    [PRESENZA_FILE_BITS.avc, "Adeguata verifica"],
    [PRESENZA_FILE_BITS.rev, "Revoca"],
  ];
  return labels.filter(([bit]) => (presenzaFile & bit) === bit).map(([, label]) => label);
}
