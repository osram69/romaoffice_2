import { handlePaypalWebhook } from "@/lib/webhook-handlers";
export async function POST(req: Request) { return handlePaypalWebhook(req, false); }
