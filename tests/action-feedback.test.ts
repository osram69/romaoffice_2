import test from "node:test";
import assert from "node:assert/strict";
import { readActionResult, runWithFeedback } from "@/components/Toaster";

test("a server action that returns nothing counts as success", () => {
  assert.deepEqual(readActionResult(undefined), { ok: true });
  assert.deepEqual(readActionResult(null), { ok: true });
});

test("both answer shapes are understood: { ok } and the older { success }", () => {
  assert.deepEqual(readActionResult({ ok: false, message: "Importo non valido" }), { ok: false, message: "Importo non valido" });
  assert.deepEqual(readActionResult({ success: false, message: "Non trovata" }), { ok: false, message: "Non trovata" });
  assert.deepEqual(readActionResult({ success: true }), { ok: true, message: undefined });
});

test("runWithFeedback reports whether the action worked", async () => {
  assert.equal(await runWithFeedback(async () => undefined, "Salvato"), true);
  assert.equal(await runWithFeedback(async () => ({ ok: false, message: "No" }), "Salvato"), false);
  assert.equal(await runWithFeedback(async () => { throw new Error("db down"); }, "Salvato"), false);
});

test("a redirect (expired session) is not swallowed", async () => {
  const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" });
  await assert.rejects(runWithFeedback(async () => { throw redirect; }, "Salvato"), /NEXT_REDIRECT/);
});
