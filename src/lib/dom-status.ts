import type { InferSelectModel } from "drizzle-orm";
import type { domClients } from "@/db/schema";
import type { DocType } from "@/lib/dom-archive";

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

// Exact labels from the legacy openScheda()'s "Allegati PDF" list (domiciliazioni.php).
export const DOC_LABELS: { key: DocType; label: string }[] = [
  { key: "con", label: "Contratto" },
  { key: "mod", label: "Modulo" },
  { key: "all", label: "Allegato 1" },
  { key: "doc", label: "Doc Amm." },
  { key: "avc", label: "Adeguata Verifica" },
  { key: "rev", label: "Revoca/Disdetta" },
];

export function presenzaFileLabels(presenzaFile: number): { key: DocType; label: string }[] {
  return DOC_LABELS.filter(d => (presenzaFile & PRESENZA_FILE_BITS[d.key]) === PRESENZA_FILE_BITS[d.key]);
}

/** Mirrors the legacy scadenza coloring for the Attive/In Attivazione list (domiciliazioni.php,
 * main table row rendering): red if already past due, dark blue if the payment due date has
 * also passed, yellow (dark yellow if the reminder email was already sent) within 20 days of
 * due, light blue if only the payment date is within 15 days. Checked in that priority order. */
export function scadenzaRowClass(client: Pick<DomClient, "scadenzaDom" | "scadenzaPagamento" | "scadenzaInviata">): string {
  if (!client.scadenzaDom) return "";
  const dayMs = 86400000;
  const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
  const scadDom = new Date(client.scadenzaDom); scadDom.setHours(0, 0, 0, 0);
  const scadPag = client.scadenzaPagamento ? new Date(client.scadenzaPagamento) : null;
  if (scadPag) scadPag.setHours(0, 0, 0, 0);

  if (scadDom.getTime() < oggi.getTime()) return "scad-red";
  if (scadPag && scadPag.getTime() < oggi.getTime()) return "scad-blu";
  if ((scadDom.getTime() - oggi.getTime()) / dayMs <= 20) return client.scadenzaInviata ? "scad-yellow-dark" : "scad-yellow";
  if (scadPag && (scadPag.getTime() - oggi.getTime()) / dayMs <= 15) return "scad-azzurro";
  return "";
}
