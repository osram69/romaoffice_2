import test from "node:test";
import assert from "node:assert/strict";
import { lowerEmail } from "@/lib/email-format";
import { contractDataSchema, emptyContract } from "@/lib/contract-data";
import { requestSchema } from "@/lib/request";

test("lowerEmail lowercases and trims", () => {
  assert.equal(lowerEmail("  Mario.Rossi@Studio.IT "), "mario.rossi@studio.it");
});

test("every email in the contract draft is stored lowercase", () => {
  const out = contractDataSchema.parse({ ...emptyContract(), pec: "Societa@PEC.it", repEmail: "Mario.Rossi@Mail.IT", emailScansioni: "INFO@Studio.it" });
  assert.equal(out.pec, "societa@pec.it");
  assert.equal(out.repEmail, "mario.rossi@mail.it");
  assert.equal(out.emailScansioni, "info@studio.it");
});

test("the online request lowercases the email and the PEC and formats the representative name", () => {
  const hex = "a".repeat(64);
  const parsed = requestSchema.safeParse({
    catalogVersion: hex, termsVersion: hex, termsAccepted: true, companyName: "Acme Srl", companyExists: true,
    companyPec: "Acme@PEC.IT", representativeName: "MARIO ROSSI", representativeTaxCode: "RSSMRA80A01H501U",
    email: "Mario.ROSSI@Gmail.com", phone: "+393331234567", months: 12, startDate: new Date(Date.now() + 7 * 864e5).toLocaleDateString("en-CA", { timeZone: "Europe/Rome" }), consent: true,
  });
  if (!parsed.success) { assert.fail(JSON.stringify(parsed.error.issues)); }
  assert.equal(parsed.data.email, "mario.rossi@gmail.com");
  assert.equal(parsed.data.companyPec, "acme@pec.it");
  assert.equal(parsed.data.representativeName, "Mario Rossi");
});
