import { z } from "zod";
import { copyFor, formatEur, tierFor, type Lang, type ProductOffer } from "./pricing";
import { adminEmail, type MailPayload } from "./mailer";

export const manualRequestSchema = z.object({
  requestId: z.string().uuid(), service: z.enum(["legal_unit", "postal"]), lang: z.enum(["it", "en"]),
  companyName: z.string().trim().min(1).max(200), vatNumber: z.string().trim().min(1).max(30), taxCode: z.string().trim().min(1).max(30),
  representativeName: z.string().trim().min(1).max(150), email: z.string().trim().email().max(254).transform(s => s.toLowerCase()),
  months: z.coerce.number().int(), notes: z.string().trim().max(1000).optional().default(""),
  consent: z.literal(true), website: z.string().max(0).optional(),
});
export type ManualRequestInput = z.infer<typeof manualRequestSchema>;

export function buildManualRequestEmail(input: ManualRequestInput, product: ProductOffer): MailPayload {
  const { lang } = input; const it = lang === "it"; const copy = copyFor(product.code, lang);
  const tier = tierFor(product, input.months);
  const rate = tier ? `${copy.months(tier.months)}: ${formatEur(tier.offerCents ?? tier.listCents, lang)} ${it ? "+ IVA" : "+ VAT"}` : (it ? "durata non disponibile" : "duration not available");
  const greeting = it ? `Gentile ${input.representativeName},` : `Dear ${input.representativeName},`;
  const rows = [
    [it ? "Denominazione" : "Company name", input.companyName],
    [it ? "Partita IVA" : "VAT number", input.vatNumber],
    [it ? "Codice Fiscale" : "Tax code", input.taxCode],
    [it ? "Rappresentante/Titolare" : "Representative/Owner", input.representativeName],
    [it ? "Servizio" : "Service", copy.name],
    [it ? "Durata/tariffa" : "Duration/rate", rate],
    ["Email", input.email],
    ...(input.notes ? [[it ? "Note" : "Notes", input.notes]] : []),
  ];
  const text = [
    greeting, "",
    it ? "Abbiamo ricevuto la Sua richiesta tramite il modulo online. Nessun pagamento è stato effettuato: prepareremo il contratto e i dati per il pagamento e Le scriveremo a breve a questo stesso indirizzo." : "We received your request through the online form. No payment has been made: we will prepare the agreement and payment details and write back to you shortly at this address.",
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    "ROMA OFFICESHARING", "Cube Engineering s.r.l.", "Via Venti Settembre, 118 int.1 — 00187 Roma", "+39 06 21.11.6268 · info@romaofficesharing.it",
    it ? "Privacy e revoca del consenso: cubeng@pec.it — +39 06 21116268" : "Privacy and consent withdrawal: cubeng@pec.it — +39 06 21116268",
  ].join("\n");
  return {
    to: input.email, bcc: adminEmail(), subject: `${it ? "Richiesta ricevuta" : "Request received"} — ${copy.name} | Roma Office Sharing`, text,
    html: `<div style="font-family:Arial,sans-serif;max-width:700px;color:#183229;line-height:1.65"><p style="font-size:21px"><strong style="color:#7f7f7f">ROMA</strong> <strong style="color:#f97300">OFFICESHARING</strong></p><div style="white-space:pre-wrap">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div></div>`,
  };
}
