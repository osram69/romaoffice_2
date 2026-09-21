import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { bankTransfer, formatEur, copyFor, shortServiceLabel, validity, type Lang, type ProductOffer, type Quote } from "./pricing";
import type { RequestData } from "./request";
import { termsText } from "./offer-terms";

/** Human-readable PDF attachment/download filename — word order differs by language, not just the noun. */
export function requestPdfFilename(serviceCode: string, lang: Lang, orderRef: string): string {
  const id = orderRef.slice(0, 8);
  if (lang === "it") {
    const slug = serviceCode === "legal_unit" ? "sede_legale" : serviceCode === "postal" ? "domiciliazione_postale" : serviceCode;
    return `Richiesta_${slug}_${id}.pdf`;
  }
  const slug = serviceCode === "legal_unit" ? "Legal_address_request" : serviceCode === "postal" ? "Postal_address_request" : `${serviceCode}_request`;
  return `${slug}_${id}.pdf`;
}

// Palette matches the actual Roma Office Sharing logo (grey "ROMA" + orange "OFFICESHARING"),
// not the site's green/gold theme — the logo's own colors, sampled directly from the artwork.
const INK = rgb(0.2, 0.2, 0.2);
const GREY = rgb(0.42, 0.42, 0.42);
const ACCENT = rgb(0.976, 0.451, 0);
const PAPER = rgb(0.965, 0.965, 0.965);
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 46;
const WIDTH = PAGE_W - MARGIN * 2;

class Writer {
  pdf: PDFDocument;
  page: PDFPage;
  y = PAGE_H - MARGIN;
  font: PDFFont;
  bold: PDFFont;

  constructor(pdf: PDFDocument, font: PDFFont, bold: PDFFont) {
    this.pdf = pdf; this.font = font; this.bold = bold; this.page = pdf.addPage([PAGE_W, PAGE_H]);
  }
  ensure(space: number) {
    if (this.y - space < 64) { this.page = this.pdf.addPage([PAGE_W, PAGE_H]); this.y = PAGE_H - MARGIN; }
  }
  wrap(text: string, size: number, font: PDFFont): string[] {
    const words = text.split(/\s+/).filter(Boolean); const lines: string[] = []; let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > WIDTH && line) { lines.push(line); line = word; } else line = candidate;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  }
  text(value: string, opts: { size?: number; bold?: boolean; color?: typeof INK; gap?: number; indent?: number } = {}) {
    const size = opts.size ?? 9.5;
    const font = opts.bold ? this.bold : this.font;
    const indent = opts.indent ?? 0;
    for (const line of this.wrap(value, size, font)) {
      this.ensure(size * 1.6);
      this.page.drawText(line, { x: MARGIN + indent, y: this.y, size, font, color: opts.color ?? INK });
      this.y -= size * 1.42;
    }
    this.y -= opts.gap ?? 0;
  }
  section(title: string) {
    this.ensure(46);
    this.y -= 12;
    this.text(title, { size: 12, bold: true });
    this.page.drawRectangle({ x: MARGIN, y: this.y + 6, width: 34, height: 2, color: ACCENT });
    this.y -= 8;
  }
  field(label: string, value: string) {
    if (!value) return;
    this.ensure(28);
    this.page.drawText(label, { x: MARGIN, y: this.y, size: 7.5, font: this.bold, color: GREY });
    this.y -= 12;
    this.text(value, { size: 10 });
    this.y -= 2;
  }
  row(label: string, value: string, strong = false) {
    this.ensure(18);
    const font = strong ? this.bold : this.font;
    this.page.drawText(label, { x: MARGIN, y: this.y, size: strong ? 11 : 9.5, font, color: INK });
    const width = font.widthOfTextAtSize(value, strong ? 11 : 9.5);
    this.page.drawText(value, { x: PAGE_W - MARGIN - width, y: this.y, size: strong ? 11 : 9.5, font, color: INK });
    this.y -= strong ? 20 : 16;
  }
  rule() {
    this.ensure(12);
    this.page.drawRectangle({ x: MARGIN, y: this.y, width: WIDTH, height: 0.6, color: rgb(0.8, 0.82, 0.8) });
    this.y -= 10;
  }
}

