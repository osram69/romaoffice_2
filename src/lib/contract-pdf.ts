import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { ContractData, Person } from "./contract-data";

// Prints the customer's answers onto the original "Contratto di domiciliazione sede legale" PDF
// (Rev. F, 16 pages) — the legal text is never retyped, only the blanks are filled. Coordinates are
// in PDF points measured from the TOP-LEFT of an A4 page (the same frame PyMuPDF reports), converted
// to pdf-lib's bottom-left frame in `Pen`. Works both in the browser and on the server.

const PAGE_H = 842;
const INK = rgb(0.02, 0.1, 0.45); // dark blue, so filled-in values are told apart from the printed form

class Pen {
  constructor(private page: PDFPage, private font: PDFFont, private bold: PDFFont) {}

  private clean(text: string) {
    const set = new Set(this.font.getCharacterSet());
    return Array.from(text.replace(/[\r\n\t]+/g, " ")).map(ch => (set.has(ch.codePointAt(0)!) ? ch : "?")).join("");
  }

  /** Free text sitting on a printed line/dotted line spanning x0..x1 whose bottom edge is y1. Shrinks to fit. */
  line(text: string, x0: number, x1: number, y1: number, size = 9) {
    const t = this.clean(text.trim());
    if (!t) return;
    let s = size;
    const width = x1 - x0 - 2;
    while (s > 5.5 && this.font.widthOfTextAtSize(t, s) > width) s -= 0.25;
    this.page.drawText(t, { x: x0 + 1, y: PAGE_H - y1 + 2.6, size: s, font: this.font, color: INK, maxWidth: undefined });
  }

  /** One character per cell of a "|___|___|" comb (n cells spanning x0..x1). */
  comb(text: string, x0: number, x1: number, y1: number, n: number, size = 9) {
    const t = this.clean(text.replace(/\s+/g, "").toUpperCase()).slice(0, n);
    const cell = (x1 - x0) / n;
    Array.from(t).forEach((ch, i) => {
      const w = this.font.widthOfTextAtSize(ch, size);
      this.page.drawText(ch, { x: x0 + cell * i + cell / 2 - w / 2 + 0.6, y: PAGE_H - y1 + 2.8, size, font: this.font, color: INK });
    });
  }

  /** ISO date written into a "____/____/________" blank (dd / mm / yyyy segments). */
  date(iso: string, x0: number, x1: number, y1: number, size = 9) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return;
    const unit = (x1 - x0) / 18; // 4 + 1 + 4 + 1 + 8 characters
    const seg = (txt: string, from: number, len: number) => {
      const w = this.font.widthOfTextAtSize(txt, size);
      this.page.drawText(txt, { x: x0 + unit * (from + len / 2) - w / 2, y: PAGE_H - y1 + 2.8, size, font: this.font, color: INK });
    };
    seg(m[3], 0, 4); seg(m[2], 5, 4); seg(m[1], 10, 8);
  }

  /** A cross inside a printed check box glyph whose top-left corner is (x, y0). */
  cross(x: number, y0: number, boxW = 8, boxH = 9) {
    const w = this.bold.widthOfTextAtSize("X", 8.5);
    this.page.drawText("X", { x: x + boxW / 2 - w / 2, y: PAGE_H - (y0 + boxH) + 1.6, size: 8.5, font: this.bold, color: INK });
  }

  whiteout(x0: number, y0: number, x1: number, y1: number) {
    this.page.drawRectangle({ x: x0, y: PAGE_H - y1, width: x1 - x0, height: y1 - y0, color: rgb(1, 1, 1) });
  }

  /** Justified single line of the original Times-Roman 10 pt body text, redrawn with new values. */
  justified(text: string, x0: number, x1: number, baseline: number, times: PDFFont, size = 9.957) {
    const words = this.cleanWith(times, text.trim()).split(" ");
    const widths = words.map(w => times.widthOfTextAtSize(w, size));
    const gap = words.length > 1 ? Math.max(0, (x1 - x0 - widths.reduce((a, b) => a + b, 0)) / (words.length - 1)) : 0;
    let x = x0;
    words.forEach((w, i) => {
      this.page.drawText(w, { x, y: PAGE_H - baseline, size, font: times, color: rgb(0, 0, 0) });
      x += widths[i] + gap;
    });
  }

  private cleanWith(font: PDFFont, text: string) {
    const set = new Set(font.getCharacterSet());
    return Array.from(text).map(ch => (set.has(ch.codePointAt(0)!) ? ch : "?")).join("");
  }
}

