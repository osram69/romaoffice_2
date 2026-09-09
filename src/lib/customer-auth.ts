import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { authLimits, customers, customerSessions } from "@/db/schema";
import type { Lang } from "@/lib/site";

export const SESSION_COOKIE = "ros_customer_session";
export const CHALLENGE_COOKIE = "ros_customer_challenge";
export const SESSION_SECONDS = 60 * 60 * 2;
export const OTP_SECONDS = 5 * 60;
export class CustomerError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
export function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new CustomerError("unavailable", 503);
  return value;
}
export const token = () => randomBytes(32).toString("hex");
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const otpDigest = (challenge: string, code: string) => createHmac("sha256", secret()).update(`customer-login:${challenge}:${code}`).digest("hex");
export function constantEqual(a: string, b: string) {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (err, key) => err ? reject(err) : resolve(key)));
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt-v1$${salt}$${(await derive(password, salt)).toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string | null) {
  const [version, salt, hash] = (stored || "scrypt-v1$unregistered-account-salt$" + "0".repeat(128)).split("$");
  const actual = (await derive(password, salt || "invalid-account")).toString("hex");
  return version === "scrypt-v1" && typeof hash === "string" && constantEqual(actual, hash) && stored !== null;
}
export function protectMutation(req: NextRequest) {
  const origin = req.headers.get("origin");
  const allowed = new Set([req.nextUrl.origin, process.env.NEXT_PUBLIC_SITE_URL].filter(Boolean));
  // Behind Next/Hostinger's proxy, nextUrl may name an internal server. A browser
  // cannot forge Host: accept its external origin only when it matches Host.
  let matchesHost = false;
  if (origin) {
    try { const url = new URL(origin); matchesHost = ["https:", "http:"].includes(url.protocol) && url.host === req.headers.get("host"); }
    catch { throw new CustomerError("forbidden", 403); }
  }
  if (req.headers.get("sec-fetch-site") === "cross-site" || (origin && !allowed.has(origin) && !matchesHost)) throw new CustomerError("forbidden", 403);
  if (!req.headers.get("content-type")?.includes("application/json")) throw new CustomerError("invalid", 415);
  if (Number(req.headers.get("content-length") || 0) > 12000) throw new CustomerError("invalid", 413);
}
export async function limit(key: string, max: number, seconds: number) {
  const now = new Date(); const expires = new Date(now.getTime() + seconds * 1000);
  const hashed = createHmac("sha256", secret()).update(key).digest("hex");
  const [row] = await db.insert(authLimits).values({ key: hashed, count: 1, expiresAt: expires })
    .onConflictDoUpdate({ target: authLimits.key, set: {
      count: sql`case when ${authLimits.expiresAt} < ${now} then 1 else ${authLimits.count} + 1 end`,
      expiresAt: sql`case when ${authLimits.expiresAt} < ${now} then ${expires} else ${authLimits.expiresAt} end`,
    } }).returning();
  if (row.count > max) throw new CustomerError("limited", 429);
}
export function clientIp(req: NextRequest) {
  // Trust only a header explicitly configured for the reverse proxy on your host.
  const name = process.env.TRUSTED_CLIENT_IP_HEADER;
  return name ? (req.headers.get(name)?.split(",")[0].trim().slice(0, 80) || "unknown") : "shared";
}
export function setCookie(response: NextResponse, name: string, value: string, maxAge: number) {
  response.cookies.set(name, value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge });
}
export function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" } });
}
export function failed(error: unknown) {
  if (error instanceof CustomerError) return json({ error: error.code }, error.status);
  console.error("Customer area request failed", error instanceof Error ? error.name : "UnknownError");
  return json({ error: "unavailable" }, 503);
}
export async function getCustomer(req: NextRequest) {
  const value = req.cookies.get(SESSION_COOKIE)?.value;
  if (!value || !/^[a-f0-9]{64}$/.test(value)) throw new CustomerError("session", 401);
  const [row] = await db.select({ customer: customers }).from(customerSessions)
    .innerJoin(customers, eq(customers.id, customerSessions.customerId))
    .where(and(eq(customerSessions.tokenHash, digest(value)), gt(customerSessions.expiresAt, new Date()), eq(customers.active, true))).limit(1);
  if (!row) throw new CustomerError("session", 401);
  return row.customer;
}
export function maskPhone(phone: string) { return `${phone.slice(0, 3)} ••• ••• ${phone.slice(-3)}`; }
export async function sendLoginSms(phone: string, code: string, lang: Lang, purpose: "login" | "request" = "login") {
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new CustomerError("unavailable", 503);
  const account = process.env.TWILIO_ACCOUNT_SID;
  const user = process.env.TWILIO_API_KEY || account;
  const password = process.env.TWILIO_API_KEY_SECRET || process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  // No fixed code, logging of OTPs, or production fallback.
  if (!account || !user || !password || !from) throw new CustomerError("smsUnavailable", 503);
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${account}/Messages.json`, {
    method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: phone, From: from, Body: purpose === "request" ? (lang === "it" ? `Roma Office Sharing: codice di verifica richiesta ${code}. Valido 10 minuti. Non condividerlo.` : `Roma Office Sharing: request verification code ${code}. Valid for 10 minutes. Do not share it.`) : (lang === "it" ? `Roma Office Sharing: codice di accesso ${code}. Valido 5 minuti. Non condividerlo con nessuno.` : `Roma Office Sharing: your sign-in code is ${code}. Valid for 5 minutes. Never share this code.`) }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new CustomerError("smsUnavailable", 503);
}
