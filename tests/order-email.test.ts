import test from "node:test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { buildConfirmationEmail, type ConfirmationEmailInput } from "@/lib/order-email";

const base: ConfirmationEmailInput = {
  lang: "it", postal: false, serviceName: "Domiciliazione Sede Legale / Unità Locale", shortRef: "SRRPRC-261116-0951-DSL", durationText: "3 mesi", startDate: "2026-11-18",
  representativeName: "Patrick Serra", representativeTaxCode: "SRRPRC69S18Z133X", email: "patrick.serra@gmail.com", phone: "+393282240726",
  addonLines: [], net: "0,95 €", vat: "0,21 €", vatPercent: "22%", total: "1,16 €", paymentMethod: "stripe", paymentLabel: "Stripe", account: null, areaUrl: "https://www.romaofficesharing.it/area-clienti.html",
};
const bank = { holder: "Cube Engineering s.r.l.", iban: "IT00X0000000000000000000000", bic: "ABCDITMM", bank: "Banca Esempio", causale: "Domiciliazione - Patrick Serra - Rif. SRRPRC-261116-0951-DSL", amount: "1,16 €" };

test("dates are written day first and the sample order reads cleanly", () => {
  const mail = buildConfirmationEmail(base);
  assert.match(mail.text, /decorrenza: 18\/11\/2026/);
  assert.match(mail.html, /18\/11\/2026/);
  assert.match(mail.html, /Pagamento confermato/);
  assert.doesNotMatch(mail.text, /per la postale/);
});

test("the Area Clienti password appears only in the customer copy", () => {
  const account = { alreadyHadAccess: false, email: "patrick.serra@gmail.com", password: "Zx9!kLm2#Qw4Tp", phone: "+393282240726" };
  const customer = buildConfirmationEmail({ ...base, account });
  const admin = buildConfirmationEmail({ ...base, account: null });
  assert.ok(customer.html.includes("Zx9!kLm2#Qw4Tp") && customer.text.includes("Zx9!kLm2#Qw4Tp"));
  assert.ok(!admin.html.includes("Zx9!kLm2#Qw4Tp") && !admin.text.includes("Zx9!kLm2#Qw4Tp"));
});

test("bank transfer shows the account details; user-supplied text is escaped", () => {
  const mail = buildConfirmationEmail({ ...base, paymentMethod: "bank_transfer", paymentLabel: "Bonifico Bancario", bank, representativeName: "<script>alert(1)</script> Rossi" });
  assert.match(mail.html, /IT00X0000000000000000000000/);
  assert.match(mail.html, /In attesa del bonifico/);
  assert.doesNotMatch(mail.html, /<script>/);
});

test("the postal service mentions Annex 1; English copy is available", () => {
  assert.match(buildConfirmationEmail({ ...base, postal: true }).text, /Allegato 1/);
  assert.match(buildConfirmationEmail({ ...base, lang: "en" }).html, /Request received/);
});

test("write samples for a visual check", { skip: !process.env.EMAIL_SAMPLES_DIR }, async () => {
  const dir = process.env.EMAIL_SAMPLES_DIR!;
  await writeFile(`${dir}/mail_online.html`, buildConfirmationEmail({ ...base, account: { alreadyHadAccess: true, email: base.email, password: null, phone: base.phone } }).html);
  await writeFile(`${dir}/mail_bonifico.html`, buildConfirmationEmail({ ...base, paymentMethod: "bank_transfer", paymentLabel: "Bonifico Bancario", bank, addonLines: [{ label: "Segreteria Virtuale × 1", amount: "120,00 € + IVA" }], account: { alreadyHadAccess: false, email: base.email, password: "Zx9!kLm2#Qw4Tp", phone: base.phone } }).html);
  await writeFile(`${dir}/mail_admin.html`, buildConfirmationEmail({ ...base, account: null }).html);
});
