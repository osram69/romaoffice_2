import test from "node:test";
import assert from "node:assert/strict";
import { companyNameScore, contactMatches, evaluateParent, samePerson, type ParentCandidate } from "@/lib/parent-company";
import { requestSchema } from "@/lib/request";
import { buildConfirmationEmail } from "@/lib/order-email";

const rossi: ParentCandidate = {
  id: 7, ragioneSociale: "Rossi Consulting S.r.l.", amministratore: "Mario Rossi", personaRif: null,
  emailPosta: "mario@rossi.it; amministrazione@rossi.it", emailPec: "rossi@pec.it", areaClientiEmail: null,
  telefono: "06 1234567", telefonoAmm: "+39 333 1234567", telefonoUrg: null,
};
const other: ParentCandidate = { ...rossi, id: 8, ragioneSociale: "Bianchi Servizi S.p.A.", amministratore: "Luigi Bianchi", emailPosta: "l@bianchi.it", emailPec: null, telefono: null, telefonoAmm: null };

test("company names: case, punctuation and legal form do not matter; extra words and typos are still close", () => {
  assert.equal(companyNameScore("ROSSI CONSULTING SRL", "Rossi Consulting S.r.l."), 1);
  assert.ok(companyNameScore("Rossi Consulting", "Rossi Consulting Group srl") >= 0.85);
  assert.ok(companyNameScore("Rossi Consultng", "Rossi Consulting srl") >= 0.85);
  assert.ok(companyNameScore("Verdi Costruzioni", "Rossi Consulting srl") < 0.5);
});

test("a person matches whatever the word order or middle names, but a single word never does", () => {
  assert.ok(samePerson("Mario Rossi", "ROSSI mario"));
  assert.ok(samePerson("Mario Rossi", "Mario Giuseppe Rossi"));
  assert.ok(!samePerson("Mario Rossi", "Luca Rossi"));
  assert.ok(!samePerson("Rossi", "Mario Rossi"));
});

test("contacts: the buyer's email or phone must be on file, in any format", () => {
  assert.ok(contactMatches(rossi, { buyerEmail: "Amministrazione@Rossi.it", buyerPhone: "+390000000000" }));
  assert.ok(contactMatches(rossi, { buyerEmail: "x@y.it", buyerPhone: "+393331234567" }));
  assert.ok(contactMatches(rossi, { buyerEmail: "x@y.it", buyerPhone: "+39061234567" }));
  assert.ok(!contactMatches(rossi, { buyerEmail: "x@y.it", buyerPhone: "+393409999999" }));
});

test("capofila check: verified, to-check, or rejected without saying why", () => {
  const claim = { companyName: "rossi consulting", contactName: "Mario Rossi", buyerEmail: "mario@rossi.it", buyerPhone: "+393409999999" };
  assert.equal(evaluateParent(claim, [rossi, other]).status, "verified");
  const stranger = evaluateParent({ ...claim, buyerEmail: "someone@else.com" }, [rossi, other]);
  assert.equal(stranger.status, "to-check");
  assert.equal(stranger.capofilaId, 7);
  // the registro imprese lists the company and its administrator, but a made-up referente or an unknown company fails
  assert.equal(evaluateParent({ ...claim, contactName: "Giulia Verdi" }, [rossi, other]).status, "rejected");
  assert.equal(evaluateParent({ ...claim, companyName: "Verdi Costruzioni" }, [rossi, other]).status, "rejected");
  // the referente of ANOTHER client does not unlock this one
  assert.equal(evaluateParent({ ...claim, contactName: "Luigi Bianchi" }, [rossi, other]).status, "rejected");
  assert.equal(evaluateParent(claim, []).status, "rejected");
});

const baseRequest = {
  catalogVersion: "a".repeat(64), termsVersion: "a".repeat(64), termsAccepted: true, companyName: "Nuova Srl", representativeName: "luca verdi", representativeTaxCode: "RSSMRA80A01H501U",
  email: "luca@nuova.it", phone: "+39 333 1112222", months: 12, startDate: new Date(Date.now() + 7 * 864e5).toLocaleDateString("en-CA", { timeZone: "Europe/Rome" }), consent: true,
};
test("the request needs the capofila name (and the referente if it is someone else) when additional is chosen", () => {
  assert.ok(requestSchema.safeParse({ ...baseRequest, additionalDomiciliation: false }).success);
  const noParent = requestSchema.safeParse({ ...baseRequest, additionalDomiciliation: true });
  assert.ok(!noParent.success && noParent.error.issues.some(i => i.path[0] === "parentCompanyName"));
  const noContact = requestSchema.safeParse({ ...baseRequest, additionalDomiciliation: true, parentCompanyName: "Rossi Consulting", parentContactSame: false });
  assert.ok(!noContact.success && noContact.error.issues.some(i => i.path[0] === "parentContactName"));
  const ok = requestSchema.safeParse({ ...baseRequest, additionalDomiciliation: true, parentCompanyName: "Rossi Consulting", parentContactSame: false, parentContactName: "mario ROSSI" });
  assert.ok(ok.success && ok.data.parentContactName === "Mario Rossi");
});

