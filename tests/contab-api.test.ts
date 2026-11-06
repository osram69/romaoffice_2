import "dotenv/config";
import test, { after, before, mock } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq, inArray, like, or } from "drizzle-orm";
import { NextRequest } from "next/server";

import { db, pool } from "@/db";
import { contabDownloads, contabFiles, contabSections, contabUnlocks } from "@/db/schema";
import { CONTAB_UNLOCK_COOKIE } from "@/lib/contab-auth";
import { CONTAB_MAX_BYTES } from "@/lib/contab-files";
import { addFile, createSection, getFile } from "@/lib/contab-data";
import { newStoredName, saveContabFile } from "@/lib/contab-storage";
import { STAFF_SESSION_COOKIE, digest, token, type StaffRole } from "@/lib/staff-auth";
import { POST as uploadPost } from "@/app/api/contabilita/files/route";
import { DELETE as fileDelete, GET as fileGet, HEAD as fileHead } from "@/app/api/contabilita/files/[id]/route";
import { GET as zipGet, HEAD as zipHead } from "@/app/api/contabilita/sections/[id]/zip/route";
import { createTestStaff } from "./helpers/staff";
import { readZip } from "./helpers/zip-read";

// Database-backed: skipped unless TEST_DB is set (they need a real dev database). The file layer uses a temporary
// DOM_ARCHIVE_DIR and a dummy AES_MASTER_KEY, so no real archive or key is touched.
const dbTest = process.env.TEST_DB ? test : test.skip;

// limit() derives its key with AUTH_SECRET; set a dummy one once (module imports are lazy about it).
process.env.AUTH_SECRET ||= "zz-test-secret-".padEnd(40, "x");

const BASE = "http://localhost:3000";
const PREFIX = "zz-test-";
const LOCKED_BODY = { success: false, code: "locked", message: "Sblocco scaduto, reinserisci la password" };
const GENERIC_MESSAGE = "Operazione non riuscita, riprova.";

let tmp = "";
const saved: Record<string, string | undefined> = {};

before(async () => {
  saved.DOM_ARCHIVE_DIR = process.env.DOM_ARCHIVE_DIR;
  saved.AES_MASTER_KEY = process.env.AES_MASTER_KEY;
  tmp = await mkdtemp(path.join(os.tmpdir(), "contab-api-"));
  process.env.DOM_ARCHIVE_DIR = tmp;
  process.env.AES_MASTER_KEY = "zz-test-master-key";
});

const createdSections: number[] = [];
const createdStaff: { cleanup: () => Promise<void> }[] = [];

after(async () => {
  try {
    if (process.env.TEST_DB) {
      // Downloads reference files, files reference sections: delete in that order. Staff users (and, by cascade,
      // their unlocks and sessions) go last.
      const files = createdSections.length
        ? await db.select({ id: contabFiles.id }).from(contabFiles).where(inArray(contabFiles.sectionId, createdSections))
        : [];
      const fileIds = files.map(f => f.id);
      await db.delete(contabDownloads).where(
        fileIds.length
          ? or(like(contabDownloads.fileName, `${PREFIX}%`), inArray(contabDownloads.fileId, fileIds))
          : like(contabDownloads.fileName, `${PREFIX}%`),
      );
      if (createdSections.length) {
        await db.delete(contabFiles).where(inArray(contabFiles.sectionId, createdSections));
        await db.delete(contabSections).where(inArray(contabSections.id, createdSections));
      }
      for (const user of createdStaff) await user.cleanup();
    }
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    if (tmp) await rm(tmp, { recursive: true, force: true });
    await pool.end();
  }
});

// ---- fixtures (created lazily, inside the tests, so a run without TEST_DB never touches the database) ----

type Actor = { id: string; username: string; session: string; /** Cookie header with the session only. */ cookies: string; /** Cookie header with session and an unlock. */ unlocked: string };

async function makeActor(role: StaffRole, opts: { mustChange?: boolean } = {}): Promise<Actor> {
  const user = await createTestStaff(role, opts);
  createdStaff.push(user);
  // An unlock bound to this very session, as unlockContab() would create it (contab_unlocks cascades from the user row).
  const unlockRaw = token();
  await db.insert(contabUnlocks).values({
    tokenHash: digest(unlockRaw),
    userId: user.id,
    sessionTokenHash: digest(user.cookie),
    lastSeenAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });
  const session = `${STAFF_SESSION_COOKIE}=${user.cookie}`;
  return { id: user.id, username: user.username, session: user.cookie, cookies: session, unlocked: `${session}; ${CONTAB_UNLOCK_COOKIE}=${unlockRaw}` };
}

