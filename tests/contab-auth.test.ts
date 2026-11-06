import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

import { db, pool } from "@/db";
import { authLimits, contabAccess, contabUnlocks, staffSessions, staffUsers } from "@/db/schema";
import { PASSWORD_MAX_LENGTH } from "@/lib/password-policy";
import { STAFF_SESSION_COOKIE, createSession, destroySession, digest, revokeStaffSessions } from "@/lib/staff-auth";
import { verifyPassword } from "@/lib/customer-auth";
import { boundPassword } from "@/lib/contab-password";
import {
  CONTAB_UNLOCK_COOKIE,
  CONTAB_UNLOCK_SECONDS,
  changeContabPassword,
  checkContabAccess,
  contabAccessFromRequest,
  hasContabPassword,
  setInitialContabPassword,
  unlockContab,
} from "@/lib/contab-auth";
import { createTestStaff } from "./helpers/staff";

// Anything touching the database only runs when TEST_DB points at a real dev database.
const dbTest = process.env.TEST_DB ? test : test.skip;

// limit() derives its key with AUTH_SECRET; set a dummy one once for every DB test (module imports are lazy about it).
process.env.AUTH_SECRET ||= "zz-test-secret-".padEnd(40, "x");

const TOO_MANY = "Troppi tentativi, riprova tra qualche minuto";
const PASSWORD = "Zz-test-Contab-Passw0rd!";
const OTHER_PASSWORD = "Zz-test-Contab-Other-Passw0rd!";
const NEW_PASSWORD = "Zz-test-Contab-New-Passw0rd!";
const MINUTE = 60 * 1000;

// ---- Pure checks: no database involved ----

test("the unlock cookie name and lifetime are the documented ones", () => {
  assert.equal(CONTAB_UNLOCK_COOKIE, "ros_contab_unlock");
  assert.equal(CONTAB_UNLOCK_SECONDS, 1800);
});

test("boundPassword keeps a password within PASSWORD_MAX_LENGTH as it is", () => {
  const exact = "a".repeat(PASSWORD_MAX_LENGTH);
  assert.deepEqual(boundPassword("abc"), { candidate: "abc", withinLimit: true });
  assert.deepEqual(boundPassword(exact), { candidate: exact, withinLimit: true });
});

test("boundPassword cuts a longer password to PASSWORD_MAX_LENGTH and flags it, so it can never be accepted", () => {
  const result = boundPassword("a".repeat(PASSWORD_MAX_LENGTH + 500));
  assert.equal(result.candidate.length, PASSWORD_MAX_LENGTH);
  assert.equal(result.withinLimit, false);
  assert.equal(boundPassword("a".repeat(PASSWORD_MAX_LENGTH + 1)).withinLimit, false);
});

test("checkContabAccess fails closed on missing or malformed cookies, before touching the database", async () => {
  const hex = "a".repeat(64);
  assert.equal(await checkContabAccess(undefined, undefined), null);
  assert.equal(await checkContabAccess(hex, undefined), null);
  assert.equal(await checkContabAccess(undefined, hex), null);
  assert.equal(await checkContabAccess("", hex), null);
  assert.equal(await checkContabAccess(hex, ""), null);
  assert.equal(await checkContabAccess("not-hex", hex), null);
  assert.equal(await checkContabAccess(hex, "not-hex"), null);
  assert.equal(await checkContabAccess(hex.toUpperCase(), hex), null);
  assert.equal(await checkContabAccess(hex + "a", hex), null);
  assert.equal(await checkContabAccess(hex, hex.slice(1)), null);
});

test("contabAccessFromRequest fails closed without both cookies", async () => {
  const hex = "b".repeat(64);
  const request = (cookie?: string) => new NextRequest("http://localhost/api/contabilita", cookie ? { headers: { cookie } } : {});
  assert.equal(await contabAccessFromRequest(request()), null);
  assert.equal(await contabAccessFromRequest(request(`${STAFF_SESSION_COOKIE}=${hex}`)), null);
  assert.equal(await contabAccessFromRequest(request(`${CONTAB_UNLOCK_COOKIE}=${hex}`)), null);
  assert.equal(await contabAccessFromRequest(request(`${STAFF_SESSION_COOKIE}=bad; ${CONTAB_UNLOCK_COOKIE}=bad`)), null);
});

// ---- Database tests ----

const cleanups: Array<() => Promise<void>> = [];
let savedAccess: typeof contabAccess.$inferSelect | undefined;

// The real contab_access row (if the dev database has one) is saved here and put back by the after hook.
before(async () => {
  if (!process.env.TEST_DB) return;
  [savedAccess] = await db.select().from(contabAccess).where(eq(contabAccess.id, 1));
});