test("the admin copy of the confirmation shows the capofila notice, the customer copy does not", () => {
  const input = { lang: "it" as const, postal: false, serviceName: "Domiciliazione", shortRef: "X1", durationText: "12 mesi", startDate: "2026-12-01", representativeName: "Luca Verdi", representativeTaxCode: "RSSMRA80A01H501U", email: "l@v.it", phone: "+393331112222", addonLines: [], net: "1", vat: "1", vatPercent: "22%", total: "1", paymentMethod: "bank_transfer", paymentLabel: "Bonifico", areaUrl: "https://x.it", account: null, parentCompany: "Rossi Consulting" };
  const admin = buildConfirmationEmail({ ...input, adminNotice: { tone: "warn", title: "DA VERIFICARE", lines: ["dettaglio"] } });
  const customer = buildConfirmationEmail(input);
  assert.match(admin.html, /DA VERIFICARE/); assert.match(admin.text, /DA VERIFICARE/);
  assert.doesNotMatch(customer.html, /DA VERIFICARE/); assert.match(customer.html, /Rossi Consulting/);
});

test("capofila check with separate first name and surname: same surname but different first name is flagged", () => {
  const claim = { companyName: "Rossi Consulting", contactName: "Luca Rossi", contactFirstName: "Luca", contactLastName: "Rossi", buyerEmail: "mario@rossi.it", buyerPhone: "+393340000000" };
  // even with the contacts of the real administrator, a different first name is never "verified"
  const sameSurname = evaluateParent(claim, [rossi, other]);
  assert.equal(sameSurname.status, "to-check");
  assert.equal(sameSurname.reason, "first-name-differs");
  assert.equal(sameSurname.capofilaId, 7);
  // a different surname is rejected, even with the right first name
  assert.equal(evaluateParent({ ...claim, contactName: "Mario Verdi", contactFirstName: "Mario", contactLastName: "Verdi" }, [rossi]).status, "rejected");
  // both right: verified (with contacts) and no reason
  const full = evaluateParent({ ...claim, contactName: "Mario Rossi", contactFirstName: "Mario", contactLastName: "Rossi" }, [rossi]);
  assert.equal(full.status, "verified");
  assert.equal(full.reason, undefined);
  // compound surnames and word order on file do not matter
  const deLuca: ParentCandidate = { ...rossi, id: 9, ragioneSociale: "De Luca Srl", amministratore: "DE LUCA Anna Maria" };
  assert.equal(evaluateParent({ companyName: "De Luca", contactName: "Anna De Luca", contactFirstName: "Anna", contactLastName: "De Luca", buyerEmail: "x@y.it", buyerPhone: "" }, [deLuca]).status, "to-check");
});

test("request schema: first name and surname are joined into the full name, and a full name alone is still accepted", () => {
  const split = requestSchema.safeParse({ ...baseRequest, representativeName: undefined, representativeFirstName: "luca", representativeLastName: "VERDI" });
  assert.ok(split.success && split.data.representativeName === "Luca Verdi" && split.data.representativeFirstName === "Luca" && split.data.representativeLastName === "Verdi");
  const whole = requestSchema.safeParse(baseRequest);
  assert.ok(whole.success && whole.data.representativeFirstName === "Luca" && whole.data.representativeLastName === "Verdi");
  assert.ok(!requestSchema.safeParse({ ...baseRequest, representativeName: undefined }).success);
  const parent = requestSchema.safeParse({ ...baseRequest, additionalDomiciliation: true, parentCompanyName: "Rossi Consulting", parentContactSame: false, parentContactFirstName: "mario", parentContactLastName: "rossi" });
  assert.ok(parent.success && parent.data.parentContactName === "Mario Rossi");
  const missing = requestSchema.safeParse({ ...baseRequest, additionalDomiciliation: true, parentCompanyName: "Rossi Consulting", parentContactSame: false });
  assert.ok(!missing.success && missing.error.issues.some(i => i.path[0] === "parentContactName"));
});
