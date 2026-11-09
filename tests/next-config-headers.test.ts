import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import nextConfig from "../next.config";

// The accounting, user-management and password pages are sensitive and per-user: the cache header is set
// centrally in next.config.ts (the pages themselves stay dynamic and never mention it).
const PRIVATE_PAGES = [
  "/gestione-contabilita-x9k2m7",
  "/gestione-contabilita-x9k2m7/:path*",
  "/gestione-utenti-x9k2m7",
  "/gestione-password-x9k2m7",
  "/commercialista-x9k2m7",
];

test("next.config headers(): the five sensitive pages carry Cache-Control private, no-store and noindex", async () => {
  assert.equal(typeof nextConfig.headers, "function");
  const rules = await nextConfig.headers!();
  for (const source of PRIVATE_PAGES) {
    const matching = rules.filter(rule => rule.source === source);
    assert.equal(matching.length, 1, `exactly one rule for ${source}`);
    const headers = Object.fromEntries(matching[0].headers.map(h => [h.key.toLowerCase(), h.value]));
    assert.equal(headers["cache-control"], "private, no-store", source);
    assert.equal(headers["x-robots-tag"], "noindex, nofollow", source);
  }
});

test("next.config headers(): the global rule does not set a cache header (public pages stay cacheable)", async () => {
  const rules = await nextConfig.headers!();
  const global = rules.find(rule => rule.source === "/:path*");
  assert.ok(global);
  assert.ok(!global.headers.some(h => h.key.toLowerCase() === "cache-control"));
});

test("api/dom-print: both PDF responses carry Cache-Control private, no-store", () => {
  const source = readFileSync("src/app/api/dom-print/route.ts", "utf8");
  const pdfResponses = source.split("\n").filter(line => line.includes("application/pdf"));
  assert.equal(pdfResponses.length, 2);
  for (const line of pdfResponses) assert.match(line, /"Cache-Control": "private, no-store"/);
});
