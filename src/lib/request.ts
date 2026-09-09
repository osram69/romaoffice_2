import { z } from "zod";
export const normalizePhone = (value: string) => value.trim().replace(/^00/, "+").replace(/[\s.()\/-]/g, "");
export const requestSchema = z.object({
  lang: z.enum(["it", "en"]).default("it"), service: z.enum(["legal_unit", "postal"]).default("legal_unit"),
  orderId: z.string().uuid().optional(), catalogVersion: z.string().regex(/^[a-f\d]{64}$/), termsVersion: z.string().regex(/^[a-f\d]{64}$/), termsAccepted: z.boolean().default(false),
  companyExists: z.boolean().default(false), companyName: z.string().trim().max(200).default(""),
  companyVat: z.string().trim().max(30).default(""), companyTaxCode: z.string().trim().max(30).default(""),
  companyAddress: z.string().trim().max(240).default(""), companyRegister: z.string().trim().max(120).default(""),
  representativeName: z.string().trim().min(2).max(200), representativeRole: z.string().trim().max(80).default(""), representativeTaxCode: z.string().trim().max(40).default(""),
  email: z.string().trim().email().max(254).transform(s => s.toLowerCase()),
  phone: z.string().max(40).transform(normalizePhone).refine(s => /^\+[1-9]\d{7,14}$/.test(s), "invalid-phone"),
  months: z.union([z.literal(3), z.literal(6), z.literal(12), z.literal(24), z.literal(36), z.literal(48)]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), newActivation: z.boolean().default(false), additionalDomiciliation: z.boolean().default(false),
  addons: z.array(z.object({ code: z.string().max(50), quantity: z.number().int().min(1).max(5) })).max(3).default([]),
  consent: z.literal(true), website: z.string().max(0).optional(),
}).superRefine((v, ctx) => {
  const date = new Date(`${v.startDate}T12:00:00Z`); const now = new Date();
  const today = now.toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });
  const max = new Date(now); max.setFullYear(max.getFullYear() + 2);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== v.startDate || v.startDate < today || date > max) ctx.addIssue({ code: "custom", path: ["startDate"], message: "invalid-date" });
  if (v.companyExists && v.companyName.length < 2) ctx.addIssue({ code: "custom", path: ["companyName"], message: "required" });
  if (v.service === "postal" && (![6, 12].includes(v.months) || !v.termsAccepted || v.newActivation)) ctx.addIssue({ code: "custom", path: ["termsAccepted"], message: "postal-terms-required" });
  if (v.service === "legal_unit" && v.addons.length) ctx.addIssue({ code: "custom", path: ["addons"], message: "invalid-addons" });
});
export type RequestData = z.infer<typeof requestSchema>;
export const paymentMethodSchema = z.enum(["stripe", "paypal", "sumup", "bank_transfer", "on_site"]);
export type PaymentMethodValue = z.infer<typeof paymentMethodSchema>;
