import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { adminEmail, sendMail } from "./mailer";
import { bankTransfer, formatEur, copyFor } from "./pricing";
import { buildRequestPdf, requestPdfFilename } from "./pdf";
import { escapeHtml } from "./standard-offer";
import type { OrderSnapshot } from "./order-access";
import type { RequestData } from "./request";

type OrderRow = typeof orders.$inferSelect;

/**
 * Builds the request PDF and emails it to the customer and admin — the one place both the
 * finalize route (bank transfer / on-site, sent immediately) and verify-payment (online
 * providers, sent only once payment is confirmed) produce this document, so it's never sent
 * before the customer has actually committed to paying that way.
 */
export async function sendRequestConfirmation(order: OrderRow, data: RequestData, snapshot: OrderSnapshot, paymentMethod: string) {
  const orderId = order.publicId; const { product, quote: priced } = snapshot; const lang = data.lang; const it = lang === "it";
  const copy = copyFor(product.code, lang); const bank = bankTransfer(lang, product.code);
  const methods: Record<string, string> = { stripe: "Stripe", paypal: "PayPal", sumup: "SumUp", bank_transfer: it ? "Bonifico Bancario" : "Bank transfer", on_site: it ? "Contanti / Bancomat / Carta di credito (in sede)" : "Cash / debit card / credit card (on site)" };
  const summary = [copy.name, `${it ? "Pratica" : "Reference"}: ${orderId}`, `${copy.months(data.months)} — ${it ? "decorrenza" : "start date"}: ${data.startDate}`, `${data.representativeName} — ${data.email} — ${data.phone}`, ...priced.addonLines.map(line => `${it ? line.titleIt : line.titleEn} × ${line.quantity}: ${formatEur(line.totalCents, lang)} ${it ? "+ IVA" : "+ VAT"}`), `${it ? "Imponibile" : "Net amount"}: ${formatEur(priced.netCents, lang)}`, `${it ? "IVA" : "VAT"} ${product.vatBps / 100}%: ${formatEur(priced.vatCents, lang)}`, `${it ? "Totale" : "Total"}: ${formatEur(priced.totalCents, lang)}`, `${it ? "Pagamento" : "Payment"}: ${methods[paymentMethod] || paymentMethod}`].join("\n");
  const bankLines = `${it ? "Intestatario" : "Account holder"}: ${bank.holder}\nIBAN: ${bank.iban}\nBIC/SWIFT: ${bank.bic}\n${it ? "Banca" : "Bank"}: ${bank.bank}\n${it ? "Causale" : "Reason"}: ${bank.reason} — ${orderId}\n${it ? "Importo" : "Amount"}: ${formatEur(priced.totalCents, lang)}`;
  const pdf = Buffer.from(await buildRequestPdf({ data, lang, orderRef: orderId, paymentMethod, product, priced }));
  const attachments = [{ filename: requestPdfFilename(product.code, lang, orderId), content: pdf, contentType: "application/pdf" }];
  const instructions = paymentMethod === "bank_transfer" ? bankLines : paymentMethod === "on_site" ? (it ? "Pagamento anticipato in sede. Concorda un appuntamento con la reception prima della decorrenza. Nessun deposito cauzionale." : "Payment in advance on site. Arrange a reception appointment before the start date. No security deposit.") : (it ? "Il pagamento online è stato confermato. Grazie!" : "Your online payment has been confirmed. Thank you!");
  const letter = `${it ? "Gentile" : "Dear"} ${data.representativeName},\n\n${it ? "abbiamo registrato la Sua richiesta. In allegato trova il riepilogo compilato e, per la postale, l’Allegato 1 e le condizioni accettate." : "we have recorded your application. Attached is your completed summary and, for the mailing service, Annex 1 and the accepted terms."}\n\n${summary}\n\n${instructions}\n\n${it ? "L’attivazione è subordinata alla verifica della documentazione e al contratto." : "Activation is subject to document review and agreement."}\nRoma Office Sharing — +39 06 21.11.6268 — info@romaofficesharing.it`;
  const sent = await db.transaction(async tx => {
    const [current] = await tx.select().from(orders).where(eq(orders.id, order.id)).for("update");
    let customerSent = !!current.requestEmailSentAt; let adminSent = !!current.adminEmailSentAt;
    if (!customerSent) customerSent = (await sendMail({ to: data.email, subject: `${it ? "Richiesta e dati pagamento" : "Application and payment details"} — ${copy.name}`, text: letter, html: `<div style="font-family:Arial;white-space:pre-wrap;line-height:1.6">${escapeHtml(letter)}</div>`, attachments })).sent;
    if (!adminSent) adminSent = (await sendMail({ to: adminEmail(), subject: `[${orderId.slice(0, 8)}] ${copy.name}`, text: letter, html: `<div style="white-space:pre-wrap">${escapeHtml(letter)}</div>`, attachments })).sent;
    await tx.update(orders).set({ requestEmailSentAt: customerSent ? current.requestEmailSentAt || new Date() : null, adminEmailSentAt: adminSent ? current.adminEmailSentAt || new Date() : null }).where(eq(orders.id, order.id));
    return { customerSent, adminSent };
  });
  return { ...sent, pdf, bankLines };
}