let adminPromise: Promise<Actor> | undefined;
let accountantPromise: Promise<Actor> | undefined;
let operatorPromise: Promise<Actor> | undefined;
const admin = () => (adminPromise ??= makeActor("admin"));
const accountant = () => (accountantPromise ??= makeActor("commercialista"));
const operator = () => (operatorPromise ??= makeActor("operatore"));

async function newSection(label = "sezione"): Promise<{ id: number; title: string }> {
  const title = `${PREFIX}${label}-${randomUUID().slice(0, 8)}`;
  const result = await createSection(title);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("createSection failed");
  createdSections.push(result.id);
  return { id: result.id, title };
}

// ---- request helpers ----

function request(url: string, cookie: string | undefined, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (cookie) headers.set("cookie", cookie);
  return new NextRequest(url, { ...init, headers, signal: init.signal ?? undefined });
}

function uploadRequest(sectionId: number | string, name: string | null, body: Buffer, cookie: string | undefined, headers: Record<string, string> = {}, rawName?: string) {
  const namePart = rawName !== undefined ? `&name=${rawName}` : name === null ? "" : `&name=${encodeURIComponent(name)}`;
  return request(`${BASE}/api/contabilita/files?sectionId=${sectionId}${namePart}`, cookie, { method: "POST", body: new Uint8Array(body), headers });
}

const upload = (...args: Parameters<typeof uploadRequest>) => uploadPost(uploadRequest(...args));
const idContext = (id: number | string) => ({ params: Promise.resolve({ id: String(id) }) });
const download = (id: number | string, cookie: string | undefined) => fileGet(request(`${BASE}/api/contabilita/files/${id}`, cookie), idContext(id));
const remove = (id: number | string, cookie: string | undefined) => fileDelete(request(`${BASE}/api/contabilita/files/${id}`, cookie, { method: "DELETE" }), idContext(id));
const zip = (sectionId: number | string, cookie: string | undefined) => zipGet(request(`${BASE}/api/contabilita/sections/${sectionId}/zip`, cookie), idContext(sectionId));

const pdf = (marker: string) => Buffer.from(`%PDF-1.4\n${marker}\n`);

/** Uploads through the real route as the unlocked admin and returns what the response and the database say. */
async function uploadOk(sectionId: number, name: string, data: Buffer) {
  const res = await upload(sectionId, name, data, (await admin()).unlocked);
  assert.equal(res.status, 200, await res.clone().text());
  const body = await res.json();
  const row = await getFile(body.file.id);
  assert.ok(row);
  return { id: body.file.id as number, storedName: row.storedName, body };
}

const contabDir = () => path.join(tmp, "contabilita");
const encPath = (storedName: string) => path.join(contabDir(), `${storedName}.enc`);
async function diskNames(): Promise<string[]> {
  try {
    return (await readdir(contabDir())).sort();
  } catch {
    return [];
  }
}
const rowsOfSection = (sectionId: number) => db.select().from(contabFiles).where(eq(contabFiles.sectionId, sectionId));
const downloadRows = (fileId: number) => db.select().from(contabDownloads).where(eq(contabDownloads.fileId, fileId));

function assertNoStore(res: Response) {
  assert.equal(res.headers.get("cache-control"), "private, no-store");
}

/** Error bodies never carry paths, SQL, stack traces or stored names. */
function assertNoLeak(text: string) {
  assert.doesNotMatch(text, /stack|\bat \w|SELECT|INSERT|Failed query|\.enc|storedName|stored_name|node_modules/i);
  assert.ok(!text.includes(tmp), "temporary archive path leaked");
}

// ================================ upload ================================

dbTest("upload without any cookie: 401 locked", async () => {
  const section = await newSection();
  const res = await upload(section.id, "a.pdf", pdf("x"), undefined);
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), LOCKED_BODY);
  assertNoStore(res);
  assert.equal((await rowsOfSection(section.id)).length, 0);
});

