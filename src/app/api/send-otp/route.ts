import { randomInt } from "node:crypto";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { orders, otpVerifications } from "@/db/schema";
import { ownedOrder } from "@/lib/order-access";
import { CustomerError, json, limit, otpDigest, protectMutation, sendLoginSms } from "@/lib/customer-auth";
import type { RequestData } from "@/lib/request";
const input = z.object({ orderId: z.string().uuid() });
export async function POST(req: NextRequest) {
  try {
    protectMutation(req); const parsed = input.safeParse(await req.json()); if (!parsed.success) return json({ error: "invalid" }, 400);
    const order = await ownedOrder(req, parsed.data.orderId); if (order.status !== "pending") return json({ error: "already-submitted" }, 409);
    await limit(`order-sms:${order.phone}`, 5, 900);
    const result = await db.transaction(async tx => {
      await tx.select({ id: orders.id }).from(orders).where(eq(orders.id, order.id)).for("update");
      const [old] = await tx.select().from(otpVerifications).where(eq(otpVerifications.orderPublicId, order.publicId)).limit(1);
      if (old && (old.sends >= 3 || old.attempts >= 5)) return "limited";
      if (old && Date.now() - old.sentAt.getTime() < 60000) return "wait";
      // Debug-only shortcut (set via env, never in source): skips the real SMS send for this one
      // phone number, using a fixed code instead — for testing without burning SMS credits.
      // Unset DEBUG_BYPASS_PHONE to disable it entirely.
      const bypassPhone = process.env.DEBUG_BYPASS_PHONE?.trim();
      const isBypass = Boolean(bypassPhone && order.phone === bypassPhone);
      const code = isBypass ? (process.env.DEBUG_BYPASS_CODE || "888888") : String(randomInt(0, 1000000)).padStart(6, "0");
      const lang = (order.formData as RequestData).lang;
      const hash = otpDigest(`order:${order.publicId}`, code);
      if (!isBypass) await sendLoginSms(order.phone!, code, lang, "request");
      const values = { phone: order.phone!, codeHash: hash, expiresAt: new Date(Date.now() + 600000), verifiedAt: null, sends: (old?.sends ?? 0) + 1, sentAt: new Date() };
      if (old) await tx.update(otpVerifications).set(values).where(eq(otpVerifications.id, old.id));
      else await tx.insert(otpVerifications).values({ orderPublicId: order.publicId, ...values });
      return "sent";
    });
    return result === "sent" ? json({ ok: true, resendAfter: 60 }) : json({ error: result }, 429);
  } catch (error) {
    if (error instanceof CustomerError) { console.error("Send OTP rejected", error.code, error.status); return json({ error: error.code }, error.status); }
    console.error("Send OTP failed", error instanceof Error ? `${error.name}: ${error.message}` : error, error instanceof Error && error.cause ? `cause: ${error.cause}` : "");
    return json({ error: "smsUnavailable" }, 503);
  }
}
