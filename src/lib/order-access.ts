import { NextRequest } from "next/server";
import { and, eq, gt, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { orders, otpVerifications } from "@/db/schema";
import { CustomerError, digest } from "./customer-auth";
import { getOffer } from "./catalog";
import { quote, type ProductOffer, type Quote, type ServiceCode } from "./pricing";
import type { RequestData } from "./request";
export const ORDER_COOKIE = "ros_order_access";
export type OrderSnapshot = { product: ProductOffer; quote: Quote; createdAt: string };
export async function ownedOrder(req: NextRequest, orderId: string) {
  const raw = req.cookies.get(ORDER_COOKIE)?.value;
  if (!raw || !/^[a-f\d]{64}$/.test(raw)) throw new CustomerError("order-session", 401);
  const [order] = await db.select().from(orders).where(and(eq(orders.publicId, orderId), eq(orders.accessTokenHash, digest(raw)))).limit(1);
  if (!order) throw new CustomerError("order-session", 401);
  return order;
}
export async function readyOrder(req: NextRequest, orderId: string) {
  const order = await ownedOrder(req, orderId);
  if (order.status === "cancelled") throw new CustomerError("cancelled", 409);
  const snapshot = order.quoteData as OrderSnapshot | null; const data = order.formData as RequestData | null;
  if (!snapshot || !data || !data.consent) throw new CustomerError("invalid-order", 400);
  if (order.service === "postal" && (!order.termsAcceptedAt || order.termsVersion !== snapshot.product.version || !data.termsAccepted)) throw new CustomerError("terms-required", 403);
  const [verified] = await db.select().from(otpVerifications).where(and(eq(otpVerifications.orderPublicId, orderId), eq(otpVerifications.phone, order.phone!), isNotNull(otpVerifications.verifiedAt), gt(otpVerifications.expiresAt, new Date()))).limit(1);
  if (!verified) throw new CustomerError("otp-required", 403);
  if (order.status !== "paid" && order.status !== "signed") {
    const current = await getOffer(order.service as ServiceCode); const fresh = quote(current, data);
    if (!fresh || current.version !== snapshot.product.version || fresh.totalCents !== order.amountCents) throw new CustomerError("prices-changed", 409);
  }
  return { order, snapshot, data };
}