dbTest("upload as an admin without unlock: 401 locked, nothing stored", async () => {
  const section = await newSection();
  const before = await diskNames();
  const res = await upload(section.id, "a.pdf", pdf("x"), (await admin()).cookies);
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), LOCKED_BODY);
  assert.deepEqual(await diskNames(), before);
  assert.equal((await rowsOfSection(section.id)).length, 0);
});

dbTest("upload as a commercialista or an operatore: 403, nothing stored", async () => {
  const section = await newSection();
  const before = await diskNames();
  for (const actor of [await accountant(), await operator()]) {
    // Even if they somehow carried an unlock cookie, a non-admin is refused.
    for (const cookie of [actor.cookies, actor.unlocked]) {
      const res = await upload(section.id, "a.pdf", pdf("x"), cookie);
      assert.equal(res.status, 403);
      assertNoStore(res);
    }
  }
  assert.deepEqual(await diskNames(), before);
  assert.equal((await rowsOfSection(section.id)).length, 0);
});

dbTest("upload by an admin who must change password: 401", async () => {
  const section = await newSection();
  const pending = await makeActor("admin", { mustChange: true });
  const res = await upload(section.id, "a.pdf", pdf("x"), pending.unlocked);
  assert.equal(res.status, 401);
  assert.equal((await rowsOfSection(section.id)).length, 0);
});

dbTest("upload of a valid PDF: 200, minimal JSON, encrypted on disk, row written", async () => {
  const section = await newSection();
  const original = pdf(`${PREFIX}contenuto-segreto`);
  const res = await upload(section.id, `${PREFIX}fattura.pdf`, original, (await admin()).unlocked);
  assert.equal(res.status, 200);
  assertNoStore(res);
  const text = await res.text();
  const body = JSON.parse(text);
  assert.equal(body.success, true);
  assert.deepEqual(Object.keys(body.file).sort(), ["id", "originalName", "sizeBytes", "uploadedAt"]);
  assert.equal(body.file.originalName, `${PREFIX}fattura.pdf`);
  assert.equal(body.file.sizeBytes, original.length);
  assert.ok(!Number.isNaN(Date.parse(body.file.uploadedAt)));

  const row = await getFile(body.file.id);
  assert.ok(row);
  // Neither the stored name nor a path is in the response.
  assert.ok(!text.includes(row.storedName));
  assert.doesNotMatch(text, /\.enc|contabilita[\\/]/);
  assert.equal(row.mime, "application/pdf");
  assert.equal(row.sizeBytes, original.length);
  assert.equal(row.uploadedBy, (await admin()).username);

  const onDisk = await readFile(encPath(row.storedName));
  assert.equal(onDisk.subarray(0, 5).toString("latin1"), "ROSC1");
  assert.ok(!onDisk.includes(Buffer.from("contenuto-segreto")), "plaintext found in the stored file");
  assert.equal(onDisk.length, original.length + 5 + 12 + 16);
});

dbTest("upload of a 0 byte file: 400 and neither a file nor a row", async () => {
  const section = await newSection();
  const before = await diskNames();
  const res = await upload(section.id, "a.pdf", Buffer.alloc(0), (await admin()).unlocked);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).success, false);
  assert.deepEqual(await diskNames(), before);
  assert.equal((await rowsOfSection(section.id)).length, 0);
});

dbTest("upload of a .exe (and a fake PDF): 400 and nothing stored", async () => {
  const section = await newSection();
  const before = await diskNames();
  const exe = await upload(section.id, "setup.exe", Buffer.from("MZ"), (await admin()).unlocked);
  assert.equal(exe.status, 400);
  const fake = await upload(section.id, "a.pdf", Buffer.from("not a pdf"), (await admin()).unlocked);
  assert.equal(fake.status, 400);
  assert.deepEqual(await diskNames(), before);
  assert.equal((await rowsOfSection(section.id)).length, 0);
});

dbTest("upload with a Content-Length of 26 MB: 413 before the body is read", async () => {
  const section = await newSection();
  const before = await diskNames();
  const res = await upload(section.id, "a.pdf", pdf("x"), (await admin()).unlocked, { "content-length": String(26 * 1024 * 1024) });
  assert.equal(res.status, 413);
  assert.equal((await res.json()).success, false);
  assert.deepEqual(await diskNames(), before);
  assert.equal((await rowsOfSection(section.id)).length, 0);
});

