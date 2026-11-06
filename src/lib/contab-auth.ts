import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { contabAccess, contabUnlocks } from "@/db/schema";
import { CustomerError, limit, verifyPassword } from "./customer-auth";
import { boundPassword } from "./contab-password";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, passwordMeetsPolicy } from "./password-policy";
import { logSafeError } from "./safe-log";
import { STAFF_SESSION_COOKIE, digest, getStaffUser, hashPassword, token, type StaffUser } from "./staff-auth";

export const CONTAB_UNLOCK_COOKIE = "ros_contab_unlock";
export const CONTAB_UNLOCK_SECONDS = 1800;

// Single-row table: the second password of the whole Contabilità area.
const ACCESS_ROW_ID = 1;
const HEX_TOKEN = /^[a-f0-9]{64}$/;

const POLICY_MESSAGE = `La password deve avere da ${PASSWORD_MIN_LENGTH} a ${PASSWORD_MAX_LENGTH} caratteri, con maiuscola, minuscola, numero e carattere speciale.`;
const TOO_MANY_MESSAGE = "Troppi tentativi, riprova tra qualche minuto";
const UNLOCK_FAILED_MESSAGE = "Password non corretta.";
const CURRENT_WRONG_MESSAGE = "La password attuale non è corretta.";
const GENERIC_FAILURE_MESSAGE = "Operazione non riuscita, riprova.";

type Result = { ok: true } | { ok: false; message: string };

async function readAccessHash(): Promise<string | null> {
  const [row] = await db.select({ passwordHash: contabAccess.passwordHash }).from(contabAccess).where(eq(contabAccess.id, ACCESS_ROW_ID)).limit(1);
  return row?.passwordHash ?? null;
}

export async function hasContabPassword(): Promise<boolean> {
  return (await readAccessHash()) !== null;
}

/** First-time setup. Race-safe: the insert does nothing when the row exists, and only the call that inserted it succeeds. */
export async function setInitialContabPassword(password: string): Promise<Result> {
  if (!passwordMeetsPolicy(password)) return { ok: false, message: POLICY_MESSAGE };
  try {
    const inserted = await db.insert(contabAccess)
      .values({ id: ACCESS_ROW_ID, passwordHash: await hashPassword(password) })
      .onConflictDoNothing({ target: contabAccess.id })
      .returning({ id: contabAccess.id });
    if (inserted.length === 0) return { ok: false, message: "La seconda password è già stata impostata." };
    return { ok: true };
  } catch (error) {
    logSafeError("Contab second password setup failed", error);
    return { ok: false, message: GENERIC_FAILURE_MESSAGE };
  }
}

/** Needs the current password. The update is conditional on the hash that was verified, so a concurrent change makes it fail. */
export async function changeContabPassword(current: string, next: string): Promise<Result> {
  try {
    const storedHash = await readAccessHash();
    const { candidate, withinLimit } = boundPassword(current);
    // Always hash, even without a stored password, so the time does not tell what exists.
    const matches = await verifyPassword(candidate, storedHash);
    if (!storedHash || !matches || !withinLimit) return { ok: false, message: CURRENT_WRONG_MESSAGE };
    if (!passwordMeetsPolicy(next)) return { ok: false, message: POLICY_MESSAGE };
    if (next === current) return { ok: false, message: "La nuova password deve essere diversa da quella attuale." };

    const updated = await db.update(contabAccess)
      .set({ passwordHash: await hashPassword(next), updatedAt: new Date() })
      .where(and(eq(contabAccess.id, ACCESS_ROW_ID), eq(contabAccess.passwordHash, storedHash)))
      .returning({ id: contabAccess.id });
    if (updated.length === 0) return { ok: false, message: GENERIC_FAILURE_MESSAGE };
    return { ok: true };
  } catch (error) {
    logSafeError("Contab second password change failed", error);
    return { ok: false, message: GENERIC_FAILURE_MESSAGE };
  }
}

