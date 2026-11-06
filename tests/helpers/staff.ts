import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { staffSessions, staffUsers } from "@/db/schema";
import { STAFF_SESSION_COOKIE, createSession, hashPassword, type StaffRole } from "@/lib/staff-auth";

// DB-backed helper: only call it from tests guarded with `dbTest` (needs a real dev database).
export async function createTestStaff(role: StaffRole, opts: { mustChange?: boolean; active?: boolean } = {}) {
  const username = `zz-test-${randomUUID().slice(0, 8)}`;
  const password = `Zz-test-${randomUUID().slice(0, 12)}-1!`;
  const [user] = await db.insert(staffUsers).values({
    username,
    passwordHash: await hashPassword(password),
    role,
    active: opts.active ?? true,
    mustChangePassword: opts.mustChange ?? false,
  }).returning();
  const cookie = await createSession(user.id);
  return {
    id: user.id,
    username,
    password,
    cookie,
    // Sessions and contab_unlocks cascade from the user row, but delete sessions explicitly first for clarity.
    async cleanup() {
      await db.delete(staffSessions).where(eq(staffSessions.userId, user.id));
      await db.delete(staffUsers).where(eq(staffUsers.id, user.id));
    },
  };
}

export function staffRequest(url: string, cookie?: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (cookie) headers.set("cookie", `${STAFF_SESSION_COOKIE}=${cookie}`);
  // NextRequest's init type does not accept `signal: null`, which the DOM RequestInit allows.
  return new NextRequest(url, { ...init, headers, signal: init.signal ?? undefined });
}