dbTest("upload whose real bytes exceed 25 MB: 413 even without a Content-Length", async () => {
  const section = await newSection();
  const before = await diskNames();
  const big = Buffer.concat([Buffer.from("%PDF"), Buffer.alloc(CONTAB_MAX_BYTES, 0x61)]);
  const res = await upload(section.id, "a.pdf", big, (await admin()).unlocked);
  assert.equal(res.status, 413);
  assert.deepEqual(await diskNames(), before);
  assert.equal((await rowsOfSection(section.id)).length, 0);
});

dbTest("upload of a file of exactly 25 MB is accepted", async () => {
  const section = await newSection();
  const data = Buffer.concat([Buffer.from("%PDF"), Buffer.alloc(CONTAB_MAX_BYTES - 4, 0x62)]);
  const { id } = await uploadOk(section.id, `${PREFIX}max.pdf`, data);
  const res = await download(id, (await accountant()).cookies);
  assert.equal(res.status, 200);
  assert.ok(Buffer.from(await res.arrayBuffer()).equals(data));
});

dbTest("upload into an unknown section: 404; into an invalid section id: 400", async () => {
  const before = await diskNames();
  const unknown = await upload(2147483646, "a.pdf", pdf("x"), (await admin()).unlocked);
  assert.equal(unknown.status, 404);
  for (const bad of ["abc", "0", "-1", "1.5", "1e3", "99999999999", "", "%20"]) {
    const res = await upload(bad, "a.pdf", pdf("x"), (await admin()).unlocked);
    assert.equal(res.status, 400, `sectionId=${JSON.stringify(bad)}`);
  }
  const missing = await uploadPost(request(`${BASE}/api/contabilita/files?name=a.pdf`, (await admin()).unlocked, { method: "POST", body: new Uint8Array(pdf("x")) }));
  assert.equal(missing.status, 400);
  assert.deepEqual(await diskNames(), before);
});

dbTest("upload with a missing or malformed name: 400, nothing stored", async () => {
  const section = await newSection();
  const before = await diskNames();
  const none = await upload(section.id, null, pdf("x"), (await admin()).unlocked);
  assert.equal(none.status, 400);
  const empty = await upload(section.id, null, pdf("x"), (await admin()).unlocked, {}, "");
  assert.equal(empty.status, 400);
  for (const raw of ["%E0%A4%A", "%", "%ZZ.pdf"]) {
    const res = await upload(section.id, null, pdf("x"), (await admin()).unlocked, {}, raw);
    assert.equal(res.status, 400, raw);
  }
  assert.deepEqual(await diskNames(), before);
  assert.equal((await rowsOfSection(section.id)).length, 0);
});

dbTest("upload keeps a literal percent sign in the name (decoded exactly once)", async () => {
  const section = await newSection();
  const { body } = await uploadOk(section.id, `${PREFIX}100%.pdf`, pdf("x"));
  assert.equal(body.file.originalName, `${PREFIX}100%.pdf`);
});

dbTest("upload of ../../x.pdf is stored as x.pdf", async () => {
  const section = await newSection();
  const { body, storedName } = await uploadOk(section.id, "../../x.pdf", pdf("x"));
  assert.equal(body.file.originalName, "x.pdf");
  assert.match(storedName, /^[0-9a-f-]{36}$/);
  assert.ok((await diskNames()).includes(`${storedName}.enc`));
});

dbTest("upload of a 200-emoji name: stored well-formed and downloadable with a valid header", async () => {
  const section = await newSection();
  const { id, body } = await uploadOk(section.id, "😀".repeat(200) + ".pdf", pdf("emoji"));
  assert.ok(body.file.originalName.endsWith(".pdf"));
  assert.ok(body.file.originalName.length <= 150);
  assert.doesNotThrow(() => encodeURIComponent(body.file.originalName));
  const res = await download(id, (await accountant()).cookies);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-disposition") ?? "", /^attachment; filename="_+\.pdf"; filename\*=UTF-8''(%F0%9F%98%80)+\.pdf$/);
});

// ================================ download ================================

