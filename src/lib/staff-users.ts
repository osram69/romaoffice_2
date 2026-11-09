import { randomInt } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { staffUsers } from "@/db/schema";
import { hashPassword, verifyPassword } from "./customer-auth";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, passwordMeetsPolicy } from "./password-policy";
import { revokeStaffSessions, type StaffRole } from "./staff-auth";

type Result = { ok: true } | { ok: false; message: string };

const USERNAME_PATTERN = /^[a-z0-9._-]{3,60}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ASSIGNABLE_ROLES: readonly string[] = ["operatore", "commercialista"];

const POLICY_MESSAGE = `La password deve avere da ${PASSWORD_MIN_LENGTH} a ${PASSWORD_MAX_LENGTH} caratteri, con maiuscola, minuscola, numero e carattere speciale.`;
const USERNAME_TAKEN_MESSAGE = "Nome utente già esistente.";
const NOT_FOUND_MESSAGE = "Utente non trovato.";
const NOT_ALLOWED_MESSAGE = "Operazione non consentita per questo utente.";

export const normalizeUsername = (raw: string) => raw.trim().toLowerCase();

/** Error message in Italian, or null when valid. Expects an already normalised name (uppercase is rejected). */
export function validateUsername(raw: string): string | null {
  return USERNAME_PATTERN.test(raw)
    ? null
    : "Il nome utente deve avere da 3 a 60 caratteri: lettere minuscole, numeri, punto, trattino o underscore.";
}

// Characters that are easy to confuse (0/O, 1/l/I) are left out so a generated password can be read out or copied by hand.
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SPECIAL = "!@#$%&*?-_+=";
const GENERATED_LENGTH = 16;

const pick = (alphabet: string) => alphabet[randomInt(alphabet.length)];

/** 16 random characters (crypto `randomInt`), always satisfying the password policy. */
export function generatePassword(): string {
  const all = UPPER + LOWER + DIGITS + SPECIAL;
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SPECIAL)];
  while (chars.length < GENERATED_LENGTH) chars.push(pick(all));
  // Fisher-Yates, so the guaranteed characters do not always sit at the start.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

