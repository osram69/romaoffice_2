import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { adminEmail, sendMail } from "./mailer";
import { bankTransfer, formatEur, copyFor } from "./pricing";
import { buildRequestPdf, requestPdfFilename } from "./pdf";
import { buildConfirmationEmail } from "./order-email";
import { shortOrderRef } from "./order-ref";
import { provisionCustomerAccount, type CustomerAccount } from "./order-account";
import { BASE_URL } from "./site";
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

  // Area Clienti access for online legal-address orders (see order-account.ts). Only the customer's copy of the email
  // carries the temporary password; and only while that email has not gone out yet, so a retry never changes it twice.
  let account: CustomerAccount | null = null;
  if (!order.requestEmailSentAt) {
    try { account = await provisionCustomerAccount(order, data, snapshot); }
    catch (error) { console.error("Area Clienti provisioning failed for order", orderId, error instanceof Error ? error.message : error); }
  }
  const areaUrl = `${BASE_URL}${it ? "/area-clienti.html" : "/en/customer-area.html"}`;

  // One layout (order-email.ts) for both copies: the customer's with the Area Clienti access, yours without it.
  const common = {
    lang, postal: product.code === "postal", serviceName: copy.name, shortRef, durationText: copy.months(data.months), startDate: data.startDate,
    representativeName: data.representativeName, representativeTaxCode: data.representativeTaxCode, email: data.email, phone: data.phone,
    companyPec: data.companyPec, companySdi: data.companySdi,
    addonLines: priced.addonLines.map(line => ({ label: `${it ? line.titleIt : line.titleEn} × ${line.quantity}`, amount: `${formatEur(line.totalCents, lang)} ${it ? "+ IVA" : "+ VAT"}` })),
    net: formatEur(priced.netCents, lang), vat: formatEur(priced.vatCents, lang), vatPercent: `${product.vatBps / 100}%`, total: formatEur(priced.totalCents, lang),
    paymentMethod, paymentLabel: methods[paymentMethod] || paymentMethod,
    bank: paymentMethod === "bank_transfer" ? bankDetails : undefined,
    areaUrl,
  };
  // "Domiciliazione aggiuntiva": both copies name the capofila; the admin copy also says how the check went.
  const parent = snapshot.parentCheck;
  const adminNotice = !parent ? undefined : parent.status === "verified"
    ? { tone: "ok" as const, title: "Domiciliazione aggiuntiva — capofila verificata", lines: [`Capofila dichiarata: ${parent.declaredName}; referente: ${parent.declaredContact}.`, `Corrisponde a «${parent.capofilaName}» (nome, referente e contatti dell'acquirente coincidono con l'anagrafica).`] }
    : parent.reason === "first-name-differs"
      ? { tone: "warn" as const, title: "ATTENZIONE — domiciliazione aggiuntiva DA VERIFICARE", lines: [`Capofila dichiarata: ${parent.declaredName}; referente: ${parent.declaredContact}.`, `Il COGNOME del referente coincide con quello di «${parent.capofilaName}» ma il NOME no: potrebbe essere un'altra persona (parente, collega) o qualcuno che ha letto il registro imprese. Controlla prima di concedere lo sconto.`] }
      : { tone: "warn" as const, title: "ATTENZIONE — domiciliazione aggiuntiva da verificare", lines: [`Capofila dichiarata: ${parent.declaredName}; referente: ${parent.declaredContact}.`, `Nome e referente coincidono con «${parent.capofilaName}», ma l'email e il telefono dell'acquirente NON risultano in anagrafica: controlla che il richiedente sia davvero il referente prima di concedere lo sconto (le informazioni su società e amministratore sono pubbliche nel registro imprese).`] };
  const parentCompany = data.additionalDomiciliation && data.parentCompanyName ? data.parentCompanyName : undefined;
  const customerMail = buildConfirmationEmail({ ...common, parentCompany, account });
  const adminMail = buildConfirmationEmail({ ...common, parentCompany, adminNotice, account: null });

  const pdf = Buffer.from(await buildRequestPdf({ data, lang, shortRef, paymentMethod, product, priced }));
  const attachments = [{ filename: requestPdfFilename(product.code, lang, orderId), content: pdf, contentType: "application/pdf" }];

  const sent = await db.transaction(async tx => {
    const [current] = await tx.select().from(orders).where(eq(orders.id, order.id)).for("update");
    let customerSent = !!current.requestEmailSentAt; let adminSent = !!current.adminEmailSentAt;
    if (!customerSent) customerSent = (await sendMail({ to: data.email, subject: `${it ? "Richiesta e dati pagamento" : "Application and payment details"} — ${copy.name}`, text: customerMail.text, html: customerMail.html, attachments })).sent;
    if (!adminSent) adminSent = (await sendMail({ to: adminEmail(), subject: `[${shortRef}] ${copy.name} ${data.companyName.replace(/\s+/g, " ").trim()}`, text: adminMail.text, html: adminMail.html, attachments })).sent;
    await tx.update(orders).set({ requestEmailSentAt: customerSent ? current.requestEmailSentAt || new Date() : null, adminEmailSentAt: adminSent ? current.adminEmailSentAt || new Date() : null }).where(eq(orders.id, order.id));
    return { customerSent, adminSent };
  });
  return { ...sent, pdf, shortRef, bankDetails: paymentMethod === "bank_transfer" ? bankDetails : undefined };
}