dbTest("download as the commercialista: same bytes, right headers, one logged download", async () => {
  const section = await newSection();
  const original = pdf(`${PREFIX}scarico`);
  const { id } = await uploadOk(section.id, `${PREFIX}Fattura è n°1.pdf`, original);
  const user = await accountant();

  const res = await download(id, user.cookies);
  assert.equal(res.status, 200);
  assert.ok(Buffer.from(await res.arrayBuffer()).equals(original));
  assert.equal(res.headers.get("content-type"), "application/pdf");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assertNoStore(res);
  const disposition = res.headers.get("content-disposition") ?? "";
  assert.match(disposition, /^attachment; filename="zz-test-Fattura _ n_1\.pdf"; filename\*=UTF-8''zz-test-Fattura%20%C3%A8%20n%C2%B01\.pdf$/);

  const rows = await downloadRows(id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].username, user.username);
  assert.equal(rows[0].fileName, `${PREFIX}Fattura è n°1.pdf`);
  assert.equal((await getFile(id))?.lastDownloadAt instanceof Date, true);
});

dbTest("download as an unlocked admin works and is not logged", async () => {
  const section = await newSection();
  const original = pdf("admin-download");
  const { id } = await uploadOk(section.id, `${PREFIX}admin.pdf`, original);
  const res = await download(id, (await admin()).unlocked);
  assert.equal(res.status, 200);
  assert.ok(Buffer.from(await res.arrayBuffer()).equals(original));
  assert.equal((await downloadRows(id)).length, 0);
});

dbTest("download is refused (and not logged) for operatore, admin without unlock, must-change users and no session", async () => {
  const section = await newSection();
  const { id } = await uploadOk(section.id, `${PREFIX}riservato.pdf`, pdf("riservato"));

  const op = await download(id, (await operator()).cookies);
  assert.equal(op.status, 403);
  assertNoStore(op);
  // An operatore with a (forged) unlock cookie is still refused.
  assert.equal((await download(id, (await operator()).unlocked)).status, 403);

  const adminLocked = await download(id, (await admin()).cookies);
  assert.equal(adminLocked.status, 401);
  assert.equal((await adminLocked.json()).code, "locked");

  const pendingAccountant = await makeActor("commercialista", { mustChange: true });
  assert.equal((await download(id, pendingAccountant.cookies)).status, 401);

  const anonymous = await download(id, undefined);
  assert.equal(anonymous.status, 401);
  assert.equal((await download(id, `${STAFF_SESSION_COOKIE}=${"0".repeat(64)}`)).status, 401);
  assert.equal((await download(id, `${STAFF_SESSION_COOKIE}=not-a-token`)).status, 401);

  assert.equal((await downloadRows(id)).length, 0);
});

dbTest("download of an unknown or malformed id: 404", async () => {
  const user = await accountant();
  for (const id of ["2147483646", "abc", "0", "-1", "1.5", "99999999999"]) {
    const res = await download(id, user.cookies);
    assert.equal(res.status, 404, id);
    assertNoStore(res);
  }
});

dbTest("download of a file that vanished from disk: 404 with the expected message, never 500, nothing logged", async () => {
  const section = await newSection();
  const { id, storedName } = await uploadOk(section.id, `${PREFIX}sparito.pdf`, pdf("sparito"));
  await rm(encPath(storedName));
  for (const cookies of [(await accountant()).cookies, (await admin()).unlocked]) {
    const res = await download(id, cookies);
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: "Il file non è più disponibile" });
    assertNoStore(res);
  }
  assert.equal((await downloadRows(id)).length, 0);
});

dbTest("download of a corrupted file: generic 500 without leaking anything, nothing logged as a download", async () => {
  const section = await newSection();
  const { id, storedName } = await uploadOk(section.id, `${PREFIX}corrotto.pdf`, pdf("corrotto"));
  const blob = await readFile(encPath(storedName));
  blob[blob.length - 20] ^= 0xff; // flips a ciphertext byte: the GCM tag no longer matches
  await writeFile(encPath(storedName), blob);

  const errors = mock.method(console, "error", () => {});
  try {
    const res = await download(id, (await accountant()).cookies);
    assert.equal(res.status, 500);
    const text = await res.text();
    assert.deepEqual(JSON.parse(text), { error: GENERIC_MESSAGE });
    assertNoLeak(text);
    assertNoStore(res);
    // The server log keeps no message, path or stack either.
    for (const call of errors.mock.calls) {
      const line = call.arguments.map(String).join(" ");
      assert.ok(!line.includes(tmp) && !/integro|stack/i.test(line), line);
    }
  } finally {
    errors.mock.restore();
  }
  assert.equal((await downloadRows(id)).length, 0);
});

