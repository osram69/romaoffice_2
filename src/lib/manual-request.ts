import { z } from "zod";
import { copyFor, formatEur, quote, type ProductOffer } from "./pricing";
import { adminEmail, type MailPayload } from "./mailer";
import { normalizePhone } from "./request";
import { isValidTaxCode } from "./codice-fiscale";
import { formatPersonName } from "./person-name";
import { lowerEmail } from "./email-format";

export const LEGAL_FORMS = ["srl_spa_snc", "ditta_individuale", "associazione", "altro"] as const;
const optional = (max: number) => z.string().trim().max(max).default("");
const province = z.string().trim().max(2).transform(s => s.toUpperCase()).default("");
const rome = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });

/** Online version of the "Modulo richiesta domiciliazione sede legale". The mobile number is verified by SMS before the request counts. */
export const manualRequestSchema = z.object({
  service: z.enum(["legal_unit", "postal"]), lang: z.enum(["it", "en"]),
  companyName: z.string().trim().min(2).max(200), legalForm: z.enum(LEGAL_FORMS), companyExists: z.boolean(),
  // Only for a company that already exists ("se la società è già costituita").
  companyAddress: optional(240), companyCity: optional(80), companyCap: optional(10), companyProvince: province,
  companyTaxCode: optional(30), companyVat: optional(30), companyRegister: optional(120), companyEmail: z.string().max(254).transform(lowerEmail).default(""),
  companyPec: z.string().max(254).transform(lowerEmail).default(""), companySdi: optional(7),
  // Referente / amministratore: everything is mandatory.
  representativeName: z.string().trim().min(2).max(150).transform(formatPersonName),
  birthPlace: z.string().trim().min(1).max(100), birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  residenceAddress: z.string().trim().min(1).max(240), residenceCity: z.string().trim().min(1).max(80),
  residenceCap: z.string().trim().regex(/^\d{5}$/), residenceProvince: z.string().trim().length(2).transform(s => s.toUpperCase()),
  representativeTaxCode: z.string().trim().min(1).max(40).refine(isValidTaxCode, "invalid-tax-code"),
  email: z.string().trim().email().max(254).transform(lowerEmail),
  representativePhone: z.string().max(40).transform(normalizePhone).refine(s => /^\+[1-9]\d{7,14}$/.test(s), "invalid-phone"),
  months: z.union([z.coerce.number().int().positive(), z.literal("smart3x24"), z.literal("smart6x24")]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), notes: z.string().trim().max(1000).optional().default(""),
  consent: z.literal(true), website: z.string().max(0).optional(),
}).superRefine((v, ctx) => {
  const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  const today = rome(new Date());
  if (v.startDate < today) issue("startDate", "invalid-date");
  const birth = new Date(`${v.birthDate}T12:00:00Z`);
  if (!Number.isFinite(birth.getTime()) || birth.toISOString().slice(0, 10) !== v.birthDate || v.birthDate >= today) issue("birthDate", "invalid-date");
  if (v.service === "postal" && !v.companyExists) issue("companyExists", "postal-needs-existing");
  if (v.service === "postal" && ![6, 12].includes(v.months as number)) issue("months", "postal-duration-invalid");
  if (typeof v.months === "number" && ![3, 6, 12, 24, 36, 48].includes(v.months)) issue("months", "invalid-duration");
  if (typeof v.months === "string" && (v.service !== "legal_unit" || v.companyExists)) issue("months", "smart-only-new-company");
  if (!v.companyExists) return;
  const required: [string, string][] = [["companyAddress", v.companyAddress], ["companyCity", v.companyCity], ["companyRegister", v.companyRegister], ["companyEmail", v.companyEmail]];
  for (const [path, value] of required) if (!value) issue(path, "required");
  if (!/^\d{5}$/.test(v.companyCap)) issue("companyCap", "invalid-cap");
  if (!/^[A-Z]{2}$/.test(v.companyProvince)) issue("companyProvince", "invalid-province");
  if (!/^\d{11}$/.test(v.companyTaxCode) && !isValidTaxCode(v.companyTaxCode)) issue("companyTaxCode", "invalid-tax-code");
  if (!/^(IT)?\d{11}$/i.test(v.companyVat)) issue("companyVat", "invalid-vat");
  if (v.companyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.companyEmail)) issue("companyEmail", "invalid-email");
  const pecOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.companyPec); const sdiOk = /^[A-Za-z0-9]{7}$/.test(v.companySdi);
  if (!pecOk && !sdiOk) issue("companyPec", "pec-or-sdi-required");
  if (v.companyPec && !pecOk) issue("companyPec", "invalid-pec");
  if (v.companySdi && !sdiOk) issue("companySdi", "invalid-sdi");
});
export type ManualRequestInput = z.infer<typeof manualRequestSchema>;

