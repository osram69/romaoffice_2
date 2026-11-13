import test from "node:test";
import assert from "node:assert/strict";
import { quote, type ProductOffer } from "@/lib/pricing";

// Offer prices of the legal-address service as quoted today (euro cents); list prices are higher.
const product = {
  code: "legal_unit", vatBps: 2200, additionalDiscountBps: 1000, additionalDiscountEnabled: true,
  newActivationDiscountBps: 1000, newActivationDiscountEnabled: true, offerValidUntil: null, termsRevision: "t", version: "v",
  tiers: [
    { months: 6, listCents: 35000, offerCents: 30000, newActivation: true, additionalDomiciliation: true },
    { months: 12, listCents: 65000, offerCents: 55000, newActivation: true, additionalDomiciliation: true },
    { months: 24, listCents: 110000, offerCents: 88000, newActivation: false, additionalDomiciliation: true },
    { months: 36, listCents: 150000, offerCents: 115000, newActivation: false, additionalDomiciliation: true },
  ],
  addons: [], smart3x24Active: false, smart6x24Active: false, onlineDiscountEnabled: true, onlineDiscountBps: 500, includedOpenings: 5,
  paymentSettings: {},
} as unknown as ProductOffer;

test("the renewal price is the offer price: no new-activation and no online discount", () => {
  const online = quote(product, { months: 12, newActivation: true, onlineActivation: true })!;
  assert.ok(online.serviceNetCents < 55000, "what the customer pays today is discounted");
  assert.equal(online.renewalBaseCents, 55000);
  assert.equal(Math.round(online.renewalBaseCents / 100), 550);
});

test("6, 24 and 36 months renew at their offer price whatever discounts apply today", () => {
  for (const [months, euro] of [[6, 300], [24, 880], [36, 1150]] as const) {
    const q = quote(product, { months, newActivation: true, additionalDomiciliation: true, onlineActivation: true })!;
    assert.equal(Math.round(q.renewalBaseCents / 100), euro, `${months} months`);
  }
});
