import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";

import { db, pool } from "@/db";
import { authLimits, contabAccess, contabUnlocks } from "@/db/schema";
import { PASSWORD_MAX_LENGTH } from "@/lib/password-policy";
import { createSession } from "@/lib/staff-auth";
import { verifyPassword } from "@/lib/customer-auth";
import { checkContabAccess, setInitialContabPassword, unlockContab } from "@/lib/contab-auth";
import { TOO_MANY_ATTEMPTS, performContabPasswordChange } from "@/app/gestione-contabilita-x9k2m7/change";
import { createTestStaff } from "./helpers/staff";

// Anything touching the database only runs when TEST_DB points at a real dev database.
const dbTest = process.env.TEST_DB ? test : test.skip;

// limit() derives its key with AUTH_SECRET; set a dummy one once for every DB test.
process.env.AUTH_SECRET ||= "zz-test-secret-".padEnd(40, "x");

const PASSWORD = "Zz-test-Contab-Passw0rd!";
const NEW_PASSWORD = "Zz-test-Contab-New-Passw0rd!";

const cleanups: Array<() => Promise<void>> = [];
let savedAccess: typeof contabAccess.$inferSelect | undefined;

// The real contab_access row (if the dev database has one) is saved and put back afterwards.
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

const limiterKey = (userId: string) => createHmac("sha256", process.env.AUTH_SECRET!).update(`contab-pw-change:${userId}`).digest("hex");
const unlockLimiterKey = (userId: string) => createHmac("sha256", process.env.AUTH_SECRET!).update(`contab-unlock:${userId}`).digest("hex");

// A zz-test- admin; its sessions, unlocks and both rate-limiter rows are removed afterwards.
async function newAdmin() {
  const staff = await createTestStaff("admin");
  cleanups.push(async () => {
    await db.delete(authLimits).where(eq(authLimits.key, limiterKey(staff.id)));
    await db.delete(authLimits).where(eq(authLimits.key, unlockLimiterKey(staff.id)));
    await staff.cleanup();
  });
  return { staff, user: { id: staff.id, username: staff.username, role: "admin" as const, mustChangePassword: false } };
}

async function resetSecondPassword() {
  await db.delete(contabAccess).where(eq(contabAccess.id, 1));
  assert.deepEqual(await setInitialContabPassword(PASSWORD), { ok: true });
}

async function unlock(admin: Awaited<ReturnType<typeof newAdmin>>, sessionRaw: string) {
  const result = await unlockContab(admin.user, sessionRaw, PASSWORD);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("unlock failed");
  return result.unlockRaw;
}

dbTest("performContabPasswordChange: success replaces the password, keeps the caller's unlock and closes the others", async () => {
  await resetSecondPassword();
  const admin = await newAdmin();
  const callerUnlock = await unlock(admin, admin.staff.cookie);
  const secondSession = await createSession(admin.staff.id);
  const secondUnlock = await unlock(admin, secondSession);

  const result = await performContabPasswordChange(admin.user, admin.staff.cookie, { current: PASSWORD, next: NEW_PASSWORD, confirm: NEW_PASSWORD });
  assert.equal(result.ok, true);

  const [row] = await db.select().from(contabAccess).where(eq(contabAccess.id, 1));
  assert.equal(await verifyPassword(NEW_PASSWORD, row.passwordHash), true);
  assert.equal((await checkContabAccess(admin.staff.cookie, callerUnlock))?.id, admin.staff.id);
  assert.equal(await checkContabAccess(secondSession, secondUnlock), null);
  assert.equal((await db.select().from(contabUnlocks).where(eq(contabUnlocks.userId, admin.staff.id))).length, 1);
});

dbTest("performContabPasswordChange: a wrong current password is an error value, not a throw, and closes no unlock", async () => {
  await resetSecondPassword();
  const admin = await newAdmin();
  const callerUnlock = await unlock(admin, admin.staff.cookie);
  const secondSession = await createSession(admin.staff.id);
  const secondUnlock = await unlock(admin, secondSession);

  const result = await performContabPasswordChange(admin.user, admin.staff.cookie, { current: "Zz-test-Wrong-Passw0rd!", next: NEW_PASSWORD, confirm: NEW_PASSWORD });
  assert.equal(result.ok, false);
  assert.ok(result.message);
  const [row] = await db.select().from(contabAccess).where(eq(contabAccess.id, 1));
  assert.equal(await verifyPassword(PASSWORD, row.passwordHash), true);
  assert.equal((await checkContabAccess(admin.staff.cookie, callerUnlock))?.id, admin.staff.id);
  assert.equal((await checkContabAccess(secondSession, secondUnlock))?.id, admin.staff.id);
});

dbTest("performContabPasswordChange: the 6th attempt in the window is refused with the generic message, even with the right password", async () => {
  await resetSecondPassword();
  const admin = await newAdmin();
  for (let i = 1; i <= 5; i++) {
    const result = await performContabPasswordChange(admin.user, admin.staff.cookie, { current: `Zz-test-Wrong-${i}-Passw0rd!`, next: NEW_PASSWORD, confirm: NEW_PASSWORD });
    assert.equal(result.ok, false, `attempt ${i}`);
    assert.notEqual(result.message, TOO_MANY_ATTEMPTS, `attempt ${i}`);
  }
  const blocked = await performContabPasswordChange(admin.user, admin.staff.cookie, { current: PASSWORD, next: NEW_PASSWORD, confirm: NEW_PASSWORD });
  assert.deepEqual(blocked, { ok: false, message: TOO_MANY_ATTEMPTS });
  assert.equal(TOO_MANY_ATTEMPTS, "Troppi tentativi, riprova tra qualche minuto");
  const [row] = await db.select().from(contabAccess).where(eq(contabAccess.id, 1));
  assert.equal(await verifyPassword(PASSWORD, row.passwordHash), true, "the blocked attempt changed nothing");
});

dbTest("performContabPasswordChange: oversize input is refused before the limiter and the hashing", async () => {
  await resetSecondPassword();
  const admin = await newAdmin();
  const long = "a".repeat(PASSWORD_MAX_LENGTH + 1);
  for (let i = 0; i < 8; i++) {
    const current = await performContabPasswordChange(admin.user, admin.staff.cookie, { current: long, next: NEW_PASSWORD, confirm: NEW_PASSWORD });
    assert.equal(current.ok, false);
    const next = await performContabPasswordChange(admin.user, admin.staff.cookie, { current: PASSWORD, next: long, confirm: long });
    assert.equal(next.ok, false);
  }
  assert.equal((await db.select().from(authLimits).where(eq(authLimits.key, limiterKey(admin.staff.id)))).length, 0, "no attempt was counted");
  const [row] = await db.select().from(contabAccess).where(eq(contabAccess.id, 1));
  assert.equal(await verifyPassword(PASSWORD, row.passwordHash), true);
});
