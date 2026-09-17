import { NextRequest } from "next/server";
import { getOffer } from "@/lib/catalog";
import { tierFor } from "@/lib/pricing";
import { buildManualRequestEmail, manualRequestSchema } from "@/lib/manual-request";
import { sendMail, smtpConfigured } from "@/lib/mailer";
import { CustomerError, clientIp, json, limit, protectMutation } from "@/lib/customer-auth";

export async function POST(req: NextRequest) {
  try {
    protectMutation(req);
    const parsed = manualRequestSchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "invalid" }, 400);
    const data = parsed.data;
    await limit(`manual-request-ip:${clientIp(req)}`, 20, 900);
    await limit(`manual-request-email:${data.email}`, 5, 3600);
    if (!smtpConfigured()) return json({ error: "mail" }, 503);
    const product = await getOffer(data.service);
    if (!tierFor(product, data.months)) return json({ error: "invalid" }, 400);
    const sent = await sendMail(buildManualRequestEmail(data, product));
    return sent.sent ? json({ ok: true, sent: true }) : json({ error: "mail" }, 502);
  } catch (error) {
    if (error instanceof CustomerError) return json({ error: error.code }, error.status);
    console.error("Manual request failed", error instanceof Error ? error.name : "UnknownError");
    return json({ error: "unavailable" }, 503);
  }
}
