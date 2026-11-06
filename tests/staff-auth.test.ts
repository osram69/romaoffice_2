import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { authLimits, contabUnlocks, staffSessions } from "@/db/schema";
import {
  createSession,
  destroySession,
  digest,
  getStaffUser,
  isOperational,
  login,
  postLoginPath,
  revokeStaffSessions,
  roleHome,
  staffLoginAllowed,
  token,
  type StaffUser,
} from "@/lib/staff-auth";
import { createTestStaff } from "./helpers/staff";

// Anything touching the database only runs when TEST_DB points at a real dev database.
const dbTest = process.env.TEST_DB ? test : test.skip;

const cleanups: Array<() => Promise<void>> = [];
after(async () => { for (const fn of cleanups) await fn(); });

const user = (role: StaffUser["role"], mustChangePassword = false): StaffUser =>
  ({ id: "00000000-0000-0000-0000-000000000000", username: "zz-test-pure", role, mustChangePassword });

// ---- pure logic (no database) ----

test("isOperational is true for admin and operatore, false for commercialista", () => {
  assert.equal(isOperational("admin"), true);
  assert.equal(isOperational("operatore"), true);
  assert.equal(isOperational("commercialista"), false);
});

test("roleHome maps each role to its landing page", () => {
  assert.equal(roleHome("admin"), "/gestione-tariffe-x9k2m7");
  assert.equal(roleHome("operatore"), "/gestione-domiciliazioni-x9k2m7");
  assert.equal(roleHome("commercialista"), "/commercialista-x9k2m7");
});

test("postLoginPath: commercialista always goes to its own page", () => {
  assert.equal(postLoginPath(user("commercialista"), "/gestione-ordini-x9k2m7"), "/commercialista-x9k2m7");
  assert.equal(postLoginPath(user("commercialista"), "/gestione-domiciliazioni-x9k2m7"), "/commercialista-x9k2m7");
  assert.equal(postLoginPath(user("commercialista"), ""), "/commercialista-x9k2m7");
});

test("postLoginPath: a user who must change password goes to the password page, whatever the role or next", () => {
  for (const role of ["admin", "operatore", "commercialista"] as const) {
    assert.equal(postLoginPath(user(role, true), "/gestione-tariffe-x9k2m7"), "/gestione-password-x9k2m7", role);
  }
});

test("postLoginPath: operatore only reaches Domiciliazioni", () => {
  assert.equal(postLoginPath(user("operatore"), "/gestione-tariffe-x9k2m7"), "/gestione-domiciliazioni-x9k2m7");
  assert.equal(postLoginPath(user("operatore"), "/gestione-contabilita-x9k2m7"), "/gestione-domiciliazioni-x9k2m7");
  assert.equal(postLoginPath(user("operatore"), "/gestione-utenti-x9k2m7"), "/gestione-domiciliazioni-x9k2m7");
  assert.equal(postLoginPath(user("operatore"), "/gestione-domiciliazioni-x9k2m7?stato=0"), "/gestione-domiciliazioni-x9k2m7?stato=0");
  assert.equal(postLoginPath(user("operatore"), ""), "/gestione-domiciliazioni-x9k2m7");
});

test("postLoginPath: admin may follow next into any dashboard area", () => {
  for (const next of [
    "/gestione-contabilita-x9k2m7",
    "/gestione-contabilita-x9k2m7/impostazioni",
    "/gestione-utenti-x9k2m7",
    "/gestione-tariffe-x9k2m7",
    "/gestione-domiciliazioni-x9k2m7",
    "/gestione-ordini-x9k2m7",
    "/gestione-configurazione-x9k2m7",
  ]) {
    assert.equal(postLoginPath(user("admin"), next), next);
  }
  assert.equal(postLoginPath(user("admin"), ""), "/gestione-tariffe-x9k2m7");
});

test("postLoginPath: foreign or malformed next falls back to the role home", () => {
  for (const next of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "/commercialista-x9k2m7", "/gestione-tariffe-x9k2m7.evil.example", "/altro"]) {
    assert.equal(postLoginPath(user("admin"), next), "/gestione-tariffe-x9k2m7", next);
    assert.equal(postLoginPath(user("operatore"), next), "/gestione-domiciliazioni-x9k2m7", next);
  }
});

// ---- database-backed ----

dbTest("getStaffUser returns the user including mustChangePassword=false", async () => {
  const staff = await createTestStaff("operatore");
  cleanups.push(staff.cleanup);
  const found = await getStaffUser(staff.cookie);
  assert.deepEqual(found, { id: staff.id, username: staff.username, role: "operatore", mustChangePassword: false });
});

dbTest("getStaffUser fails closed for a user who must change password, unless allowMustChange", async () => {
  const staff = await createTestStaff("admin", { mustChange: true });
  cleanups.push(staff.cleanup);
  assert.equal(await getStaffUser(staff.cookie), null);
  assert.equal(await getStaffUser(staff.cookie, {}), null);
  assert.equal(await getStaffUser(staff.cookie, { allowMustChange: false }), null);
  const found = await getStaffUser(staff.cookie, { allowMustChange: true });
  assert.equal(found?.id, staff.id);
  assert.equal(found?.mustChangePassword, true);
});

