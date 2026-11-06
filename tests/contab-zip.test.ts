import test from "node:test";
import assert from "node:assert/strict";

import { CONTAB_ZIP_MAX_BYTES, zipEntryNames, zipFileName } from "@/lib/contab-zip";
import { buildZip } from "@/lib/zip-store";
import { readZip } from "./helpers/zip-read";

// Pure tests (no database): they run everywhere. The route-level ZIP test is in contab-api.test.ts.

test("zipEntryNames: two files named a.pdf become a.pdf and a (2).pdf, readable from the built archive", () => {
  const names = zipEntryNames(["a.pdf", "a.pdf"]);
  assert.deepEqual(names, ["a.pdf", "a (2).pdf"]);
  const zip = buildZip([
    { name: names[0], data: Buffer.from("one") },
    { name: names[1], data: Buffer.from("two") },
  ]);
  const read = readZip(zip);
  assert.deepEqual(read.map(e => e.name), ["a.pdf", "a (2).pdf"]);
  assert.equal(read[0].data.toString(), "one");
  assert.equal(read[1].data.toString(), "two");
});

test("zipEntryNames: every name is sanitized before it is made unique", () => {
  assert.deepEqual(zipEntryNames(["../../x.pdf", "C:\\y\\X.PDF"]), ["x.pdf", "X (2).PDF"]);
  const names = zipEntryNames(["..\\..\\evil.xml", "/etc/passwd.xml", "a\u0000b.csv"]);
  for (const n of names) assert.doesNotMatch(n, /[\\/\u0000-\u001f]|^\.\./);
  assert.deepEqual(names, ["evil.xml", "passwd.xml", "ab.csv"]);
});

test("zipEntryNames: three equal names and names that only become equal after sanitizing", () => {
  assert.deepEqual(zipEntryNames(["a.pdf", "a.pdf", "a.pdf"]), ["a.pdf", "a (2).pdf", "a (3).pdf"]);
  assert.deepEqual(zipEntryNames(["x/a.pdf", "y/a.pdf"]), ["a.pdf", "a (2).pdf"]);
});

test("zipEntryNames: an emoji name cut at 150 characters stays well-formed inside the archive", () => {
  const [name] = zipEntryNames(["😀".repeat(200) + ".pdf"]);
  assert.doesNotThrow(() => encodeURIComponent(name));
  const [entry] = readZip(buildZip([{ name, data: Buffer.from("x") }]));
  assert.equal(entry.name, name);
});

test("zipFileName: sanitized section title plus .zip", () => {
  assert.equal(zipFileName("Documenti Contabilità 3° Trim"), "Documenti Contabilità 3° Trim.zip");
  assert.equal(zipFileName("1/2 Trim"), "1-2 Trim.zip");
  assert.equal(zipFileName("..\\..\\Fatture"), "-..-Fatture.zip");
  assert.equal(zipFileName("Q3: \"fatture\"?"), "Q3_ _fatture__.zip");
  assert.equal(zipFileName("trim."), "trim.zip");
});

test("zipFileName: never empty, never a path, always ends with .zip, header-safe", () => {
  for (const title of ["", "   ", ".", "..", "/", "\u202e", "😀".repeat(100), "a".repeat(100)]) {
    const out = zipFileName(title);
    assert.ok(out.endsWith(".zip"), out);
    assert.ok(out.length > ".zip".length, JSON.stringify(title));
    assert.doesNotMatch(out, /[\\/\u0000-\u001f]/);
    assert.doesNotThrow(() => encodeURIComponent(out));
    assert.ok(out.length <= 150);
  }
});

test("the ZIP cap is 200 MB of plaintext", () => {
  assert.equal(CONTAB_ZIP_MAX_BYTES, 200 * 1024 * 1024);
});