dbTest("HEAD on the download routes is refused: it must not decrypt or log", async () => {
  const section = await newSection();
  const { id } = await uploadOk(section.id, `${PREFIX}head.pdf`, pdf("head"));
  assert.equal(fileHead().status, 405);
  assert.equal(zipHead().status, 405);
  assert.equal((await downloadRows(id)).length, 0);
});

// ================================ delete ================================

dbTest("DELETE by the commercialista or the operatore: 403 and the file stays", async () => {
  const section = await newSection();
  const { id, storedName } = await uploadOk(section.id, `${PREFIX}intoccabile.pdf`, pdf("intoccabile"));
  for (const actor of [await accountant(), await operator()]) {
    for (const cookie of [actor.cookies, actor.unlocked]) {
      const res = await remove(id, cookie);
      assert.equal(res.status, 403);
      assertNoStore(res);
    }
  }
  assert.ok(await getFile(id));
  assert.ok((await diskNames()).includes(`${storedName}.enc`));
});

dbTest("DELETE without session or without unlock: 401 locked, the file stays", async () => {
  const section = await newSection();
  const { id, storedName } = await uploadOk(section.id, `${PREFIX}resta.pdf`, pdf("resta"));
  for (const cookie of [undefined, (await admin()).cookies]) {
    const res = await remove(id, cookie);
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), LOCKED_BODY);
  }
  assert.ok(await getFile(id));
  assert.ok((await diskNames()).includes(`${storedName}.enc`));
});

dbTest("DELETE by the unlocked admin removes the row and the file; the download log keeps its entry", async () => {
  const section = await newSection();
  const { id, storedName } = await uploadOk(section.id, `${PREFIX}elimina.pdf`, pdf("elimina"));
  assert.equal((await download(id, (await accountant()).cookies)).status, 200);

  const res = await remove(id, (await admin()).unlocked);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { success: true });
  assertNoStore(res);
  assert.equal(await getFile(id), null);
  assert.ok(!(await diskNames()).includes(`${storedName}.enc`));

  const kept = await db.select().from(contabDownloads).where(eq(contabDownloads.fileName, `${PREFIX}elimina.pdf`));
  assert.equal(kept.length, 1);
  assert.equal(kept[0].fileId, null);

  assert.equal((await remove(id, (await admin()).unlocked)).status, 404);
  assert.equal((await remove("abc", (await admin()).unlocked)).status, 404);
  assert.equal((await download(id, (await accountant()).cookies)).status, 404);
});

// ================================ ZIP ================================

dbTest("ZIP: two files named a.pdf become a.pdf and a (2).pdf; one logged download per file for the commercialista", async () => {
  const section = await newSection("zip");
  const first = pdf("primo");
  const second = pdf("secondo");
  const one = await uploadOk(section.id, "a.pdf", first);
  const two = await uploadOk(section.id, "a.pdf", second);
  const user = await accountant();

  const res = await zip(section.id, user.cookies);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "application/zip");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assertNoStore(res);
  assert.equal(res.headers.get("content-disposition"), `attachment; filename="${section.title}.zip"; filename*=UTF-8''${encodeURIComponent(section.title)}.zip`);

  const entries = readZip(Buffer.from(await res.arrayBuffer()));
  assert.deepEqual(entries.map(e => e.name), ["a.pdf", "a (2).pdf"]);
  assert.ok(entries[0].data.equals(first));
  assert.ok(entries[1].data.equals(second));

  for (const id of [one.id, two.id]) {
    const rows = await downloadRows(id);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].username, user.username);
    assert.equal(rows[0].fileName, "a.pdf");
  }
});

