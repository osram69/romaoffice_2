import test from "node:test";
import assert from "node:assert/strict";
import { manualRequestSchema, buildManualRequestEmail } from "@/lib/manual-request";
import type { ProductOffer } from "@/lib/pricing";

const future = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
const base = {
  service: "legal_unit", lang: "it", companyName: "Acme Srl", legalForm: "srl_spa_snc", companyExists: false,
  representativeName: "mario rossi", birthPlace: "Roma", birthDate: "1985-12-10",
  residenceAddress: "Via Roma 1", residenceCity: "Roma", residenceCap: "00185", residenceProvince: "rm",
  representativeTaxCode: "RSSMRA85T10A562S", email: "Mario@Example.com", representativePhone: "333 1234567",
  months: "12", startDate: future, consent: true,
};
const exists = {
  ...base, companyExists: true, companyAddress: "Via Milano 2", companyCity: "Roma", companyCap: "00184", companyProvince: "RM",
  companyTaxCode: "12345678901", companyVat: "12345678901", companyRegister: "RM-123456", companyEmail: "info@acme.it", companyPec: "acme@pec.it", companySdi: "",
};
const parse = (o: object) => manualRequestSchema.safeParse(o);
const failedPaths = (o: object) => { const r = parse(o); return r.success ? [] : r.error.issues.map(i => String(i.path[0])); };

test("accepts a complete company being formed and normalizes name, email, phone, province", () => {
  const r = parse({ ...base, representativePhone: "+39 333 1234567" });
  assert.equal(r.success, true); if (!r.success) return;
  assert.equal(r.data.email, "mario@example.com"); assert.equal(r.data.representativePhone, "+393331234567"); assert.equal(r.data.residenceProvince, "RM");
});

test("accepts a complete constituted company", () => {
  assert.equal(parse({ ...exists, representativePhone: "+393331234567" }).success, true);
});

test("rejects phone without international prefix", () => {
  assert.ok(failedPaths({ ...base, representativePhone: "333 1234567" }).includes("representativePhone"));
});

test("rejects constituted company without PEC and SDI", () => {
  assert.ok(failedPaths({ ...exists, companyPec: "", companySdi: "", representativePhone: "+393331234567" }).includes("companyPec"));
});

test("accepts constituted company with SDI only", () => {
  assert.equal(parse({ ...exists, companyPec: "", companySdi: "ABC1234", representativePhone: "+393331234567" }).success, true);
});

test("rejects constituted company missing its address and register", () => {
  const paths = failedPaths({ ...exists, companyAddress: "", companyRegister: "", representativePhone: "+393331234567" });
  assert.ok(paths.includes("companyAddress")); assert.ok(paths.includes("companyRegister"));
});

test("company fields are not required while the company is being formed", () => {
  assert.equal(parse({ ...base, representativePhone: "+393331234567" }).success, true);
});

test("smart contracts only for companies being formed", () => {
  const phone = { representativePhone: "+393331234567" };
  assert.equal(parse({ ...base, ...phone, months: "smart3x24" }).success, true);
  assert.ok(failedPaths({ ...exists, ...phone, months: "smart6x24" }).includes("months"));
});

test("postal requires an existing company and 6 or 12 months", () => {
  const phone = { representativePhone: "+393331234567" };
  assert.ok(failedPaths({ ...base, ...phone, service: "postal", months: "12" }).includes("companyExists"));
  assert.ok(failedPaths({ ...exists, ...phone, service: "postal", months: "24" }).includes("months"));
  assert.equal(parse({ ...exists, ...phone, service: "postal", months: "12" }).success, true);
});

test("rejects past start date, future birth date and missing consent", () => {
  const phone = { representativePhone: "+393331234567" };
  assert.ok(failedPaths({ ...base, ...phone, startDate: "2020-01-01" }).includes("startDate"));
  assert.ok(failedPaths({ ...base, ...phone, birthDate: "2999-01-01" }).includes("birthDate"));
  assert.ok(failedPaths({ ...base, ...phone, consent: false }).includes("consent"));
});

test("the confirmation email lists the data and the SMS verification time", () => {
  const product = { code: "legal_unit", vatBps: 2200, tiers: [{ months: 12, listCents: 60000, offerCents: null, newActivation: false, additionalDomiciliation: false }], newActivationDiscountEnabled: false, additionalDiscountEnabled: false, smart3x24Active: true, smart6x24Active: true } as unknown as ProductOffer;
  const parsed = parse({ ...exists, representativePhone: "+393331234567" }); assert.equal(parsed.success, true); if (!parsed.success) return;
  const mail = buildManualRequestEmail(parsed.data, product, new Date("2026-11-28T10:30:00Z"));
  assert.equal(mail.to, "mario@example.com");
  for (const piece of ["Acme Srl", "+393331234567", "RSSMRA85T10A562S", "acme@pec.it", "SMS", "28/11/2026"]) assert.ok(mail.text.includes(piece), piece);
});
