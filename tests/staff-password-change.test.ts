import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";

import { db, pool } from "@/db";
import { authLimits, staffUsers } from "@/db/schema";
import { PASSWORD_MAX_LENGTH } from "@/lib/password-policy";
import { createSession, getStaffUser } from "@/lib/staff-auth";
import { verifyPassword } from "@/lib/customer-auth";
import { validatePasswordChange } from "@/app/gestione-password-x9k2m7/validate";
import { TOO_MANY_ATTEMPTS, performPasswordChange } from "@/app/gestione-password-x9k2m7/change";
import { createTestStaff } from "./helpers/staff";

// Anything touching the database only runs when TEST_DB points at a real dev database.
const dbTest = process.env.TEST_DB ? test : test.skip;

const OLD = "Zz-test-Old-Passw0rd!";
const STRONG = "Zz-test-Passw0rd-ok!";

const cleanups: Array<() => Promise<void>> = [];
after(async () => {
  for (const fn of cleanups) await fn();
  await pool.end();
});

// ---- validatePasswordChange: pure, runs without a database ----

test("validatePasswordChange accepts a strong, different, confirmed password", () => {
  assert.equal(validatePasswordChange({ current: OLD, next: STRONG, confirm: STRONG }), null);
});

test("validatePasswordChange requires the current password", () => {
  assert.match(validatePasswordChange({ current: "", next: STRONG, confirm: STRONG }) ?? "", /attuale/);
});

test("validatePasswordChange rejects a current password longer than PASSWORD_MAX_LENGTH", () => {
  const message = validatePasswordChange({ current: "a".repeat(PASSWORD_MAX_LENGTH + 1), next: STRONG, confirm: STRONG });
  assert.match(message ?? "", /attuale.*lunga/);
});

test("validatePasswordChange rejects a new password longer than PASSWORD_MAX_LENGTH, whatever the policy", () => {
  const long = "Aa1!".repeat(PASSWORD_MAX_LENGTH);
  const message = validatePasswordChange({ current: OLD, next: long, confirm: long });
  assert.match(message ?? "", new RegExp(String(PASSWORD_MAX_LENGTH)));
});

test("validatePasswordChange accepts passwords of exactly PASSWORD_MAX_LENGTH", () => {
  const edge = "Aa1!" + "x".repeat(PASSWORD_MAX_LENGTH - 4);
  assert.equal(edge.length, PASSWORD_MAX_LENGTH);
  assert.equal(validatePasswordChange({ current: "c".repeat(PASSWORD_MAX_LENGTH), next: edge, confirm: edge }), null);
});

test("validatePasswordChange rejects a new password that does not meet the policy", () => {
  assert.match(validatePasswordChange({ current: OLD, next: "weak", confirm: "weak" }) ?? "", /password/i);
});

test("validatePasswordChange rejects a confirmation that differs", () => {
  assert.match(validatePasswordChange({ current: OLD, next: STRONG, confirm: STRONG + "x" }) ?? "", /conferma/i);
});

test("validatePasswordChange rejects a new password equal to the current one", () => {
  assert.match(validatePasswordChange({ current: STRONG, next: STRONG, confirm: STRONG }) ?? "", /diversa/);
});

// ---- performPasswordChange: needs the database ----

const asUser = (staff: { id: string; username: string }, role: "admin" | "operatore" | "commercialista", mustChangePassword = false) =>
  ({ id: staff.id, username: staff.username, role, mustChangePassword });

dbTest("performPasswordChange changes the password, clears mustChangePassword and keeps only the current session", async () => {
  const staff = await createTestStaff("commercialista", { mustChange: true });
  cleanups.push(staff.cleanup);
  const other = await createSession(staff.id);
  const result = await performPasswordChange(asUser(staff, "commercialista", true), staff.cookie, { current: staff.password, next: STRONG, confirm: STRONG });
  assert.deepEqual(result, { done: true });
  const [row] = await db.select().from(staffUsers).where(eq(staffUsers.id, staff.id));
  assert.equal(row.mustChangePassword, false);
  assert.equal(await verifyPassword(STRONG, row.passwordHash), true);
  assert.equal((await getStaffUser(staff.cookie))?.id, staff.id);
  assert.equal(await getStaffUser(other), null);
});

dbTest("performPasswordChange reports a wrong current password as an error value, not an exception", async () => {
  const staff = await createTestStaff("operatore");
  cleanups.push(staff.cleanup);
  process.env.AUTH_SECRET ||= "zz-test-secret-".padEnd(40, "x");
  cleanups.push(async () => {
    const key = createHmac("sha256", process.env.AUTH_SECRET!).update(`staff-pw-change:${staff.id}`).digest("hex");
    await db.delete(authLimits).where(eq(authLimits.key, key));
  });
  const result = await performPasswordChange(asUser(staff, "operatore"), staff.cookie, { current: "Zz-test-Wrong-Passw0rd!", next: STRONG, confirm: STRONG });
  assert.match(result.error ?? "", /attuale/);
  assert.equal(result.done, undefined);
});

dbTest("performPasswordChange: the 6th attempt in the window is refused with a generic message, even with the right password", async () => {
  process.env.AUTH_SECRET ||= "zz-test-secret-".padEnd(40, "x");
  const staff = await createTestStaff("operatore");
  cleanups.push(staff.cleanup);
  cleanups.push(async () => {
    const key = createHmac("sha256", process.env.AUTH_SECRET!).update(`staff-pw-change:${staff.id}`).digest("hex");
    await db.delete(authLimits).where(eq(authLimits.key, key));
  });
  const user = asUser(staff, "operatore");
  for (let i = 1; i <= 5; i++) {
    const result = await performPasswordChange(user, staff.cookie, { current: `Zz-test-Wrong-${i}-Passw0rd!`, next: STRONG, confirm: STRONG });
    assert.notEqual(result.error, TOO_MANY_ATTEMPTS, `attempt ${i}`);
    assert.ok(result.error, `attempt ${i} must fail`);
  }
  const blocked = await performPasswordChange(user, staff.cookie, { current: staff.password, next: STRONG, confirm: STRONG });
  assert.deepEqual(blocked, { error: TOO_MANY_ATTEMPTS });
  assert.equal(TOO_MANY_ATTEMPTS, "Troppi tentativi, riprova tra qualche minuto");
  // The password was not changed by the blocked attempt.
  const [row] = await db.select().from(staffUsers).where(eq(staffUsers.id, staff.id));
  assert.equal(await verifyPassword(staff.password, row.passwordHash), true);
});

dbTest("performPasswordChange: invalid input never consumes attempts and never reaches the database", async () => {
  process.env.AUTH_SECRET ||= "zz-test-secret-".padEnd(40, "x");
  const staff = await createTestStaff("admin");
  cleanups.push(staff.cleanup);
  const user = asUser(staff, "admin");
  for (let i = 0; i < 8; i++) {
    const result = await performPasswordChange(user, staff.cookie, { current: "x".repeat(PASSWORD_MAX_LENGTH + 1), next: STRONG, confirm: STRONG });
    assert.match(result.error ?? "", /lunga/);
  }
  const key = createHmac("sha256", process.env.AUTH_SECRET!).update(`staff-pw-change:${staff.id}`).digest("hex");
  const rows = await db.select().from(authLimits).where(eq(authLimits.key, key));
  assert.equal(rows.length, 0);
});

