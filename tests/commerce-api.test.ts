import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash, createHmac } from "node:crypto";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";
import { and, eq, inArray } from "drizzle-orm";
import { db, pool } from "@/db";
import { servicePrices, standardOfferRequests, orders, otpVerifications, authLimits } from "@/db/schema";
import { getCatalog, getOffer } from "@/lib/catalog";
import { quote } from "@/lib/pricing";
import { termsText } from "@/lib/offer-terms";
import { buildStandardOfferEmail, MODULE_FILENAME } from "@/lib/standard-offer";
import { ORDER_COOKIE } from "@/lib/order-access";
import { POST as offerApi } from "@/app/api/standard-offer/route";
import { POST as requestApi } from "@/app/api/domiciliation-request/route";
import { POST as finalizeApi } from "@/app/api/domiciliation-request/finalize/route";
import { POST as sendOtp } from "@/app/api/send-otp/route";
import { POST as verifyOtp } from "@/app/api/verify-otp/route";
import { POST as checkoutApi } from "@/app/api/create-payment-session/route";
import { POST as verifyPayment } from "@/app/api/verify-payment/route";
import { startTestSmtp } from "./test-smtp";

test("database offers, immutable attachments and postal checkout", async t => {
  const nonce = randomUUID(); const email = `qa-commerce-${nonce}@example.invalid`; const phone = `+39333${Math.floor(1000000 + Math.random() * 8999999)}`;
  const smtp = await startTestSmtp(); const originalFetch = globalThis.fetch;
  const vars = ["AUTH_SECRET", "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "MAIL_FROM", "ADMIN_EMAIL", "TWILIO_ACCOUNT_SID", "TWILIO_API_KEY", "TWILIO_API_KEY_SECRET", "TWILIO_FROM", "TRUSTED_CLIENT_IP_HEADER", "SUMUP_API_KEY", "SUMUP_MERCHANT_CODE"];
  const previous = vars.map(key => [key, process.env[key]] as const);
  Object.assign(process.env, { AUTH_SECRET: process.env.AUTH_SECRET || randomUUID() + randomUUID(), SMTP_HOST: "127.0.0.1", SMTP_PORT: String(smtp.port), SMTP_USER: "local-test-user", SMTP_PASS: nonce, MAIL_FROM: "test@example.invalid", ADMIN_EMAIL: "admin@example.invalid", TWILIO_ACCOUNT_SID: "TEST_ONLY", TWILIO_API_KEY: "TEST_ONLY", TWILIO_API_KEY_SECRET: nonce, TWILIO_FROM: "+15005550006", TRUSTED_CLIENT_IP_HEADER: "x-test-ip", SUMUP_API_KEY: "TEST_ONLY", SUMUP_MERCHANT_CODE: "MC_TEST_ONLY" });
  let code = ""; let smsPhone = ""; let paymentBody: { amount?: number; currency?: string; checkout_reference?: string; redirect_url?: string } = {};
  let orderId = "", cookie = ""; let createdFixture = false; const offerIds: string[] = []; const rateKeys = new Set([`standard-offer-ip:${nonce}`, `standard-offer-email:${email}`, `order-email:${email}`, `order-sms:${phone}`]);
  const attachmentPath = join(process.cwd(), "public", MODULE_FILENAME);
  const makeRequest = (path: string, body: object, access = "") => new NextRequest(`http://localhost:3000${path}`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", "x-test-ip": nonce, ...(access ? { Cookie: access } : {}) }, body: JSON.stringify(body) });
  globalThis.fetch = (async (url: RequestInfo | URL, options?: RequestInit) => {
    const address = String(url);
    if (address.includes("api.twilio.com")) { const data = new URLSearchParams(String(options?.body)); code = data.get("Body")?.match(/\b\d{6}\b/)?.[0] || ""; smsPhone = data.get("To") || ""; return new Response(JSON.stringify({ sid: "TEST_SMS" }), { status: 201 }); }
    if (address.endsWith("/v0.1/checkouts") && options?.method === "POST") { paymentBody = JSON.parse(String(options.body)); return new Response(JSON.stringify({ id: "test-checkout", hosted_checkout_url: "https://checkout.sumup.com/test-only" }), { status: 201 }); }
    if (address.endsWith("/v0.1/checkouts/test-checkout")) return new Response(JSON.stringify({ status: "PAID", amount: paymentBody.amount, currency: "EUR", merchant_code: "MC_TEST_ONLY", checkout_reference: orderId }));
    throw new Error(`Unexpected network access in test: ${address}`);
  }) as typeof fetch;
  try {
    const catalog = await getCatalog(); const product = catalog.postal;
    await t.test("published legal and postal rates come from PostgreSQL", async () => {
      assert.deepEqual(product.tiers.map(t => [t.months, t.listCents, t.offerCents]), [[6, 30000, 28000], [12, 54000, 50000]]);
      assert.equal(quote(product, { months: 6, additionalDomiciliation: true })!.totalCents, 30744);
      assert.equal(quote(product, { months: 12, additionalDomiciliation: true })!.totalCents, 54900);
      assert.equal(quote(product, { months: 6, newActivation: true })!.newActivationDiscountCents, 0);
      assert.equal(quote(product, { months: 6, addons: [{ code: "virtual_secretary", quantity: 1 }] })!.totalCents, 69540);
      assert.equal(quote(product, { months: 6, addons: [{ code: "archive", quantity: 6 }] }), null);
      assert.equal(quote(catalog.legal_unit, { months: 12, newActivation: true, now: new Date("2026-09-01T12:00:00Z") })!.netCents, 49500);
    });
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const body = { lang: "it", service: "postal", representativeName: "QA Mario Rossi", representativeRole: "Titolare", email, phone, companyExists: false, months: 6, startDate: tomorrow, newActivation: false, additionalDomiciliation: false, addons: [{ code: "virtual_secretary", quantity: 1 }], consent: true, termsAccepted: true, catalogVersion: product.version, termsVersion: product.version };
    await t.test("database changes change the displayed catalogue and reject stale requests", async () => {
      try {
        await db.update(servicePrices).set({ offerCents: 28100 }).where(and(eq(servicePrices.service, "postal"), eq(servicePrices.months, 6)));
        const fresh = await getOffer("postal"); assert.equal(fresh.tiers[0].offerCents, 28100); assert.notEqual(fresh.version, product.version);
        assert.equal((await requestApi(makeRequest("/api/domiciliation-request", body))).status, 409);
      } finally { await db.update(servicePrices).set({ offerCents: 28000 }).where(and(eq(servicePrices.service, "postal"), eq(servicePrices.months, 6))); }
    });
    await t.test("postal terms and postal-only durations are server requirements", async () => {
      assert.equal((await requestApi(makeRequest("/api/domiciliation-request", { ...body, termsAccepted: false }))).status, 400);
      assert.equal((await requestApi(makeRequest("/api/domiciliation-request", { ...body, months: 3 }))).status, 400);
      assert.equal((await requestApi(makeRequest("/api/domiciliation-request", { ...body, newActivation: true }))).status, 400);
      assert.equal((await requestApi(makeRequest("/api/domiciliation-request", { ...body, consent: false }))).status, 400);
      const text = termsText(product, "it");
      for (const expected of ["Logo aziendale esposto al piano (su richiesta)", "10 aperture/mese incluse", "entro le 24h", "40€/mese", "50€", "max 5 faldoni", "Pagamento anticipato", "non è previsto deposito cauzionale"]) assert.ok(text.includes(expected), expected);
    });
    await t.test("standard offer attaches exactly the original bytes and is idempotent", async () => {
      let original: Buffer;
      try { original = await readFile(attachmentPath); }
      catch {
        const missingId = randomUUID();
        assert.equal((await offerApi(makeRequest("/api/standard-offer", { requestId: missingId, service: "postal", lang: "it", title: "Mr", firstName: "Mario", lastName: "Rossi", email, consent: true }))).status, 503);
        const doc = await PDFDocument.create(); doc.addPage().drawText("TEST FIXTURE ONLY - NOT THE CUSTOMER'S ORIGINAL MODULE"); original = Buffer.from(await doc.save());
        await writeFile(attachmentPath, original, { flag: "wx" }); createdFixture = true;
      }
      const requestId = randomUUID(); offerIds.push(requestId);
      const data = { requestId, service: "postal" as const, lang: "it" as const, title: "Mr" as const, firstName: "Mario", lastName: "Rossi", email, consent: true as const };
      const mail = buildStandardOfferEmail(data, product, original); assert.strictEqual(mail.attachments![0].content, original); assert.equal(mail.attachments![0].filename, MODULE_FILENAME); assert.ok(mail.text.includes("280,00"));
      const first = await offerApi(makeRequest("/api/standard-offer", data)); assert.equal(first.status, 200); assert.equal((await first.json()).sent, true);
      const count = smtp.messages.length; assert.equal((await offerApi(makeRequest("/api/standard-offer", data))).status, 200); assert.equal(smtp.messages.length, count);
      const mime = smtp.messages[0].split(/\r\n--/).find(section => section.includes("Content-Type: application/pdf"))!;
      assert.ok(mime); const encoded = mime.slice(mime.indexOf("\r\n\r\n") + 4).trim(); const bytes = Buffer.from(encoded, "base64"); assert.equal(bytes.equals(original), true);
      const [record] = await db.select().from(standardOfferRequests).where(eq(standardOfferRequests.id, requestId)); assert.equal(record.attachmentHash, createHash("sha256").update(original).digest("hex")); assert.equal(record.status, "sent");
      assert.equal((await offerApi(makeRequest("/api/standard-offer", { ...data, requestId: randomUUID(), consent: false }))).status, 400);
    });
    await t.test("rejected email never reports success and can be retried", async () => {
      const requestId = randomUUID(); offerIds.push(requestId);
      const data = { requestId, service: "legal_unit", lang: "en", title: "Ms", firstName: "Jane", lastName: "Smith", email, consent: true };
      smtp.state.reject = true;
      try { const rejected = await offerApi(makeRequest("/api/standard-offer", data)); assert.equal(rejected.status, 502); assert.equal((await rejected.json()).error, "mail"); }
      finally { smtp.state.reject = false; }
      const [failed] = await db.select().from(standardOfferRequests).where(eq(standardOfferRequests.id, requestId)); assert.equal(failed.status, "failed");
      const retried = await offerApi(makeRequest("/api/standard-offer", data)); assert.equal(retried.status, 200); assert.equal((await retried.json()).sent, true);
    });
    await t.test("create postal application and block payment before SMS verification", async () => {
      const response = await requestApi(makeRequest("/api/domiciliation-request", body)); assert.equal(response.status, 201);
      const data = await response.json(); orderId = data.orderId; rateKeys.add(`order-verify:${orderId}`); cookie = `${ORDER_COOKIE}=${response.headers.get("set-cookie")?.match(new RegExp(`${ORDER_COOKIE}=([^;]+)`))?.[1]}`;
      assert.equal(data.totalCents, 69540);
      assert.equal((await finalizeApi(makeRequest("/api/domiciliation-request/finalize", { orderId, paymentMethod: "on_site" }, cookie))).status, 403);
      assert.equal((await checkoutApi(makeRequest("/api/create-payment-session", { orderId, provider: "sumup" }, cookie))).status, 403);
      assert.equal((await sendOtp(makeRequest("/api/send-otp", { orderId, phone }))).status, 401);
    });
    await t.test("SMS is bound to the stored phone, not the caller's phone", async () => {
      assert.equal((await sendOtp(makeRequest("/api/send-otp", { orderId, phone: "+12025559999" }, cookie))).status, 200); assert.equal(smsPhone, phone);
      assert.equal((await verifyOtp(makeRequest("/api/verify-otp", { orderId, code }, cookie))).status, 200);
      assert.equal((await verifyOtp(makeRequest("/api/verify-otp", { orderId, code }, cookie))).status, 400);
    });
    await t.test("postal submission records accepted terms and Annex 1, emails a request PDF", async () => {
      const response = await finalizeApi(makeRequest("/api/domiciliation-request/finalize", { orderId, paymentMethod: "on_site" }, cookie)); assert.equal(response.status, 200);
      const data = await response.json(); assert.equal(data.emailSent, true); assert.equal(data.totalCents, 69540); assert.equal(data.paymentMethod, "on_site");
      const pdf = await PDFDocument.load(Buffer.from(data.pdfBase64, "base64")); assert.ok(pdf.getPageCount() >= 2);
      const [order] = await db.select().from(orders).where(eq(orders.publicId, orderId)); assert.equal(order.service, "postal"); assert.ok(order.termsAcceptedAt); assert.ok(order.termsText?.includes("non è previsto deposito cauzionale")); assert.equal(order.status, "filled");
      const before = smtp.messages.length; await finalizeApi(makeRequest("/api/domiciliation-request/finalize", { orderId, paymentMethod: "on_site" }, cookie)); assert.equal(smtp.messages.length, before);
    });
    await t.test("payment ignores caller price overrides and uses saved postal totals", async () => {
      const r = await checkoutApi(makeRequest("/api/create-payment-session", { orderId, provider: "sumup", months: 3, service: "legal_unit", totalCents: 1 }, cookie)); assert.equal(r.status, 200);
      assert.equal(paymentBody.amount, 695.4); assert.equal(paymentBody.checkout_reference, orderId); assert.ok(paymentBody.redirect_url?.includes("service=postal"));
      const verified = await verifyPayment(makeRequest("/api/verify-payment", { order: orderId, provider: "sumup", sessionId: "untrusted" }, cookie)); assert.equal((await verified.json()).paid, true);
      const [order] = await db.select().from(orders).where(eq(orders.publicId, orderId)); assert.equal(order.status, "paid"); assert.equal(order.amountCents, 69540);
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (createdFixture) await unlink(attachmentPath);
    if (orderId) { await db.delete(otpVerifications).where(eq(otpVerifications.orderPublicId, orderId)); await db.delete(orders).where(eq(orders.publicId, orderId)); }
    if (offerIds.length) await db.delete(standardOfferRequests).where(inArray(standardOfferRequests.id, offerIds));
    const hashes = [...rateKeys].map(k => createHmac("sha256", process.env.AUTH_SECRET!).update(k).digest("hex")); await db.delete(authLimits).where(inArray(authLimits.key, hashes));
    for (const [k,v] of previous) if (v === undefined) delete process.env[k]; else process.env[k] = v;
    await smtp.close(); await pool.end();
  }
});
