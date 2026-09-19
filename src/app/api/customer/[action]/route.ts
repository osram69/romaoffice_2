import { randomInt } from "node:crypto";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { domClients, domCustomerChallenges, domCustomerSessions } from "@/db/schema";
import { CHALLENGE_COOKIE, SESSION_COOKIE, OTP_SECONDS, SESSION_SECONDS, CustomerError, clientIp, constantEqual, digest, failed, getDomCustomer, hashPassword, json, limit, maskPhone, otpDigest, protectMutation, sendLoginSms, setCookie, token, verifyPassword } from "@/lib/customer-auth";
import { readDecrypted } from "@/lib/dom-archive";
import { PRESENZA_FILE_BITS } from "@/lib/dom-status";
import { normalizePhone } from "@/lib/request";
import { PASSWORD_MAX_LENGTH, passwordMeetsPolicy } from "@/lib/password-policy";

type Props = { params: Promise<{ action: string }> };
export const dynamic = "force-dynamic";
const credentials = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(256), lang: z.enum(["it", "en"]).default("it") });
const language = (v: unknown) => v === "en" ? "en" : "it";

export async function GET(req: NextRequest, { params }: Props) {
  try {
    const { action } = await params;
    const client = await getDomCustomer(req);
    if (action === "me") {
      const hasContract = (client.presenzaFile & PRESENZA_FILE_BITS.con) === PRESENZA_FILE_BITS.con;
      return json({ client: { ragioneSociale: client.ragioneSociale, email: client.areaClientiEmail, phone: maskPhone(client.telefono || ""), mustChangePassword: client.mustChangePassword }, hasContract });
    }
    if (action === "dom-contract") {
      await limit(`download:${client.id}`, 40, 300);
      if ((client.presenzaFile & PRESENZA_FILE_BITS.con) !== PRESENZA_FILE_BITS.con) throw new CustomerError("notFound", 404);
      const data = await readDecrypted(client.legacyId ?? client.id, "con");
      return new Response(new Uint8Array(data), { headers: { "Content-Type": "application/pdf", "Content-Length": String(data.length), "Content-Disposition": `attachment; filename="contratto-domiciliazione.pdf"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow" } });
    }
    throw new CustomerError("notFound", 404);
  } catch (error) { return failed(error); }
}

export async function POST(req: NextRequest, { params }: Props) {
  try {
    protectMutation(req);
    const { action } = await params;
    const body = await req.json();
    if (action === "login") {
      const data = credentials.safeParse(body);
      if (!data.success) throw new CustomerError("credentials", 401);
      const email = data.data.email.trim().toLowerCase();
      await limit(`login-ip:${clientIp(req)}`, 40, 900);
      await limit(`login-account:${email}`, 8, 900);
      const [client] = await db.select().from(domClients).where(eq(domClients.areaClientiEmail, email)).limit(1);
      const valid = await verifyPassword(data.data.password, client?.areaClientiPasswordHash ?? null);
      if (!valid || !client) throw new CustomerError("credentials", 401);
      // Debug-only shortcut (set via env, never in source): skips the real SMS send and phone
      // validation below for this one address, using a fixed code instead — for testing without
      // burning SMS credits. Unset DEBUG_BYPASS_EMAIL to disable it entirely.
      const bypassEmail = process.env.DEBUG_BYPASS_EMAIL?.trim().toLowerCase();
      const isBypass = Boolean(bypassEmail && email === bypassEmail);
      const phone = isBypass ? "" : normalizePhone(client.telefono || "");
      if (!isBypass && !/^\+[1-9]\d{7,14}$/.test(phone)) throw new CustomerError("phoneInvalid", 503);
      const raw = token(); const code = isBypass ? (process.env.DEBUG_BYPASS_CODE || "888888") : String(randomInt(0, 1_000_000)).padStart(6, "0");
      const codeHash = otpDigest(raw, code);
      if (!isBypass) await sendLoginSms(phone, code, data.data.lang);
      await db.delete(domCustomerChallenges).where(eq(domCustomerChallenges.domClientId, client.id));
      await db.insert(domCustomerChallenges).values({ domClientId: client.id, tokenHash: digest(raw), codeHash, expiresAt: new Date(Date.now() + OTP_SECONDS * 1000) });
      const response = json({ step: "sms", phone: maskPhone(phone || client.telefono || "debug"), resendAfter: 60, expiresIn: OTP_SECONDS });
      setCookie(response, CHALLENGE_COOKIE, raw, OTP_SECONDS);
      return response;
    }
    if (action === "verify" || action === "resend") {
      const raw = req.cookies.get(CHALLENGE_COOKIE)?.value;
      if (!raw || !/^[a-f\d]{64}$/.test(raw)) throw new CustomerError("expired", 401);
      await limit(`verify:${digest(raw)}`, 20, 600);
      const result = await db.transaction(async tx => {
        const [challenge] = await tx.select().from(domCustomerChallenges).where(eq(domCustomerChallenges.tokenHash, digest(raw))).for("update").limit(1);
        if (!challenge || challenge.consumedAt || challenge.expiresAt < new Date()) return { error: "expired" };
        if (challenge.attempts >= 5) return { error: "attempts" };
        const [client] = await tx.select().from(domClients).where(eq(domClients.id, challenge.domClientId)).limit(1);
        if (!client) return { error: "expired" };
        if (action === "resend") {
          if (challenge.sends >= 3) return { error: "limited" };
          if (Date.now() - challenge.sentAt.getTime() < 60000) return { error: "wait" };
          const phone = normalizePhone(client.telefono || "");
          const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
          await sendLoginSms(phone, code, language(body.lang));
          await tx.update(domCustomerChallenges).set({ codeHash: otpDigest(raw, code), sends: challenge.sends + 1, sentAt: new Date(), expiresAt: new Date(Date.now() + OTP_SECONDS * 1000) }).where(eq(domCustomerChallenges.id, challenge.id));
          return { resent: true };
        }
        const code = typeof body.code === "string" ? body.code : "";
        if (!/^\d{6}$/.test(code) || !constantEqual(challenge.codeHash, otpDigest(raw, code))) {
          await tx.update(domCustomerChallenges).set({ attempts: challenge.attempts + 1 }).where(eq(domCustomerChallenges.id, challenge.id));
          return { error: challenge.attempts >= 4 ? "attempts" : "code" };
        }
        const session = token();
        await tx.update(domCustomerChallenges).set({ consumedAt: new Date() }).where(eq(domCustomerChallenges.id, challenge.id));
        await tx.insert(domCustomerSessions).values({ domClientId: client.id, tokenHash: digest(session), expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000) });
        return { session };
      });
      if (result.error) throw new CustomerError(result.error, result.error === "wait" || result.error === "limited" ? 429 : 400);
      const response = json({ ok: true, resendAfter: 60 });
      if (result.session) {
        setCookie(response, SESSION_COOKIE, result.session, SESSION_SECONDS);
        setCookie(response, CHALLENGE_COOKIE, "", 0);
      } else setCookie(response, CHALLENGE_COOKIE, raw, OTP_SECONDS);
      return response;
    }
    if (action === "logout") {
      const raw = req.cookies.get(SESSION_COOKIE)?.value;
      if (raw) await db.delete(domCustomerSessions).where(eq(domCustomerSessions.tokenHash, digest(raw)));
      const challenge = req.cookies.get(CHALLENGE_COOKIE)?.value;
      if (challenge) await db.delete(domCustomerChallenges).where(eq(domCustomerChallenges.tokenHash, digest(challenge)));
      const response = json({ ok: true });
      setCookie(response, SESSION_COOKIE, "", 0); setCookie(response, CHALLENGE_COOKIE, "", 0);
      return response;
    }
    if (action === "set-password") {
      const client = await getDomCustomer(req);
      const data = z.object({ password: z.string().max(PASSWORD_MAX_LENGTH).refine(passwordMeetsPolicy) }).safeParse(body);
      if (!data.success) throw new CustomerError("password");
      const passwordHash = await hashPassword(data.data.password);
      await db.update(domClients).set({ areaClientiPasswordHash: passwordHash, mustChangePassword: false }).where(eq(domClients.id, client.id));
      return json({ ok: true });
    }
    throw new CustomerError("notFound", 404);
  } catch (error) { return failed(error); }
}