dbTest("getStaffUser returns null for a deactivated user, even with allowMustChange", async () => {
  const staff = await createTestStaff("operatore", { active: false });
  cleanups.push(staff.cleanup);
  assert.equal(await getStaffUser(staff.cookie), null);
  assert.equal(await getStaffUser(staff.cookie, { allowMustChange: true }), null);
});

dbTest("getStaffUser returns null for a missing or malformed cookie", async () => {
  assert.equal(await getStaffUser(undefined), null);
  assert.equal(await getStaffUser("not-a-token"), null);
  assert.equal(await getStaffUser(token()), null);
});

dbTest("login succeeds for a must-change user and reports mustChangePassword", async () => {
  const staff = await createTestStaff("commercialista", { mustChange: true });
  cleanups.push(staff.cleanup);
  const result = await login(staff.username, staff.password);
  assert.equal(result?.id, staff.id);
  assert.equal(result?.role, "commercialista");
  assert.equal(result?.mustChangePassword, true);
  assert.equal(await login(staff.username, "wrong-password-zz"), null);
});

dbTest("revokeStaffSessions removes every session of the user", async () => {
  const staff = await createTestStaff("operatore");
  cleanups.push(staff.cleanup);
  const second = await createSession(staff.id);
  await revokeStaffSessions(staff.id);
  assert.equal(await getStaffUser(staff.cookie), null);
  assert.equal(await getStaffUser(second), null);
});

dbTest("revokeStaffSessions with exceptRawToken keeps only that session", async () => {
  const staff = await createTestStaff("operatore");
  cleanups.push(staff.cleanup);
  const second = await createSession(staff.id);
  await revokeStaffSessions(staff.id, second);
  assert.equal(await getStaffUser(staff.cookie), null);
  assert.equal((await getStaffUser(second))?.id, staff.id);
});

async function addUnlock(userId: string, rawSession: string) {
  const tokenHash = digest(token());
  await db.insert(contabUnlocks).values({ tokenHash, userId, sessionTokenHash: digest(rawSession), expiresAt: new Date(Date.now() + 60_000) });
  return tokenHash;
}

dbTest("revokeStaffSessions also deletes the contab unlocks not tied to the kept session", async () => {
  const staff = await createTestStaff("admin");
  cleanups.push(staff.cleanup);
  const kept = await createSession(staff.id);
  const lostUnlock = await addUnlock(staff.id, staff.cookie);
  const keptUnlock = await addUnlock(staff.id, kept);
  await revokeStaffSessions(staff.id, kept);
  const left = (await db.select({ tokenHash: contabUnlocks.tokenHash }).from(contabUnlocks).where(eq(contabUnlocks.userId, staff.id))).map(r => r.tokenHash);
  assert.deepEqual(left, [keptUnlock]);
  assert.ok(!left.includes(lostUnlock));
  await revokeStaffSessions(staff.id);
  assert.equal((await db.select().from(contabUnlocks).where(eq(contabUnlocks.userId, staff.id))).length, 0);
});

dbTest("destroySession deletes the session and the unlocks tied to it, and only those", async () => {
  const staff = await createTestStaff("admin");
  cleanups.push(staff.cleanup);
  const other = await createSession(staff.id);
  await addUnlock(staff.id, staff.cookie);
  const otherUnlock = await addUnlock(staff.id, other);
  await destroySession(staff.cookie);
  assert.equal(await getStaffUser(staff.cookie), null);
  assert.equal((await getStaffUser(other))?.id, staff.id);
  const left = (await db.select({ tokenHash: contabUnlocks.tokenHash }).from(contabUnlocks).where(eq(contabUnlocks.userId, staff.id))).map(r => r.tokenHash);
  assert.deepEqual(left, [otherUnlock]);
  const rows = await db.select().from(staffSessions).where(inArray(staffSessions.tokenHash, [digest(staff.cookie)]));
  assert.equal(rows.length, 0);
});

dbTest("staffLoginAllowed rejects the 11th attempt in the window (case and whitespace insensitive) instead of throwing", async () => {
  process.env.AUTH_SECRET ||= "zz-test-secret-".padEnd(40, "x");
  const name = `zz-test-${randomUUID().slice(0, 8)}`;
  cleanups.push(async () => {
    const key = createHmac("sha256", process.env.AUTH_SECRET!).update(`staff-login:${name}`).digest("hex");
    await db.delete(authLimits).where(eq(authLimits.key, key));
  });
  for (let i = 1; i <= 10; i++) assert.equal(await staffLoginAllowed(i % 2 ? name : ` ${name.toUpperCase()} `), true, `attempt ${i}`);
  assert.equal(await staffLoginAllowed(name), false);
  assert.equal(await staffLoginAllowed(name.toUpperCase()), false);
});
