import { handleStripeWebhook } from "@/lib/webhook-handlers";
export async function POST(req: Request) { return handleStripeWebhook(req, true); }
