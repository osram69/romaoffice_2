import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { domiciliationRequests } from "@/db/schema";
import { getOffer } from "@/lib/catalog";
import { tierFor } from "@/lib/pricing";
import { manualRequestSchema } from "@/lib/manual-request";
import { REQUEST_COOKIE, ownedRequest } from "@/lib/manual-request-access";
import { CustomerError, clientIp, digest, json, limit, protectMutation, token } from "@/lib/customer-auth";

// Saves (or updates) the draft of the online request. The request only counts once the mobile number is verified
// by SMS (/send-otp then /verify): any change to a draft or an already verified request cancels that verification.
export async function POST(req: NextRequest) {
  try {
    protectMutation(req);
    const body = await req.json();
    const requestId = z.string().uuid().optional().safeParse(body?.requestId);
    const parsed = manualRequestSchema.safeParse(body);
    if (!requestId.success || !parsed.success) return json({ error: "invalid", fields: parsed.success ? [] : [...new Set(parsed.error.issues.map(i => String(i.path[0])))] }, 400);
    const data = parsed.data;
    await limit(`manual-request-ip:${clientIp(req)}`, 30, 900);
    await limit(`manual-request-email:${data.email}`, 15, 3600);
    const product = await getOffer(data.service);
    if (typeof data.months === "number") {
      if (!tierFor(product, data.months)) return json({ error: "invalid", fields: ["months"] }, 400);
    } else if (!(data.months === "smart3x24" ? product.smart3x24Active : product.smart6x24Active)) return json({ error: "invalid", fields: ["months"] }, 400);
    const values = { service: data.service, lang: data.lang, email: data.email, phone: data.representativePhone, formData: data, status: "draft", codeHash: null, expiresAt: null, verifiedAt: null, attempts: 0, updatedAt: new Date() };
    if (requestId.data) {
      const old = await ownedRequest(req, requestId.data);
      if (old.status === "submitted") return json({ error: "already-submitted" }, 409);
      await db.update(domiciliationRequests).set(values).where(eq(domiciliationRequests.id, old.id));
      return json({ requestId: old.publicId });
    }
    const publicId = randomUUID(); const raw = token();
    await db.insert(domiciliationRequests).values({ publicId, tokenHash: digest(raw), ...values });
    const response = json({ requestId: publicId }, 201);
    response.cookies.set(REQUEST_COOKIE, raw, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 8 * 3600 });
    return response;
  } catch (error) {
    if (error instanceof CustomerError) return json({ error: error.code }, error.status);
    console.error("Manual request failed", error instanceof Error ? `${error.name}: ${error.message}` : "UnknownError");
    return json({ error: "unavailable" }, 503);
  }
}
