import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { sendRequestConfirmation } from "./order-confirmation";
import type { OrderSnapshot } from "./order-access";
import type { RequestData } from "./request";

/**
 * Transitions an order from "filled" to "paid" and sends the confirmation email/PDF exactly
 * once. Called from both the client-side verify-payment flow (customer's browser returns from
 * the payment provider) and the Stripe/PayPal webhooks (which can arrive first, or fire even
 * when the customer never returns to the site). Whichever call wins the filled->paid transition
 * does the work; the other finds the order already paid and no-ops, so the two paths never
 * double-send — and neither can silently skip sending, which is what happened before: the
 * webhooks used to flip the status directly without ever calling sendRequestConfirmation.
 */
export async function markOrderPaidAndNotify(publicId: string, provider: string, providerReference: string) {
  const justPaid = await db.transaction(async tx => {
    const [current] = await tx.select().from(orders).where(and(eq(orders.publicId, publicId), eq(orders.status, "filled"))).for("update");
    if (!current) return null;
    await tx.update(orders).set({ status: "paid", provider, providerReference, updatedAt: new Date() }).where(eq(orders.id, current.id));
    return current;
  });
  if (!justPaid) return null;
  try {
    const data = justPaid.formData as RequestData;
    const snapshot = justPaid.quoteData as OrderSnapshot;
    return await sendRequestConfirmation(justPaid, data, snapshot, justPaid.paymentMethod || provider);
  } catch (error) {
    console.error("Post-payment confirmation failed (payment itself succeeded)", justPaid.publicId, error instanceof Error ? `${error.name}: ${error.message}` : error);
    return null;
  }
}