after(async () => {
  try {
    for (const fn of cleanups) await fn();
    if (process.env.TEST_DB) {
      await db.delete(contabAccess).where(eq(contabAccess.id, 1));
      if (savedAccess) await db.insert(contabAccess).values(savedAccess);
    }
  } finally {
    await pool.end();
  }
});

const limiterKey = (userId: string) => createHmac("sha256", process.env.AUTH_SECRET!).update(`contab-unlock:${userId}`).digest("hex");

// Creates a zz-test- staff user and registers the clean-up of the user, its sessions, unlocks and rate-limiter row.
async function newStaff(...args: Parameters<typeof createTestStaff>) {
  const staff = await createTestStaff(...args);
  cleanups.push(async () => {
    await db.delete(authLimits).where(eq(authLimits.key, limiterKey(staff.id)));
    await staff.cleanup();
  });
  return staff;
}

const clearAccess = () => db.delete(contabAccess).where(eq(contabAccess.id, 1));
const asUser = (staff: Awaited<ReturnType<typeof newStaff>>, role: "admin" | "operatore" | "commercialista") =>
  ({ id: staff.id, username: staff.username, role, mustChangePassword: false });

// A fresh admin that has unlocked Contabilità with the known password; the second password is (re)set first.
async function unlockedAdmin() {
  await clearAccess();
  assert.deepEqual(await setInitialContabPassword(PASSWORD), { ok: true });
  const admin = await newStaff("admin");
  const result = await unlockContab(asUser(admin, "admin"), admin.cookie, PASSWORD);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("unlock failed");
  return { admin, unlockRaw: result.unlockRaw };
}

const unlockRow = async (unlockRaw: string) => (await db.select().from(contabUnlocks).where(eq(contabUnlocks.tokenHash, digest(unlockRaw))))[0];

dbTest("without a second password hasContabPassword is false", async () => {
  await clearAccess();
  assert.equal(await hasContabPassword(), false);
});

dbTest("setInitialContabPassword refuses a weak password and sets nothing", async () => {
  await clearAccess();
  const result = await setInitialContabPassword("debole");
  assert.equal(result.ok, false);
  assert.equal(await hasContabPassword(), false);
  assert.equal((await setInitialContabPassword("Aa1!".repeat(PASSWORD_MAX_LENGTH))).ok, false);
  assert.equal(await hasContabPassword(), false);
});

dbTest("setInitialContabPassword accepts a valid password once and refuses a second call without overwriting", async () => {
  await clearAccess();
  assert.deepEqual(await setInitialContabPassword(PASSWORD), { ok: true });
  assert.equal(await hasContabPassword(), true);
  const second = await setInitialContabPassword(OTHER_PASSWORD);
  assert.equal(second.ok, false);
  const [row] = await db.select().from(contabAccess).where(eq(contabAccess.id, 1));
  assert.equal(await verifyPassword(PASSWORD, row.passwordHash), true);
  assert.equal(await verifyPassword(OTHER_PASSWORD, row.passwordHash), false);
});

dbTest("two concurrent first-time setups cannot both succeed", async () => {
  await clearAccess();
  const results = await Promise.all([setInitialContabPassword(PASSWORD), setInitialContabPassword(OTHER_PASSWORD)]);
  assert.equal(results.filter(r => r.ok).length, 1);
  assert.equal(await hasContabPassword(), true);
});

dbTest("unlockContab with a wrong password fails and creates no unlock", async () => {
  await clearAccess();
  await setInitialContabPassword(PASSWORD);
  const admin = await newStaff("admin");
  const result = await unlockContab(asUser(admin, "admin"), admin.cookie, OTHER_PASSWORD);
  assert.equal(result.ok, false);
  assert.equal((await db.select().from(contabUnlocks).where(eq(contabUnlocks.userId, admin.id))).length, 0);
});

dbTest("unlockContab with the right password returns a token, stores only its digest and checkContabAccess returns the admin", async () => {
  const { admin, unlockRaw } = await unlockedAdmin();
  assert.match(unlockRaw, /^[a-f0-9]{64}$/);
  const rows = await db.select().from(contabUnlocks).where(eq(contabUnlocks.userId, admin.id));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].tokenHash, digest(unlockRaw));
  assert.notEqual(rows[0].tokenHash, unlockRaw);
  assert.equal(rows[0].sessionTokenHash, digest(admin.cookie));
  const user = await checkContabAccess(admin.cookie, unlockRaw);
  assert.equal(user?.id, admin.id);
  assert.equal(user?.role, "admin");
});

