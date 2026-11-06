import "dotenv/config";
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "@/db";
import type { StaffRole } from "@/lib/staff-auth";
import { GET as documentsGet } from "@/app/api/dom-documents/route";
import { GET as mailScansGet, POST as mailScansPost } from "@/app/api/dom-mail-scans/route";
import { GET as printGet } from "@/app/api/dom-print/route";
import { createTestStaff, staffRequest } from "./helpers/staff";

// Database-backed: skipped unless TEST_DB is set (they need a real dev database).
const dbTest = process.env.TEST_DB ? test : test.skip;

const BASE = "http://localhost:3000";

type Handler = (req: ReturnType<typeof staffRequest>) => Promise<Response>;
// Every handler is called with parameters that would give 400/404 for an authorized user (missing or unknown
// ids), so "not 401/403" proves only that the authorization check let the request through.
const handlers: { name: string; url: string; init?: RequestInit; call: Handler }[] = [
  { name: "GET /api/dom-documents", url: `${BASE}/api/dom-documents`, call: req => documentsGet(req) },
  { name: "GET /api/dom-mail-scans", url: `${BASE}/api/dom-mail-scans`, call: req => mailScansGet(req) },
  { name: "POST /api/dom-mail-scans", url: `${BASE}/api/dom-mail-scans`, init: { method: "POST" }, call: req => mailScansPost(req) },
  { name: "GET /api/dom-print", url: `${BASE}/api/dom-print`, call: req => printGet(req) },
];

const created: { cleanup: () => Promise<void> }[] = [];
async function staff(role: StaffRole) {
  const user = await createTestStaff(role);
  created.push(user);
  return user;
}

after(async () => {
  for (const user of created) await user.cleanup();
  await pool.end();
});

for (const { name, url, init, call } of handlers) {
  dbTest(`${name}: no cookie gives 401`, async () => {
    const response = await call(staffRequest(url, undefined, init));
    assert.equal(response.status, 401);
  });

  dbTest(`${name}: a commercialista is refused with 403`, async () => {
    const accountant = await staff("commercialista");
    const response = await call(staffRequest(url, accountant.cookie, init));
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.ok(body.error === "forbidden" || body.message === "forbidden");
  });

  dbTest(`${name}: a commercialista who must change password is refused with 401`, async () => {
    const pending = await createTestStaff("commercialista", { mustChange: true });
    created.push(pending);
    const response = await call(staffRequest(url, pending.cookie, init));
    assert.equal(response.status, 401);
  });

  for (const role of ["operatore", "admin"] as const) {
    dbTest(`${name}: ${role} is not refused`, async () => {
      const user = await staff(role);
      const response = await call(staffRequest(url, user.cookie, init));
      assert.notEqual(response.status, 401);
      assert.notEqual(response.status, 403);
    });
  }
}
