import { NextRequest } from "next/server";
import { z } from "zod";
import { findUsableDiscount } from "@/lib/discount-code-db";
import { CustomerError, clientIp, json, limit, protectMutation } from "@/lib/customer-auth";

const input = z.object({ code: z.string().max(60), service: z.enum(["legal_unit", "postal"]) });

/** Checks a discount code for the price summary. Same answer for unknown, expired, switched-off and wrong-service codes. */
export async function POST(req: NextRequest) {
  try {
    protectMutation(req); const parsed = input.safeParse(await req.json()); if (!parsed.success) return json({ valid: false }, 400);
    await limit(`discount-code:${clientIp(req)}`, 40, 600);
    const found = await findUsableDiscount(parsed.data.code, parsed.data.service);
    return json(found ? { valid: true, code: found.code, bps: found.bps, months: found.months } : { valid: false });
  } catch (error) {
    if (error instanceof CustomerError) return json({ error: error.code }, error.status);
    console.error("Discount code check failed", error instanceof Error ? error.name : "UnknownError");
    return json({ error: "unavailable" }, 503);
  }
}