/**
 * Checks the second password and, when right, opens an unlock bound to the staff session `sessionRaw`.
 * Never throws. The wrong-password and right-password paths do the same work up to the final comparison.
 */
export async function unlockContab(user: StaffUser, sessionRaw: string, password: string): Promise<{ ok: true; unlockRaw: string } | { ok: false; message: string }> {
  try {
    try {
      await limit("contab-unlock:" + user.id, 5, 900);
    } catch (error) {
      if (error instanceof CustomerError && error.code === "limited") return { ok: false, message: TOO_MANY_MESSAGE };
      throw error;
    }

    // The session must be a live one of this very (admin) user, otherwise an unlock bound to it would be meaningless.
    const sessionUser = await getStaffUser(sessionRaw);
    const allowed = sessionUser !== null && sessionUser.id === user.id && sessionUser.role === "admin";
    const storedHash = await readAccessHash();
    const { candidate, withinLimit } = boundPassword(password);
    const matches = await verifyPassword(candidate, storedHash);
    if (!allowed || !storedHash || !matches || !withinLimit) return { ok: false, message: UNLOCK_FAILED_MESSAGE };

    const unlockRaw = token();
    const now = new Date();
    // Housekeeping: this user's lapsed unlocks are of no use any more.
    await db.delete(contabUnlocks).where(and(eq(contabUnlocks.userId, user.id), lt(contabUnlocks.expiresAt, now)));
    await db.insert(contabUnlocks).values({
      tokenHash: digest(unlockRaw),
      userId: user.id,
      sessionTokenHash: digest(sessionRaw),
      lastSeenAt: now,
      expiresAt: new Date(now.getTime() + CONTAB_UNLOCK_SECONDS * 1000),
    });
    return { ok: true, unlockRaw };
  } catch (error) {
    logSafeError("Contab unlock failed", error);
    return { ok: false, message: GENERIC_FAILURE_MESSAGE };
  }
}

/**
 * The admin, only when: the staff session is valid (not expired, user active, no forced password change), the user is an
 * admin, and an unlock row exists for this token, this user and exactly this session and has not expired. A successful
 * check slides the expiry 30 minutes ahead in the same UPDATE. Fails closed (null) on anything else, DB errors included.
 */
export async function checkContabAccess(sessionRaw: string | undefined, unlockRaw: string | undefined): Promise<StaffUser | null> {
  if (!sessionRaw || !unlockRaw || !HEX_TOKEN.test(sessionRaw) || !HEX_TOKEN.test(unlockRaw)) return null;
  try {
    const user = await getStaffUser(sessionRaw);
    if (!user || user.role !== "admin") return null;
    const now = new Date();
    const touched = await db.update(contabUnlocks)
      .set({ lastSeenAt: now, expiresAt: new Date(now.getTime() + CONTAB_UNLOCK_SECONDS * 1000) })
      .where(and(
        eq(contabUnlocks.tokenHash, digest(unlockRaw)),
        eq(contabUnlocks.userId, user.id),
        eq(contabUnlocks.sessionTokenHash, digest(sessionRaw)),
        gt(contabUnlocks.expiresAt, now),
      ))
      .returning({ id: contabUnlocks.id });
    return touched.length === 1 ? user : null;
  } catch (error) {
    logSafeError("Contab access check failed", error);
    return null;
  }
}

/** For route handlers (API). */
export function contabAccessFromRequest(req: NextRequest): Promise<StaffUser | null> {
  return checkContabAccess(req.cookies.get(STAFF_SESSION_COOKIE)?.value, req.cookies.get(CONTAB_UNLOCK_COOKIE)?.value);
}

/** For pages and Server Actions. */
export async function contabAccessFromCookies(): Promise<StaffUser | null> {
  const store = await cookies();
  return checkContabAccess(store.get(STAFF_SESSION_COOKIE)?.value, store.get(CONTAB_UNLOCK_COOKIE)?.value);
}
