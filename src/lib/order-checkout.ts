import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { readyOrder } from "./order-access";
import { CustomerError } from "./customer-auth";
import { copyFor } from "./pricing";
import { createPaymentSession, providerConfigured, type ProviderKey } from "./payments";
import { paymentMethodEnabled } from "./payment-settings";
export async function checkoutOrder(req: NextRequest, orderId: string, provider: ProviderKey) {
  const { order, data, snapshot } = await readyOrder(req, orderId);
  if (order.status === "paid" || order.status === "signed") return { paid: true, orderRef: orderId };
  if (order.status !== "filled") throw new CustomerError("submit-request-first", 403);
  const it = data.lang === "it";
  if (!providerConfigured(provider) || !(await paymentMethodEnabled(provider))) return { paymentUnavailable: true, message: it ? "La richiesta è registrata, ma questo pagamento online non è ancora disponibile. Scegli bonifico o contatta la reception. Nessun addebito è stato eseguito." : "Your application is recorded, but this online payment method is not yet available. Choose bank transfer or contact reception. No charge has been made." };
  return db.transaction(async tx => {
    const [locked] = await tx.select().from(orders).where(eq(orders.id, order.id)).for("update");
    if (locked.status === "paid" || locked.status === "signed") return { paid: true, orderRef: orderId };
    if (locked.provider && locked.provider !== provider && locked.checkoutUrl) throw new CustomerError("payment-pending", 409);
    if (locked.provider === provider && locked.checkoutUrl) return { url: locked.checkoutUrl, orderRef: orderId };
    const copy = copyFor(snapshot.product.code, data.lang);
    // Normalize to scheme+host only: a stray trailing path/slash on NEXT_PUBLIC_SITE_URL (e.g.
    // "https://site.it/it") would otherwise get baked into the payment-provider return URL and
    // 404 on redirect back, since returnPath() already supplies the full path itself.
    const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).origin;
    const description = `${copy.name} — ${copy.months(order.durationMonths)} — ${data.representativeName} (CF ${data.representativeTaxCode})`;
    const session = await createPaymentSession({ provider, service: snapshot.product.code, orderId, lang: data.lang, origin, email: order.email, totalCents: order.amountCents, description });
    if (!("url" in session)) return { paymentUnavailable: true, message: session.message };
    await tx.update(orders).set({ provider, providerReference: session.providerRef, paymentMethod: provider, checkoutUrl: session.url, updatedAt: new Date() }).where(eq(orders.id, order.id));
    return { url: session.url, orderRef: orderId };
  });
}
