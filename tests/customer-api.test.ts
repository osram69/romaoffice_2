import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "@/db";
import { domClients, domCustomerChallenges, domCustomerSessions, authLimits } from "@/db/schema";
import { hashPassword, verifyPassword, digest, token, SESSION_COOKIE, CHALLENGE_COOKIE, limit } from "@/lib/customer-auth";
import { saveEncrypted, removeEncrypted } from "@/lib/dom-archive";
import { PRESENZA_FILE_BITS } from "@/lib/dom-status";
import { GET, POST } from "@/app/api/customer/[action]/route";

test("area clienti: password + registered-mobile SMS and the domiciliazione contract", async t => {
  const nonce = randomUUID(); const email = `qa-${nonce}@example.invalid`;
  const password = `QA-only-${token()}`; const phone = "+393331234567";
  const originalFetch = globalThis.fetch;
  const envNames = ["TWILIO_ACCOUNT_SID", "TWILIO_API_KEY", "TWILIO_API_KEY_SECRET", "TWILIO_FROM", "TRUSTED_CLIENT_IP_HEADER"];
  const saved = envNames.map(name => [name, process.env[name]] as const);
  Object.assign(process.env, { TWILIO_ACCOUNT_SID: "AC_TEST_ONLY", TWILIO_API_KEY: "TEST_ONLY", TWILIO_API_KEY_SECRET: "TEST_ONLY", TWILIO_FROM: "+15005550006", TRUSTED_CLIENT_IP_HEADER: "x-qa-ip" });
  let sentPhone = ""; let sentCode = ""; let challenge = ""; let session = "";
  const domClientIds: number[] = [];
  const rateKeys = new Set<string>([`login-ip:${nonce}`, `login-account:${email}`]);
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
    const r = await request("login", { email, password, lang: "en" }); assert.equal(r.status, 200);
    challenge = cookieValue(r, CHALLENGE_COOKIE); assert.ok(challenge);
    assert.equal(cookieValue(r, SESSION_COOKIE), ""); assert.equal(sentPhone, phone);
    assert.ok(r.headers.get("set-cookie")?.includes("HttpOnly"));
    const data = await r.json(); assert.notEqual(data.phone, phone); assert.equal(data.code, undefined);
    rateKeys.add(`verify:${digest(challenge)}`);
    return challenge;
  }
  try {
    const [client] = await db.insert(domClients).values({
      ragioneSociale: "QA Test Client", areaClientiEmail: email, areaClientiPasswordHash: await hashPassword(password),
      telefono: phone, presenzaFile: PRESENZA_FILE_BITS.con,
    }).returning();
    domClientIds.push(client.id);
    const [other] = await db.insert(domClients).values({ ragioneSociale: "QA Other Client", areaClientiEmail: `other-${nonce}@example.invalid`, telefono: phone, presenzaFile: PRESENZA_FILE_BITS.con }).returning();
    domClientIds.push(other.id);
    rateKeys.add(`download:${client.id}`);
    const contractBytes = Buffer.from("%PDF-1.4 QA contract for the test client only");
    await saveEncrypted(client.id, "con", contractBytes);
    await saveEncrypted(other.id, "con", Buffer.from("%PDF-1.4 QA contract for the OTHER client"));

    await t.test("password hashing, anonymous protection, and cross-site rejection", async () => {
      assert.notEqual(client.areaClientiPasswordHash, password); assert.equal(await verifyPassword(password, client.areaClientiPasswordHash), true);
      assert.equal(await verifyPassword("wrong password", client.areaClientiPasswordHash), false);
      assert.equal((await get("me")).status, 401); assert.equal((await get("dom-contract")).status, 401);
      assert.equal((await request("login", { email, password: "wrong password" })).status, 401);
      assert.equal((await request("login", { email, password }, undefined, "https://attacker.invalid")).status, 403);
      const proxied = new NextRequest("http://internal-server:3000/api/customer/logout", { method: "POST", headers: { "Content-Type": "application/json", Host: "preview.example.test", Origin: "https://preview.example.test", "Sec-Fetch-Site": "same-origin" }, body: "{}" });
      assert.equal((await POST(proxied, { params: Promise.resolve({ action: "logout" }) })).status, 200);
    });
    await t.test("only a correct password sends SMS, to the stored mobile", async () => { await login(); });
    await t.test("wrong OTP is counted, early resend blocked, and resend preserves attempts", async () => {
      const wrong = sentCode === "000000" ? "999999" : "000000";
      assert.equal((await request("verify", { code: wrong }, `${CHALLENGE_COOKIE}=${challenge}`)).status, 400);
      assert.equal((await request("resend", {}, `${CHALLENGE_COOKIE}=${challenge}`)).status, 429);
      await db.update(domCustomerChallenges).set({ sentAt: new Date(Date.now() - 61000) }).where(eq(domCustomerChallenges.tokenHash, digest(challenge)));
      assert.equal((await request("resend", { lang: "it" }, `${CHALLENGE_COOKIE}=${challenge}`)).status, 200);
      const [row] = await db.select().from(domCustomerChallenges).where(eq(domCustomerChallenges.tokenHash, digest(challenge)));
      assert.equal(row.attempts, 1); assert.equal(row.sends, 2);
    });
    await t.test("SMS verification issues a session; the code cannot be replayed", async () => {
      const r = await request("verify", { code: sentCode }, `${CHALLENGE_COOKIE}=${challenge}`);
      assert.equal(r.status, 200); session = cookieValue(r, SESSION_COOKIE); assert.ok(session);
      assert.equal((await request("verify", { code: sentCode }, `${CHALLENGE_COOKIE}=${challenge}`)).status, 400);
      const [stored] = await db.select().from(domCustomerSessions).where(eq(domCustomerSessions.tokenHash, digest(session)));
      assert.ok(stored); assert.notEqual(stored.tokenHash, session);
    });
    await t.test("the dashboard and contract download are private and owner-scoped", async () => {
      const profile = await get("me", `${SESSION_COOKIE}=${session}`); assert.equal(profile.status, 200);
      const data = await profile.json(); assert.equal(data.hasContract, true); assert.equal(data.client.areaClientiPasswordHash, undefined);
      const downloaded = await get("dom-contract", `${SESSION_COOKIE}=${session}`);
      assert.equal(downloaded.status, 200); assert.match(downloaded.headers.get("cache-control") || "", /no-store/);
      assert.equal(Buffer.from(await downloaded.arrayBuffer()).equals(contractBytes), true);
    });
    await t.test("a customer can change their own password while logged in", async () => {
      const newPassword = `new-${password}`;
      const r = await request("set-password", { password: newPassword }, `${SESSION_COOKIE}=${session}`); assert.equal(r.status, 200);
      const [updated] = await db.select().from(domClients).where(eq(domClients.id, client.id));
      assert.equal(await verifyPassword(newPassword, updated.areaClientiPasswordHash), true);
      assert.equal(updated.mustChangePassword, false);
    });
    await t.test("expired sessions and logout revoke protected access", async () => {
      await db.update(domCustomerSessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(domCustomerSessions.tokenHash, digest(session)));
      assert.equal((await get("me", `${SESSION_COOKIE}=${session}`)).status, 401);
      await db.update(domCustomerSessions).set({ expiresAt: new Date(Date.now() + 60000) }).where(eq(domCustomerSessions.tokenHash, digest(session)));
      assert.equal((await request("logout", {}, `${SESSION_COOKIE}=${session}`)).status, 200);
      assert.equal((await get("me", `${SESSION_COOKIE}=${session}`)).status, 401);
    });
    await t.test("expired challenges and five failed codes cannot authenticate", async () => {
      await login(); await db.update(domCustomerChallenges).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(domCustomerChallenges.tokenHash, digest(challenge)));
      assert.equal((await request("verify", { code: sentCode }, `${CHALLENGE_COOKIE}=${challenge}`)).status, 400);
      await login(); const wrong = sentCode === "000000" ? "999999" : "000000";
      for (let i = 0; i < 5; i++) assert.equal((await request("verify", { code: wrong }, `${CHALLENGE_COOKIE}=${challenge}`)).status, 400);
      assert.equal((await request("verify", { code: sentCode }, `${CHALLENGE_COOKIE}=${challenge}`)).status, 400);
    });
    await t.test("missing SMS configuration fails closed", async () => {
      delete process.env.TWILIO_ACCOUNT_SID;
      const r = await request("login", { email, password: `new-${password}` }); assert.equal(r.status, 503); assert.equal(cookieValue(r, SESSION_COOKIE), "");
      process.env.TWILIO_ACCOUNT_SID = "AC_TEST_ONLY";
    });
    await t.test("database-backed throttling is enforced", async () => {
      const key = `qa-limit:${nonce}`; rateKeys.add(key); await limit(key, 2, 60); await limit(key, 2, 60);
      await assert.rejects(limit(key, 2, 60), (e: unknown) => e instanceof Error && e.message === "limited");
    });
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of saved) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    for (const id of domClientIds) await removeEncrypted(id, "con").catch(() => {});
    if (domClientIds.length) await db.delete(domClients).where(inArray(domClients.id, domClientIds));
    const hashes = [...rateKeys].map(key => createHmac("sha256", process.env.AUTH_SECRET!).update(key).digest("hex"));
    if (hashes.length) await db.delete(authLimits).where(inArray(authLimits.key, hashes));
    await pool.end();
  }
});
