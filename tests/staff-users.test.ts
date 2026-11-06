import test, { after } from "node:test";
import assert from "node:assert/strict";
import { eq, like } from "drizzle-orm";

import { db } from "@/db";
import { staffSessions, staffUsers } from "@/db/schema";
import { passwordMeetsPolicy } from "@/lib/password-policy";
import { createSession, digest, getStaffUser, hashPassword, type StaffRole } from "@/lib/staff-auth";
import { verifyPassword } from "@/lib/customer-auth";
import {
  changeOwnPassword,
  createStaffUser,
  generatePassword,
  listStaffUsers,
  normalizeUsername,
  resetStaffPassword,
  setStaffActive,
  validateUsername,
} from "@/lib/staff-users";
import { createTestStaff } from "./helpers/staff";

// Anything touching the database only runs when TEST_DB points at a real dev database.
const dbTest = process.env.TEST_DB ? test : test.skip;

const STRONG = "Zz-test-Passw0rd-ok!";
const STRONG_2 = "Zz-test-Another-Passw0rd-2!";

const cleanups: Array<() => Promise<void>> = [];
after(async () => {
  for (const fn of cleanups) await fn();
  // Users created through createStaffUser are not tracked individually: sweep the zz-test- prefix.
  if (process.env.TEST_DB) {
    const rows = await db.select({ id: staffUsers.id }).from(staffUsers).where(like(staffUsers.username, "zz-test-%"));
    for (const row of rows) {
      await db.delete(staffSessions).where(eq(staffSessions.userId, row.id));
      await db.delete(staffUsers).where(eq(staffUsers.id, row.id));
    }
  }
});

// --- Pure functions (run locally, no database) -------------------------------------------------

test("normalizeUsername trims and lowercases", () => {
  assert.equal(normalizeUsername("  Mario "), "mario");
  assert.equal(normalizeUsername("ZZ-Test-X"), "zz-test-x");
});

test("validateUsername rejects bad names and accepts good ones", () => {
  assert.ok(validateUsername("ab"));
  assert.ok(validateUsername(""));
  assert.ok(validateUsername("mario rossi"));
  assert.ok(validateUsername("mario@x"));
  assert.ok(validateUsername("a".repeat(61)));
  assert.equal(validateUsername("mario.rossi-2"), null);
  assert.equal(validateUsername("mario_rossi"), null);
  assert.equal(validateUsername("a".repeat(60)), null);
  assert.equal(validateUsername("abc"), null);
});

test("validateUsername works on the normalized form only for lowercase input", () => {
  // Callers normalise first; an uppercase letter is not part of the allowed alphabet.
  assert.ok(validateUsername("Mario"));
  assert.equal(validateUsername(normalizeUsername("  Mario ")), null);
});

test("generatePassword is always policy-compliant, 16 characters and never repeats", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const pw = generatePassword();
    assert.equal(pw.length, 16);
    assert.ok(passwordMeetsPolicy(pw), `generated password violates the policy: run ${i}`);
    assert.ok(!seen.has(pw), "generated password repeated");
    seen.add(pw);
  }
});

test("generatePassword relies on crypto randomInt, never Math.random", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../src/lib/staff-users.ts", import.meta.url), "utf8");
  assert.ok(!/Math\.random/.test(source));
  assert.match(source, /randomInt/);
});

// --- Database-backed (skipped unless TEST_DB is set) -------------------------------------------

dbTest("createStaffUser rejects a weak password", async () => {
  const result = await createStaffUser({ username: "zz-test-weak", role: "operatore", password: "weak" });
  assert.equal(result.ok, false);
  const rows = await db.select().from(staffUsers).where(eq(staffUsers.username, "zz-test-weak"));
  assert.equal(rows.length, 0);
});

dbTest("createStaffUser rejects an invalid username", async () => {
  const result = await createStaffUser({ username: "zz test", role: "operatore", password: STRONG });
  assert.equal(result.ok, false);
});

dbTest("createStaffUser normalises the name, sets mustChangePassword and refuses duplicates in any case", async () => {
  const created = await createStaffUser({ username: " ZZ-Test-X ", role: "operatore", password: STRONG });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const [row] = await db.select().from(staffUsers).where(eq(staffUsers.id, created.id));
  assert.equal(row.username, "zz-test-x");
  assert.equal(row.role, "operatore");
  assert.equal(row.mustChangePassword, true);
  assert.equal(row.active, true);
  assert.equal(await verifyPassword(STRONG, row.passwordHash), true);

  const same = await createStaffUser({ username: "zz-test-x", role: "operatore", password: STRONG });
  assert.equal(same.ok, false);
  if (!same.ok) assert.match(same.message, /già esistente/);
  const upper = await createStaffUser({ username: "ZZ-TEST-X", role: "commercialista", password: STRONG });
  assert.equal(upper.ok, false);
  if (!upper.ok) assert.match(upper.message, /già esistente/);

  const all = await db.select().from(staffUsers).where(eq(staffUsers.username, "zz-test-x"));
  assert.equal(all.length, 1);
});

