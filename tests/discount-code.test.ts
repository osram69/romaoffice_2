import test from "node:test";
import assert from "node:assert/strict";
import { quote, type ProductOffer } from "@/lib/pricing";
import { codeFitsMonths, codeRunning, codeUsable, normalizeCode, parseMonths, promoHref, promoText, toPromo, validCodeFormat, type DiscountCodeRow } from "@/lib/discount-code";

const product = {
  code: "legal_unit", vatBps: 2200, additionalDiscountBps: 1000, additionalDiscountEnabled: true,
  newActivationDiscountBps: 1000, newActivationDiscountEnabled: true, offerValidUntil: null, termsRevision: "t", version: "v",
  tiers: [{ months: 12, listCents: 65000, offerCents: 55000, newActivation: true, additionalDomiciliation: true }],
  addons: [], smart3x24Active: false, smart6x24Active: false, onlineDiscountEnabled: true, onlineDiscountBps: 500, includedOpenings: 5,
  paymentSettings: {},
} as unknown as ProductOffer;

const row = (over: Partial<DiscountCodeRow> = {}): DiscountCodeRow => ({
  code: "BLACKWEEK", label: "", percentBps: 1500, services: "all", validFrom: "2026-11-23", validTo: "2026-11-30", enabled: true, promoBanner: true, bannerIt: null, bannerEn: null, ...over,
});

test("the discount code comes after every other discount and lowers only the first period", () => {
  const without = quote(product, { months: 12, newActivation: true, onlineActivation: true })!;
  const withCode = quote(product, { months: 12, newActivation: true, onlineActivation: true, discountCode: { code: "BLACKWEEK", bps: 1500 } })!;
  assert.equal(withCode.discountCodeCents, Math.round(without.serviceNetCents * 0.15));
  assert.equal(withCode.serviceNetCents, without.serviceNetCents - withCode.discountCodeCents);
  assert.equal(withCode.discountCode, "BLACKWEEK");
  assert.equal(withCode.discountCodeBps, 1500);
  assert.equal(withCode.renewalBaseCents, without.renewalBaseCents, "renewal price untouched");
  assert.ok(withCode.totalCents < without.totalCents);
});

test("without a code (or with a nonsensical one) nothing changes", () => {
  const base = quote(product, { months: 12, newActivation: true, onlineActivation: true })!;
  for (const bad of [undefined, null, { code: "X", bps: 0 }, { code: "X", bps: -5 }, { code: "X", bps: 20000 }]) {
    const q = quote(product, { months: 12, newActivation: true, onlineActivation: true, discountCode: bad })!;
    assert.equal(q.totalCents, base.totalCents);
    assert.equal(q.discountCodeCents, 0);
    assert.equal(q.discountCode, null);
  }
});

test("a code works with the other discounts switched off", () => {
  const q = quote(product, { months: 12, discountCode: { code: "ABC", bps: 1000 } })!;
  assert.equal(q.discountCodeCents, 5500);
  assert.equal(q.serviceNetCents, 49500);
});

test("validity window is inclusive on both days and respects the switch", () => {
  assert.equal(codeUsable(row(), "legal_unit", "2026-11-22"), false);
  assert.equal(codeUsable(row(), "legal_unit", "2026-11-23"), true);
  assert.equal(codeUsable(row(), "legal_unit", "2026-11-30"), true);
  assert.equal(codeUsable(row(), "legal_unit", "2026-12-01"), false);
  assert.equal(codeUsable(row({ enabled: false }), "legal_unit", "2026-11-25"), false);
  assert.equal(codeUsable(row({ validFrom: null, validTo: null }), "postal", "2030-01-01"), true);
  assert.equal(codeUsable(row({ percentBps: 0 }), "postal", "2026-11-25"), false);
});

test("a code can be limited to one service", () => {
  assert.equal(codeUsable(row({ services: "postal" }), "legal_unit", "2026-11-25"), false);
  assert.equal(codeUsable(row({ services: "postal" }), "postal", "2026-11-25"), true);
  assert.equal(codeUsable(row({ services: "legal_unit" }), "postal", "2026-11-25"), false);
  assert.equal(codeRunning(row({ services: "postal" }), "2026-11-25"), true);
  assert.equal(codeRunning(row({ services: "postal" }), "2026-12-25"), false);
});

test("codes are typed in any case and with stray spaces", () => {
  assert.equal(normalizeCode("  black week "), "BLACKWEEK");
  assert.equal(validCodeFormat("BLACKWEEK"), true);
  assert.equal(validCodeFormat("AB"), false);
  assert.equal(validCodeFormat("BAD CODE"), false);
  assert.equal(validCodeFormat("-ABC"), false);
});

test("promotion banner text and link", () => {
  assert.match(promoText(row(), "it"), /15%.*BLACKWEEK/);
  assert.match(promoText(row(), "en"), /15%.*BLACKWEEK/);
  assert.equal(promoText(row({ bannerIt: "  Testo mio " }), "it"), "Testo mio");
  assert.equal(promoHref(toPromo(row(), "it"), "it"), "/attiva.html?codice=BLACKWEEK");
  assert.equal(promoHref(toPromo(row({ services: "postal" }), "en"), "en"), "/en/activate.html?service=postal&codice=BLACKWEEK");
});

test("a code limited to some durations is not applied to the others", () => {
  const multi = { ...product, tiers: [6, 12, 24].map(months => ({ months, listCents: months * 5000, offerCents: null, newActivation: true, additionalDomiciliation: true })) } as unknown as ProductOffer;
  const code = { code: "BLACK50", bps: 5000, months: [6, 12] };
  for (const months of [6, 12]) assert.ok(quote(multi, { months, discountCode: code })!.discountCodeCents > 0, `${months} months gets the discount`);
  const q24 = quote(multi, { months: 24, discountCode: code })!;
  assert.equal(q24.discountCodeCents, 0);
  assert.equal(q24.discountCode, null);
  assert.ok(quote(multi, { months: 24, discountCode: { code: "BLACK50", bps: 5000 } })!.discountCodeCents > 0, "no months = every duration");
});

test("durations stored as text are read back safely", () => {
  assert.deepEqual(parseMonths("6,12"), [6, 12]);
  assert.deepEqual(parseMonths(" 12 , 6 "), [12, 6]);
  assert.equal(parseMonths(null), null);
  assert.equal(parseMonths(""), null);
  assert.equal(parseMonths("abc"), null);
  assert.equal(parseMonths("3,6,12,24,36,48"), null, "all durations = no limit");
  assert.equal(codeFitsMonths({ months: [6, 12] }, 12), true);
  assert.equal(codeFitsMonths({ months: [6, 12] }, 3), false);
  assert.equal(codeFitsMonths({}, 3), true);
});