dbTest("unlockContab never throws: a bogus session or a session of another user gives ok:false", async () => {
  await clearAccess();
  await setInitialContabPassword(PASSWORD);
  const admin = await newStaff("admin");
  const other = await newStaff("admin");
  assert.equal((await unlockContab(asUser(admin, "admin"), "not-a-session", PASSWORD)).ok, false);
  assert.equal((await unlockContab(asUser(admin, "admin"), other.cookie, PASSWORD)).ok, false);
  assert.equal((await unlockContab(asUser(admin, "admin"), "a".repeat(64), PASSWORD)).ok, false);
  assert.equal((await db.select().from(contabUnlocks).where(eq(contabUnlocks.userId, admin.id))).length, 0);
});

dbTest("unlockContab refuses operatore and commercialista even with the right password", async () => {
  await clearAccess();
  await setInitialContabPassword(PASSWORD);
  for (const role of ["operatore", "commercialista"] as const) {
    const staff = await newStaff(role);
    const result = await unlockContab(asUser(staff, role), staff.cookie, PASSWORD);
    assert.equal(result.ok, false);
    assert.equal((await db.select().from(contabUnlocks).where(eq(contabUnlocks.userId, staff.id))).length, 0);
  }
});

dbTest("unlockContab without a second password set fails", async () => {
  await clearAccess();
  const admin = await newStaff("admin");
  assert.equal((await unlockContab(asUser(admin, "admin"), admin.cookie, PASSWORD)).ok, false);
});

dbTest("an unlock does not work on a different session of the same admin, nor for another admin", async () => {
  const { admin, unlockRaw } = await unlockedAdmin();
  const secondSession = await createSession(admin.id);
  assert.equal(await checkContabAccess(secondSession, unlockRaw), null);
  const other = await newStaff("admin");
  assert.equal(await checkContabAccess(other.cookie, unlockRaw), null);
  assert.equal((await checkContabAccess(admin.cookie, unlockRaw))?.id, admin.id);
});

dbTest("an expired unlock is refused and not extended", async () => {
  const { admin, unlockRaw } = await unlockedAdmin();
  const past = new Date(Date.now() - MINUTE);
  await db.update(contabUnlocks).set({ expiresAt: past }).where(eq(contabUnlocks.tokenHash, digest(unlockRaw)));
  assert.equal(await checkContabAccess(admin.cookie, unlockRaw), null);
  assert.equal((await unlockRow(unlockRaw)).expiresAt.getTime(), past.getTime());
});

dbTest("a successful check slides expires_at and last_seen_at 30 minutes ahead", async () => {
  const { admin, unlockRaw } = await unlockedAdmin();
  const soon = new Date(Date.now() + 2 * MINUTE);
  const longAgo = new Date(Date.now() - 20 * MINUTE);
  await db.update(contabUnlocks).set({ expiresAt: soon, lastSeenAt: longAgo }).where(eq(contabUnlocks.tokenHash, digest(unlockRaw)));
  const started = Date.now();
  assert.equal((await checkContabAccess(admin.cookie, unlockRaw))?.id, admin.id);
  const row = await unlockRow(unlockRaw);
  const slack = 30 * 1000;
  const expected = started + CONTAB_UNLOCK_SECONDS * 1000;
  assert.ok(Math.abs(row.expiresAt.getTime() - expected) < MINUTE, "expires_at is about 30 minutes ahead");
  assert.ok(row.lastSeenAt.getTime() >= started - slack, "last_seen_at was refreshed");
});

dbTest("an operatore or commercialista with a forced unlock row in the database is refused", async () => {
  for (const role of ["operatore", "commercialista"] as const) {
    const staff = await newStaff(role);
    // A cookie value whose digest is stored: everything else about the row is valid.
    const forged = "d".repeat(64);
    await db.insert(contabUnlocks).values({
      tokenHash: digest(forged),
      userId: staff.id,
      sessionTokenHash: digest(staff.cookie),
      expiresAt: new Date(Date.now() + 10 * MINUTE),
    });
    assert.equal(await checkContabAccess(staff.cookie, forged), null);
  }
});

dbTest("an admin who must change password or is inactive gets no access, even with a valid unlock row", async () => {
  const { admin, unlockRaw } = await unlockedAdmin();
  assert.equal((await checkContabAccess(admin.cookie, unlockRaw))?.id, admin.id);
  await db.update(staffUsers).set({ mustChangePassword: true }).where(eq(staffUsers.id, admin.id));
  assert.equal(await checkContabAccess(admin.cookie, unlockRaw), null);
  await db.update(staffUsers).set({ mustChangePassword: false, active: false }).where(eq(staffUsers.id, admin.id));
  assert.equal(await checkContabAccess(admin.cookie, unlockRaw), null);
  await db.update(staffUsers).set({ active: true, role: "operatore" }).where(eq(staffUsers.id, admin.id));
  assert.equal(await checkContabAccess(admin.cookie, unlockRaw), null);
});

