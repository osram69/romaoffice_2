import { randomBytes, createHash } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { staffSessions, staffUsers } from "@/db/schema";
import { hashPassword, verifyPassword } from "./customer-auth";

export const STAFF_SESSION_COOKIE = "ros_staff_session";
export const STAFF_SESSION_SECONDS = 60 * 60 * 8;

export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const token = () => randomBytes(32).toString("hex");
export { hashPassword };

export type StaffRole = "admin" | "operatore";
export type StaffUser = { id: string; username: string; role: StaffRole };

export async function login(username: string, password: string): Promise<StaffUser | null> {
  const [user] = await db.select().from(staffUsers).where(eq(staffUsers.username, username.trim().toLowerCase())).limit(1);
  if (!user || !user.active) { await verifyPassword(password, null); return null; }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  await db.update(staffUsers).set({ lastLoginAt: new Date() }).where(eq(staffUsers.id, user.id));
  return { id: user.id, username: user.username, role: user.role };
}

export async function createSession(userId: string) {
  const raw = token();
  await db.insert(staffSessions).values({ userId, tokenHash: digest(raw), expiresAt: new Date(Date.now() + STAFF_SESSION_SECONDS * 1000) });
  return raw;
}

export async function destroySession(raw: string | undefined) {
  if (!raw) return;
  await db.delete(staffSessions).where(eq(staffSessions.tokenHash, digest(raw)));
}

export async function getStaffUser(sessionCookie: string | undefined): Promise<StaffUser | null> {
  if (!sessionCookie || !/^[a-f0-9]{64}$/.test(sessionCookie)) return null;
  const [row] = await db.select({ user: staffUsers }).from(staffSessions)
    .innerJoin(staffUsers, eq(staffUsers.id, staffSessions.userId))
    .where(and(eq(staffSessions.tokenHash, digest(sessionCookie)), gt(staffSessions.expiresAt, new Date()), eq(staffUsers.active, true)))
    .limit(1);
  if (!row) return null;
  return { id: row.user.id, username: row.user.username, role: row.user.role };
}
