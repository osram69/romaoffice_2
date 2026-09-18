import "dotenv/config";
import { readFileSync } from "node:fs";
import { Parser } from "node-sql-parser";
import { db, pool } from "@/db";
import { domClients } from "@/db/schema";

const dumpPath = process.argv[2];
if (!dumpPath) { console.error("Uso: npx tsx scripts/import-domiciliazioni-dump.ts <percorso-dump.sql>"); process.exit(1); }

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

function extractInsertBlocks(sql: string, table: string) {
  // phpMyAdmin splits large tables into several INSERT statements, and a naive search for the
  // first ";\n" is unsafe anyway: a free-text column (note, ind_sped_posta...) can itself contain
  // a literal newline, ending the scan early. Instead, bound each search by the next "-- ----"
  // section separator phpMyAdmin prints between statements/tables, then take the *last* semicolon
  // in that range (the true end of that particular multi-row INSERT statement).
  const marker = `INSERT INTO \`${table}\``;
  const blocks: string[] = [];
  let cursor = 0;
  for (;;) {
    const start = sql.indexOf(marker, cursor);
    if (start === -1) break;
    const nextSection = sql.indexOf("\n-- --------", start);
    const window = sql.slice(start, nextSection === -1 ? undefined : nextSection);
    const lastSemicolon = window.lastIndexOf(";");
    if (lastSemicolon === -1) break;
    blocks.push(window.slice(0, lastSemicolon + 1));
    cursor = start + lastSemicolon;
  }
  return blocks;
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

async function main() {
  const sql = readFileSync(dumpPath, "utf8");
  const blocks = extractInsertBlocks(sql, "domiciliazioni");
  if (!blocks.length) throw new Error("Nessuno statement INSERT INTO `domiciliazioni` trovato nel dump.");

  const parser = new Parser();
  let columns: string[] = [];
  const rows: { value: Literal[] }[] = [];
  for (const block of blocks) {
    const ast = parser.astify(block, { database: "mysql" });
    const inserts = Array.isArray(ast) ? ast : [ast];
    for (const insert of inserts) {
      if (insert.type !== "insert") throw new Error("Statement inatteso: non è un INSERT.");
      columns = insert.columns as string[];
      const valuesClause = insert.values as { type: "values"; values: { value: Literal[] }[] };
      rows.push(...valuesClause.values);
    }
  }

  console.log(`Trovate ${blocks.length} statement INSERT, ${rows.length} righe totali da importare nella tabella domiciliazioni.`);

  let inserted = 0;
  let skipped = 0;
  for (const row of rows) {
    const record: Record<string, string | number | boolean | null> = {};
    columns.forEach((col, i) => { record[col] = literalToJs(row.value[i]); });

    const [result] = await db.insert(domClients).values({
      legacyId: Number(record.id),
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
    }).onConflictDoNothing({ target: domClients.legacyId }).returning({ id: domClients.id });

    if (result) inserted++; else skipped++;
  }

  console.log(`Importazione completata: ${inserted} nuove righe, ${skipped} già presenti (saltate).`);
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
