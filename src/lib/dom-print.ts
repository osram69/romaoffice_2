import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { domClients } from "@/db/schema";

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 42;

class Writer {
  doc!: PDFDocument;
  regular!: PDFFont;
  bold!: PDFFont;
  page!: PDFPage;
  y = 0;

  static async create() {
    const w = new Writer();
    w.doc = await PDFDocument.create();
    w.regular = await w.doc.embedFont(StandardFonts.Helvetica);
    w.bold = await w.doc.embedFont(StandardFonts.HelveticaBold);
    w.addPage();
    return w;
  }
  addPage() {
    this.page = this.doc.addPage([A4.width, A4.height]);
    this.y = A4.height - MARGIN;
  }
  ensureSpace(need: number) {
    if (this.y - need < MARGIN) this.addPage();
  }
  line(text: string, opts: { size?: number; bold?: boolean; gap?: number } = {}) {
    const size = opts.size ?? 11;
    const font = opts.bold ? this.bold : this.regular;
    this.ensureSpace(size + (opts.gap ?? 4));
    this.page.drawText(text, { x: MARGIN, y: this.y, size, font, color: rgb(0.13, 0.18, 0.24) });
    this.y -= size + (opts.gap ?? 4);
  }
  columns(left: string, right: string, rightX: number, opts: { size?: number; bold?: boolean; gap?: number } = {}) {
    const size = opts.size ?? 11;
    const font = opts.bold ? this.bold : this.regular;
    this.ensureSpace(size + (opts.gap ?? 4));
    this.page.drawText(left, { x: MARGIN, y: this.y, size, font, color: rgb(0.13, 0.18, 0.24) });
    this.page.drawText(right, { x: rightX, y: this.y, size, font, color: rgb(0.13, 0.18, 0.24) });
    this.y -= size + (opts.gap ?? 4);
  }
  space(amount: number) { this.y -= amount; }
  async bytes() { return this.doc.save(); }
}

function fmtDate(value: string | null) {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

/** Mirrors generaetichette.php. raccoglitore=0 prints the full "ragione sociale / n. raccoglitore"
 * list for every active company at Sede XX Settembre; raccoglitore>0 prints one label per company
 * in that specific binder. */
export async function printRaccoglitori(raccoglitore: number) {
  const w = await Writer.create();
  if (raccoglitore > 0) {
    w.line(`Raccoglitore n. ${raccoglitore}`, { size: 16, bold: true, gap: 14 });
    const rows = await db.select({ ragioneSociale: domClients.ragioneSociale, stato: domClients.stato, sede: domClients.sede })
      .from(domClients).where(eq(domClients.raccoglitore, raccoglitore)).orderBy(asc(domClients.ragioneSociale));
    for (const row of rows) {
      if (row.stato === 1 && row.sede === 1) w.line(row.ragioneSociale, { size: 15, bold: true, gap: 10 });
    }
  } else {
    w.columns("RAGIONE SOCIALE", "N. RACCOGLITORE", 380, { size: 14, bold: true, gap: 14 });
    const rows = await db.select({ ragioneSociale: domClients.ragioneSociale, raccoglitore: domClients.raccoglitore })
      .from(domClients).where(eq(domClients.stato, 1)).orderBy(asc(domClients.ragioneSociale));
    // Mirrors generaetichette.php: alternate bold/normal rows for readability.
    rows.forEach((row, i) => w.columns(row.ragioneSociale, String(row.raccoglitore), 380, { size: 11, gap: 8, bold: i % 2 === 0 }));
  }
  return w.bytes();
}

/** Mirrors generaListaXX.php, minus the "clienti" physical-presence section (that legacy table
 * wasn't migrated — see the domiciliazioni manager notes). Sede XX Settembre only. */
export async function printListaCompleta() {
  const w = await Writer.create();
  const rows = await db.select().from(domClients).where(eq(domClients.sede, 1)).orderBy(asc(domClients.ragioneSociale));

  w.line("Elenco Societa' domiciliate presso la Cube Engineering S.r.l.", { size: 15, bold: true });
  w.line("(ritiro posta e pacchi piccoli)", { size: 11 });
  w.line("(*) In grassetto quelle aggiunte di recente", { size: 11, bold: true, gap: 16 });

  const now = Date.now();
  let currentLetter = "";
  for (const row of rows) {
    if (!(row.stato === 1 || row.stato === 3) || /avvocato/i.test(row.ragioneSociale)) continue;
    const letter = row.ragioneSociale.charAt(0).toUpperCase();
    if (letter !== currentLetter) { currentLetter = letter; w.line(currentLetter, { size: 14, bold: true, gap: 8 }); }
    if (row.stato === 3) {
      const end = row.scadenzaDom ? new Date(new Date(row.scadenzaDom).getTime() + 30 * 86400000) : null;
      w.line(`${row.ragioneSociale}           (Fine servizio ritiro posta: ${end ? fmtDate(end.toISOString().slice(0, 10)) : "—"})`, { size: 12 });
    } else {
      const recent = row.inizioDom ? now < new Date(row.inizioDom).getTime() + 125 * 86400000 : false;
      w.line(row.ragioneSociale, { size: 12, bold: recent });
    }
  }

  w.addPage();
  w.line("Elenco Domiciliazioni NUOVE o RECENTI", { size: 15, bold: true, gap: 14 });
  for (const row of rows) {
    if (row.stato !== 1 || !row.inizioDom) continue;
    if (now < new Date(row.inizioDom).getTime() + 125 * 86400000) w.line(row.ragioneSociale, { size: 12 });
  }

  w.addPage();
  w.line("Elenco AVVOCATI presso il ROMA OFFICE SHARING", { size: 15, bold: true });
  w.line("(ritiro posta, pacchi piccoli)", { size: 11, gap: 14 });
  for (const row of rows) {
    if (row.stato !== 1 || !/avvocato/i.test(row.ragioneSociale)) continue;
    const label = "Avv. " + row.ragioneSociale.replace(/avvocato/i, "").replace(/\*/g, "").trim();
    w.line(label, { size: 12, bold: row.ragioneSociale.includes("*") });
  }
  w.space(14);
  w.line("Attenzione: Ritiriamo anche lettere indirizzate a Nome Cognome c/o Avvocato", { size: 11 });
  w.line("Ad esempio: Mario Rossi c/o Avv. Rossella Nocera", { size: 11 });

  w.addPage();
  w.line("Domiciliazioni decadute (Non ritiriamo piu' la posta)", { size: 15, bold: true, gap: 14 });
  for (const row of rows) {
    if (row.stato !== 2 || !row.scadenzaDom) continue;
    const scad = new Date(row.scadenzaDom).getTime();
    if (scad > now - 120 * 86400000) w.line(row.ragioneSociale, { size: 12 });
  }
  w.space(30);
  w.line("Si autorizza la portineria dello stabile di Via XX Settembre, 118 a ritirare la corrispondenza", { size: 8 });
  w.line("delle suindicate societa' in nome e per conto della societa' CUBE ENGINEERING S.R.L.", { size: 8 });

  return w.bytes();
}