/** Builds the domiciliation request module (modulo di richiesta) as a PDF. */
export async function buildRequestPdf(opts: { data: RequestData; lang: Lang; shortRef: string; paymentMethod: string; product: ProductOffer; priced: Quote }): Promise<Uint8Array> {
  const { data, lang, shortRef } = opts;
  const it = lang === "it";
  const product = opts.product; const postal = product.code === "postal"; const copy = copyFor(product.code, lang);
  const priced = opts.priced;
  const bank = bankTransfer(lang, product.code, data.representativeName, shortRef);
  const pdf = await PDFDocument.create();
  const writer = new Writer(pdf, await pdf.embedFont(StandardFonts.Helvetica), await pdf.embedFont(StandardFonts.HelveticaBold));
  pdf.setTitle(it ? "Modulo di richiesta domiciliazione" : "Registered office address application");
  pdf.setAuthor("Roma Office Sharing — Cube Engineering s.r.l.");
  pdf.setSubject(copy.name);

  // Header: logo top-left over an orange rule, matching the company's own paper form —
  // white background instead of the site's green, since this is the logo's own palette.
  const logoBytes = await readFile(join(process.cwd(), "public", "images", "logo-pdf.png"));
  const logo = await pdf.embedPng(logoBytes);
  const logoWidth = 168;
  const logoHeight = logoWidth * (logo.height / logo.width);
  const logoTop = PAGE_H - MARGIN;
  writer.page.drawImage(logo, { x: MARGIN, y: logoTop - logoHeight, width: logoWidth, height: logoHeight });
  const ruleY = logoTop - logoHeight - 10;
  writer.page.drawRectangle({ x: 0, y: ruleY, width: PAGE_W, height: 2.2, color: ACCENT });
  writer.y = ruleY - 22;
  writer.page.drawText(it ? "MODULO RICHIESTA" : "APPLICATION FORM", { x: MARGIN, y: writer.y, size: 15, font: writer.bold, color: INK });
  writer.y -= 18;
  writer.page.drawText(shortServiceLabel(product.code, lang).toUpperCase(), { x: MARGIN, y: writer.y, size: 10.5, font: writer.bold, color: ACCENT });
  writer.y -= 22;
  writer.row(it ? `Riferimento pratica: ${shortRef}` : `Reference: ${shortRef}`, new Date().toLocaleString(it ? "it-IT" : "en-GB", { timeZone: "Europe/Rome" }));

  writer.section(it ? "1. Dati dell'azienda / ditta individuale" : "1. Company / sole proprietorship data");
  writer.field(it ? "Denominazione / Ragione sociale" : "Company name", data.companyName);
  if (data.companyExists) {
    writer.field(it ? "Partita IVA" : "VAT number", data.companyVat || "-");
    writer.field(it ? "Codice fiscale" : "Tax code", data.companyTaxCode || "-");
    writer.field(it ? "Sede attuale" : "Current address", data.companyAddress || "-");
    writer.field(it ? "REA / Registro imprese" : "REA / Company register", data.companyRegister || "-");
  } else {
    writer.text(it ? "Azienda non ancora costituita: la richiesta è riferita alla futura attività." : "Company not yet incorporated: this request refers to the future business.", { size: 9.5 });
  }

  writer.section(it ? "2. Legale rappresentante / Amministratore (dati obbligatori)" : "2. Legal representative / administrator (mandatory data)");
  writer.field(it ? "Nome e cognome" : "Full name", data.representativeName);
  writer.field(it ? "Ruolo" : "Role", data.representativeRole || (it ? "Legale rappresentante" : "Legal representative"));
  writer.field(it ? "Codice fiscale" : "Tax code", data.representativeTaxCode || "-");
  writer.field("Email", data.email);
  writer.field(it ? "Cellulare (verificato via SMS)" : "Mobile (verified by SMS)", data.phone);

  writer.section(it ? "3. Contratto di domiciliazione" : "3. Registered office address agreement");
  writer.field(it ? "Servizio" : "Service", copy.name);
  writer.field(it ? "Descrizione" : "Description", copy.description);
  writer.field(it ? "Durata" : "Duration", copy.months(data.months));
  writer.field(it ? "Data di inizio contratto" : "Contract start date", data.startDate);
  writer.field(it ? "Nuova attivazione (nuovo cliente/società)" : "New activation (new client/company)", data.newActivation ? (it ? "Sì" : "Yes") : it ? "No" : "No");
  if (!postal) writer.field(it ? "Domiciliazione aggiuntiva (stesso referente/amministratore)" : "Additional address service (same contact/administrator)", data.additionalDomiciliation ? (it ? "Sì" : "Yes") : it ? "No" : "No");

  if (priced) {
    // Keep the whole quotation block together: forcing a break here (rather than letting each
    // row's own ensure() trigger mid-list) avoids splitting the cost list across two pages.
    const preventivoRows = 1 + (priced.offerApplied ? 1 : 0) + (priced.newActivationDiscountCents ? 1 : 0) + (priced.additionalDomiciliationDiscountCents ? 1 : 0) + (priced.onlineDiscountCents ? 1 : 0) + priced.addonLines.length + 4;
    writer.ensure(46 + preventivoRows * 18 + 12);
    writer.section(it ? "4. Preventivo" : "4. Quotation");
    writer.row(it ? "Tariffa di listino" : "Standard rate", `${formatEur(priced.listCents, lang)} ${it ? "+ IVA" : "+ VAT"}`);
    if (priced.offerApplied) writer.row(it ? `Offerta ${priced.months} mesi` : `${priced.months}-month offer`, `${formatEur(priced.baseCents, lang)} ${it ? "+ IVA" : "+ VAT"}`);
    if (priced.newActivationDiscountCents) writer.row(it ? "Sconto una-tantum nuove attivazioni (10%)" : "One-off new activation discount (10%)", `- ${formatEur(priced.newActivationDiscountCents, lang)}`);
    if (priced.additionalDomiciliationDiscountCents) writer.row(it ? "Sconto domiciliazioni aggiuntive (10%)" : "Additional address service discount (10%)", `- ${formatEur(priced.additionalDomiciliationDiscountCents, lang)}`);
    if (priced.onlineDiscountCents) writer.row(it ? `Sconto attivazione online (${product.onlineDiscountBps / 100}%)` : `Online activation discount (${product.onlineDiscountBps / 100}%)`, `- ${formatEur(priced.onlineDiscountCents, lang)}`);
    for (const line of priced.addonLines) writer.row(`${it ? line.titleIt : line.titleEn} x ${line.quantity}`, formatEur(line.totalCents, lang));
    writer.row(it ? "Imponibile" : "Net amount", formatEur(priced.netCents, lang));
    writer.row(`${it ? "IVA" : "VAT"} ${product.vatBps / 100}%`, formatEur(priced.vatCents, lang));
    writer.rule();
    writer.row(it ? "TOTALE" : "TOTAL", formatEur(priced.totalCents, lang), true);
    writer.row(it ? "Rinnovi successivi" : "Subsequent renewals", `${formatEur(priced.renewalBaseCents, lang)} ${it ? "+ IVA" : "+ VAT"}`);
  }

  writer.section(it ? "5. Pagamento" : "5. Payment");
  const methodLabels: Record<string, string> = {
    stripe: "Stripe", paypal: "PayPal", sumup: "SumUp",
    bank_transfer: it ? "Bonifico bancario" : "Bank transfer", on_site: it ? "In sede: contanti / Bancomat / carta" : "On site: cash / debit card / credit card",
  };
  writer.field(it ? "Modalità di pagamento" : "Payment method", methodLabels[opts.paymentMethod] || opts.paymentMethod);
  if (opts.paymentMethod === "bank_transfer") {
    writer.field(it ? "Intestatario" : "Account holder", bank.holder);
    writer.field("IBAN", bank.iban);
    writer.field("BIC / SWIFT", bank.bic);
    writer.field(it ? "Istituto bancario" : "Bank", bank.bank);
    writer.field(it ? "Causale" : "Payment reason", bank.reason);
    if (priced) writer.field(it ? "Importo da versare" : "Amount to transfer", `${formatEur(priced.totalCents, lang)} (${it ? "IVA inclusa" : "VAT included"})`);
  }

  writer.section(it ? "6. Informativa e consenso" : "6. Notice and consent");
  writer.text(it
    ? "Il sottoscritto dichiara che i dati forniti sono veritieri e acconsente al trattamento dei dati personali per la gestione della presente richiesta e dell'eventuale contratto di domiciliazione, ai sensi del Regolamento UE 2016/679 e dell'informativa privacy pubblicata sul sito."
    : "The undersigned declares that the information provided is truthful and consents to the processing of personal data for the handling of this request and of any registered office address agreement, in accordance with EU Regulation 2016/679 and the privacy notice published on this website.", { size: 8.5 });
  writer.text(it
    ? "Il consenso può essere revocato in qualsiasi momento scrivendo a cubeng@pec.it o chiamando il +39 06 21116268."
    : "Consent may be withdrawn at any time by writing to cubeng@pec.it or calling +39 06 21116268.", { size: 8.5, gap: 10 });

  writer.section(it ? "Allegato 1 — Servizi aggiuntivi richiesti" : "Annex 1 — Requested additional services");
  if (!priced.addonLines.length) writer.text(it ? "Nessun servizio opzionale a canone selezionato." : "No optional recurring services selected.");
  for (const line of priced.addonLines) writer.text(`${it ? line.titleIt : line.titleEn} x ${line.quantity}: ${formatEur(line.monthlyCents, lang)}/${it ? "mese" : "month"}${line.annualCents ? ` + ${formatEur(line.annualCents, lang)}/${it ? "anno numero VoIP" : "year VoIP number"}` : ""}. ${it ? "Totale periodo" : "Period total"}: ${formatEur(line.totalCents, lang)} ${it ? "+ IVA" : "+ VAT"}.`);
  if (postal) writer.text(it ? "I costi a consumo, postali e di spedizione sono esclusi dal totale iniziale e si applicano solo ai servizi richiesti." : "Usage, postage and shipping charges are excluded from the initial total and apply only to requested services.");
  writer.section(it ? `Condizioni dell’offerta di ${shortServiceLabel(product.code, lang).toLowerCase()} accettate` : `Accepted ${shortServiceLabel(product.code, lang).toLowerCase()} offer terms`);
  writer.text(`${it ? "Versione" : "Version"}: ${product.termsRevision} / ${product.version.slice(0, 16)}`, {size: 8});
  for (const paragraph of termsText(product, lang).split("\n")) writer.text(paragraph, { size: 9, gap: 4 });
  // Footer on every page
  const pages = pdf.getPages();
  pages.forEach((page, index) => {
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: 34, color: PAPER });
    page.drawRectangle({ x: 0, y: 34, width: PAGE_W, height: 1.2, color: ACCENT });
    page.drawText(it
      ? "Cube Engineering s.r.l. — Via San Martino Della Battaglia, 31 - 00185 Roma — info@romaofficesharing.it — +39 06 21.11.6268"
      : "Cube Engineering s.r.l. — Via San Martino Della Battaglia, 31 - 00185 Rome — info@romaofficesharing.it — +39 06 21.11.6268",
      { x: MARGIN, y: 20, size: 7, font: writer.font, color: GREY });
    const label = `${index + 1} / ${pages.length}`;
    const width = writer.font.widthOfTextAtSize(label, 7);
    page.drawText(label, { x: PAGE_W - MARGIN - width, y: 20, size: 7, font: writer.font, color: GREY });
  });

  return pdf.save();
}
