/**
 * Syncs dom_clients (Supabase/Postgres) from a fresh phpMyAdmin dump of the legacy MySQL
 * `domiciliazioni` table — unlike import-domiciliazioni-dump.ts (which only inserts rows that
 * don't exist yet, for the one-time initial migration), this UPDATES existing rows too, matched
 * by legacy_id, so it can be re-run whenever the legacy site (still the system of record for this
 * data) has moved on and this site's copy has gone stale.
 *
 * Only touches the columns that actually come from the legacy table. Never touches: `id`,
 * `created_at`, or this site's own additions that have no legacy equivalent — `primo_rinnovo`,
 * `area_clienti_email`, `area_clienti_password_hash`, `must_change_password` (Area Clienti login,
 * set directly by staff on this site) — and never deletes anything, so a company created only on
 * this site (no legacy_id) is untouched.
 *
 * Uso:  npx tsx scripts/sync-domiciliazioni-dump.ts <percorso-dump.sql>
 *
 * IMPORTANT: this overwrites existing rows' data from the dump — take a Supabase backup/snapshot
 * first (Database → Backups in the Supabase dashboard) in case anything was edited on this site's
 * own dashboard since the two diverged and shouldn't be overwritten.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { Parser } from "node-sql-parser";
import { eq } from "drizzle-orm";
import { db, pool } from "@/db";
import { domClients } from "@/db/schema";

const dumpPath = process.argv[2];
if (!dumpPath) { console.error("Uso: npx tsx scripts/sync-domiciliazioni-dump.ts <percorso-dump.sql>"); process.exit(1); }

function unescape(value: string) {
  return value.replace(/\\'/g, "'").replace(/\\"/g, '"');
}

type Literal = { type: string; value: unknown };
function literalToJs(node: Literal): string | number | boolean | null {
  if (node.type === "null") return null;
  if (node.type === "number") return node.value as number;
  if (node.type === "bool") return node.value as boolean;
  if (node.type === "single_quote_string" || node.type === "string") return unescape(String(node.value));
  return node.value == null ? null : String(node.value);
}

function toBool(value: string | number | boolean | null): boolean | null {
  if (value === null) return null;
  return Number(value) !== 0;
}
function toDate(value: string | number | boolean | null): string | null {
  if (value === null || value === "" || String(value).startsWith("0000-00-00")) return null;
  return String(value);
}
function toText(value: string | number | boolean | null): string | null {
  if (value === null) return null;
  const str = String(value);
  return str === "" ? null : str;
}

type InsertStatement = {
  type: string;
  table?: { table?: string }[];
  columns?: string[];
  values?: { values: { value: Literal[] }[] };
};

async function main() {
  const sql = readFileSync(dumpPath, "utf8");
  // phpMyAdmin splits a large table's data into several INSERT statements with no reliable text
  // marker between them (a "-- ----" section divider only appears between *tables*, not between
  // successive INSERT chunks for the same one) — so rather than guess at text boundaries, parse
  // the whole dump as SQL and pick out every INSERT that targets `domiciliazioni`.
  const parser = new Parser();
  const ast = parser.astify(sql, { database: "mysql" }) as InsertStatement | InsertStatement[];
  const statements = Array.isArray(ast) ? ast : [ast];
  const inserts = statements.filter((s): s is Required<InsertStatement> => s.type === "insert" && s.table?.[0]?.table === "domiciliazioni");
  if (!inserts.length) throw new Error("Nessuno statement INSERT INTO `domiciliazioni` trovato nel dump.");

  let columns: string[] = [];
  const rows: { value: Literal[] }[] = [];
  for (const insert of inserts) {
    columns = insert.columns;
    rows.push(...insert.values.values);
  }

  console.log(`Trovate ${inserts.length} statement INSERT, ${rows.length} righe totali nel dump.`);

  const existing = await db.select({ legacyId: domClients.legacyId }).from(domClients);
  const existingIds = new Set(existing.map(r => r.legacyId).filter((id): id is number => id !== null));

  let inserted = 0;
  let updated = 0;
  for (const row of rows) {
    const record: Record<string, string | number | boolean | null> = {};
    columns.forEach((col, i) => { record[col] = literalToJs(row.value[i]); });

    const legacyId = Number(record.id);
    const values = {
      legacyId,
      ragioneSociale: String(record.ragione_sociale ?? ""),
      sede: record.sede === null ? 1 : Number(record.sede),
      emailPosta: toText(record.email_posta) ?? "",
      emailPec: toText(record.email_pec),
      testoScadenza: toText(record.testo_scadenza),
      testoProforma: toText(record.testo_proforma),
      testoSospensione: toText(record.testo_sospensione),
      amministratore: toText(record.amministratore),
      telefonoAmm: toText(record.telefono_amm),
      personaRif: toText(record.persona_rif),
      telefono: toText(record.telefono),
      telefonoUrg: toText(record.telefono_urg),
      inizioDom: toDate(record.inizio_dom),
      scadenzaDom: toDate(record.scadenza_dom),
      scadenzaPagamento: toDate(record.scadenza_pagamento),
      contrFirmato: toBool(record.contr_firmato),
      controfirmatoInviato: toBool(record.controfirmato_inviato),
      moduloCont: toBool(record.modulo_cont),
      docAmmPres: toBool(record.doc_amm_pres),
      allegato1Pres: toBool(record.allegato1_pres),
      visuraPres: toBool(record.visura_pres),
      stato: record.stato === null ? null : Number(record.stato),
      note: toText(record.note),
      indSpedPosta: toText(record.ind_sped_posta),
      presenzaFile: Number(record.PresenzaFile ?? 0),
      tipologia: Number(record.tipologia ?? 0),
      raccoglitore: Number(record.raccoglitore ?? 0),
      prezzoRinnovo: record.prezzo_rinnovo === null ? null : Number(record.prezzo_rinnovo),
      scadenzaInviata: toBool(record.scadenza_inviata),
    };

    if (existingIds.has(legacyId)) {
      const { legacyId: _legacyId, ...updateFields } = values;
      await db.update(domClients).set({ ...updateFields, updatedAt: new Date() }).where(eq(domClients.legacyId, legacyId));
      updated++;
    } else {
      await db.insert(domClients).values(values);
      inserted++;
    }
  }

  console.log(`Sincronizzazione completata: ${inserted} nuove righe inserite, ${updated} righe esistenti aggiornate.`);
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
