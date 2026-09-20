import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { readyOrder } from "@/lib/order-access";
import { CustomerError, clientIp, limit, protectMutation } from "@/lib/customer-auth";
import { buildRequestPdf } from "@/lib/pdf";
import { adminEmail, sendMail } from "@/lib/mailer";
import { escapeHtml } from "@/lib/standard-offer";
import { copyFor } from "@/lib/pricing";

const input = z.object({ orderId: z.string().uuid(), signature: z.string().startsWith("data:image/png;base64,") });

export async function POST(req: NextRequest) {
  try {
    protectMutation(req);
    const parsed = input.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
    await limit(`sign:${clientIp(req)}`, 20, 900);
    const { order, data, snapshot } = await readyOrder(req, parsed.data.orderId);
    if (order.status !== "filled" && order.status !== "paid" && order.status !== "signed") return NextResponse.json({ error: "not-ready" }, { status: 403 });
    const { product, quote: priced } = snapshot; const it = data.lang === "it";
    const png = Buffer.from(parsed.data.signature.split(",")[1], "base64");
    const signedAt = new Date();
    const pdf = Buffer.from(await buildRequestPdf({ data, lang: data.lang, orderRef: order.publicId, paymentMethod: order.paymentMethod || "bank_transfer", product, priced, signature: { png, signedAt } }));
    await db.update(orders).set({ status: "signed", updatedAt: new Date() }).where(eq(orders.id, order.id));
    const copy = copyFor(product.code, data.lang);
    const attachments = [{ filename: `Richiesta_firmata_${product.code}_${order.publicId.slice(0, 8)}.pdf`, content: pdf, contentType: "application/pdf" }];
    const letter = it
      ? `Gentile ${data.representativeName},\n\nin allegato trova copia della richiesta firmata (Rif. ${order.publicId}).\n\nRoma Office Sharing — +39 06 21.11.6268 — info@romaofficesharing.it`
      : `Dear ${data.representativeName},\n\nplease find attached your signed application copy (Ref. ${order.publicId}).\n\nRoma Office Sharing — +39 06 21.11.6268 — info@romaofficesharing.it`;
    await sendMail({ to: data.email, subject: `${it ? "Richiesta firmata" : "Signed application"} — ${copy.name}`, text: letter, html: `<div style="font-family:Arial;white-space:pre-wrap;line-height:1.6">${escapeHtml(letter)}</div>`, attachments });
    await sendMail({ to: adminEmail(), subject: `[${order.publicId.slice(0, 8)}] ${it ? "Firmata" : "Signed"} — ${copy.name}`, text: letter, html: `<div style="white-space:pre-wrap">${escapeHtml(letter)}</div>`, attachments });
    return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="firmato-${order.publicId}.pdf"`, "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof CustomerError) return NextResponse.json({ error: error.code }, { status: error.status });
    console.error("Signature save failed", error instanceof Error ? `${error.name}: ${error.message}` : error);
    return NextResponse.json({ error: "signature-failed" }, { status: 400 });
  }
}