// --- layout tables ------------------------------------------------------------------------------

type Span = [x0: number, x1: number, y1: number];
type PersonLayout = {
  cognome: Span; nome: Span; via: Span; cap: Span; comune: Span; prov: Span; cf: Span;
  nascLuogo: Span; nascProv: Span; nascData: Span; cittadinanza: Span; docTipo: Span; docNumero: Span;
  docRil: Span; docScad: Span; autorita: Span; docComune: Span; docProv: Span; docStato: Span; pepMotivo: Span;
  motivoTit?: Span;
  pepNo: [number, number]; pepSi: [number, number];
  pairs: number[]; xYes: number; xNo: number;
};

// Allegato 3, legal representative (page 11)
const L_RAPP: PersonLayout = {
  cognome: [112, 315, 134], nome: [347, 509, 134], via: [170, 508, 154], cap: [78, 142, 175], comune: [192, 446, 175], prov: [479, 506, 175],
  cf: [116, 396, 196], nascLuogo: [145, 449, 217], nascProv: [482, 509, 217], nascData: [136, 221, 237], cittadinanza: [312, 494, 237],
  docTipo: [195, 510, 258], docNumero: [120, 394, 284], docRil: [117, 202, 314], docScad: [330, 415, 314], autorita: [129, 509, 334],
  docComune: [96, 333, 355], docProv: [376, 510, 355], docStato: [81, 509, 376], pepMotivo: [123, 510, 426],
  pepNo: [57, 405], pepSi: [57, 415], pairs: [475, 495, 527, 591, 610], xYes: 57, xNo: 113,
};
// Executor (page 12)
const L_ESEC: PersonLayout = {
  cognome: [112, 315, 128], nome: [347, 509, 128], via: [170, 514, 148], cap: [78, 142, 169], comune: [192, 455, 169], prov: [488, 515, 169],
  cf: [116, 396, 190], nascLuogo: [145, 454, 211], nascProv: [459, 486, 211], nascData: [136, 221, 231], cittadinanza: [312, 485, 231],
  docTipo: [195, 510, 252], docNumero: [120, 394, 278], docRil: [117, 202, 308], docScad: [330, 415, 308], autorita: [129, 516, 328],
  docComune: [96, 315, 349], docProv: [358, 480, 349], docStato: [81, 496, 370], pepMotivo: [123, 492, 420],
  pepNo: [57, 399], pepSi: [57, 409], pairs: [460, 481, 512], xYes: 57, xNo: 92,
};
// Beneficial owner (page 13, repeated once per owner)
const L_TIT: PersonLayout = {
  cognome: [112, 315, 94], nome: [347, 509, 94], via: [170, 505, 143], cap: [78, 142, 164], comune: [192, 446, 164], prov: [479, 506, 164],
  cf: [116, 396, 185], nascLuogo: [145, 438, 205], nascProv: [478, 505, 205], nascData: [136, 221, 226], cittadinanza: [312, 503, 226],
  docTipo: [195, 510, 247], docNumero: [120, 394, 268], docRil: [117, 202, 297], docScad: [330, 415, 297], autorita: [129, 516, 318],
  docComune: [96, 351, 339], docProv: [394, 510, 339], docStato: [81, 509, 360], pepMotivo: [123, 510, 431], motivoTit: [212, 509, 389],
  pepNo: [57, 410], pepSi: [57, 420], pairs: [479, 500, 531, 584, 603], xYes: 57, xNo: 92,
};

