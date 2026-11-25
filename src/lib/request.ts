import { z } from "zod";
import { isValidTaxCode } from "./codice-fiscale";
import { formatPersonName, splitPersonName } from "./person-name";
import { lowerEmail } from "./email-format";
/** "Via Roma 1, 00185 Roma, Italia": the current registered address as one line, leaving out whatever was not filled in
 * (orders placed before the postal code, city and country fields existed only have the street part). */
export function formatCompanyAddress(d: { companyAddress?: string; companyCap?: string; companyCity?: string; companyCountry?: string }): string {
  const clean = (value?: string) => (value ?? "").trim();
  const cityLine = [clean(d.companyCap), clean(d.companyCity)].filter(Boolean).join(" ");
  return [clean(d.companyAddress), cityLine, clean(d.companyCountry)].filter(Boolean).join(", ");
}
const fullName = (first: string, last: string, whole: string) => (first && last ? `${first} ${last}` : whole || [first, last].filter(Boolean).join(" ")).trim();
/** first name, surname and full name, filling whichever the caller did not send. */
function personParts(first: string, last: string, whole: string) {
  const full = fullName(first, last, whole);
  return first && last ? { firstName: first, lastName: last, fullName: full } : { ...splitPersonName(full), fullName: full };
}
export const normalizePhone = (value: string) => value.trim().replace(/^00/, "+").replace(/[\s.()\/-]/g, "");
export const requestSchema = z.object({
  lang: z.enum(["it", "en"]).default("it"), service: z.enum(["legal_unit", "postal"]).default("legal_unit"),
  orderId: z.string().uuid().optional(), catalogVersion: z.string().regex(/^[a-f\d]{64}$/), termsVersion: z.string().regex(/^[a-f\d]{64}$/), termsAccepted: z.boolean().default(false),
  companyExists: z.boolean().default(false), companyName: z.string().trim().min(2).max(200),
  companyVat: z.string().trim().max(30).default(""), companyTaxCode: z.string().trim().max(30).default(""),
  companyAddress: z.string().trim().max(240).default(""), companyCap: z.string().trim().max(10).default(""), companyCity: z.string().trim().max(80).default(""), companyCountry: z.string().trim().max(60).default(""), companyRegister: z.string().trim().max(120).default(""),
  companyPec: z.string().max(254).transform(lowerEmail).default(""), companySdi: z.string().trim().max(7).default(""),
  // The form sends first name and surname separately (the capofila check compares them one by one); the full
  // name stays available as representativeName for the PDF, the emails and the records. A caller that sends only
  // representativeName still works: it is split at the first word.
  representativeFirstName: z.string().trim().max(100).transform(formatPersonName).default(""), representativeLastName: z.string().trim().max(100).transform(formatPersonName).default(""),
  representativeName: z.string().trim().max(200).transform(formatPersonName).default(""), representativeRole: z.string().trim().max(80).default(""),
  representativeTaxCode: z.string().trim().min(1).max(40).refine(isValidTaxCode, "invalid-tax-code"),
  email: z.string().trim().email().max(254).transform(lowerEmail),
  phone: z.string().max(40).transform(normalizePhone).refine(s => /^\+[1-9]\d{7,14}$/.test(s), "invalid-phone"),
  months: z.union([z.literal(3), z.literal(6), z.literal(12), z.literal(24), z.literal(36), z.literal(48)]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), newActivation: z.boolean().default(false), additionalDomiciliation: z.boolean().default(false),
  // "Domiciliazione aggiuntiva": the buyer types the name of the capofila (already domiciled with us) and, if it is not the buyer, its referente.
  parentCompanyName: z.string().trim().max(200).default(""), parentContactSame: z.boolean().default(true), parentContactName: z.string().trim().max(200).transform(formatPersonName).default(""),
  parentContactFirstName: z.string().trim().max(100).transform(formatPersonName).default(""), parentContactLastName: z.string().trim().max(100).transform(formatPersonName).default(""),
  addons: z.array(z.object({ code: z.string().max(50), quantity: z.number().int().min(1).max(5) })).max(3).default([]),
  // Optional discount code from the price summary: re-checked on the server, never trusted as typed.
  discountCode: z.string().trim().max(60).transform(v => v.toUpperCase().replace(/\s+/g, "")).default(""),
  consent: z.literal(true), website: z.string().max(0).optional(),
}).superRefine((v, ctx) => {
  if (fullName(v.representativeFirstName, v.representativeLastName, v.representativeName).length < 2) ctx.addIssue({ code: "custom", path: ["representativeName"], message: "name-required" });
  const date = new Date(`${v.startDate}T12:00:00Z`); const now = new Date();
  const today = now.toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });
  const max = new Date(now); max.setFullYear(max.getFullYear() + 2);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== v.startDate || v.startDate < today || date > max) ctx.addIssue({ code: "custom", path: ["startDate"], message: "invalid-date" });
  if (v.service === "postal" && (![6, 12].includes(v.months) || v.newActivation)) ctx.addIssue({ code: "custom", path: ["months"], message: "postal-duration-invalid" });
  if (!v.termsAccepted) ctx.addIssue({ code: "custom", path: ["termsAccepted"], message: "terms-required" });
  if (v.service === "postal" && !isValidTaxCode(v.companyTaxCode)) ctx.addIssue({ code: "custom", path: ["companyTaxCode"], message: "invalid-tax-code" });
  // An already-existing company must give a way to be invoiced/notified: a PEC or an SDI code (either one is enough; with an SDI code the PEC is optional).
  const pecOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.companyPec); const sdiOk = /^[A-Za-z0-9]{7}$/.test(v.companySdi);
  if (v.service === "postal" || v.companyExists) {
    if (!pecOk && !sdiOk) ctx.addIssue({ code: "custom", path: ["companyPec"], message: "pec-or-sdi-required" });
  }
  if (v.companyPec && !pecOk) ctx.addIssue({ code: "custom", path: ["companyPec"], message: "invalid-pec" });
  if (v.companySdi && !sdiOk) ctx.addIssue({ code: "custom", path: ["companySdi"], message: "invalid-sdi" });
  if (v.service === "legal_unit" && v.additionalDomiciliation) {
    if (v.parentCompanyName.length < 2) ctx.addIssue({ code: "custom", path: ["parentCompanyName"], message: "parent-required" });
    if (!v.parentContactSame && fullName(v.parentContactFirstName, v.parentContactLastName, v.parentContactName).length < 2) ctx.addIssue({ code: "custom", path: ["parentContactName"], message: "parent-contact-required" });
  }
  if (v.service === "legal_unit" && v.addons.length) ctx.addIssue({ code: "custom", path: ["addons"], message: "invalid-addons" });
}).transform(v => {
  const rep = personParts(v.representativeFirstName, v.representativeLastName, v.representativeName);
  const parent = personParts(v.parentContactFirstName, v.parentContactLastName, v.parentContactName);
  return { ...v, representativeFirstName: rep.firstName, representativeLastName: rep.lastName, representativeName: rep.fullName, parentContactFirstName: parent.firstName, parentContactLastName: parent.lastName, parentContactName: parent.fullName };
});
export type RequestData = z.infer<typeof requestSchema>;
export const paymentMethodSchema = z.enum(["stripe", "paypal", "sumup", "bank_transfer", "on_site"]);
export type PaymentMethodValue = z.infer<typeof paymentMethodSchema>;