dbTest("an expired staff session closes the unlock too", async () => {
  const { admin, unlockRaw } = await unlockedAdmin();
  await db.update(staffSessions).set({ expiresAt: new Date(Date.now() - MINUTE) }).where(eq(staffSessions.tokenHash, digest(admin.cookie)));
  assert.equal(await checkContabAccess(admin.cookie, unlockRaw), null);
});

dbTest("revokeStaffSessions invalidates the unlock", async () => {
  const { admin, unlockRaw } = await unlockedAdmin();
  await revokeStaffSessions(admin.id);
  assert.equal(await checkContabAccess(admin.cookie, unlockRaw), null);
  assert.equal(await unlockRow(unlockRaw), undefined);
});

dbTest("destroySession (logout) invalidates the unlock", async () => {
  const { admin, unlockRaw } = await unlockedAdmin();
  await destroySession(admin.cookie);
  assert.equal(await checkContabAccess(admin.cookie, unlockRaw), null);
  assert.equal(await unlockRow(unlockRaw), undefined);
});

dbTest("the sixth unlock attempt in 15 minutes gets the too-many-attempts message, even with the right password", async () => {
  await clearAccess();
  await setInitialContabPassword(PASSWORD);
  const admin = await newStaff("admin");
  const user = asUser(admin, "admin");
  for (let i = 0; i < 5; i++) {
    const result = await unlockContab(user, admin.cookie, OTHER_PASSWORD);
    assert.equal(result.ok, false);
    assert.notEqual(result.ok === false ? result.message : "", TOO_MANY);
  }
  const sixth = await unlockContab(user, admin.cookie, OTHER_PASSWORD);
  assert.deepEqual(sixth, { ok: false, message: TOO_MANY });
  assert.deepEqual(await unlockContab(user, admin.cookie, PASSWORD), { ok: false, message: TOO_MANY });
  assert.equal((await db.select().from(contabUnlocks).where(eq(contabUnlocks.userId, admin.id))).length, 0);
});

dbTest("the password length cap: a password longer than PASSWORD_MAX_LENGTH never unlocks, even if its first 128 characters are right", async () => {
  const longPassword = "Aa1!".repeat(PASSWORD_MAX_LENGTH / 4);
  assert.equal(longPassword.length, PASSWORD_MAX_LENGTH);
  await clearAccess();
  assert.deepEqual(await setInitialContabPassword(longPassword), { ok: true });
  const admin = await newStaff("admin");
  const user = asUser(admin, "admin");
  assert.equal((await unlockContab(user, admin.cookie, longPassword + "x")).ok, false);
  assert.equal((await unlockContab(user, admin.cookie, longPassword + "x".repeat(5000))).ok, false);
  assert.equal((await unlockContab(user, admin.cookie, longPassword)).ok, true);
});

dbTest("changeContabPassword with a wrong current password fails and keeps the old one", async () => {
  await clearAccess();
  await setInitialContabPassword(PASSWORD);
  assert.equal((await changeContabPassword(OTHER_PASSWORD, NEW_PASSWORD)).ok, false);
  assert.equal((await changeContabPassword("a".repeat(PASSWORD_MAX_LENGTH + 100), NEW_PASSWORD)).ok, false);
  const [row] = await db.select().from(contabAccess).where(eq(contabAccess.id, 1));
  assert.equal(await verifyPassword(PASSWORD, row.passwordHash), true);
});

dbTest("changeContabPassword refuses a weak or unchanged new password and fails without a password set", async () => {
  await clearAccess();
  assert.equal((await changeContabPassword(PASSWORD, NEW_PASSWORD)).ok, false);
  assert.equal(await hasContabPassword(), false);
  await setInitialContabPassword(PASSWORD);
  assert.equal((await changeContabPassword(PASSWORD, "debole")).ok, false);
  assert.equal((await changeContabPassword(PASSWORD, PASSWORD)).ok, false);
  const [row] = await db.select().from(contabAccess).where(eq(contabAccess.id, 1));
  assert.equal(await verifyPassword(PASSWORD, row.passwordHash), true);
});

dbTest("changeContabPassword with the right current password replaces it", async () => {
  await clearAccess();
  await setInitialContabPassword(PASSWORD);
  assert.deepEqual(await changeContabPassword(PASSWORD, NEW_PASSWORD), { ok: true });
  const [row] = await db.select().from(contabAccess).where(eq(contabAccess.id, 1));
  assert.equal(await verifyPassword(NEW_PASSWORD, row.passwordHash), true);
  assert.equal(await verifyPassword(PASSWORD, row.passwordHash), false);
  const admin = await newStaff("admin");
  assert.equal((await unlockContab(asUser(admin, "admin"), admin.cookie, PASSWORD)).ok, false);
  assert.equal((await unlockContab(asUser(admin, "admin"), admin.cookie, NEW_PASSWORD)).ok, true);
});