function drawPerson(pen: Pen, p: Person, L: PersonLayout, declarations: number) {
  pen.line(p.cognome, ...L.cognome); pen.line(p.nome, ...L.nome); pen.line(p.resVia, ...L.via);
  pen.comb(p.resCap, ...L.cap, 5); pen.line(p.resComune, ...L.comune); pen.comb(p.resProv, ...L.prov, 2);
  pen.comb(p.cf, ...L.cf, 16);
  pen.line(p.nascLuogo, ...L.nascLuogo); pen.comb(p.nascProv, ...L.nascProv, 2); pen.date(p.nascData, ...L.nascData); pen.line(p.cittadinanza, ...L.cittadinanza);
  pen.line(p.docTipo, ...L.docTipo); pen.comb(p.docNumero, ...L.docNumero, 22);
  pen.date(p.docRilascio, ...L.docRil); pen.date(p.docScadenza, ...L.docScad); pen.line(p.docAutorita, ...L.autorita);
  pen.line(p.docComune, ...L.docComune); pen.line(p.docProvincia, ...L.docProv); pen.line(p.docStato, ...L.docStato);
  if (L.motivoTit) pen.line(p.motivoTitolare, ...L.motivoTit);
  if (p.pep === "no") pen.cross(...L.pepNo);
  if (p.pep === "si") { pen.cross(...L.pepSi); pen.line(p.pepMotivo, ...L.pepMotivo); }
  const answers = [p.procedimenti, p.indagini, p.collegato, p.paesi, p.quota];
  L.pairs.slice(0, declarations).forEach((y, i) => {
    if (answers[i] === "y") pen.cross(L.xYes, y);
    if (answers[i] === "n") pen.cross(L.xNo, y);
  });
}

