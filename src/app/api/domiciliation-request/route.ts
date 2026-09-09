import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, otpVerifications } from "@/db/schema";
import { getCatalog } from "@/lib/catalog";
import { quote } from "@/lib/pricing";
import { termsText } from "@/lib/offer-terms";
import { requestSchema } from "@/lib/request";
import { ORDER_COOKIE, ownedOrder } from "@/lib/order-access";
import { CustomerError, digest, token, json, limit, protectMutation } from "@/lib/customer-auth";

export async function POST(req: NextRequest) {
  try {
    protectMutation(req); const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "invalid-data", fields: parsed.error.issues.map(i => String(i.path[0])) }, 400);
    const data = parsed.data; const catalog = await getCatalog(); const product = catalog[data.service];
    if (data.catalogVersion !== product.version || data.termsVersion !== product.version) return json({ error: "prices-changed", catalog }, 409);
    const priced = quote(product, data); if (!priced) return json({ error: "invalid-duration-or-addons" }, 400);
    const publicId = data.orderId || randomUUID(); const now = new Date();
    if (data.orderId) {
      const old = await ownedOrder(req, data.orderId); if (old.status !== "pending") return json({ error: "already-submitted" }, 409);
    } else await limit(`order-email:${data.email}`, 10, 900);
    const raw = data.orderId ? req.cookies.get(ORDER_COOKIE)!.value : token();
    const values = {
      email: data.email, phone: data.phone, service: data.service, durationMonths: data.months, amountCents: priced.totalCents,
      formData: data, quoteData: { product, quote: priced, createdAt: now.toISOString() }, accessTokenHash: digest(raw),
      termsVersion: product.version, termsAcceptedAt: data.termsAccepted ? now : null, termsText: termsText(product, data.lang), updatedAt: now,
    };
    await db.transaction(async tx => {
      if (data.orderId) {
        const updated = await tx.update(orders).set(values).where(and(eq(orders.publicId, publicId), eq(orders.status, "pending"))).returning({ id: orders.id });
        if (!updated.length) throw new CustomerError("already-submitted", 409);
        await tx.delete(otpVerifications).where(eq(otpVerifications.orderPublicId, publicId));
      } else await tx.insert(orders).values({ publicId, ...values, status: "pending" });
    });
    const response = json({ orderId: publicId, totalCents: priced.totalCents, status: "pending" }, data.orderId ? 200 : 201);
    response.cookies.set(ORDER_COOKIE, raw, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 8 * 3600 });
    return response;
  } catch (error) {
    if (error instanceof CustomerError) return json({ error: error.code }, error.status);
    console.error("Request creation failed", error instanceof Error ? error.name : "UnknownError");
    return json({ error: "request-failed" }, 400);
  }
}