const FORM_LABELS: Record<(typeof LEGAL_FORMS)[number], [string, string]> = {
  srl_spa_snc: ["S.r.l./S.p.a./S.n.c.", "S.r.l./S.p.a./S.n.c."], ditta_individuale: ["Ditta individuale", "Sole proprietorship"], associazione: ["Associazione", "Association"], altro: ["Altro", "Other"],
};

export function buildManualRequestEmail(input: ManualRequestInput, product: ProductOffer, verifiedAt: Date): MailPayload {
  const { lang } = input; const it = lang === "it"; const copy = copyFor(product.code, lang);
  let rate: string;
  if (input.months === "smart3x24") rate = "Smart 3+24";
  else if (input.months === "smart6x24") rate = "Smart 6+24";
  else {
    const priced = quote(product, { months: input.months });
    rate = priced ? `${copy.months(priced.months)}: ${formatEur(priced.netCents, lang)} ${it ? "+ IVA" : "+ VAT"}` : copy.months(input.months);
  }
  const when = verifiedAt.toLocaleString(it ? "it-IT" : "en-GB", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const yes = it ? "Sì" : "Yes";
  const row = (label: string, value: string): [string, string] => [label, value];
  const company: [string, string][] = input.companyExists ? [
    row(it ? "Sede" : "Registered address", `${input.companyAddress}, ${input.companyCap} ${input.companyCity} (${input.companyProvince})`),
    row(it ? "Codice Fiscale società" : "Company tax code", input.companyTaxCode), row(it ? "Partita IVA" : "VAT number", input.companyVat),
    row(it ? "Reg. Imprese" : "Business register", input.companyRegister), row(it ? "Email società" : "Company email", input.companyEmail),
    ...(input.companyPec ? [row("PEC", input.companyPec)] : []), ...(input.companySdi ? [row(it ? "Codice SDI" : "SDI code", input.companySdi)] : []),
  ] : [];
  const rows: [string, string][] = [
    row(it ? "Servizio" : "Service", copy.name),
    row(it ? "Denominazione società" : "Company name", input.companyName), row(it ? "Forma giuridica" : "Legal form", FORM_LABELS[input.legalForm][it ? 0 : 1]),
    row(it ? "Società già costituita" : "Company already incorporated", input.companyExists ? yes : (it ? "No (costituenda)" : "No (being formed)")),
    ...company,
    row(it ? "Referente/Amministratore" : "Representative/Administrator", input.representativeName),
    row(it ? "Nato/a a" : "Born in", `${input.birthPlace}, ${input.birthDate}`),
    row(it ? "Residenza" : "Home address", `${input.residenceAddress}, ${input.residenceCap} ${input.residenceCity} (${input.residenceProvince})`),
    row(it ? "Codice Fiscale referente" : "Representative's tax code", input.representativeTaxCode),
    row("Email", input.email), row(it ? "Cellulare" : "Mobile", input.representativePhone),
    row(it ? "Contratto" : "Agreement", rate), row(it ? "Data inizio contratto" : "Start date", input.startDate),
    ...(input.notes ? [row(it ? "Note" : "Notes", input.notes)] : []),
    row(it ? "Verifica SMS" : "SMS verification", it ? `Cellulare verificato via SMS il ${when} (vale come firma dell'invio)` : `Mobile number verified by SMS on ${when} (acts as signature of the request)`),
  ];
  const greeting = it ? `Gentile ${input.representativeName},` : `Dear ${input.representativeName},`;
  const text = [
    greeting, "",
    it ? "Abbiamo ricevuto la Sua richiesta di domiciliazione tramite il modulo online, confermata con il codice inviato via SMS. Nessun pagamento è stato effettuato: prepareremo il contratto e i dati per il pagamento e Le scriveremo a breve a questo stesso indirizzo." : "We received your domiciliation request through the online form, confirmed with the code sent by SMS. No payment has been made: we will prepare the agreement and payment details and write back to you shortly at this address.",
    "", ...rows.map(([label, value]) => `${label}: ${value}`), "",
    "ROMA OFFICESHARING", "Cube Engineering s.r.l.", "Via Venti Settembre, 118 int.1 — 00187 Roma", "+39 06 21.11.6268 · info@romaofficesharing.it",
    it ? "Privacy e revoca del consenso: cubeng@pec.it — +39 06 21116268" : "Privacy and consent withdrawal: cubeng@pec.it — +39 06 21116268",
  ].join("\n");
  return {
    to: input.email, bcc: adminEmail(), subject: `${it ? "Richiesta ricevuta" : "Request received"} — ${copy.name} | Roma Office Sharing`, text,
    html: `<div style="font-family:Arial,sans-serif;max-width:700px;color:#183229;line-height:1.65"><p style="font-size:21px"><strong style="color:#7f7f7f">ROMA</strong> <strong style="color:#f97300">OFFICESHARING</strong></p><div style="white-space:pre-wrap">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div></div>`,
  };
}
