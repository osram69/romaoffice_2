import { randomBytes, createHash } from "node:crypto";
import { and, eq, gt, ne } from "drizzle-orm";
import { db } from "@/db";
import { contabUnlocks, staffSessions, staffUsers } from "@/db/schema";
import { CustomerError, hashPassword, limit, verifyPassword } from "./customer-auth";

export const STAFF_SESSION_COOKIE = "ros_staff_session";
export const STAFF_SESSION_SECONDS = 60 * 60 * 8;

export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const token = () => randomBytes(32).toString("hex");
export { hashPassword };

export type StaffRole = "admin" | "operatore" | "commercialista";
export type StaffUser = { id: string; username: string; role: StaffRole; mustChangePassword: boolean };

export const PASSWORD_CHANGE_PATH = "/gestione-password-x9k2m7";

const HOME: Record<StaffRole, string> = {
  admin: "/gestione-tariffe-x9k2m7",
  operatore: "/gestione-domiciliazioni-x9k2m7",
  commercialista: "/commercialista-x9k2m7",
};
const ADMIN_NEXT_PREFIXES = [
  "/gestione-tariffe-x9k2m7",
  "/gestione-domiciliazioni-x9k2m7",
  "/gestione-ordini-x9k2m7",
  "/gestione-configurazione-x9k2m7",
  "/gestione-contabilita-x9k2m7",
  "/gestione-utenti-x9k2m7",
];
const OPERATOR_NEXT_PREFIXES = ["/gestione-domiciliazioni-x9k2m7"];

/** Admin and operatore run the day-to-day dashboard; commercialista only sees the accountant download page. */
export const isOperational = (role: StaffRole) => role === "admin" || role === "operatore";
export const roleHome = (role: StaffRole) => HOME[role];

// `next` must be exactly the prefix or continue with a path/query/hash separator, so lookalikes
// such as "/gestione-tariffe-x9k2m7.evil.example" are not accepted.
const underPrefix = (next: string, prefix: string) => next === prefix || [`${prefix}/`, `${prefix}?`, `${prefix}#`].some(p => next.startsWith(p));

/** Where to send a user right after a successful login. `next` is untrusted (query parameter). */
export function postLoginPath(user: StaffUser, next: string) {
  if (user.mustChangePassword) return PASSWORD_CHANGE_PATH;
  if (user.role === "commercialista") return roleHome(user.role);
  const allowed = user.role === "admin" ? ADMIN_NEXT_PREFIXES : OPERATOR_NEXT_PREFIXES;
  return allowed.some(prefix => underPrefix(next, prefix)) ? next : roleHome(user.role);
}

/** Login attempts per user name: at most 10 every 15 minutes. False (not an exception) once exceeded. */
export async function staffLoginAllowed(username: string) {
  try {
    await limit("staff-login:" + username.trim().toLowerCase(), 10, 900);
    return true;
  } catch (error) {
    if (error instanceof CustomerError && error.code === "limited") return false;
    throw error;
  }
}

// Succeeds for users who must change password too: the login action sends them to the password page,
// and getStaffUser keeps every other page closed to them.
export async function login(username: string, password: string): Promise<StaffUser | null> {
  const [user] = await db.select().from(staffUsers).where(eq(staffUsers.username, username.trim().toLowerCase())).limit(1);
  if (!user || !user.active) { await verifyPassword(password, null); return null; }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  await db.update(staffUsers).set({ lastLoginAt: new Date() }).where(eq(staffUsers.id, user.id));
  return { id: user.id, username: user.username, role: user.role, mustChangePassword: user.mustChangePassword };
}

export async function createSession(userId: string) {
  const raw = token();
  await db.insert(staffSessions).values({ userId, tokenHash: digest(raw), expiresAt: new Date(Date.now() + STAFF_SESSION_SECONDS * 1000) });
  return raw;
}

export async function destroySession(raw: string | undefined) {
  if (!raw) return;
  const hash = digest(raw);
  // Contabilità unlocks are bound to the session that created them: they die with it.
  await db.transaction(async tx => {
    await tx.delete(contabUnlocks).where(eq(contabUnlocks.sessionTokenHash, hash));
    await tx.delete(staffSessions).where(eq(staffSessions.tokenHash, hash));
  });
}

/** Closes all sessions (and Contabilità unlocks) of a user, optionally keeping the one identified by `exceptRawToken`. */
export async function revokeStaffSessions(userId: string, exceptRawToken?: string) {
  const keep = exceptRawToken ? digest(exceptRawToken) : null;
  await db.transaction(async tx => {
    await tx.delete(contabUnlocks).where(keep
      ? and(eq(contabUnlocks.userId, userId), ne(contabUnlocks.sessionTokenHash, keep))
      : eq(contabUnlocks.userId, userId));
    await tx.delete(staffSessions).where(keep
      ? and(eq(staffSessions.userId, userId), ne(staffSessions.tokenHash, keep))
      : eq(staffSessions.userId, userId));
  });
}

/** Fail closed: a user who must change password gets null (every existing guard then denies access) unless `allowMustChange`. */
export async function getStaffUser(sessionCookie: string | undefined, opts: { allowMustChange?: boolean } = {}): Promise<StaffUser | null> {
  if (!sessionCookie || !/^[a-f0-9]{64}$/.test(sessionCookie)) return null;
  const [row] = await db.select({ user: staffUsers }).from(staffSessions)
    .innerJoin(staffUsers, eq(staffUsers.id, staffSessions.userId))
    .where(and(eq(staffSessions.tokenHash, digest(sessionCookie)), gt(staffSessions.expiresAt, new Date()), eq(staffUsers.active, true)))
    .limit(1);
  if (!row) return null;
  if (row.user.mustChangePassword && opts.allowMustChange !== true) return null;
  return { id: row.user.id, username: row.user.username, role: row.user.role, mustChangePassword: row.user.mustChangePassword };
}
