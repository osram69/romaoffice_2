import test from "node:test";
import assert from "node:assert/strict";
import { logSafeError } from "@/lib/safe-log";

function capture(fn: () => void): string {
  const original = console.error;
  const lines: string[] = [];
  console.error = (...args: unknown[]) => { lines.push(args.map(a => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")); };
  try {
    fn();
  } finally {
    console.error = original;
  }
  return lines.join("\n");
}

function driverLikeError() {
  const cause = Object.assign(new Error("duplicate key for zz-test-mario"), { code: "23505" });
  const error = new Error("Failed query: update staff_users\nparams: scrypt-v1$abc,zz-test-mario", { cause });
  error.name = "DrizzleQueryError";
  return Object.assign(error, { query: "update staff_users set password_hash = $1", params: ["scrypt-v1$abc", "zz-test-mario"] });
}

test("logSafeError: never logs message, params, query or username; keeps label, name and SQLSTATE", () => {
  const out = capture(() => logSafeError("staff user creation failed", driverLikeError()));
  assert.ok(!out.includes("scrypt-v1$abc"), out);
  assert.ok(!out.includes("zz-test-mario"), out);
  assert.ok(!out.includes("params"), out);
  assert.ok(!out.includes("password_hash"), out);
  assert.ok(out.includes("staff user creation failed"));
  assert.ok(out.includes("DrizzleQueryError"));
  assert.ok(out.includes("23505"));
});

test("logSafeError: SQLSTATE read from error.code too; anything that is not 5 characters is ignored", () => {
  assert.ok(capture(() => logSafeError("x", Object.assign(new Error("m"), { code: "40001" }))).includes("40001"));
  const bad = capture(() => logSafeError("x", Object.assign(new Error("m"), { code: "secret-hash-value" })));
  assert.ok(!bad.includes("secret-hash-value"), bad);
  const nonString = capture(() => logSafeError("x", Object.assign(new Error("m"), { code: 12345 })));
  assert.ok(!nonString.includes("12345"), nonString);
});

test("logSafeError: non-Error values do not leak and do not throw", () => {
  const out = capture(() => {
    logSafeError("x", "scrypt-v1$abc");
    logSafeError("x", { message: "scrypt-v1$abc", name: "zz-test-mario" });
    logSafeError("x", null);
    logSafeError("x", undefined);
  });
  assert.ok(!out.includes("scrypt-v1$abc"), out);
  assert.ok(!out.includes("zz-test-mario"), out);
});
