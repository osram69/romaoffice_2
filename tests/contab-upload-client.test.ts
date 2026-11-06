import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CONTAB_EXTENSIONS, CONTAB_MAX_BYTES, checkContabFileMeta, validateContabUpload } from "@/lib/contab-files";
import { CONTAB_LOCKED_MESSAGE } from "@/lib/contab-messages";
import { interpretUploadResponse, uploadUrl } from "@/lib/contab-upload-client";

// ---- client-side checks use the very same messages as the server ----

test("checkContabFileMeta accepts every allowed extension (case-insensitive) up to the limit", () => {
  for (const ext of CONTAB_EXTENSIONS) {
    assert.equal(checkContabFileMeta(`doc.${ext}`, 1).ok, true, ext);
    assert.equal(checkContabFileMeta(`DOC.${ext.toUpperCase()}`, CONTAB_MAX_BYTES).ok, true, ext);
  }
});

test("checkContabFileMeta refuses other types with the server message", () => {
  const server = validateContabUpload("virus.exe", Buffer.from("MZ"));
  const client = checkContabFileMeta("virus.exe", 2);
  assert.equal(client.ok, false);
  assert.equal(server.ok, false);
  if (!client.ok && !server.ok) assert.equal(client.message, server.message);
  assert.equal(checkContabFileMeta("senza-estensione", 10).ok, false);
  assert.equal(checkContabFileMeta("archivio.tar.gz", 10).ok, false);
  assert.equal(checkContabFileMeta(".pdf", 10).ok, false);
});

test("checkContabFileMeta refuses an empty file and one over 25 MB with the server messages", () => {
  const empty = checkContabFileMeta("a.pdf", 0);
  assert.deepEqual(empty, { ok: false, message: "Il file è vuoto (0 byte)." });
  const big = checkContabFileMeta("a.xml", CONTAB_MAX_BYTES + 1);
  const serverBig = validateContabUpload("a.xml", Buffer.alloc(CONTAB_MAX_BYTES + 1, 1));
  assert.equal(big.ok, false);
  assert.equal(serverBig.ok, false);
  if (!big.ok && !serverBig.ok) {
    assert.equal(big.message, serverBig.message);
    assert.match(big.message, /25 MB/);
  }
});

// ---- upload URL ----

test("uploadUrl encodes the name with encodeURIComponent and puts the section id first", () => {
  assert.equal(uploadUrl(4, "fattura 100%.pdf"), "/api/contabilita/files?sectionId=4&name=fattura%20100%25.pdf");
  assert.equal(uploadUrl(4, "a&b=c#d.xml"), "/api/contabilita/files?sectionId=4&name=a%26b%3Dc%23d.xml");
  assert.equal(new URL(uploadUrl(9, "è ñ 😀.pdf"), "http://x").searchParams.get("name"), "è ñ 😀.pdf");
});

test("uploadUrl never throws on a lone surrogate in the name", () => {
  assert.doesNotThrow(() => uploadUrl(1, "a\ud800b.pdf"));
});

// ---- response interpretation ----

test("interpretUploadResponse: success", () => {
  assert.deepEqual(interpretUploadResponse(200, JSON.stringify({ success: true, file: { id: 1 } })), { kind: "ok" });
});

test("interpretUploadResponse: 401 with code locked is the locked state with the fixed message", () => {
  const body = JSON.stringify({ success: false, code: "locked", message: CONTAB_LOCKED_MESSAGE });
  assert.deepEqual(interpretUploadResponse(401, body), { kind: "locked", message: "Sblocco scaduto, reinserisci la password" });
  // A locked code on any other status is not trusted as "locked".
  assert.equal(interpretUploadResponse(500, body).kind, "error");
});

test("interpretUploadResponse: other errors show the server message, or a generic one when there is none", () => {
  assert.deepEqual(interpretUploadResponse(400, JSON.stringify({ success: false, message: "Tipo di file non consentito." })), { kind: "error", message: "Tipo di file non consentito." });
  assert.deepEqual(interpretUploadResponse(403, JSON.stringify({ success: false, code: "forbidden", message: "Operazione non consentita." })), { kind: "error", message: "Operazione non consentita." });
  const generic = interpretUploadResponse(502, "<html>Bad gateway</html>");
  assert.equal(generic.kind, "error");
  assert.match((generic as { message: string }).message, /riprova/i);
  const tooBig = interpretUploadResponse(413, "<html>too large</html>");
  assert.equal(tooBig.kind, "error");
  assert.match((tooBig as { message: string }).message, /25 MB/);
  // A 2xx without success:true is not a success.
  assert.equal(interpretUploadResponse(200, "{}").kind, "error");
  // Absurdly long or non-string server messages are not shown.
  const long = interpretUploadResponse(400, JSON.stringify({ message: "x".repeat(5000) }));
  assert.ok((long as { message: string }).message.length < 400);
  assert.equal(interpretUploadResponse(400, JSON.stringify({ message: { a: 1 } })).kind, "error");
});

// ---- the uploader component ----

test("ContabUploadRow: XHR with progress, shared pure helpers, no server-only imports in the client bundle", () => {
  const source = readFileSync("src/components/ContabUploadRow.tsx", "utf8");
  assert.match(source, /^"use client";/);
  assert.match(source, /new XMLHttpRequest\(\)/);
  assert.match(source, /xhr\.upload\.onprogress/);
  assert.match(source, /uploadUrl\(/);
  assert.match(source, /checkContabFileMeta\(/);
  assert.match(source, /interpretUploadResponse\(/);
  assert.match(source, /\bSave\b/);
  assert.match(source, /Carica/);
  assert.match(source, /Scegli file/);
  assert.match(source, /formatMb\(/);
  assert.match(source, /window\.location\.reload\(\)/);
  assert.match(source, /router\.refresh\(\)/);
  assert.doesNotMatch(source, /storedName/);
  // Every import of the client file (and of the pure modules it uses) must stay db- and fs-free.
  const forbidden = /contab-storage|contab-data|contab-auth|contab-api|contab-upload["']|@\/db|node:|dom-archive|staff-auth|staff-guards|next\/headers/;
  for (const file of ["src/components/ContabUploadRow.tsx", "src/lib/contab-files.ts", "src/lib/contab-messages.ts", "src/lib/contab-upload-client.ts"]) {
    const imports = [...readFileSync(file, "utf8").matchAll(/^import[^;]*from\s+["']([^"']+)["']/gm)].map(m => m[1]);
    for (const spec of imports) assert.doesNotMatch(spec, forbidden, `${file} imports ${spec}`);
  }
});
