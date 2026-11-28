import { randomInt } from "node:crypto";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { domiciliationRequests } from "@/db/schema";
import { REQUEST_OTP_CHALLENGE, ownedRequest } from "@/lib/manual-request-access";
import { smsBypassEnabled } from "@/lib/sms-bypass";
import { CustomerError, json, limit, otpDigest, protectMutation, sendLoginSms } from "@/lib/customer-auth";

const input = z.object({ requestId: z.string().uuid() });

export async function POST(req: NextRequest) {
  try {
    protectMutation(req); const parsed = input.safeParse(await req.json()); if (!parsed.success) return json({ error: "invalid" }, 400);
    const row = await ownedRequest(req, parsed.data.requestId);
    if (row.status === "submitted") return json({ error: "already-submitted" }, 409);
    if (row.status === "verified") return json({ error: "already-verified" }, 409);
    await limit(`manual-request-sms:${row.phone}`, 5, 900);
    const result = await db.transaction(async tx => {
      const [current] = await tx.select().from(domiciliationRequests).where(eq(domiciliationRequests.id, row.id)).for("update");
      if (current.status !== "draft") return "state";
      if (current.sends >= 3 || current.attempts >= 5) return "limited";
      if (current.sentAt && Date.now() - current.sentAt.getTime() < 60000) return "wait";
      // Same debug shortcut as the online purchase: one phone number from the environment, never from source.
      const bypassPhone = process.env.DEBUG_BYPASS_PHONE?.trim();
      const isBypass = Boolean(bypassPhone && current.phone === bypassPhone) && await smsBypassEnabled();
      const code = isBypass ? (process.env.DEBUG_BYPASS_CODE || "888888") : String(randomInt(0, 1000000)).padStart(6, "0");
      if (!isBypass) await sendLoginSms(current.phone, code, current.lang === "en" ? "en" : "it", "request");
      await tx.update(domiciliationRequests).set({
        codeHash: otpDigest(REQUEST_OTP_CHALLENGE(current.publicId), code), sends: current.sends + 1, sentAt: new Date(), expiresAt: new Date(Date.now() + 600000), updatedAt: new Date(),
      }).where(eq(domiciliationRequests.id, current.id));
      return "sent";
    });
    if (result === "sent") return json({ ok: true, resendAfter: 60 });
    return json({ error: result }, result === "state" ? 409 : 429);
  } catch (error) {
    if (error instanceof CustomerError) { console.error("Request SMS rejected", error.code, error.status); return json({ error: error.code }, error.status); }
    console.error("Request SMS failed", error instanceof Error ? `${error.name}: ${error.message}` : error);
    return json({ error: "smsUnavailable" }, 503);
  }
}
