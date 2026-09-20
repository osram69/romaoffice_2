import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { readyOrder } from "@/lib/order-access";
import { checkoutOrder } from "@/lib/order-checkout";
import { sendRequestConfirmation } from "@/lib/order-confirmation";
import { CustomerError, json, protectMutation } from "@/lib/customer-auth";
import { paymentMethodSchema } from "@/lib/request";
import { paymentMethodEnabled } from "@/lib/payment-settings";
import { shortOrderRef } from "@/lib/order-ref";
const input = z.object({ orderId: z.string().uuid(), paymentMethod: paymentMethodSchema });
const ONLINE_METHODS = ["stripe", "paypal", "sumup"] as const;
export async function POST(req: NextRequest) {
  try {
    protectMutation(req); const parsed = input.safeParse(await req.json()); if (!parsed.success) return json({ error: "invalid" }, 400);
    const { orderId, paymentMethod } = parsed.data;
    const { order, data, snapshot } = await readyOrder(req, orderId);
    if (order.status === "paid" || order.status === "signed") return json({ paid: true, orderRef: orderId });
    const { product, quote: priced } = snapshot; const it = data.lang === "it";
    if (paymentMethod === "on_site" && product.code !== "postal") return json({ error: "invalid-payment-method" }, 400);
    if (!(await paymentMethodEnabled(paymentMethod))) return json({ error: "invalid-payment-method" }, 400);
    const isOnline = (ONLINE_METHODS as readonly string[]).includes(paymentMethod);
    await db.transaction(async tx => {
      const [current] = await tx.select().from(orders).where(eq(orders.id, order.id)).for("update");
      if (current.status === "paid" || current.status === "signed") throw new CustomerError("already-paid", 409);
      await tx.update(orders).set({ status: "filled", paymentMethod, updatedAt: new Date() }).where(eq(orders.id, order.id));
    });
    const shortRef = shortOrderRef(data.representativeTaxCode, order.createdAt);
    if (isOnline) {
      // The request PDF is built and emailed only once the online payment actually succeeds
      // (see /api/verify-payment) — not here, since the customer hasn't paid yet at this point.
      const checkout = await checkoutOrder(req, orderId, paymentMethod as "stripe" | "paypal" | "sumup");
      return json({ paymentMethod, orderRef: orderId, shortRef, totalCents: priced.totalCents,
        message: it ? "Procedi al pagamento online per completare la pratica. Il modulo compilato ti sarà inviato via email dopo la conferma del pagamento." : "Proceed with online payment to complete the application. The completed form will be emailed to you once payment is confirmed.",
        ...checkout });
    }
    const sent = await sendRequestConfirmation(order, data, snapshot, paymentMethod);
    return json({ paymentMethod, orderRef: orderId, shortRef: sent.shortRef, emailSent: sent.customerSent, adminMailSent: sent.adminSent, totalCents: priced.totalCents, pdfBase64: sent.pdf.toString("base64"), bankTransferDetails: paymentMethod === "bank_transfer" ? sent.bankDetails : undefined,
      message: sent.customerSent ? (it ? "La richiesta è registrata e l’email è stata inviata. Controlla la tua casella di posta." : "Your application is recorded and the email has been sent. Please check your inbox.") : (it ? "La richiesta è registrata, ma l’email non è stata inviata. Scarica il riepilogo e contatta la reception." : "Your application is recorded, but the email was not sent. Download the summary and contact reception.") });
  } catch (error) {
    if (error instanceof CustomerError) { console.error("Request finalization rejected", error.code, error.status); return json({ error: error.code }, error.status); }
    console.error("Request finalization failed", error instanceof Error ? `${error.name}: ${error.message}` : error, error instanceof Error && error.cause ? `cause: ${error.cause}` : "");
    return json({ error: "finalize-failed" }, 400);
  }
}
