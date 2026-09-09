import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { otpVerifications } from "@/db/schema";
import { ownedOrder } from "@/lib/order-access";
import { constantEqual, CustomerError, json, limit, otpDigest, protectMutation } from "@/lib/customer-auth";
const input = z.object({ orderId: z.string().uuid(), code: z.string().regex(/^\d{6}$/) });
export async function POST(req: NextRequest) {
  try {
    protectMutation(req); const parsed = input.safeParse(await req.json()); if (!parsed.success) return json({ error: "invalid" }, 400);
    const { orderId, code } = parsed.data; const order = await ownedOrder(req, orderId);
    await limit(`order-verify:${orderId}`, 12, 900);
    const valid = await db.transaction(async tx => {
      const [row] = await tx.select().from(otpVerifications).where(eq(otpVerifications.orderPublicId, orderId)).for("update").limit(1);
      if (!row || row.phone !== order.phone || row.verifiedAt || row.expiresAt < new Date() || row.attempts >= 5) return false;
      const accepted = constantEqual(row.codeHash, otpDigest(`order:${orderId}`, code));
      await tx.update(otpVerifications).set(accepted ? { verifiedAt: new Date() } : { attempts: row.attempts + 1 }).where(eq(otpVerifications.id, row.id));
      return accepted;
    });
    return valid ? json({ ok: true }) : json({ error: "invalid-or-expired-code" }, 400);
  } catch (error) { return error instanceof CustomerError ? json({ error: error.code }, error.status) : json({ error: "verification-failed" }, 400); }
}
