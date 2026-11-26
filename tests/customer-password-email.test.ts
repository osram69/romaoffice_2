import test from "node:test";
import assert from "node:assert/strict";
import { buildNewPasswordEmail, NEW_PASSWORD_SUBJECT } from "@/lib/customer-password-email";

test("the new-password email carries the login address and the password in both parts", () => {
  const m = buildNewPasswordEmail({ greeting: "Buongiorno Sig. Rossi,", email: "mario@esempio.it", password: "Ab3#xyzQ<9&k", areaUrl: "https://www.romaofficesharing.it/area-clienti.html" });
  assert.match(NEW_PASSWORD_SUBJECT, /Area Clienti/);
  assert.match(m.text, /Utente \(email\): mario@esempio\.it/);
  assert.match(m.text, /Password provvisoria: Ab3#xyzQ<9&k/);
  assert.match(m.html, /Ab3#xyzQ&lt;9&amp;k/, "special characters are escaped in the HTML");
  assert.doesNotMatch(m.html, /undefined/);
  assert.match(m.html, /href="https:\/\/www\.romaofficesharing\.it\/area-clienti\.html"/);
});

test("without a known contact the greeting is the plain one", () => {
  const m = buildNewPasswordEmail({ greeting: "", email: "a@b.it", password: "x", areaUrl: "https://x.it" });
  assert.match(m.text, /^Buongiorno,/);
});