// node-postgres puts the SQLSTATE in `code`; Drizzle may wrap the driver error in `cause`.
function isUniqueViolation(error: unknown): boolean {
  for (let current: unknown = error, depth = 0; current && typeof current === "object" && depth < 3; depth++) {
    if ((current as { code?: unknown }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export async function listStaffUsers(): Promise<{ id: string; username: string; role: StaffRole; active: boolean; mustChangePassword: boolean; lastLoginAt: Date | null }[]> {
  // Explicit column list: the password hash never leaves this module.
  return db.select({
    id: staffUsers.id,
    username: staffUsers.username,
    role: staffUsers.role,
    active: staffUsers.active,
    mustChangePassword: staffUsers.mustChangePassword,
    lastLoginAt: staffUsers.lastLoginAt,
  }).from(staffUsers).orderBy(asc(staffUsers.username));
}

export async function createStaffUser(input: { username: string; role: "operatore" | "commercialista"; password: string }): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  // Callers can cast, so the role is checked at runtime too: admin accounts are never created from here.
  if (!ASSIGNABLE_ROLES.includes(input.role)) return { ok: false, message: "Ruolo non valido." };
  const username = normalizeUsername(input.username);
  const usernameError = validateUsername(username);
  if (usernameError) return { ok: false, message: usernameError };
  if (!passwordMeetsPolicy(input.password)) return { ok: false, message: POLICY_MESSAGE };

  const [existing] = await db.select({ id: staffUsers.id }).from(staffUsers).where(eq(staffUsers.username, username)).limit(1);
  if (existing) return { ok: false, message: USERNAME_TAKEN_MESSAGE };

  try {
    const [created] = await db.insert(staffUsers).values({
      username,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      active: true,
      mustChangePassword: true,
    }).returning({ id: staffUsers.id });
    return { ok: true, id: created.id };
  } catch (error) {
    // Two requests can both pass the check above: the unique constraint decides.
    if (isUniqueViolation(error)) return { ok: false, message: USERNAME_TAKEN_MESSAGE };
    throw error;
  }
}

async function findTarget(targetId: string) {
  if (!UUID_PATTERN.test(targetId)) return null;
  const [user] = await db.select({ id: staffUsers.id, role: staffUsers.role }).from(staffUsers).where(eq(staffUsers.id, targetId)).limit(1);
  return user ?? null;
}

/** Admin-initiated reset: the user must pick a new password at the next login and every session is closed. Admin accounts are refused. */
export async function resetStaffPassword(targetId: string, newPassword: string): Promise<Result> {
  if (!passwordMeetsPolicy(newPassword)) return { ok: false, message: POLICY_MESSAGE };
  const target = await findTarget(targetId);
  if (!target) return { ok: false, message: NOT_FOUND_MESSAGE };
  if (target.role === "admin") return { ok: false, message: NOT_ALLOWED_MESSAGE };

  // The role condition repeats in the UPDATE so a role change between the read and the write cannot slip through.
  const updated = await db.update(staffUsers)
    .set({ passwordHash: await hashPassword(newPassword), mustChangePassword: true })
    .where(and(eq(staffUsers.id, target.id), eq(staffUsers.role, target.role)))
    .returning({ id: staffUsers.id });
  if (updated.length === 0) return { ok: false, message: NOT_FOUND_MESSAGE };
  await revokeStaffSessions(target.id);
  return { ok: true };
}

/** Activate or deactivate an account (no deletion). Refuses the actor's own account and admin targets; deactivation closes sessions. */
export async function setStaffActive(actorId: string, targetId: string, active: boolean): Promise<Result> {
  if (actorId === targetId) return { ok: false, message: "Non puoi modificare il tuo stesso account." };
  const target = await findTarget(targetId);
  if (!target) return { ok: false, message: NOT_FOUND_MESSAGE };
  if (target.role === "admin") return { ok: false, message: NOT_ALLOWED_MESSAGE };

  const updated = await db.update(staffUsers)
    .set({ active })
    .where(and(eq(staffUsers.id, target.id), eq(staffUsers.role, target.role)))
    .returning({ id: staffUsers.id });
  if (updated.length === 0) return { ok: false, message: NOT_FOUND_MESSAGE };
  if (!active) await revokeStaffSessions(target.id);
  return { ok: true };
}

/** Self-service change: needs the current password, closes the user's other sessions and keeps the one in `currentRawSession`. */
export async function changeOwnPassword(userId: string, currentRawSession: string, current: string, next: string): Promise<Result> {
  const failure = { ok: false as const, message: "Impossibile cambiare la password." };
  const [user] = UUID_PATTERN.test(userId)
    ? await db.select().from(staffUsers).where(eq(staffUsers.id, userId)).limit(1)
    : [];
  if (!user || !user.active) {
    // Same work as the normal path, so timing does not tell whether the account exists.
    await verifyPassword(current, null);
    return failure;
  }
  if (!(await verifyPassword(current, user.passwordHash))) return { ok: false, message: "La password attuale non è corretta." };
  if (!passwordMeetsPolicy(next)) return { ok: false, message: POLICY_MESSAGE };
  if (next === current) return { ok: false, message: "La nuova password deve essere diversa da quella attuale." };

  // Conditional on the hash we verified: a concurrent change makes this one fail instead of overwriting it.
  const updated = await db.update(staffUsers)
    .set({ passwordHash: await hashPassword(next), mustChangePassword: false })
    .where(and(eq(staffUsers.id, user.id), eq(staffUsers.passwordHash, user.passwordHash)))
    .returning({ id: staffUsers.id });
  if (updated.length === 0) return failure;
  await revokeStaffSessions(user.id, currentRawSession);
  return { ok: true };
}
