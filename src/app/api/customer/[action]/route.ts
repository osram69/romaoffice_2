import { randomInt } from "node:crypto";
import { NextRequest } from "next/server";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { customers, customerChallenges, customerSessions, customerPasswordTokens, customerContracts, customerAudit } from "@/db/schema";
import { CHALLENGE_COOKIE, SESSION_COOKIE, OTP_SECONDS, SESSION_SECONDS, CustomerError, clientIp, constantEqual, digest, failed, getCustomer, hashPassword, json, limit, maskPhone, otpDigest, protectMutation, sendLoginSms, setCookie, token, verifyPassword } from "@/lib/customer-auth";
import { readCustomerContract } from "@/lib/customer-documents";
import { inviteCustomer } from "@/lib/customer-invitations";

type Props = { params: Promise<{ action: string }> };
export const dynamic = "force-dynamic";
const credentials = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(256), lang: z.enum(["it", "en"]).default("it") });
const language = (v: unknown) => v === "en" ? "en" : "it";

export async function GET(req: NextRequest, { params }: Props) {
  try {
    const { action } = await params;
    const customer = await getCustomer(req);
    if (action === "me") {
      const contracts = await db.select({ id: customerContracts.id, title: customerContracts.title, titleEn: customerContracts.titleEn, reference: customerContracts.reference, sizeBytes: customerContracts.sizeBytes, createdAt: customerContracts.createdAt }).from(customerContracts)
        .where(eq(customerContracts.customerId, customer.id)).orderBy(desc(customerContracts.createdAt));
      return json({ customer: { name: customer.name, email: customer.email, companyName: customer.companyName, phone: maskPhone(customer.phone), lastLoginAt: customer.lastLoginAt }, contracts });
    }
    if (action === "contract") {
      const id = z.string().uuid().safeParse(req.nextUrl.searchParams.get("id"));
      if (!id.success) throw new CustomerError("notFound", 404);
      await limit(`download:${customer.id}`, 40, 300);
      const [document] = await db.select().from(customerContracts).where(and(eq(customerContracts.id, id.data), eq(customerContracts.customerId, customer.id))).limit(1);
      if (!document) throw new CustomerError("notFound", 404);
      const data = await readCustomerContract(document.storageKey);
      await db.insert(customerAudit).values({ customerId: customer.id, documentId: document.id, event: "contract.downloaded" });
      return new Response(new Uint8Array(data), { headers: { "Content-Type": "application/pdf", "Content-Length": String(data.length), "Content-Disposition": `attachment; filename="contract-${document.reference.replace(/[^\w-]/g, "_").slice(0, 70)}.pdf"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow" } });
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
      const [customer] = await db.select().from(customers).where(eq(customers.email, email)).limit(1);
      const valid = await verifyPassword(data.data.password, customer?.passwordHash ?? null);
      if (!valid || !customer?.active) throw new CustomerError("credentials", 401);
      const raw = token(); const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      const codeHash = otpDigest(raw, code);
      await sendLoginSms(customer.phone, code, data.data.lang);
      await db.delete(customerChallenges).where(eq(customerChallenges.customerId, customer.id));
      await db.insert(customerChallenges).values({ customerId: customer.id, tokenHash: digest(raw), codeHash, expiresAt: new Date(Date.now() + OTP_SECONDS * 1000) });
      const response = json({ step: "sms", phone: maskPhone(customer.phone), resendAfter: 60, expiresIn: OTP_SECONDS });
      setCookie(response, CHALLENGE_COOKIE, raw, OTP_SECONDS);
      return response;
    }
    if (action === "verify" || action === "resend") {
      const raw = req.cookies.get(CHALLENGE_COOKIE)?.value;
      if (!raw || !/^[a-f\d]{64}$/.test(raw)) throw new CustomerError("expired", 401);
      await limit(`verify:${digest(raw)}`, 20, 600);
      const result = await db.transaction(async tx => {
        const [challenge] = await tx.select().from(customerChallenges).where(eq(customerChallenges.tokenHash, digest(raw))).for("update").limit(1);
        if (!challenge || challenge.consumedAt || challenge.expiresAt < new Date()) return { error: "expired" };
        if (challenge.attempts >= 5) return { error: "attempts" };
        const [customer] = await tx.select().from(customers).where(and(eq(customers.id, challenge.customerId), eq(customers.active, true))).limit(1);
        if (!customer) return { error: "expired" };
        if (action === "resend") {
          if (challenge.sends >= 3) return { error: "limited" };
          if (Date.now() - challenge.sentAt.getTime() < 60000) return { error: "wait" };
          const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
          await sendLoginSms(customer.phone, code, language(body.lang));
          await tx.update(customerChallenges).set({ codeHash: otpDigest(raw, code), sends: challenge.sends + 1, sentAt: new Date(), expiresAt: new Date(Date.now() + OTP_SECONDS * 1000) }).where(eq(customerChallenges.id, challenge.id));
          return { resent: true };
        }
        const code = typeof body.code === "string" ? body.code : "";
        if (!/^\d{6}$/.test(code) || !constantEqual(challenge.codeHash, otpDigest(raw, code))) {
          await tx.update(customerChallenges).set({ attempts: challenge.attempts + 1 }).where(eq(customerChallenges.id, challenge.id));
          return { error: challenge.attempts >= 4 ? "attempts" : "code" };
        }
        const session = token();
        await tx.update(customerChallenges).set({ consumedAt: new Date() }).where(eq(customerChallenges.id, challenge.id));
        await tx.insert(customerSessions).values({ customerId: customer.id, tokenHash: digest(session), expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000) });
        await tx.update(customers).set({ lastLoginAt: new Date() }).where(eq(customers.id, customer.id));
        await tx.insert(customerAudit).values({ customerId: customer.id, event: "login.sms_verified" });
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
      if (raw) await db.delete(customerSessions).where(eq(customerSessions.tokenHash, digest(raw)));
      const challenge = req.cookies.get(CHALLENGE_COOKIE)?.value;
      if (challenge) await db.delete(customerChallenges).where(eq(customerChallenges.tokenHash, digest(challenge)));
      const response = json({ ok: true });
      setCookie(response, SESSION_COOKIE, "", 0); setCookie(response, CHALLENGE_COOKIE, "", 0);
      return response;
    }
    if (action === "password") {
      await limit(`password-ip:${clientIp(req)}`, 12, 900);
      if (body.action === "request") {
        const email = z.string().email().max(254).safeParse(body.email);
        if (!email.success) throw new CustomerError("invalid");
        await limit(`password-email:${email.data.toLowerCase()}`, 3, 3600);
        const [customer] = await db.select().from(customers).where(and(eq(customers.email, email.data.toLowerCase()), eq(customers.active, true))).limit(1);
        if (customer) await inviteCustomer(customer, language(body.lang));
        // Identical response whether the account exists or mail could be sent.
        return json({ ok: true });
      }
      const data = z.object({ token: z.string().regex(/^[a-f\d]{64}$/), password: z.string().min(12).max(128) }).safeParse(body);
      if (!data.success) throw new CustomerError("password");
      const passwordHash = await hashPassword(data.data.password);
      const changed = await db.transaction(async tx => {
        const [record] = await tx.select().from(customerPasswordTokens).where(and(eq(customerPasswordTokens.tokenHash, digest(data.data.token)), isNull(customerPasswordTokens.usedAt), gt(customerPasswordTokens.expiresAt, new Date()))).for("update").limit(1);
        if (!record) return false;
        await tx.update(customerPasswordTokens).set({ usedAt: new Date() }).where(eq(customerPasswordTokens.id, record.id));
        await tx.update(customers).set({ passwordHash }).where(eq(customers.id, record.customerId));
        await tx.delete(customerSessions).where(eq(customerSessions.customerId, record.customerId));
        await tx.delete(customerChallenges).where(eq(customerChallenges.customerId, record.customerId));
        await tx.insert(customerAudit).values({ customerId: record.customerId, event: "password.changed" });
        return true;
      });
      if (!changed) throw new CustomerError("resetExpired");
      return json({ ok: true });
    }
    throw new CustomerError("notFound", 404);
  } catch (error) { return failed(error); }
}
