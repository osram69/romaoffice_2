import test from "node:test";
import assert from "node:assert/strict";
import { SECTION_TITLE_MAX, normalizeSectionTitle } from "@/lib/contab-title";

test("the maximum title length is 100", () => {
  assert.equal(SECTION_TITLE_MAX, 100);
});

test("a normal title is returned trimmed", () => {
  assert.deepEqual(normalizeSectionTitle("  1° trimestre 2026  "), { ok: true, title: "1° trimestre 2026" });
  assert.deepEqual(normalizeSectionTitle("Fatture"), { ok: true, title: "Fatture" });
});

test("an empty or whitespace-only title is refused", () => {
  for (const raw of ["", " ", "   \t\n "]) {
    const r = normalizeSectionTitle(raw);
    assert.equal(r.ok, false, JSON.stringify(raw));
    if (!r.ok) assert.match(r.message, /da 1 a 100 caratteri/);
  }
});

test("exactly 100 characters pass, 101 are refused", () => {
  assert.deepEqual(normalizeSectionTitle("a".repeat(100)), { ok: true, title: "a".repeat(100) });
  assert.equal(normalizeSectionTitle("a".repeat(101)).ok, false);
});

test("the length is measured after the trim", () => {
  assert.equal(normalizeSectionTitle(" ".repeat(10) + "a".repeat(100) + " ".repeat(10)).ok, true);
  assert.equal(normalizeSectionTitle(" ".repeat(10) + "a".repeat(101)).ok, false);
});

test("characters are counted like PostgreSQL varchar does (code points, not UTF-16 units)", () => {
  // 100 emoji = 200 UTF-16 units but 100 characters.
  assert.equal(normalizeSectionTitle("😀".repeat(100)).ok, true);
  assert.equal(normalizeSectionTitle("😀".repeat(101)).ok, false);
});

test("a non-string value is refused instead of throwing", () => {
  assert.equal(normalizeSectionTitle(undefined as unknown as string).ok, false);
  assert.equal(normalizeSectionTitle(null as unknown as string).ok, false);
  assert.equal(normalizeSectionTitle(42 as unknown as string).ok, false);
});