const dmy = (iso: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso); return m ? `${m[3]}/${m[2]}/${m[1]}` : iso; };
// Italian format with the thousands dot (toLocaleString("it-IT") omits it for 4-digit amounts).
const eur = (n: number) => n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** Builds the filled contract. `template` is the blank Rev. F PDF. */
export async function buildContractPdf(template: ArrayBuffer | Uint8Array, d: ContractData): Promise<Uint8Array> {
  const src = await PDFDocument.load(template);
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const bold = await out.embedFont(StandardFonts.HelveticaBold);
  const times = await out.embedFont(StandardFonts.TimesRoman);

  // Page 13 (beneficial owner) is repeated once per owner, and dropped when there is none.
  const owners = d.titolareMode === "insieme" || d.titolareMode === "altri" ? d.titolari : [];
  const order: { from: number; owner?: Person }[] = [];
  for (let i = 0; i < 16; i++) {
    if (i === 12) owners.forEach(owner => order.push({ from: 12, owner }));
    else order.push({ from: i });
  }
  const pages = await out.copyPages(src, order.map(o => o.from));
  const byIndex: Record<number, PDFPage> = {};
  pages.forEach((p, i) => { out.addPage(p); if (order[i].from !== 12) byIndex[order[i].from] = p; });
  const pen = (page: PDFPage) => new Pen(page, font, bold);

  // Page 1 — le parti
  let p = pen(byIndex[0]);
  p.line(d.societa, 150, 431, 264); p.line(d.sedeVia, 43, 257, 283); p.line(d.sedeCitta, 293, 475, 283); p.line(d.sedeCap, 503, 553, 283);
  p.line(d.sedeProv, 89, 114, 302); p.line(d.capitale, 268, 360, 302); p.line(d.cfRegImp.toUpperCase(), 43, 257, 321); p.line(d.piva, 296, 466, 321);
  p.line(d.pec, 93, 302, 340, 8.5); p.line(d.sdi.toUpperCase(), 359, 469, 340); p.line(d.repQualifica, 320, 523, 359);
  p.line(d.repNome, 43, 243, 378); p.line(d.repNatoA, 399, 553, 378); p.line(dmy(d.repNatoIl), 57, 216, 397);
  p.line(d.repResVia, 326, 524, 397); p.line(d.repResCitta, 43, 285, 416); p.line(d.repResCap, 339, 378, 416); p.line(d.repResProv, 437, 474, 416);
  p.line(d.repCf.toUpperCase(), 43, 235, 435); p.line(d.repEmail, 267, 473, 435, 8.5);

  // Page 4 — canone, durata e decorrenza (printed values replaced, same Times 10 pt look)
  p = pen(byIndex[3]);
  p.whiteout(42, 105.2, 567, 115.6);
  p.justified(`Il canone del servizio di domiciliazione con durata di ${d.durataMesi} mesi è fissato complessivamente in € ${eur(d.canoneEuro)} + IVA (attuale`, 42.6, 565.65, 112.44, times);
  p.whiteout(42, 182.8, 557, 193.4);
  p.justified(`Il servizio di domiciliazione avrà durata di ${d.durataMesi} mesi a partire dalla data del ${dmy(d.dataInizio)}. Il servizio si intenderà tacitamente`, 42.6, 555.45, 190.2, times);

  // Page 8 — Allegato 1
  p = pen(byIndex[7]);
  const cols = [51, 173, 295, 417, 540];
  const rowsY = [[147, 164], [164, 181], [181, 199]];
  d.delegati.filter(x => x.nome || x.cognome || x.documento || x.note).slice(0, 3).forEach((x, i) => {
    const y1 = rowsY[i][1] - 4;
    [x.nome, x.cognome, x.documento, x.note].forEach((v, c) => p.line(v, cols[c] + 2, cols[c + 1] - 2, y1 + 3, 8));
  });
  p.line(d.telUrgenze, 395, 527, 226); p.line(d.intestazione, 220, 462, 264);
  p.line(d.inoltroNome, 218, 498, 314); p.line(d.inoltroVia, 105, 495, 333); p.line(d.inoltroComune, 99, 328, 352); p.line(d.inoltroProv, 359, 395, 352); p.line(d.inoltroCap, 430, 483, 352);
  if (d.svcLineaTel) p.cross(57, 389, 9, 10);
  if (d.svcDenomPostale) { p.cross(57, 408, 9, 10); p.line(d.denomPostaleTesto, 241, 408, 420, 8.5); }
  if (d.svcApertura) p.cross(57, 451, 9, 10);
  if (d.svcArchivio) p.cross(57, 470, 9, 10);
  if (d.svcInoltro) p.cross(57, 489, 9, 10);
  const [local, domain = ""] = d.emailScansioni.split("@");
  p.line(local, 117, 283, 678, 8.5); p.line(domain, 291, 491, 678, 8.5);

  // Page 9 — Allegato 2
  p = pen(byIndex[8]);
  p.line(d.societa, 143, 534, 224); p.line(d.a2Studio, 293, 538, 272); p.line(d.a2DomFiscale1, 191, 521, 297); p.line(d.a2DomFiscale2, 57, 522, 322);
  p.line(d.a2Luogo1, 300, 530, 347); p.line(d.a2Luogo2, 57, 528, 372); p.line(d.a2Tel, 159, 392, 397); p.line(d.a2Orario, 145, 402, 422); p.line(d.a2Chiuso, 449, 535, 422);

  // Page 10 — Allegato 3, sezione A
  p = pen(byIndex[9]);
  const rap = d.rappresentante;
  p.line(`${rap.nome} ${rap.cognome}`, 115, 502, 215); p.comb(rap.cf, 127, 407, 235, 16); p.line(d.societa, 57, 504, 277);
  p.line(d.denominazioneForma, 57, 502, 537); p.line(d.indirizzoSede, 171, 505, 568); p.comb(d.capSede, 78, 142, 599, 5); p.line(d.comuneSede, 187, 441, 599);
  p.comb(d.provSede, 474, 501, 599, 2); p.comb(d.cfSocieta, 116, 396, 630, 16); p.comb(d.pivaSocieta, 119, 312, 661, 11);
  p.comb(d.rea, 85, 209, 692, 7); p.comb(d.ateco.replace(/\./g, ""), 148, 298, 723, 12); p.comb(d.sae, 324, 400, 723, 6); p.comb(d.rae, 424, 488, 723, 5);

  // Page 11 — rappresentante legale
  drawPerson(pen(byIndex[10]), rap, L_RAPP, 5);

  // Page 12 — esecutore (opzionale) e sezione B
  p = pen(byIndex[11]);
  if (d.hasEsecutore) drawPerson(p, d.esecutore, L_ESEC, 3);
  const modeY: Record<string, number> = { unico: 617, insieme: 638, altri: 668, nessuno: 714 };
  if (modeY[d.titolareMode]) p.cross(72, modeY[d.titolareMode], 10, 10);
  if (d.titolareMode === "nessuno") p.line(d.titolareNessunoMotivo, 92, 377, 740);

  // Page 13 (one per beneficial owner)
  order.forEach((o, i) => { if (o.from === 12 && o.owner) drawPerson(pen(pages[i]), o.owner, L_TIT, 5); });

  return out.save();
}