dbTest("createStaffUser reports a concurrent duplicate as già esistente instead of throwing", async () => {
  const results = await Promise.all([
    createStaffUser({ username: "zz-test-race", role: "operatore", password: STRONG }),
    createStaffUser({ username: "ZZ-test-race", role: "operatore", password: STRONG }),
    createStaffUser({ username: "zz-test-race ", role: "operatore", password: STRONG }),
  ]);
  assert.equal(results.filter(r => r.ok).length, 1);
  for (const r of results) if (!r.ok) assert.match(r.message, /già esistente/);
});

dbTest("createStaffUser accepts commercialista and refuses admin even when cast", async () => {
  const commercialista = await createStaffUser({ username: "zz-test-comm", role: "commercialista", password: STRONG });
  assert.equal(commercialista.ok, true);
  const admin = await createStaffUser({ username: "zz-test-adm", role: "admin" as unknown as "operatore", password: STRONG });
  assert.equal(admin.ok, false);
  const bogus = await createStaffUser({ username: "zz-test-bogus", role: "root" as unknown as "operatore", password: STRONG });
  assert.equal(bogus.ok, false);
  const rows = await db.select().from(staffUsers).where(like(staffUsers.username, "zz-test-adm%"));
  assert.equal(rows.length, 0);
});

dbTest("a freshly created user cannot pass guards until the password is changed", async () => {
  const created = await createStaffUser({ username: "zz-test-fresh", role: "operatore", password: STRONG });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const cookie = await createSession(created.id);
  assert.equal(await getStaffUser(cookie), null);
  const allowed = await getStaffUser(cookie, { allowMustChange: true });
  assert.equal(allowed?.mustChangePassword, true);
});

dbTest("listStaffUsers returns users ordered by name without password hashes", async () => {
  const a = await createStaffUser({ username: "zz-test-list-b", role: "operatore", password: STRONG });
  const b = await createStaffUser({ username: "zz-test-list-a", role: "commercialista", password: STRONG });
  assert.ok(a.ok && b.ok);
  const list = await listStaffUsers();
  const names = list.map(u => u.username);
  assert.deepEqual(names, [...names].sort());
  const mine = list.filter(u => u.username.startsWith("zz-test-list-"));
  assert.deepEqual(mine.map(u => u.username), ["zz-test-list-a", "zz-test-list-b"]);
  assert.equal(mine[0].role, "commercialista");
  assert.equal(mine[0].mustChangePassword, true);
  assert.equal(mine[0].active, true);
  assert.equal(mine[0].lastLoginAt, null);
  for (const u of list) assert.ok(!("passwordHash" in u));
});

dbTest("resetStaffPassword refuses an admin target", async () => {
  const admin = await createTestStaff("admin");
  cleanups.push(admin.cleanup);
  const result = await resetStaffPassword(admin.id, STRONG_2);
  assert.equal(result.ok, false);
  const [row] = await db.select().from(staffUsers).where(eq(staffUsers.id, admin.id));
  assert.equal(await verifyPassword(admin.password, row.passwordHash), true);
  assert.equal(row.mustChangePassword, false);
  assert.ok(await getStaffUser(admin.cookie));
});

dbTest("resetStaffPassword on an operatore changes the hash, sets mustChange and closes sessions", async () => {
  const op = await createTestStaff("operatore");
  cleanups.push(op.cleanup);
  assert.ok(await getStaffUser(op.cookie));
  const result = await resetStaffPassword(op.id, STRONG_2);
  assert.equal(result.ok, true);
  const [row] = await db.select().from(staffUsers).where(eq(staffUsers.id, op.id));
  assert.equal(await verifyPassword(STRONG_2, row.passwordHash), true);
  assert.equal(await verifyPassword(op.password, row.passwordHash), false);
  assert.equal(row.mustChangePassword, true);
  const sessions = await db.select().from(staffSessions).where(eq(staffSessions.userId, op.id));
  assert.equal(sessions.length, 0);
  assert.equal(await getStaffUser(op.cookie, { allowMustChange: true }), null);
});

dbTest("resetStaffPassword rejects weak passwords and unknown users", async () => {
  const op = await createTestStaff("operatore");
  cleanups.push(op.cleanup);
  const weak = await resetStaffPassword(op.id, "weak");
  assert.equal(weak.ok, false);
  const [row] = await db.select().from(staffUsers).where(eq(staffUsers.id, op.id));
  assert.equal(await verifyPassword(op.password, row.passwordHash), true);
  assert.ok(await getStaffUser(op.cookie));
  const missing = await resetStaffPassword("00000000-0000-4000-8000-000000000000", STRONG_2);
  assert.equal(missing.ok, false);
  const malformed = await resetStaffPassword("not-a-uuid", STRONG_2);
  assert.equal(malformed.ok, false);
});

