import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { copyFor, formatEur, offerActive, validity, type ProductOffer } from "./pricing";
import { additionalNote, termsText } from "./offer-terms";
import { adminEmail, type MailPayload } from "./mailer";
export const MODULE_FILENAME = "Modulo_Richiesta_Domiciliazione_ns.pdf";
export const standardOfferSchema = z.object({
  requestId: z.string().uuid(), service: z.enum(["legal_unit", "postal"]), lang: z.enum(["it", "en"]),
  title: z.enum(["Mr", "Ms"]), firstName: z.string().trim().min(1).max(100), lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254).transform(s => s.toLowerCase()), consent: z.literal(true), website: z.string().max(0).optional(),
});
export type StandardOfferInput = z.infer<typeof standardOfferSchema>;
export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
export async function readOriginalRequestModule() {
  // This is a fixed local asset. No user-supplied path, remote fetch, generated fallback,
  // PDF stamping, metadata rewrite or translated replacement is permitted.
  const bytes = await readFile(join(process.cwd(), "public", "Modulo_Richiesta_Domiciliazione_ns.pdf"));
  if (bytes.subarray(0, 5).toString() !== "%PDF-" || bytes.length > 20 * 1024 * 1024) throw new Error("Invalid original request module");
  return bytes;
}
export function buildStandardOfferEmail(input: StandardOfferInput, product: ProductOffer, originalModule: Buffer): MailPayload {
  const { lang } = input; const it = lang === "it"; const copy = copyFor(product.code, lang); const active = offerActive(product);
  const rows = product.tiers.map(tier => `${copy.months(tier.months)}: ${it ? "tariffa" : "standard rate"} ${formatEur(tier.listCents, lang)} ${it ? "+ IVA" : "+ VAT"}${tier.offerCents !== null && active ? ` — ${it ? "offerta" : "offer"} ${formatEur(tier.offerCents, lang)} ${it ? "+ IVA" : "+ VAT"}${tier.newActivation ? " (*)" : ""}` : ""}`).join("\n");
  const greeting = it ? `Gentile ${input.title} ${input.firstName} ${input.lastName},` : `Dear ${input.title} ${input.firstName} ${input.lastName},`;
  const text = [greeting, "", it ? "Come richiesto, Le inviamo la nostra offerta standard, senza impegno di acquisto." : "As requested, please find our standard offer below, with no obligation to purchase.", "", copy.name, copy.description, "", rows, validity(product, lang), additionalNote(product, lang), it ? `Ove non indicato, i costi si intendono IVA ${product.vatBps / 100}% esclusa.` : `Unless stated otherwise, prices exclude ${product.vatBps / 100}% VAT.`, "", termsText(product, lang), "", it ? `In allegato trova ${MODULE_FILENAME}, il modulo originale da restituire compilato a info@romaofficesharing.it. Ricevuto il modulo, Le invieremo il contratto e i dati per il pagamento.` : `Attached is ${MODULE_FILENAME}, the original form to complete and return to info@romaofficesharing.it. Once we receive it, we will send the agreement and payment details.`, "", "ROMA OFFICESHARING", "Cube Engineering s.r.l.", "Via Venti Settembre, 118 int.1 — 00187 Roma", "+39 06 21.11.6268 · info@romaofficesharing.it", it ? "Privacy e revoca del consenso: cubeng@pec.it — +39 06 21116268" : "Privacy and consent withdrawal: cubeng@pec.it — +39 06 21116268"].join("\n");
  return {
    to: input.email, bcc: adminEmail(), subject: `${it ? "Offerta standard" : "Standard offer"} — ${copy.name} | Roma Office Sharing`, text,
    html: `<div style="font-family:Arial,sans-serif;max-width:700px;color:#183229;line-height:1.65"><p style="font-size:21px"><strong style="color:#7f7f7f">ROMA</strong> <strong style="color:#f97300">OFFICESHARING</strong></p><h1 style="font-size:23px">${escapeHtml(copy.name)}</h1><div style="white-space:pre-wrap">${escapeHtml(text)}</div></div>`,
    attachments: [{ filename: MODULE_FILENAME, content: originalModule, contentType: "application/pdf" }],
  };
}
