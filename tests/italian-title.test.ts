import { test } from "node:test";
import assert from "node:assert/strict";
import { titleFor, firstNameOf } from "../src/lib/italian-title";

test("clearly feminine first names give Sig.ra", () => {
  for (const name of ["Maria Rossi", "Giulia Bianchi", "Beatrice Verdi", "Carmen Esposito", "Maria Grazia Neri", "ELISABETTA ROMANO", "Chiara De Luca", "Ilaria Conti"])
    assert.equal(titleFor(name), "Sig.ra", name);
});

test("male names (also those ending in a) give Sig.", () => {
  for (const name of ["Mario Rossi", "Andrea Bianchi", "Luca Verdi", "Nicola Neri", "Mattia Conti", "Gianluca Esposito", "Giovanni Russo", "Michele Costa"])
    assert.equal(titleFor(name), "Sig.", name);
});

test("missing name, only the surname, an initial or an empty value give Sig.", () => {
  for (const name of ["", "   ", null, undefined, "Rossi", "M. Rossi", "Ma. Rossi", "A Rossi"])
    assert.equal(titleFor(name), "Sig.", String(name));
  assert.equal(firstNameOf("M. Rossi"), null);
});

test("accents and extra spaces are ignored", () => {
  assert.equal(titleFor("  Nicolò   Rossi"), "Sig.");
  assert.equal(titleFor("Chloé Martin"), "Sig.ra");
});
