import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { domiciliationRequests } from "@/db/schema";
import { getOffer } from "@/lib/catalog";
import { buildManualRequestEmail, type ManualRequestInput } from "@/lib/manual-request";
import { REQUEST_OTP_CHALLENGE, ownedRequest } from "@/lib/manual-request-access";
import { sendMail, smtpConfigured } from "@/lib/mailer";
import { CustomerError, constantEqual, json, limit, otpDigest, protectMutation } from "@/lib/customer-auth";

// code is omitted only to retry the confirmation email of a request whose code was already accepted.
const input = z.object({ requestId: z.string().uuid(), code: z.string().regex(/^\d{6}$/).optional() });

export async function POST(req: NextRequest) {
  try {
    protectMutation(req); const parsed = input.safeParse(await req.json()); if (!parsed.success) return json({ error: "invalid" }, 400);
    const { requestId, code } = parsed.data; const row = await ownedRequest(req, requestId);
    await limit(`manual-request-verify:${requestId}`, 12, 900);
    if (row.status === "submitted") return json({ error: "already-submitted" }, 409);
    const accepted = await db.transaction(async tx => {
      const [current] = await tx.select().from(domiciliationRequests).where(eq(domiciliationRequests.id, row.id)).for("update");
      if (current.status === "verified") return true;
      if (current.status !== "draft" || !code || !current.codeHash || !current.expiresAt || current.expiresAt < new Date() || current.attempts >= 5) return false;
      const ok = constantEqual(current.codeHash, otpDigest(REQUEST_OTP_CHALLENGE(requestId), code));
      // A code is good once: it is wiped on success so it can never confirm another version of the form.
      await tx.update(domiciliationRequests).set(ok ? { status: "verified", verifiedAt: new Date(), codeHash: null, updatedAt: new Date() } : { attempts: current.attempts + 1, updatedAt: new Date() }).where(eq(domiciliationRequests.id, current.id));
      return ok;
    });
    if (!accepted) return json({ error: "invalid-or-expired-code" }, 400);
    // Claim the submission first so two simultaneous calls cannot send the email twice.
    const [claimed] = await db.update(domiciliationRequests).set({ status: "submitted", submittedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(domiciliationRequests.id, row.id), eq(domiciliationRequests.status, "verified"))).returning();
    if (!claimed) return json({ error: "already-submitted" }, 409);
    const data = claimed.formData as ManualRequestInput;
    let sent = false;
    if (smtpConfigured()) {
      const mail = buildManualRequestEmail(data, await getOffer(data.service), claimed.verifiedAt ?? new Date());
      sent = (await sendMail(mail)).sent;
    }
    // The request itself is recorded either way; if the email failed it can be retried without a new code.
    if (!sent) await db.update(domiciliationRequests).set({ status: "verified", submittedAt: null, updatedAt: new Date() }).where(eq(domiciliationRequests.id, row.id));
    return json({ ok: true, emailSent: sent });
  } catch (error) {
    if (error instanceof CustomerError) { console.error("Request verify rejected", error.code, error.status); return json({ error: error.code }, error.status); }
    console.error("Request verify failed", error instanceof Error ? `${error.name}: ${error.message}` : error);
    return json({ error: "verification-failed" }, 400);
  }
}
