import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PASSWORD_MAX_LENGTH } from "@/lib/password-policy";
import { parseCreateInput, parseResetInput, parseToggleInput } from "@/app/gestione-utenti-x9k2m7/parse";

const UUID = "123e4567-e89b-42d3-a456-426614174000";
const STRONG = "Zz-test-Passw0rd-ok!";

function form(fields: Record<string, string | Blob>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.append(key, value);
  return fd;
}

// ---- parseCreateInput ----

test("create: typed password, username is normalised", () => {
  const r = parseCreateInput(form({ username: "  Mario.Rossi ", role: "operatore", mode: "typed", password: STRONG }));
  assert.deepEqual(r, { ok: true, username: "mario.rossi", role: "operatore", generate: false, password: STRONG });
});

test("create: generate mode ignores any typed password", () => {
  const r = parseCreateInput(form({ username: "contabile", role: "commercialista", mode: "generate", password: STRONG }));
  assert.deepEqual(r, { ok: true, username: "contabile", role: "commercialista", generate: true });
});

test("create: role whitelist rejects admin, unknown and missing roles", () => {
  for (const role of ["admin", "root", "", "OPERATORE"]) {
    const r = parseCreateInput(form({ username: "mario", role, mode: "generate" }));
    assert.equal(r.ok, false, `role ${JSON.stringify(role)}`);
  }
  assert.equal(parseCreateInput(form({ username: "mario", mode: "generate" })).ok, false);
});

test("create: rejects missing, oversize and non-string fields", () => {
  assert.equal(parseCreateInput(form({ role: "operatore", mode: "generate" })).ok, false);
  assert.equal(parseCreateInput(form({ username: "x".repeat(5000), role: "operatore", mode: "generate" })).ok, false);
  assert.equal(parseCreateInput(form({ username: new Blob(["x"]), role: "operatore", mode: "generate" })).ok, false);
  assert.equal(parseCreateInput(form({ username: "mario", role: "operatore", mode: "typed" })).ok, false, "typed without password");
  assert.equal(parseCreateInput(form({ username: "mario", role: "operatore", mode: "typed", password: "a".repeat(PASSWORD_MAX_LENGTH + 1) })).ok, false);
  assert.equal(parseCreateInput(form({ username: "mario", role: "operatore", mode: "other", password: STRONG })).ok, false, "unknown mode");
  assert.equal(parseCreateInput(form({ username: "mario", role: "operatore", password: STRONG })).ok, false, "missing mode");
});

test("create: a password of exactly the maximum length passes parsing (policy is checked by the library)", () => {
  const r = parseCreateInput(form({ username: "mario", role: "operatore", mode: "typed", password: "a".repeat(PASSWORD_MAX_LENGTH) }));
  assert.equal(r.ok, true);
});

// ---- parseResetInput ----

test("reset: typed and generate modes", () => {
  assert.deepEqual(parseResetInput(form({ targetId: UUID, mode: "typed", password: STRONG })), { ok: true, targetId: UUID, generate: false, password: STRONG });
  assert.deepEqual(parseResetInput(form({ targetId: UUID, mode: "generate" })), { ok: true, targetId: UUID, generate: true });
});

test("reset: rejects a bad id, missing password and oversize password", () => {
  assert.equal(parseResetInput(form({ targetId: "not-a-uuid", mode: "generate" })).ok, false);
  assert.equal(parseResetInput(form({ mode: "generate" })).ok, false);
  assert.equal(parseResetInput(form({ targetId: UUID, mode: "typed" })).ok, false);
  assert.equal(parseResetInput(form({ targetId: UUID, mode: "typed", password: "a".repeat(PASSWORD_MAX_LENGTH + 1) })).ok, false);
});

// ---- parseToggleInput ----

test("toggle: accepts only 'true' or 'false' and a uuid", () => {
  assert.deepEqual(parseToggleInput(form({ targetId: UUID, active: "true" })), { ok: true, targetId: UUID, active: true });
  assert.deepEqual(parseToggleInput(form({ targetId: UUID, active: "false" })), { ok: true, targetId: UUID, active: false });
  assert.equal(parseToggleInput(form({ targetId: UUID, active: "1" })).ok, false);
  assert.equal(parseToggleInput(form({ targetId: UUID })).ok, false);
  assert.equal(parseToggleInput(form({ targetId: "x", active: "true" })).ok, false);
});

// ---- actions.ts structure (the actions need a request context, so the guard is checked on the source) ----

test("actions.ts: every exported function is async and starts with requireAdminUser; actor never comes from FormData", () => {
  const source = readFileSync("src/app/gestione-utenti-x9k2m7/actions.ts", "utf8");
  assert.match(source, /^"use server";/);
  // Every export must be an async function (a "use server" file turns each export into a public endpoint).
  const exports = [...source.matchAll(/^export\s+(.*)$/gm)].map(m => m[1]);
  assert.ok(exports.length >= 3);
  for (const line of exports) assert.match(line, /^async function \w+\(/, line);
  // The first statement of each body is the admin guard.
  const bodies = source.split(/^export async function /m).slice(1);
  assert.equal(bodies.length, exports.length);
  for (const body of bodies) {
    const afterBrace = body.slice(body.indexOf("{") + 1).trimStart();
    assert.match(afterBrace, /^(const admin = )?await requireAdminUser\(BASE_PATH\);/, body.slice(0, 60));
  }
  assert.doesNotMatch(source, /formData\.get\(\s*["']actor/i);
  // No password value reaches a log call (string literals are stripped first, so message text does not count).
  const withoutStrings = source.replace(/"(?:[^"\\]|\\.)*"/g, '""');
  assert.doesNotMatch(withoutStrings, /console\.\w+\([^)]*\b(password|generatedPassword)\b/);
});
