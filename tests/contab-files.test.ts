import test from "node:test";
import assert from "node:assert/strict";

import {
  CONTAB_EXTENSIONS,
  CONTAB_MAX_BYTES,
  contabMimeFor,
  formatMb,
  sanitizeFileName,
  validateContabUpload,
} from "@/lib/contab-files";

const pdf = Buffer.from("%PDF-1.4 dummy");

test("sanitizeFileName strips directory components (posix and windows)", () => {
  assert.equal(sanitizeFileName("../../etc/passwd.pdf"), "passwd.pdf");
  assert.equal(sanitizeFileName("a\\b\\c.xml"), "c.xml");
  assert.equal(sanitizeFileName("C:\\Users\\x\\fattura.pdf"), "fattura.pdf");
  assert.equal(sanitizeFileName("..\\..\\x.pdf"), "x.pdf");
});

test("sanitizeFileName removes control and bidi characters", () => {
  const out = sanitizeFileName("nul\u0000x\u0007.pdf");
  assert.equal(out, "nulx.pdf");
  assert.doesNotMatch(out, /[\u0000-\u001f\u007f]/);
  assert.equal(sanitizeFileName("fattura\u202egpj.exe"), "fatturagpj.exe");
});

test("sanitizeFileName caps long names at 150 chars and keeps the extension", () => {
  const out = sanitizeFileName("a".repeat(400) + ".xml");
  assert.ok(out.length <= 150);
  assert.ok(out.endsWith(".xml"));
  const noExt = sanitizeFileName("b".repeat(400));
  assert.equal(noExt.length, 150);
});

test("sanitizeFileName never leaves a lone surrogate when it cuts a long emoji name", () => {
  const out = sanitizeFileName("😀".repeat(200) + ".pdf");
  assert.doesNotThrow(() => encodeURIComponent(out));
  assert.ok(out.endsWith(".pdf"));
  assert.ok(out.length <= 150, `length ${out.length}`);
  assert.equal(out, out.toWellFormed());
  // Same without an extension, and with an odd budget so the cut would land inside a pair.
  const noExt = sanitizeFileName("x" + "😀".repeat(200));
  assert.doesNotThrow(() => encodeURIComponent(noExt));
  assert.ok(noExt.length <= 150);
});

test("sanitizeFileName repairs a lone surrogate in the input", () => {
  const out = sanitizeFileName("a\ud83dz.pdf");
  assert.doesNotThrow(() => encodeURIComponent(out));
  assert.equal(out, "a\ufffdz.pdf");
});

test("sanitizeFileName drops a trailing space or dot exposed by the cut before re-appending the extension", () => {
  const out = sanitizeFileName("a".repeat(145) + " zzzz.pdf");
  assert.equal(out, "a".repeat(145) + ".pdf");
  const dots = sanitizeFileName("a".repeat(145) + "... zzzz.xml");
  assert.equal(dots, "a".repeat(145) + ".xml");
  assert.doesNotMatch(out, /[.\s]\.pdf$/);
});

test("sanitizeFileName removes zero-width, bidi and line/paragraph separator characters", () => {
  for (const c of ["\u200b", "\u200c", "\u200d", "\u200e", "\u200f", "\u202a", "\u202d", "\u202e", "\u2028", "\u2029", "\u2066", "\u2069", "\ufeff", "\u0085", "\u009f"]) {
    assert.equal(sanitizeFileName(`a${c}b.pdf`), "ab.pdf", c.charCodeAt(0).toString(16));
  }
});

test("sanitizeFileName falls back to 'documento' for empty or dots-only names", () => {
  for (const n of ["", "...", ".", "..", "   ", "/", "../", "\u0000"]) {
    assert.equal(sanitizeFileName(n), "documento", JSON.stringify(n));
  }
});

test("sanitizeFileName keeps unicode letters", () => {
  assert.equal(sanitizeFileName("Fattura è n°1.xml"), "Fattura è n°1.xml");
});

test("sanitizeFileName replaces characters illegal on Windows", () => {
  assert.equal(sanitizeFileName('a<b>c:d"e|f?g*h.pdf'), "a_b_c_d_e_f_g_h.pdf");
});

test("contabMimeFor maps every allowed extension, case-insensitively", () => {
  assert.equal(contabMimeFor("a.xml"), "application/xml");
  assert.equal(contabMimeFor("a.XML"), "application/xml");
  assert.equal(contabMimeFor("a.pdf"), "application/pdf");
  assert.equal(contabMimeFor("a.p7m"), "application/pkcs7-mime");
  assert.equal(contabMimeFor("a.zip"), "application/zip");
  assert.equal(contabMimeFor("a.csv"), "text/csv");
  assert.equal(contabMimeFor("a.xls"), "application/vnd.ms-excel");
  assert.equal(
    contabMimeFor("a.xlsx"),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  assert.equal(contabMimeFor("a.jpg"), "image/jpeg");
  assert.equal(contabMimeFor("a.jpeg"), "image/jpeg");
  assert.equal(contabMimeFor("a.png"), "image/png");
  assert.equal(contabMimeFor("a.exe"), "application/octet-stream");
  assert.equal(contabMimeFor("noext"), "application/octet-stream");
  for (const ext of CONTAB_EXTENSIONS) {
    assert.notEqual(contabMimeFor(`x.${ext}`), "application/octet-stream", ext);
  }
});

test("validateContabUpload rejects disallowed extensions", () => {
  const r = validateContabUpload("a.exe", Buffer.from("MZ"));
  assert.equal(r.ok, false);
  assert.equal(validateContabUpload("noext", Buffer.from("x")).ok, false);
});

test("validateContabUpload rejects a 0 byte file with a clear message", () => {
  const r = validateContabUpload("a.xml", Buffer.alloc(0));
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.message, /vuoto/);
});

test("validateContabUpload enforces the 25 MB limit", () => {
  const tooBig = Buffer.alloc(CONTAB_MAX_BYTES + 1, 0x61);
  const r = validateContabUpload("a.csv", tooBig);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.message, /Dimensione massima: 25 MB\./);
  const exact = Buffer.alloc(CONTAB_MAX_BYTES, 0x61);
  assert.equal(validateContabUpload("a.csv", exact).ok, true);
});

test("validateContabUpload checks the PDF signature", () => {
  assert.equal(validateContabUpload("a.pdf", Buffer.from("not a pdf")).ok, false);
  const ok = validateContabUpload("a.pdf", pdf);
  assert.equal(ok.ok, true);
});

test("validateContabUpload accepts uppercase extension and returns sanitized name and mime", () => {
  const r = validateContabUpload("FATTURA.XML", Buffer.from("<a/>"));
  assert.deepEqual(r, { ok: true, name: "FATTURA.XML", mime: "application/xml" });
  const h = validateContabUpload("../../x.pdf", pdf);
  assert.deepEqual(h, { ok: true, name: "x.pdf", mime: "application/pdf" });
});

test("validateContabUpload on hostile names never returns an unsafe name", () => {
  for (const n of ["../../x.pdf", "a".repeat(400) + ".pdf", "...pdf", "\u0000.pdf"]) {
    const r = validateContabUpload(n, pdf);
    if (r.ok) {
      assert.ok(r.name.length <= 150);
      assert.doesNotMatch(r.name, /[\\/\u0000-\u001f]/);
      assert.notEqual(r.name, "..");
    }
  }
});

test("formatMb uses two decimals and a comma", () => {
  assert.equal(formatMb(440000), "0,42 MB");
  assert.equal(formatMb(0), "0,00 MB");
  assert.equal(formatMb(CONTAB_MAX_BYTES), "25,00 MB");
});
