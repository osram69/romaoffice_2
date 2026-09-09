import Stripe from "stripe";
import type { Lang } from "./site";

export type ProviderKey = "stripe" | "paypal" | "sumup";
export type SessionInput = { provider: ProviderKey; service?: "legal_unit" | "postal"; orderId: string; description: string; totalCents: number; lang: Lang; origin: string; email?: string };
export type SessionResult = { url: string; providerRef: string } | { demo: true; message: string };

export function returnPath(lang: Lang): string {
  return lang === "en" ? "/en/activate.html" : "/attiva.html";
}

export function providerConfigured(provider: ProviderKey): boolean {
  if (provider === "stripe") return Boolean(process.env.STRIPE_SECRET);
  if (provider === "paypal") return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_SECRET);
  return Boolean(process.env.SUMUP_API_KEY && process.env.SUMUP_MERCHANT_CODE);
}

function demoMessage(provider: ProviderKey, lang: Lang): string {
  const name = provider === "stripe" ? "STRIPE_SECRET" : provider === "paypal" ? "PAYPAL_CLIENT_ID / PAYPAL_SECRET" : "SUMUP_API_KEY / SUMUP_MERCHANT_CODE";
  return lang === "it"
    ? `Modalità dimostrativa: la pratica è stata registrata. Configura ${name} per procedere al pagamento reale.`
    : `Demonstration mode: your request has been recorded. Configure ${name} to proceed with a live payment.`;
}

async function createStripeSession(input: SessionInput): Promise<SessionResult> {
  if (!process.env.STRIPE_SECRET) return { demo: true, message: demoMessage("stripe", input.lang) };
  const stripe = new Stripe(process.env.STRIPE_SECRET);
  const base = `${input.origin}${returnPath(input.lang)}`;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: input.email && !input.email.endsWith(".invalid") ? input.email : undefined,
    line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: input.totalCents, product_data: { name: input.description } } }],
    metadata: { orderId: input.orderId, service: input.service || "legal_unit" },
    success_url: `${base}?service=${input.service || "legal_unit"}&payment=return&provider=stripe&order=${input.orderId}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}?service=${input.service || "legal_unit"}&payment=cancelled&provider=stripe&order=${input.orderId}`,
  });
  if (!session.url) throw new Error("Stripe session URL missing");
  return { url: session.url, providerRef: session.id };
}

async function createPaypalOrder(input: SessionInput): Promise<SessionResult> {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_SECRET) return { demo: true, message: demoMessage("paypal", input.lang) };
  const api = process.env.PAYPAL_API_URL || "https://api-m.sandbox.paypal.com";
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString("base64");
  const tokenRes = await fetch(`${api}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const accessToken = (await tokenRes.json()).access_token;
  if (!accessToken) throw new Error("PayPal token error");
  const base = `${input.origin}${returnPath(input.lang)}`;
  const orderRes = await fetch(`${api}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{ description: input.description, custom_id: input.orderId, amount: { currency_code: "EUR", value: (input.totalCents / 100).toFixed(2) } }],
      application_context: {
        brand_name: "Roma Office Sharing",
        return_url: `${base}?service=${input.service || "legal_unit"}&payment=return&provider=paypal&order=${input.orderId}`,
        cancel_url: `${base}?service=${input.service || "legal_unit"}&payment=cancelled&provider=paypal&order=${input.orderId}`,
      },
    }),
  });
  const order = await orderRes.json();
  const approve = order?.links?.find((l: { rel: string; href: string }) => l.rel === "approve")?.href;
  if (!approve) throw new Error("PayPal approval link missing");
  return { url: approve, providerRef: order.id };
}

async function createSumupCheckout(input: SessionInput): Promise<SessionResult> {
  if (!process.env.SUMUP_API_KEY || !process.env.SUMUP_MERCHANT_CODE) return { demo: true, message: demoMessage("sumup", input.lang) };
  const api = process.env.SUMUP_API_URL || "https://api.sumup.com";
  const base = `${input.origin}${returnPath(input.lang)}`;
  const res = await fetch(`${api}/v0.1/checkouts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.SUMUP_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: Number((input.totalCents / 100).toFixed(2)),
      currency: "EUR",
      checkout_reference: input.orderId,
      description: input.description,
      merchant_code: process.env.SUMUP_MERCHANT_CODE,
      redirect_url: `${base}?service=${input.service || "legal_unit"}&payment=return&provider=sumup&order=${input.orderId}`,
      hosted_checkout: { enabled: true },
    }),
  });
  const checkout = await res.json();
  if (!res.ok) throw new Error(checkout?.message || "SumUp checkout failed");
  const url = checkout.hosted_checkout_url || checkout.redirect_url;
  if (!url) throw new Error("SumUp hosted checkout URL missing");
  return { url, providerRef: checkout.id };
}

export async function createPaymentSession(input: SessionInput): Promise<SessionResult> {
  if (input.provider === "stripe") return createStripeSession(input);
  if (input.provider === "paypal") return createPaypalOrder(input);
  return createSumupCheckout(input);
}

/** SumUp has no HMAC-signed webhook: confirm the authoritative status through the API. */
export async function fetchSumupStatus(checkoutReference: string): Promise<string | null> {
  if (!process.env.SUMUP_API_KEY) return null;
  const api = process.env.SUMUP_API_URL || "https://api.sumup.com";
  const res = await fetch(`${api}/v0.1/checkouts/${encodeURIComponent(checkoutReference)}`, { headers: { Authorization: `Bearer ${process.env.SUMUP_API_KEY}` } });
  if (!res.ok) return null;
  const checkout = await res.json();
  return checkout?.status ?? null;
}

export async function fetchStripeStatus(sessionId: string): Promise<{ status: string | null; paymentStatus: string | null; orderId: string | null }> {
  if (!process.env.STRIPE_SECRET) return { status: null, paymentStatus: null, orderId: null };
  const stripe = new Stripe(process.env.STRIPE_SECRET);
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  return { status: session.status, paymentStatus: session.payment_status, orderId: (session.metadata?.orderId as string) || null };
}
