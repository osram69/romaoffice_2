import test from "node:test";
import assert from "node:assert/strict";
import { formatPersonName } from "@/lib/person-name";

test("any casing becomes lowercase with only the initial of each part capitalised", () => {
  assert.equal(formatPersonName("MARIO ROSSI"), "Mario Rossi");
  assert.equal(formatPersonName("mario rossi"), "Mario Rossi");
  assert.equal(formatPersonName("mArIo rOSSI"), "Mario Rossi");
});

test("extra spaces are collapsed and the ends trimmed", () => {
  assert.equal(formatPersonName("  mario    rossi  "), "Mario Rossi");
});

test("apostrophes and hyphens start a new capital", () => {
  assert.equal(formatPersonName("DELL'ACQUA ANNA-MARIA"), "Dell'Acqua Anna-Maria");
  assert.equal(formatPersonName("d’angelo luca"), "D’Angelo Luca");
});

test("accented letters and several given names work", () => {
  assert.equal(formatPersonName("ÈLISA DE LUCA"), "Èlisa De Luca");
  assert.equal(formatPersonName("GIAN MARIA DI FRANCESCO"), "Gian Maria Di Francesco");
});

test("it is idempotent", () => {
  const once = formatPersonName("MARIA DELL'ORTO");
  assert.equal(formatPersonName(once), once);
});
