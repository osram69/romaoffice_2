import Stripe from "stripe";
import { NextRequest } from "next/server";
import { z } from "zod";
import { ownedOrder, type OrderSnapshot } from "@/lib/order-access";
import { sendRequestConfirmation } from "@/lib/order-confirmation";
import { markOrderPaidAndNotify } from "@/lib/order-payment";
import { CustomerError, json, protectMutation } from "@/lib/customer-auth";
import { paypalCredentials, stripeSecret, sumupCredentials } from "@/lib/payments";
import type { RequestData } from "@/lib/request";
const input = z.object({ order: z.string().uuid(), provider: z.enum(["stripe", "sumup", "paypal"]) });
export async function POST(req: NextRequest) {
  try {
    protectMutation(req); const parsed = input.safeParse(await req.json()); if (!parsed.success) return json({ error: "invalid" }, 400);
    const order = await ownedOrder(req, parsed.data.order);
    if (order.provider !== parsed.data.provider || !order.providerReference) return json({ paid: false, error: "unmatched-payment" }, 400);
    if (order.status === "paid" || order.status === "signed") {
      // A webhook can win the race and complete the filled->paid transition (and its own
      // confirmation attempt) before the customer's browser gets here. sendRequestConfirmation
      // is idempotent (it checks requestEmailSentAt/adminEmailSentAt), so retrying it here is
      // safe and also gives this response the pdfBase64/emailSent status to show the customer.
      let confirmation;
      try {
        const data = order.formData as RequestData; const snapshot = order.quoteData as OrderSnapshot;
        confirmation = await sendRequestConfirmation(order, data, snapshot, order.paymentMethod || parsed.data.provider);
      } catch (error) {
        console.error("Post-payment confirmation retry failed", order.publicId, error instanceof Error ? `${error.name}: ${error.message}` : error);
      }
      return json({ paid: true, emailSent: confirmation?.customerSent, pdfBase64: confirmation?.pdf.toString("base64"), shortRef: confirmation?.shortRef });
    }
    if (order.status !== "filled" || (order.service === "postal" && !order.termsAcceptedAt)) return json({ paid: false }, 403);
    let paid = false;
    // The order's own stored test_mode, not the site's live toggle — a later flip must never make
    // this look up a sandbox session with live credentials, or vice versa.
    if (order.provider === "stripe" && stripeSecret(order.testMode)) {
      const s = await new Stripe(stripeSecret(order.testMode)!).checkout.sessions.retrieve(order.providerReference);
      paid = s.payment_status === "paid" && s.metadata?.orderId === order.publicId && s.amount_total === order.amountCents && s.currency === "eur";
    } else if (order.provider === "sumup" && sumupCredentials(order.testMode).apiKey) {
      const { apiKey, merchantCode, api } = sumupCredentials(order.testMode);
      const r = await fetch(`${api}/v0.1/checkouts/${encodeURIComponent(order.providerReference)}`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(12000) });
      if (r.ok) { const s = await r.json(); paid = s.status === "PAID" && s.checkout_reference === order.publicId && s.merchant_code === merchantCode && s.currency === "EUR" && Math.round(Number(s.amount) * 100) === order.amountCents; }
    } else if (order.provider === "paypal" && paypalCredentials(order.testMode).clientId && paypalCredentials(order.testMode).secret) {
      const { clientId, secret, api } = paypalCredentials(order.testMode);
      const tokenRes = await fetch(`${api}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials", signal: AbortSignal.timeout(12000) });
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
    // The request PDF + confirmation emails are sent here, on the transition into "paid" (via
    // markOrderPaidAndNotify, shared with the Stripe/PayPal webhooks), rather than at finalize
    // time — that's the whole point: for online providers, nothing is sent to the customer
    // until the payment has actually gone through. This must never turn a genuinely successful
    // payment into a reported failure: if PDF/email generation throws (slow SMTP, transient DB
    // error...), the customer still sees their paid confirmation immediately, and we just log
    // the delivery failure for follow-up.
    const confirmation = paid ? await markOrderPaidAndNotify(order.publicId, parsed.data.provider, order.providerReference) : undefined;
    return json({ paid, emailSent: confirmation?.customerSent, pdfBase64: confirmation?.pdf.toString("base64"), shortRef: confirmation?.shortRef });
  } catch (error) { return error instanceof CustomerError ? json({ paid: false, error: error.code }, error.status) : json({ paid: false, error: "verify-failed" }, 400); }
}
