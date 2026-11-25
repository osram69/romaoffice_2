import assert from "node:assert/strict";
import { test } from "node:test";
import { additionalDiscountNote, buildScadenzaEmailHtml, defaultScontoApplicabile, renewalFeeFor, scadenzaDefaultMonths, scadenzaEmailSubject, scadenzaOfferMonths } from "../src/lib/dom-scadenza-email";

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

const prezzi = [6, 12, 24, 36, 48].map(mesi => ({ mesi, prezzoPieno: 1000, prezzoOfferta: 800, notaMensile: null, updatedAt: new Date() })) as never;

test("a postal reminder says postale everywhere and only offers 6 and 12 months, only when ticked", () => {
  const postale = { ...(client as object), tipologia: 1, inizioDom: "2026-03-31", scadenzaDom: "2026-09-30" } as never;
  assert.equal(scadenzaEmailSubject(postale), "Scadenza contratto domiciliazione postale ACME SRL - Roma Office Sharing");
  assert.equal(scadenzaOfferMonths(prezzi, true).join(), "6,12");
  assert.equal(scadenzaDefaultMonths(prezzi, 6, true).length, 0);
  assert.doesNotMatch(buildScadenzaEmailHtml(postale, prezzi, false), /Abbiamo altresì/);
  assert.match(buildScadenzaEmailHtml(postale, prezzi, false, [12]), /12 mesi/);
  const html = buildScadenzaEmailHtml(postale, prezzi, false, [6, 12, 24, 36, 48]);
  assert.match(html, /contratto di domiciliazione postale della società/);
  assert.doesNotMatch(html, /legale/);
  assert.match(html, /6 mesi/);
  assert.doesNotMatch(html, /(24|36|48) mesi/);
  assert.equal(defaultScontoApplicabile(postale), false);
});

test("a legal-address reminder is unchanged", () => {
  const legale = { ...(client as object), tipologia: 0 } as never;
  assert.equal(scadenzaEmailSubject(legale), "Scadenza contratto domiciliazione sede legale ACME SRL - Roma Office Sharing");
  assert.equal(scadenzaOfferMonths(prezzi).join(), "6,12,24,36,48");
  assert.match(buildScadenzaEmailHtml(legale, prezzi, false, [12, 24]), /contratto di domiciliazione legale della società/);
});
