import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { and, eq, ne, or, lt } from "drizzle-orm";
import { db } from "@/db";
import { standardOfferRequests } from "@/db/schema";
import { getOffer } from "@/lib/catalog";
import { buildStandardOfferEmail, readOriginalRequestModule, standardOfferSchema } from "@/lib/standard-offer";
import { sendMail, smtpConfigured } from "@/lib/mailer";
import { CustomerError, clientIp, json, limit, protectMutation } from "@/lib/customer-auth";

export async function POST(req: NextRequest) {
  try {
    protectMutation(req);
    const parsed = standardOfferSchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "invalid" }, 400);
    const data = parsed.data;
    const payloadHash = createHash("sha256").update(JSON.stringify(data)).digest("hex");
    const [existing] = await db.select().from(standardOfferRequests).where(eq(standardOfferRequests.id, data.requestId)).limit(1);
    if (existing && existing.payloadHash !== payloadHash) return json({ error: "invalid" }, 409);
    if (existing?.status === "sent") return json({ ok: true, sent: true });
    if (existing?.status === "sending" && Date.now() - existing.createdAt.getTime() < 120000) return json({ error: "sending" }, 409);
    await limit(`standard-offer-ip:${clientIp(req)}`, 20, 900);
    await limit(`standard-offer-email:${data.email}`, 5, 3600);
    let module: Buffer;
    try { module = await readOriginalRequestModule(); } catch { return json({ error: "attachment" }, 503); }
    if (!smtpConfigured()) return json({ error: "mail" }, 503);
    const product = await getOffer(data.service);
    const inserted = await db.insert(standardOfferRequests).values({ id: data.requestId, service: data.service, title: data.title, firstName: data.firstName, lastName: data.lastName, email: data.email, lang: data.lang, payloadHash, status: "sending", catalogSnapshot: product, attachmentHash: createHash("sha256").update(module).digest("hex") }).onConflictDoNothing().returning();
    if (!inserted.length) {
      const claimed = await db.update(standardOfferRequests).set({ status: "sending", errorCode: null, catalogSnapshot: product, attachmentHash: createHash("sha256").update(module).digest("hex"), createdAt: new Date() }).where(and(eq(standardOfferRequests.id, data.requestId), eq(standardOfferRequests.payloadHash, payloadHash), or(eq(standardOfferRequests.status, "failed"), and(eq(standardOfferRequests.status, "sending"), lt(standardOfferRequests.createdAt, new Date(Date.now() - 120000)))))).returning();
      if (!claimed.length) return json({ error: "sending" }, 409);
    }
    const sent = await sendMail(buildStandardOfferEmail(data, product, module));
    await db.update(standardOfferRequests).set(sent.sent ? { status: "sent", sentAt: new Date(), messageId: sent.messageId ?? null, errorCode: null } : { status: "failed", errorCode: sent.reason ?? "mail" }).where(eq(standardOfferRequests.id, data.requestId));
    return sent.sent ? json({ ok: true, sent: true }) : json({ error: "mail" }, 502);
  } catch (error) {
    if (error instanceof CustomerError) return json({ error: error.code }, error.status);
    console.error("Standard offer request failed", error instanceof Error ? error.name : "UnknownError");
    return json({ error: "unavailable" }, 503);
  }
}
