import Stripe from "stripe";
import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { ownedOrder } from "@/lib/order-access";
import { CustomerError, json, protectMutation } from "@/lib/customer-auth";
const input = z.object({ order: z.string().uuid(), provider: z.enum(["stripe", "sumup", "paypal"]) });
export async function POST(req: NextRequest) {
  try {
    protectMutation(req); const parsed = input.safeParse(await req.json()); if (!parsed.success) return json({ error: "invalid" }, 400);
    const order = await ownedOrder(req, parsed.data.order);
    if (order.provider !== parsed.data.provider || !order.providerReference) return json({ paid: false, error: "unmatched-payment" }, 400);
    if (order.status === "paid" || order.status === "signed") return json({ paid: true });
    if (order.status !== "filled" || (order.service === "postal" && !order.termsAcceptedAt)) return json({ paid: false }, 403);
    let paid = false;
    if (order.provider === "stripe" && process.env.STRIPE_SECRET) {
      const s = await new Stripe(process.env.STRIPE_SECRET).checkout.sessions.retrieve(order.providerReference);
      paid = s.payment_status === "paid" && s.metadata?.orderId === order.publicId && s.amount_total === order.amountCents && s.currency === "eur";
    } else if (order.provider === "sumup" && process.env.SUMUP_API_KEY) {
      const r = await fetch(`${process.env.SUMUP_API_URL || "https://api.sumup.com"}/v0.1/checkouts/${encodeURIComponent(order.providerReference)}`, { headers: { Authorization: `Bearer ${process.env.SUMUP_API_KEY}` }, signal: AbortSignal.timeout(12000) });
      if (r.ok) { const s = await r.json(); paid = s.status === "PAID" && s.checkout_reference === order.publicId && s.merchant_code === process.env.SUMUP_MERCHANT_CODE && s.currency === "EUR" && Math.round(Number(s.amount) * 100) === order.amountCents; }
    } else if (order.provider === "paypal" && process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_SECRET) {
      const api = process.env.PAYPAL_API_URL || "https://api-m.sandbox.paypal.com";
      const tokenRes = await fetch(`${api}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials", signal: AbortSignal.timeout(12000) });
      const access = (await tokenRes.json()).access_token; if (!access) return json({ paid: false }, 502);
      const headers = { Authorization: `Bearer ${access}`, "Content-Type": "application/json" };
      const detail = await fetch(`${api}/v2/checkout/orders/${encodeURIComponent(order.providerReference)}`, { headers, signal: AbortSignal.timeout(12000) });
      let payment = await detail.json(); const unit = payment.purchase_units?.[0];
      if (!detail.ok || unit?.custom_id !== order.publicId || unit?.amount?.currency_code !== "EUR" || Math.round(Number(unit?.amount?.value) * 100) !== order.amountCents) return json({ paid: false }, 400);
      if (payment.status === "APPROVED") {
        const capture = await fetch(`${api}/v2/checkout/orders/${encodeURIComponent(order.providerReference)}/capture`, { method: "POST", headers: { ...headers, "PayPal-Request-Id": `capture-${order.publicId}` }, body: "{}", signal: AbortSignal.timeout(12000) });
        payment = await capture.json(); if (!capture.ok) return json({ paid: false }, 502);
      }
      const captures = payment.purchase_units?.[0]?.payments?.captures as { status: string; amount: { currency_code: string; value: string } }[] | undefined;
      paid = payment.status === "COMPLETED" && !!captures?.some(c => c.status === "COMPLETED" && c.amount.currency_code === "EUR" && Math.round(Number(c.amount.value) * 100) === order.amountCents);
    }
    if (paid) await db.update(orders).set({ status: "paid", updatedAt: new Date() }).where(and(eq(orders.id, order.id), eq(orders.status, "filled")));
    return json({ paid });
  } catch (error) { return error instanceof CustomerError ? json({ paid: false, error: error.code }, error.status) : json({ paid: false, error: "verify-failed" }, 400); }
}
