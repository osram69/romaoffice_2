import { NextResponse } from "next/server";
import Stripe from "stripe";
import { markOrderPaidAndNotify } from "./order-payment";
import { paypalCredentials, stripeSecret, stripeWebhookSecret } from "./payments";

// Live and test webhooks are separate endpoints (registered separately in each provider's
// dashboard, each with its own signing secret) rather than one endpoint branching on the parsed
// body — the signature must be checked with the right secret before anything in the body,
// including which order it claims to be for, can be trusted.
export async function handleStripeWebhook(req: Request, testMode: boolean) {
  const secret = stripeSecret(testMode); const webhookSecret = stripeWebhookSecret(testMode);
  if (!secret || !webhookSecret) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  try {
    const stripe = new Stripe(secret);
    const raw = await req.text();
    const event = stripe.webhooks.constructEvent(raw, req.headers.get("stripe-signature") || "", webhookSecret);
    if (event.type === "checkout.session.completed") {
      const s = event.data.object; const orderId = s.metadata?.orderId;
      if (orderId) await markOrderPaidAndNotify(orderId, "stripe", s.id);
    }
    return NextResponse.json({ received: true });
  } catch (e) { console.error("Stripe webhook rejected", e); return NextResponse.json({ error: "Invalid signature" }, { status: 400 }); }
}

async function paypalAccessToken(api: string, clientId: string, secret: string) {
  const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const r = await fetch(`${api}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
  return (await r.json()).access_token as string | undefined;
}

export async function handlePaypalWebhook(req: Request, testMode: boolean) {
  const { clientId, secret, webhookId, api } = paypalCredentials(testMode);
  if (!clientId || !secret || !webhookId) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  try {
    const raw = await req.text(); const event = JSON.parse(raw);
    const access = await paypalAccessToken(api, clientId, secret);
    const verify = await fetch(`${api}/v1/notifications/verify-webhook-signature`, {
      method: "POST", headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_algo: req.headers.get("paypal-auth-algo"), cert_url: req.headers.get("paypal-cert-url"),
        transmission_id: req.headers.get("paypal-transmission-id"), transmission_sig: req.headers.get("paypal-transmission-sig"),
        transmission_time: req.headers.get("paypal-transmission-time"), webhook_id: webhookId, webhook_event: event,
      }),
    });
    const result = await verify.json();
    if (result.verification_status !== "SUCCESS") throw new Error("Invalid PayPal signature");
    if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
      const orderId = event.resource?.custom_id;
      if (orderId) await markOrderPaidAndNotify(orderId, "paypal", event.resource.id);
    }
    return NextResponse.json({ received: true });
  } catch (e) { console.error("PayPal webhook rejected", e); return NextResponse.json({ error: "Invalid webhook" }, { status: 400 }); }
}
