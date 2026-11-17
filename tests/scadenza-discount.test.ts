import assert from "node:assert/strict";
import { test } from "node:test";
import { additionalDiscountNote, buildScadenzaEmailHtml, renewalFeeFor } from "../src/lib/dom-scadenza-email";

const client = { ragioneSociale: "ACME SRL", amministratore: "Mario Rossi", personaRif: null, scadenzaDom: "2027-03-31", inizioDom: "2026-03-31", prezzoRinnovo: 550 } as never;

test("renewalFeeFor applies the discount in whole euros and leaves the base alone otherwise", () => {
  assert.equal(renewalFeeFor(550, 1000), 495);
  assert.equal(renewalFeeFor(555, 1000), 500); // 499.5 rounds to the whole euro
  assert.equal(renewalFeeFor(550, 0), 550);
  assert.equal(renewalFeeFor(null, 1000), null);
});

test("the discount note follows the fee only when a discount applies", () => {
  assert.equal(additionalDiscountNote(1000), " (sconto del 10% per domiciliazione aggiuntiva)");
  assert.equal(additionalDiscountNote(0), "");
});

test("reminder email quotes the discounted fee plus the note for an aggiuntiva, the full fee otherwise", () => {
  const discounted = buildScadenzaEmailHtml(client, [], false, [], 1000);
  assert.match(discounted, /<span data-prezzo="1">495<\/span>&nbsp;€ \+ IVA \(sconto del 10% per domiciliazione aggiuntiva\)/);
  const plain = buildScadenzaEmailHtml(client, [], false, []);
  assert.match(plain, /<span data-prezzo="1">550<\/span>&nbsp;€ \+ IVA<\/p>/);
  assert.doesNotMatch(plain, /aggiuntiva/);
});
