import { NextRequest } from "next/server";
import { z } from "zod";
import { checkoutOrder } from "@/lib/order-checkout";
import { CustomerError, json, protectMutation } from "@/lib/customer-auth";
const input = z.object({ orderId: z.string().uuid(), provider: z.enum(["stripe", "paypal", "sumup"]) });
export async function POST(req: NextRequest) {
  try {
    protectMutation(req); const parsed = input.safeParse(await req.json());
    if (!parsed.success) return json({ error: "invalid" }, 400);
    // The caller cannot submit a duration, discount, service or amount override.
    return json(await checkoutOrder(req, parsed.data.orderId, parsed.data.provider));
  } catch (error) { return error instanceof CustomerError ? json({ error: error.code }, error.status) : json({ error: "payment-session-failed" }, 400); }
}
