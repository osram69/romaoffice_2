import test from "node:test";
import assert from "node:assert/strict";
import { RECAPTCHA_TIMEOUT_MS, runRecaptcha, type GrecaptchaClient } from "@/lib/recaptcha-client";

const KEY = "6Lxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

test("returns the token when Google answers", async () => {
  const client: GrecaptchaClient = { ready: cb => cb(), execute: async (key, opts) => { assert.equal(key, KEY); assert.equal(opts.action, "contact"); return "token-123"; } };
  assert.equal(await runRecaptcha(client, KEY, "contact"), "token-123");
});

test("an invalid site key that throws synchronously inside ready() no longer hangs", async () => {
  // This is exactly what the live site did: "Invalid site key or not loaded in api.js" thrown
  // synchronously from grecaptcha.execute inside the ready callback.
  // Google runs the ready callback inside its own code, which swallows the exception: the caller never
  // sees it, which is why the old implementation waited forever.
  const client: GrecaptchaClient = { ready: cb => { try { cb(); } catch { /* swallowed by Google's code */ } }, execute: () => { throw new Error("Invalid site key or not loaded in api.js"); } };
  const started = Date.now();
  assert.equal(await runRecaptcha(client, KEY, "contact", 50), undefined);
  assert.ok(Date.now() - started < 1500);
});

test("a throw from ready() itself resolves without a token", async () => {
  const client: GrecaptchaClient = { ready: () => { throw new Error("boom"); }, execute: async () => "x" };
  assert.equal(await runRecaptcha(client, KEY, "contact", 2000), undefined);
});

test("a rejected execute() resolves without a token", async () => {
  const client: GrecaptchaClient = { ready: cb => cb(), execute: () => Promise.reject(new Error("network")) };
  assert.equal(await runRecaptcha(client, KEY, "contact", 2000), undefined);
});

test("a ready() that never calls back ends after the timeout instead of waiting forever", async () => {
  const client: GrecaptchaClient = { ready: () => { /* never calls back */ }, execute: async () => "x" };
  const started = Date.now();
  assert.equal(await runRecaptcha(client, KEY, "contact", 50), undefined);
  assert.ok(Date.now() - started < 1500);
});

test("an execute() that never settles ends after the timeout", async () => {
  const client: GrecaptchaClient = { ready: cb => cb(), execute: () => new Promise<string>(() => { /* never settles */ }) };
  assert.equal(await runRecaptcha(client, KEY, "contact", 50), undefined);
});

test("an empty or non-string token counts as no token", async () => {
  const empty: GrecaptchaClient = { ready: cb => cb(), execute: async () => "" };
  assert.equal(await runRecaptcha(empty, KEY, "contact", 2000), undefined);
  const wrong = { ready: (cb: () => void) => cb(), execute: async () => 42 as unknown as string } satisfies GrecaptchaClient;
  assert.equal(await runRecaptcha(wrong, KEY, "contact", 2000), undefined);
});

test("a late token after the timeout is ignored and does not throw", async () => {
  let release: (t: string) => void = () => {};
  const client: GrecaptchaClient = { ready: cb => cb(), execute: () => new Promise<string>(res => { release = res; }) };
  assert.equal(await runRecaptcha(client, KEY, "contact", 30), undefined);
  release("too-late");
  await new Promise(r => setTimeout(r, 20));
});

test("the default timeout is 8 seconds", () => {
  assert.equal(RECAPTCHA_TIMEOUT_MS, 8000);
});
