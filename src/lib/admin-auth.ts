import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "ros_admin_session";
const SESSION_SECONDS = 60 * 60 * 8;

function secret() {
  const value = process.env.ADMIN_DASHBOARD_SECRET || process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("ADMIN_DASHBOARD_SECRET (or AUTH_SECRET) must be at least 32 characters");
  return value;
}

function sign(expiresAt: number) {
  return createHmac("sha256", secret()).update(`admin-dashboard:${expiresAt}`).digest("hex");
}

export function createAdminSessionCookie() {
  const expiresAt = Date.now() + SESSION_SECONDS * 1000;
  return { value: `${expiresAt}.${sign(expiresAt)}`, maxAge: SESSION_SECONDS };
}

export function verifyAdminSessionCookie(value: string | undefined) {
  if (!value) return false;
  const [expiresAtRaw, signature] = value.split(".");
  const expiresAt = Number(expiresAtRaw);
  if (!expiresAt || !signature || expiresAt < Date.now()) return false;
  const expected = sign(expiresAt);
  return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function checkAdminPassword(password: string) {
  const expected = process.env.ADMIN_DASHBOARD_PASSWORD;
  if (!expected || !password) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
