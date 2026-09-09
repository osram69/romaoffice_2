import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { readyOrder } from "@/lib/order-access";
import { checkoutOrder } from "@/lib/order-checkout";
import { CustomerError, json, protectMutation } from "@/lib/customer-auth";
import { adminEmail, sendMail } from "@/lib/mailer";
import { bankTransfer, formatEur, copyFor } from "@/lib/pricing";
import { termsText } from "@/lib/offer-terms";
import { buildRequestPdf } from "@/lib/pdf";
import { escapeHtml } from "@/lib/standard-offer";
import { paymentMethodSchema } from "@/lib/request";
const input = z.object({ orderId: z.string().uuid(), paymentMethod: paymentMethodSchema });
export async function POST(req: NextRequest) {
  try {
    protectMutation(req); const parsed = input.safeParse(await req.json()); if (!parsed.success) return json({ error: "invalid" }, 400);
    const { orderId, paymentMethod } = parsed.data;
    const { order, data, snapshot } = await readyOrder(req, orderId);
    if (order.status === "paid" || order.status === "signed") return json({ paid: true, orderRef: orderId });
    const { product, quote: priced } = snapshot; const lang = data.lang; const it = lang === "it";
    if (paymentMethod === "on_site" && product.code !== "postal") return json({ error: "invalid-payment-method" }, 400);
    const copy = copyFor(product.code, lang); const bank = bankTransfer(lang, product.code);
    const methods = { stripe: "Stripe", paypal: "PayPal", sumup: "SumUp", bank_transfer: it ? "Bonifico Bancario" : "Bank transfer", on_site: it ? "Contanti / Bancomat / Carta di credito (in sede)" : "Cash / debit card / credit card (on site)" };
    const summary = [copy.name, `${it ? "Pratica" : "Reference"}: ${orderId}`, `${copy.months(data.months)} — ${it ? "decorrenza" : "start date"}: ${data.startDate}`, `${data.representativeName} — ${data.email} — ${data.phone}`, ...priced.addonLines.map(line => `${it ? line.titleIt : line.titleEn} × ${line.quantity}: ${formatEur(line.totalCents, lang)} ${it ? "+ IVA" : "+ VAT"}`), `${it ? "Imponibile" : "Net amount"}: ${formatEur(priced.netCents, lang)}`, `${it ? "IVA" : "VAT"} ${product.vatBps / 100}%: ${formatEur(priced.vatCents, lang)}`, `${it ? "Totale" : "Total"}: ${formatEur(priced.totalCents, lang)}`, `${it ? "Pagamento" : "Payment"}: ${methods[paymentMethod]}`].join("\n");
    const bankLines = `${it ? "Intestatario" : "Account holder"}: ${bank.holder}\nIBAN: ${bank.iban}\nBIC/SWIFT: ${bank.bic}\n${it ? "Banca" : "Bank"}: ${bank.bank}\n${it ? "Causale" : "Reason"}: ${bank.reason} — ${orderId}\n${it ? "Importo" : "Amount"}: ${formatEur(priced.totalCents, lang)}`;
    const pdf = Buffer.from(await buildRequestPdf({ data, lang, orderRef: orderId, paymentMethod, product, priced }));
    const attachments = [{ filename: `Richiesta_${product.code}_${orderId.slice(0, 8)}.pdf`, content: pdf, contentType: "application/pdf" }];
    const instructions = paymentMethod === "bank_transfer" ? bankLines : paymentMethod === "on_site" ? (it ? "Pagamento anticipato in sede. Concorda un appuntamento con la reception prima della decorrenza. Nessun deposito cauzionale." : "Payment in advance on site. Arrange a reception appointment before the start date. No security deposit.") : (it ? "Procedi al pagamento online per completare la pratica. Nessun pagamento è confermato finché non viene verificato dal provider." : "Proceed with online payment to complete the application. Payment is not confirmed until verified with the provider.");
    const letter = `${it ? "Gentile" : "Dear"} ${data.representativeName},\n\n${it ? "abbiamo registrato la Sua richiesta. In allegato trova il riepilogo compilato e, per la postale, l’Allegato 1 e le condizioni accettate." : "we have recorded your application. Attached is your completed summary and, for the mailing service, Annex 1 and the accepted terms."}\n\n${summary}\n\n${instructions}\n\n${termsText(product, lang)}\n\n${it ? "L’attivazione è subordinata alla verifica della documentazione e al contratto." : "Activation is subject to document review and agreement."}\nRoma Office Sharing — +39 06 21.11.6268 — info@romaofficesharing.it`;
    const sent = await db.transaction(async tx => {
      const [current] = await tx.select().from(orders).where(eq(orders.id, order.id)).for("update");
      if (current.status === "paid" || current.status === "signed") throw new CustomerError("already-paid", 409);
      let customerSent = !!current.requestEmailSentAt; let adminSent = !!current.adminEmailSentAt;
      if (!customerSent) customerSent = (await sendMail({ to: data.email, subject: `${it ? "Richiesta e dati pagamento" : "Application and payment details"} — ${copy.name}`, text: letter, html: `<div style="font-family:Arial;white-space:pre-wrap;line-height:1.6">${escapeHtml(letter)}</div>`, attachments })).sent;
      if (!adminSent) adminSent = (await sendMail({ to: adminEmail(), subject: `[${orderId.slice(0, 8)}] ${copy.name}`, text: letter, html: `<div style="white-space:pre-wrap">${escapeHtml(letter)}</div>`, attachments })).sent;
      await tx.update(orders).set({ status: "filled", paymentMethod, updatedAt: new Date(), requestEmailSentAt: customerSent ? current.requestEmailSentAt || new Date() : null, adminEmailSentAt: adminSent ? current.adminEmailSentAt || new Date() : null }).where(eq(orders.id, order.id));
      return { customerSent, adminSent };
    });
    const checkout = ["stripe", "paypal", "sumup"].includes(paymentMethod) ? await checkoutOrder(req, orderId, paymentMethod as "stripe" | "paypal" | "sumup") : {};
    return json({ paymentMethod, orderRef: orderId, emailSent: sent.customerSent, adminMailSent: sent.adminSent, totalCents: priced.totalCents, pdfBase64: pdf.toString("base64"), bankTransferDetails: paymentMethod === "bank_transfer" ? bankLines : undefined,
      message: sent.customerSent ? (it ? "La richiesta è registrata e l’email è stata inviata. Controlla la tua casella di posta." : "Your application is recorded and the email has been sent. Please check your inbox.") : (it ? "La richiesta è registrata, ma l’email non è stata inviata. Scarica il riepilogo e contatta la reception." : "Your application is recorded, but the email was not sent. Download the summary and contact reception."), ...checkout });
  } catch (error) {
    if (error instanceof CustomerError) return json({ error: error.code }, error.status);
    console.error("Request finalization failed", error instanceof Error ? error.name : "UnknownError");
    return json({ error: "finalize-failed" }, 400);
  }
}