dbTest("setStaffActive refuses the actor's own account and admin targets", async () => {
  const admin = await createTestStaff("admin");
  const otherAdmin = await createTestStaff("admin");
  cleanups.push(admin.cleanup, otherAdmin.cleanup);
  const self = await setStaffActive(admin.id, admin.id, false);
  assert.equal(self.ok, false);
  const other = await setStaffActive(admin.id, otherAdmin.id, false);
  assert.equal(other.ok, false);
  assert.ok(await getStaffUser(admin.cookie));
  assert.ok(await getStaffUser(otherAdmin.cookie));
});

dbTest("setStaffActive deactivates an operatore, closes sessions, and can reactivate", async () => {
  const admin = await createTestStaff("admin");
  const op = await createTestStaff("operatore");
  cleanups.push(admin.cleanup, op.cleanup);
  assert.ok(await getStaffUser(op.cookie));

  const off = await setStaffActive(admin.id, op.id, false);
  assert.equal(off.ok, true);
  assert.equal(await getStaffUser(op.cookie), null);
  const sessions = await db.select().from(staffSessions).where(eq(staffSessions.userId, op.id));
  assert.equal(sessions.length, 0);
  const [inactive] = await db.select().from(staffUsers).where(eq(staffUsers.id, op.id));
  assert.equal(inactive.active, false);

  const on = await setStaffActive(admin.id, op.id, true);
  assert.equal(on.ok, true);
  const [active] = await db.select().from(staffUsers).where(eq(staffUsers.id, op.id));
  assert.equal(active.active, true);
  // Old sessions stay closed after reactivation.
  assert.equal(await getStaffUser(op.cookie), null);
});

dbTest("setStaffActive reports an unknown target", async () => {
  const admin = await createTestStaff("admin");
  cleanups.push(admin.cleanup);
  const result = await setStaffActive(admin.id, "00000000-0000-4000-8000-000000000000", false);
  assert.equal(result.ok, false);
});

dbTest("changeOwnPassword rejects a wrong current password", async () => {
  const op = await createTestStaff("operatore");
  cleanups.push(op.cleanup);
  const result = await changeOwnPassword(op.id, op.cookie, "Wrong-Current-1!x", STRONG_2);
  assert.equal(result.ok, false);
  const [row] = await db.select().from(staffUsers).where(eq(staffUsers.id, op.id));
  assert.equal(await verifyPassword(op.password, row.passwordHash), true);
});

dbTest("changeOwnPassword rejects a weak new password and a new password equal to the current one", async () => {
  const op = await createTestStaff("operatore");
  cleanups.push(op.cleanup);
  const weak = await changeOwnPassword(op.id, op.cookie, op.password, "weak");
  assert.equal(weak.ok, false);
  const same = await changeOwnPassword(op.id, op.cookie, op.password, op.password);
  assert.equal(same.ok, false);
  const [row] = await db.select().from(staffUsers).where(eq(staffUsers.id, op.id));
  assert.equal(await verifyPassword(op.password, row.passwordHash), true);
});

dbTest("changeOwnPassword clears mustChange and keeps only the current session", async () => {
  const op = await createTestStaff("operatore", { mustChange: true });
  cleanups.push(op.cleanup);
  const otherCookie = await createSession(op.id);
  assert.equal(await getStaffUser(op.cookie), null);
  assert.ok(await getStaffUser(op.cookie, { allowMustChange: true }));

  const result = await changeOwnPassword(op.id, op.cookie, op.password, STRONG_2);
  assert.equal(result.ok, true);

  const [row] = await db.select().from(staffUsers).where(eq(staffUsers.id, op.id));
  assert.equal(row.mustChangePassword, false);
  assert.equal(await verifyPassword(STRONG_2, row.passwordHash), true);
  const sessions = await db.select().from(staffSessions).where(eq(staffSessions.userId, op.id));
  assert.deepEqual(sessions.map(s => s.tokenHash), [digest(op.cookie)]);
  assert.ok(await getStaffUser(op.cookie));
  assert.equal(await getStaffUser(otherCookie), null);
});

dbTest("changeOwnPassword refuses an inactive or unknown user", async () => {
  const gone = await createTestStaff("operatore", { active: false });
  cleanups.push(gone.cleanup);
  const inactive = await changeOwnPassword(gone.id, gone.cookie, gone.password, STRONG_2);
  assert.equal(inactive.ok, false);
  const unknown = await changeOwnPassword("00000000-0000-4000-8000-000000000000", "x", STRONG, STRONG_2);
  assert.equal(unknown.ok, false);
});

dbTest("hashes are never part of any returned value", async () => {
  const roles: StaffRole[] = ["operatore"];
  const op = await createTestStaff(roles[0]);
  cleanups.push(op.cleanup);
  const hash = await hashPassword(STRONG_2);
  const results = [
    await resetStaffPassword(op.id, STRONG_2),
    await changeOwnPassword(op.id, op.cookie, STRONG_2, STRONG),
    await listStaffUsers(),
  ];
  assert.ok(!JSON.stringify(results).includes("scrypt-v1"));
  assert.ok(hash.startsWith("scrypt-v1"));
});
