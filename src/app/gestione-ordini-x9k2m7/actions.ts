"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, otpVerifications } from "@/db/schema";
import { requireAdminUser } from "@/lib/staff-guards";
import { sendRequestConfirmation } from "@/lib/order-confirmation";
import type { OrderSnapshot } from "@/lib/order-access";
import type { RequestData } from "@/lib/request";

const BASE_PATH = "/gestione-ordini-x9k2m7";

// Reachable only for orders whose payment/registration is actually final (see the "Reinvia
// conferma" button in page.tsx) — resending for a still-"pending" or "cancelled" order would be
// meaningless (no accepted data) or misleading (payment not actually confirmed).
const RESENDABLE = new Set(["filled", "paid", "signed"]);

export async function resendConfirmationAction(formData: FormData): Promise<{ ok: boolean; message?: string }> {
  "use server";
  await requireAdminUser(BASE_PATH);
  const publicId = String(formData.get("orderId") ?? "");
  const [order] = await db.select().from(orders).where(eq(orders.publicId, publicId)).limit(1);
  if (!order || !RESENDABLE.has(order.status)) { revalidatePath(BASE_PATH); return { ok: false, message: "Questo ordine non si trova più in uno stato in cui la conferma si può reinviare. Ricarica la pagina." }; }
  const data = order.formData as RequestData | null;
  const snapshot = order.quoteData as OrderSnapshot | null;
  if (!data || !snapshot) { revalidatePath(BASE_PATH); return { ok: false, message: "I dati della richiesta di questo ordine non sono disponibili: la conferma non può essere reinviata." }; }
  // sendRequestConfirmation is idempotent (it checks requestEmailSentAt/adminEmailSentAt itself),
  // so this only actually delivers whichever side (customer/admin) never went out — exactly the
  // case where a payment webhook flipped the order to "paid" without ever notifying anyone.
  const sent = await sendRequestConfirmation(order, data, snapshot, order.paymentMethod || order.provider || "on_site");
  revalidatePath(BASE_PATH);
  if (!sent.customerSent || !sent.adminSent) {
    const missing = [!sent.customerSent && "al cliente", !sent.adminSent && "a te"].filter(Boolean).join(" e ");
    return { ok: false, message: `La conferma non è partita ${missing}. Controlla la posta in uscita e riprova.` };
  }
  return { ok: true, message: "Conferma inviata al cliente e in copia a te." };
}

// Irreversible. The whole Ordini area is admin-only (requireAdminUser). Used mostly to clear
// test orders. The OTP row is keyed by public id with no foreign key, so it is removed by hand.
export async function deleteOrderAction(formData: FormData): Promise<{ ok: boolean; message?: string }> {
  "use server";
  await requireAdminUser(BASE_PATH);
  const publicId = String(formData.get("orderId") ?? "");
  if (!publicId) return { ok: false, message: "Ordine non indicato." };
  await db.transaction(async tx => {
    await tx.delete(otpVerifications).where(eq(otpVerifications.orderPublicId, publicId));
    await tx.delete(orders).where(eq(orders.publicId, publicId));
  });
  revalidatePath(BASE_PATH);
  return { ok: true };
}
