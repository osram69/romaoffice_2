import test from "node:test";
import assert from "node:assert/strict";
import { crc32 } from "node:zlib";

import { buildZip, uniqueZipNames } from "@/lib/zip-store";
import { readZip } from "./helpers/zip-read";

function check(entries: { name: string; data: Buffer }[]) {
  const read = readZip(buildZip(entries));
  assert.equal(read.length, entries.length);
  entries.forEach((e, i) => {
    assert.equal(read[i].name, e.name);
    assert.equal(read[i].data.length, e.data.length);
    assert.ok(read[i].data.equals(e.data));
    // zlib.crc32 is used only here: the writer has its own table (production Node may be older).
    assert.equal(read[i].crc, crc32(e.data));
  });
}

test("three files with different contents round-trip with the right CRC32", () => {
  check([
    { name: "uno.txt", data: Buffer.from("primo file") },
    { name: "due.bin", data: Buffer.from(Array.from({ length: 5000 }, (_, i) => i % 251)) },
    { name: "tre.pdf", data: Buffer.from("%PDF-1.4 finto") },
  ]);
});

test("name with accents and spaces is stored as UTF-8 (flag bit 11)", () => {
  const zip = buildZip([{ name: "Fattura è.xml", data: Buffer.from("<x/>") }]);
  check([{ name: "Fattura è.xml", data: Buffer.from("<x/>") }]);
  assert.equal(zip.readUInt16LE(6) & 0x0800, 0x0800); // local header flags
});

test("zero files gives a valid 22-byte empty ZIP", () => {
  const zip = buildZip([]);
  assert.equal(zip.length, 22);
  assert.equal(zip.readUInt32LE(0), 0x06054b50);
  assert.deepEqual(readZip(zip), []);
});

test("0-byte file is stored with CRC 0 and empty data", () => {
  check([{ name: "vuoto.txt", data: Buffer.alloc(0) }]);
  assert.equal(readZip(buildZip([{ name: "vuoto.txt", data: Buffer.alloc(0) }]))[0].crc, 0);
});

test("DOS date is derived from entry.date", () => {
  const zip = buildZip([{ name: "a", data: Buffer.from("x"), date: new Date(2026, 10, 6, 13, 45, 30) }]);
  const time = zip.readUInt16LE(10);
  const date = zip.readUInt16LE(12);
  assert.equal(time, (13 << 11) | (45 << 5) | (30 >> 1));
  assert.equal(date, ((2026 - 1980) << 9) | (11 << 5) | 6);
});

test("uniqueZipNames numbers duplicates, case-insensitively", () => {
  assert.deepEqual(uniqueZipNames(["a.pdf", "a.pdf", "A.PDF", "b"]), ["a.pdf", "a (2).pdf", "A (3).PDF", "b"]);
});
