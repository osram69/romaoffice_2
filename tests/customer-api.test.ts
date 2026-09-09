import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";
import { and, eq, inArray } from "drizzle-orm";
import { db, pool } from "@/db";
import { customers, customerContracts, customerChallenges, customerSessions, customerPasswordTokens, customerAudit, authLimits } from "@/db/schema";
import { hashPassword, verifyPassword, digest, token, SESSION_COOKIE, CHALLENGE_COOKIE, limit } from "@/lib/customer-auth";
import { storeCustomerContract } from "@/lib/customer-documents";
import { GET, POST } from "@/app/api/customer/[action]/route";

test("customer portal: password + registered-mobile SMS and private contracts", async t => {
  const nonce = randomUUID(); const email = `qa-${nonce}@example.invalid`;
  const password = `QA-only-${token()}`; const phone = "+393331234567";
  const originalFetch = globalThis.fetch;
  const envNames = ["TWILIO_ACCOUNT_SID", "TWILIO_API_KEY", "TWILIO_API_KEY_SECRET", "TWILIO_FROM", "TRUSTED_CLIENT_IP_HEADER"];
  const saved = envNames.map(name => [name, process.env[name]] as const);
  Object.assign(process.env, { TWILIO_ACCOUNT_SID: "AC_TEST_ONLY", TWILIO_API_KEY: "TEST_ONLY", TWILIO_API_KEY_SECRET: "TEST_ONLY", TWILIO_FROM: "+15005550006", TRUSTED_CLIENT_IP_HEADER: "x-qa-ip" });
  let sentPhone = ""; let sentCode = ""; let challenge = ""; let session = "";
  const customerIds: string[] = []; const files: string[] = [];
  const rateKeys = new Set<string>([`login-ip:${nonce}`, `login-account:${email}`, `password-ip:${nonce}`]);
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    assert.ok(String(url).startsWith("https://api.twilio.com/"), "only the SMS test transport may be called");
    const body = new URLSearchParams(String(init?.body)); sentPhone = body.get("To") || "";
    sentCode = body.get("Body")?.match(/\b\d{6}\b/)?.[0] || "";
    assert.equal(sentCode.length, 6);
    return new Response(JSON.stringify({ sid: "SM_TEST_ONLY", status: "queued" }), { status: 201 });
  }) as typeof fetch;
  const request = (action: string, data: object, cookie?: string, origin = "http://localhost:3000") => POST(new NextRequest(`http://localhost:3000/api/customer/${action}`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin, "x-qa-ip": nonce, ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(data) }), { params: Promise.resolve({ action }) });
  const get = (action: string, cookie?: string, query = "") => GET(new NextRequest(`http://localhost:3000/api/customer/${action}${query}`, { headers: cookie ? { Cookie: cookie } : {} }), { params: Promise.resolve({ action }) });
  const cookieValue = (response: Response, name: string) => response.headers.get("set-cookie")?.match(new RegExp(`${name}=([^; ,]+)`))?.[1] || "";
  async function login() {
    const r = await request("login", { email, password, phone: "+12025559999", lang: "en" }); assert.equal(r.status, 200);
    challenge = cookieValue(r, CHALLENGE_COOKIE); assert.ok(challenge);
    assert.equal(cookieValue(r, SESSION_COOKIE), ""); assert.equal(sentPhone, phone);
    assert.ok(r.headers.get("set-cookie")?.includes("HttpOnly"));
    const data = await r.json(); assert.notEqual(data.phone, phone); assert.equal(data.code, undefined);
    rateKeys.add(`verify:${digest(challenge)}`);
    return challenge;
  }
  try {
    const [customer] = await db.insert(customers).values({ email, name: "QA Customer", phone, passwordHash: await hashPassword(password) }).returning(); customerIds.push(customer.id);
    const [other] = await db.insert(customers).values({ email: `other-${nonce}@example.invalid`, name: "Other QA Customer", phone }).returning(); customerIds.push(other.id);
    rateKeys.add(`download:${customer.id}`);
    const pdf = await PDFDocument.create(); pdf.addPage().drawText("Contract for the test customer only"); const bytes = Buffer.from(await pdf.save());
    const storageKey = await storeCustomerContract(bytes); files.push(storageKey);
    const [mine] = await db.insert(customerContracts).values({ customerId: customer.id, title: "Contratto di prova", titleEn: "Test agreement", reference: "QA-001", storageKey, sizeBytes: bytes.length }).returning();
    const [theirs] = await db.insert(customerContracts).values({ customerId: other.id, title: "Altro contratto", titleEn: "Other agreement", reference: "QA-002", storageKey, sizeBytes: bytes.length }).returning();

    await t.test("password hashing, anonymous protection, and cross-site rejection", async () => {
      assert.notEqual(customer.passwordHash, password); assert.equal(await verifyPassword(password, customer.passwordHash), true);
      assert.equal(await verifyPassword("wrong password", customer.passwordHash), false);
      assert.equal((await get("me")).status, 401); assert.equal((await get("contract", undefined, `?id=${mine.id}`)).status, 401);
      assert.equal((await request("login", { email, password: "wrong password" })).status, 401);
      assert.equal((await request("login", { email, password }, undefined, "https://attacker.invalid")).status, 403);
      const proxied = new NextRequest("http://internal-server:3000/api/customer/logout", { method: "POST", headers: { "Content-Type": "application/json", Host: "preview.example.test", Origin: "https://preview.example.test", "Sec-Fetch-Site": "same-origin" }, body: "{}" });
      assert.equal((await POST(proxied, { params: Promise.resolve({ action: "logout" }) })).status, 200);
    });
    await t.test("only a correct password sends SMS, to the stored phone", async () => { await login(); });
    await t.test("wrong OTP is counted, early resend blocked, and resend preserves attempts", async () => {
      const wrong = sentCode === "000000" ? "999999" : "000000";
      assert.equal((await request("verify", { code: wrong }, `${CHALLENGE_COOKIE}=${challenge}`)).status, 400);
      assert.equal((await request("resend", {}, `${CHALLENGE_COOKIE}=${challenge}`)).status, 429);
      await db.update(customerChallenges).set({ sentAt: new Date(Date.now() - 61000) }).where(eq(customerChallenges.tokenHash, digest(challenge)));
      assert.equal((await request("resend", { lang: "it" }, `${CHALLENGE_COOKIE}=${challenge}`)).status, 200);
      const [row] = await db.select().from(customerChallenges).where(eq(customerChallenges.tokenHash, digest(challenge)));
      assert.equal(row.attempts, 1); assert.equal(row.sends, 2);
    });
    await t.test("SMS verification issues a session; the code cannot be replayed", async () => {
      const r = await request("verify", { code: sentCode }, `${CHALLENGE_COOKIE}=${challenge}`);
      assert.equal(r.status, 200); session = cookieValue(r, SESSION_COOKIE); assert.ok(session);
      assert.equal((await request("verify", { code: sentCode }, `${CHALLENGE_COOKIE}=${challenge}`)).status, 400);
      const [stored] = await db.select().from(customerSessions).where(eq(customerSessions.tokenHash, digest(session)));
      assert.ok(stored); assert.notEqual(stored.tokenHash, session);
    });
    await t.test("contract listing and downloads are private and owner-scoped", async () => {
      const profile = await get("me", `${SESSION_COOKIE}=${session}`); assert.equal(profile.status, 200);
      const data = await profile.json(); assert.equal(data.contracts.length, 1); assert.equal(data.contracts[0].storageKey, undefined); assert.equal(data.customer.passwordHash, undefined);
      assert.equal((await get("contract", `${SESSION_COOKIE}=${session}`, `?id=${theirs.id}`)).status, 404);
      const downloaded = await get("contract", `${SESSION_COOKIE}=${session}`, `?id=${mine.id}`);
      assert.equal(downloaded.status, 200); assert.match(downloaded.headers.get("cache-control") || "", /no-store/);
      assert.equal(Buffer.from(await downloaded.arrayBuffer()).equals(bytes), true);
      const encrypted = await readFile(resolve(process.env.CUSTOMER_STORAGE_PATH || "private/customer-contracts", storageKey));
      assert.equal(encrypted.subarray(0, 4).toString(), "ROS1"); assert.equal(encrypted.includes(Buffer.from("%PDF-")), false);
    });
    await t.test("expired sessions and logout revoke protected access", async () => {
      await db.update(customerSessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(customerSessions.tokenHash, digest(session)));
      assert.equal((await get("me", `${SESSION_COOKIE}=${session}`)).status, 401);
      await db.update(customerSessions).set({ expiresAt: new Date(Date.now() + 60000) }).where(eq(customerSessions.tokenHash, digest(session)));
      assert.equal((await request("logout", {}, `${SESSION_COOKIE}=${session}`)).status, 200);
      assert.equal((await get("me", `${SESSION_COOKIE}=${session}`)).status, 401);
    });
    await t.test("expired challenges and five failed codes cannot authenticate", async () => {
      await login(); await db.update(customerChallenges).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(customerChallenges.tokenHash, digest(challenge)));
      assert.equal((await request("verify", { code: sentCode }, `${CHALLENGE_COOKIE}=${challenge}`)).status, 400);
      await login(); const wrong = sentCode === "000000" ? "999999" : "000000";
      for (let i = 0; i < 5; i++) assert.equal((await request("verify", { code: wrong }, `${CHALLENGE_COOKIE}=${challenge}`)).status, 400);
      assert.equal((await request("verify", { code: sentCode }, `${CHALLENGE_COOKIE}=${challenge}`)).status, 400);
    });
    await t.test("missing SMS configuration fails closed", async () => {
      delete process.env.TWILIO_ACCOUNT_SID;
      const r = await request("login", { email, password }); assert.equal(r.status, 503); assert.equal(cookieValue(r, SESSION_COOKIE), "");
      process.env.TWILIO_ACCOUNT_SID = "AC_TEST_ONLY";
    });
    await t.test("password reset tokens are single-use and never create a session", async () => {
      const reset = token(); await db.insert(customerPasswordTokens).values({ customerId: customer.id, tokenHash: digest(reset), expiresAt: new Date(Date.now() + 60000) });
      const r = await request("password", { action: "set", token: reset, password: `new-${password}` }); assert.equal(r.status, 200); assert.equal(cookieValue(r, SESSION_COOKIE), "");
      assert.equal((await request("password", { action: "set", token: reset, password })).status, 400);
      const [updated] = await db.select().from(customers).where(eq(customers.id, customer.id)); assert.equal(await verifyPassword(`new-${password}`, updated.passwordHash), true);
    });
    await t.test("database-backed throttling is enforced", async () => {
      const key = `qa-limit:${nonce}`; rateKeys.add(key); await limit(key, 2, 60); await limit(key, 2, 60);
      await assert.rejects(limit(key, 2, 60), (e: unknown) => e instanceof Error && e.message === "limited");
    });
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of saved) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    if (customerIds.length) {
      await db.delete(customerAudit).where(inArray(customerAudit.customerId, customerIds));
      await db.delete(customers).where(inArray(customers.id, customerIds));
    }
    const hashes = [...rateKeys].map(key => createHmac("sha256", process.env.AUTH_SECRET!).update(key).digest("hex"));
    if (hashes.length) await db.delete(authLimits).where(inArray(authLimits.key, hashes));
    for (const file of files) await unlink(resolve(process.env.CUSTOMER_STORAGE_PATH || "private/customer-contracts", file)).catch(() => {});
    await pool.end();
  }
});