dbTest("ZIP as an unlocked admin works and is not logged", async () => {
  const section = await newSection("zip");
  const { id } = await uploadOk(section.id, `${PREFIX}b.pdf`, pdf("b"));
  const res = await zip(section.id, (await admin()).unlocked);
  assert.equal(res.status, 200);
  assert.equal(readZip(Buffer.from(await res.arrayBuffer())).length, 1);
  assert.equal((await downloadRows(id)).length, 0);
});

dbTest("ZIP is refused for operatore, admin without unlock and no session", async () => {
  const section = await newSection("zip");
  const { id } = await uploadOk(section.id, `${PREFIX}c.pdf`, pdf("c"));
  assert.equal((await zip(section.id, (await operator()).cookies)).status, 403);
  assert.equal((await zip(section.id, (await admin()).cookies)).status, 401);
  assert.equal((await zip(section.id, undefined)).status, 401);
  const pending = await makeActor("commercialista", { mustChange: true });
  assert.equal((await zip(section.id, pending.cookies)).status, 401);
  assert.equal((await downloadRows(id)).length, 0);
});

dbTest("ZIP of an empty section, an unknown section or a malformed id: 404", async () => {
  const empty = await newSection("vuota");
  const user = await accountant();
  for (const id of [String(empty.id), "2147483646", "abc", "0", "-1"]) {
    const res = await zip(id, user.cookies);
    assert.equal(res.status, 404, id);
    assertNoStore(res);
  }
});

dbTest("ZIP entry names are sanitized even if a row holds a hostile name", async () => {
  const section = await newSection("zip");
  const storedName = newStoredName();
  // Written straight into the database (bypassing the upload route) to prove the ZIP route does not trust the row.
  await saveContabFile(storedName, pdf("ostile"));
  await addFile({ sectionId: section.id, originalName: "../../evil.pdf", mime: "application/pdf", sizeBytes: pdf("ostile").length, storedName, uploadedBy: PREFIX + "x" });
  const res = await zip(section.id, (await admin()).unlocked);
  assert.equal(res.status, 200);
  assert.deepEqual(readZip(Buffer.from(await res.arrayBuffer())).map(e => e.name), ["evil.pdf"]);
});

dbTest("ZIP with a file missing from disk: 404 and nothing logged", async () => {
  const section = await newSection("zip");
  const keep = await uploadOk(section.id, `${PREFIX}d1.pdf`, pdf("d1"));
  const gone = await uploadOk(section.id, `${PREFIX}d2.pdf`, pdf("d2"));
  await rm(encPath(gone.storedName));
  const res = await zip(section.id, (await accountant()).cookies);
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: "Un file della sezione non è più disponibile" });
  assert.equal((await downloadRows(keep.id)).length, 0);
  assert.equal((await downloadRows(gone.id)).length, 0);
});

dbTest("ZIP over 200 MB in total: 413 with a clear message, nothing decrypted or logged", async () => {
  const section = await newSection("zip");
  // Rows only: the size check on the recorded sizes must stop the request before any file is opened.
  const ids: number[] = [];
  for (const n of [1, 2]) {
    ids.push(await addFile({
      sectionId: section.id,
      originalName: `${PREFIX}grande-${n}.zip`,
      mime: "application/zip",
      sizeBytes: 101 * 1024 * 1024,
      storedName: newStoredName(),
      uploadedBy: PREFIX + "x",
    }));
  }
  const res = await zip(section.id, (await accountant()).cookies);
  assert.equal(res.status, 413);
  const body = await res.json();
  assert.match(body.error, /200 MB/);
  assertNoStore(res);
  for (const id of ids) assert.equal((await downloadRows(id)).length, 0);
});

dbTest("ZIP and download responses never contain the stored name, even on errors", async () => {
  const section = await newSection("zip");
  const { id, storedName } = await uploadOk(section.id, `${PREFIX}e.pdf`, pdf("e"));
  const responses = [
    await download(id, (await accountant()).cookies),
    await download(id, (await operator()).cookies),
    await zip(section.id, (await operator()).cookies),
    await download("abc", (await accountant()).cookies),
  ];
  for (const res of responses) {
    if ((res.headers.get("content-type") ?? "").includes("json")) {
      const text = await res.text();
      assert.ok(!text.includes(storedName));
      assertNoLeak(text);
    }
    assert.ok(!(res.headers.get("content-disposition") ?? "").includes(storedName));
  }
});
