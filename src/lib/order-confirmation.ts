import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { adminEmail, sendMail } from "./mailer";
import { bankTransfer, formatEur, copyFor } from "./pricing";
import { buildRequestPdf, requestPdfFilename } from "./pdf";
import { escapeHtml } from "./standard-offer";
import { shortOrderRef } from "./order-ref";
import type { OrderSnapshot } from "./order-access";
import type { RequestData } from "./request";

type OrderRow = typeof orders.$inferSelect;
export type BankDetails = { holder: string; iban: string; bic: string; bank: string; causale: string; amount: string };

/**
 * Builds the request PDF and emails it to the customer and admin — the one place both the
 * finalize route (bank transfer / on-site, sent immediately) and verify-payment (online
 * providers, sent only once payment is confirmed) produce this document, so it's never sent
 * before the customer has actually committed to paying that way.
 */
export async function sendRequestConfirmation(order: OrderRow, data: RequestData, snapshot: OrderSnapshot, paymentMethod: string) {
  const orderId = order.publicId; const { product, quote: priced } = snapshot; const lang = data.lang; const it = lang === "it";
  const shortRef = shortOrderRef(data.representativeTaxCode, order.createdAt, product.code);
  const copy = copyFor(product.code, lang);
  const bank = bankTransfer(lang, product.code, data.representativeName, shortRef);
  const bankDetails: BankDetails = { holder: bank.holder, iban: bank.iban, bic: bank.bic, bank: bank.bank, causale: bank.reason, amount: formatEur(priced.totalCents, lang) };
  const methods: Record<string, string> = { stripe: "Stripe", paypal: "PayPal", sumup: "SumUp", bank_transfer: it ? "Bonifico Bancario" : "Bank transfer", on_site: it ? "Contanti / Bancomat / Carta di credito (in sede)" : "Cash / debit card / credit card (on site)" };

  const summaryLines = [
    copy.name,
    `${it ? "Pratica" : "Reference"}: ${shortRef}`,
    `${copy.months(data.months)} — ${it ? "decorrenza" : "start date"}: ${data.startDate}`,
    `${data.representativeName} (CF ${data.representativeTaxCode}) — ${data.email} — ${data.phone}`,
    ...priced.addonLines.map(line => `${it ? line.titleIt : line.titleEn} × ${line.quantity}: ${formatEur(line.totalCents, lang)} ${it ? "+ IVA" : "+ VAT"}`),
    `${it ? "Imponibile" : "Net amount"}: ${formatEur(priced.netCents, lang)}`,
    `${it ? "IVA" : "VAT"} ${product.vatBps / 100}%: ${formatEur(priced.vatCents, lang)}`,
    `${it ? "Totale" : "Total"}: ${formatEur(priced.totalCents, lang)}`,
    `${it ? "Pagamento" : "Payment"}: ${methods[paymentMethod] || paymentMethod}`,
  ];
  const bankLines = [
    `${it ? "Intestatario" : "Account holder"}: ${bankDetails.holder}`,
    `IBAN: ${bankDetails.iban}`,
    `BIC/SWIFT: ${bankDetails.bic}`,
    `${it ? "Banca" : "Bank"}: ${bankDetails.bank}`,
    `${it ? "Causale" : "Reason"}: ${bankDetails.causale}`,
    `${it ? "Importo" : "Amount"}: ${bankDetails.amount}`,
  ];
  const instructionLines = paymentMethod === "bank_transfer" ? bankLines
    : paymentMethod === "on_site" ? [it ? "Pagamento anticipato in sede. Concorda un appuntamento con la reception prima della decorrenza. Nessun deposito cauzionale." : "Payment in advance on site. Arrange a reception appointment before the start date. No security deposit."]
    : [it ? "Il pagamento online è stato confermato. Grazie!" : "Your online payment has been confirmed. Thank you!"];

  const greeting = it ? `Gentile ${data.representativeName},` : `Dear ${data.representativeName},`;
  const intro = it ? "abbiamo registrato la Sua richiesta. In allegato trova il riepilogo compilato e, per la postale, l’Allegato 1 e le condizioni accettate." : "we have recorded your application. Attached is your completed summary and, for the mailing service, Annex 1 and the accepted terms.";
  const closing = it ? "L’attivazione è subordinata alla verifica della documentazione e al contratto." : "Activation is subject to document review and agreement.";
  const signOff = "Roma Office Sharing — +39 06 21.11.6268 — info@romaofficesharing.it";
  const letter = [greeting, intro, summaryLines.join("\n"), instructionLines.join("\n"), closing, signOff].join("\n\n");

  // Plain "\n" line breaks inside a white-space:pre-wrap div are not reliably honored by every
  // mail client (Gmail in particular can collapse them into one run-on paragraph), so the HTML
  // body is built explicitly with <br> per line instead of relying on that CSS property.
  const htmlLines = (lines: string[]) => lines.map(escapeHtml).join("<br>");
  const bankHtmlLines = [
    `${it ? "Intestatario" : "Account holder"}: <b>${escapeHtml(bankDetails.holder)}</b>`,
    `IBAN: <b>${escapeHtml(bankDetails.iban)}</b>`,
    `BIC/SWIFT: ${escapeHtml(bankDetails.bic)}`,
    `${it ? "Banca" : "Bank"}: ${escapeHtml(bankDetails.bank)}`,
    `${it ? "Causale" : "Reason"}: <b>${escapeHtml(bankDetails.causale)}</b>`,
    `${it ? "Importo" : "Amount"}: <b>${escapeHtml(bankDetails.amount)}</b>`,
  ];
  const instructionsHtml = paymentMethod === "bank_transfer" ? bankHtmlLines.join("<br>") : htmlLines(instructionLines);
  const p = (inner: string) => `<p style="margin:0 0 14px">${inner}</p>`;
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#183229">${p(escapeHtml(greeting))}${p(escapeHtml(intro))}${p(htmlLines(summaryLines))}${p(instructionsHtml)}${p(escapeHtml(closing))}${p(escapeHtml(signOff))}</div>`;

  const pdf = Buffer.from(await buildRequestPdf({ data, lang, shortRef, paymentMethod, product, priced }));
  const attachments = [{ filename: requestPdfFilename(product.code, lang, orderId), content: pdf, contentType: "application/pdf" }];

  const sent = await db.transaction(async tx => {
    const [current] = await tx.select().from(orders).where(eq(orders.id, order.id)).for("update");
    let customerSent = !!current.requestEmailSentAt; let adminSent = !!current.adminEmailSentAt;
    if (!customerSent) customerSent = (await sendMail({ to: data.email, subject: `${it ? "Richiesta e dati pagamento" : "Application and payment details"} — ${copy.name}`, text: letter, html, attachments })).sent;
    if (!adminSent) adminSent = (await sendMail({ to: adminEmail(), subject: `[${shortRef}] ${copy.name}`, text: letter, html, attachments })).sent;
    await tx.update(orders).set({ requestEmailSentAt: customerSent ? current.requestEmailSentAt || new Date() : null, adminEmailSentAt: adminSent ? current.adminEmailSentAt || new Date() : null }).where(eq(orders.id, order.id));
    return { customerSent, adminSent };
  });
  return { ...sent, pdf, shortRef, bankDetails: paymentMethod === "bank_transfer" ? bankDetails : undefined };
}
