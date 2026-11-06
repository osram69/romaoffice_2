import test from "node:test";
import assert from "node:assert/strict";

import { sanitizeFileName } from "@/lib/contab-files";
import { contentDisposition, decodeQueryValue, rawQueryParam, readBodyLimited } from "@/lib/contab-http";

// Pure tests (no database): they run everywhere.

function assertHeaderSafe(value: string) {
  // The Headers class throws on characters that are not allowed in a header value (CR, LF, > U+00FF ...).
  assert.doesNotThrow(() => new Headers({ "Content-Disposition": value }));
  assert.doesNotMatch(value, /[\r\n\u0000]/);
}

test("contentDisposition: plain ASCII name", () => {
  assert.equal(
    contentDisposition("fattura.pdf"),
    `attachment; filename="fattura.pdf"; filename*=UTF-8''fattura.pdf`,
  );
});

test("contentDisposition: non-ASCII name gets an underscore fallback and a percent-encoded filename*", () => {
  const out = contentDisposition("Fattura è n°1.xml");
  assert.equal(
    out,
    `attachment; filename="Fattura _ n_1.xml"; filename*=UTF-8''Fattura%20%C3%A8%20n%C2%B01.xml`,
  );
  assertHeaderSafe(out);
});

test("contentDisposition: quotes, backslashes and control characters never reach the ASCII fallback", () => {
  const out = contentDisposition('a"b\\c\r\nd\u0000e.pdf');
  assertHeaderSafe(out);
  assert.match(out, /^attachment; filename="abcde\.pdf"; /);
  // Nor the percent-encoded form: a downloaded file must not carry a CR/LF in its name.
  assert.doesNotMatch(out, /%0[0-9A-F]|%1[0-9A-F]|%7F/i);
});

test("contentDisposition: percent signs and the characters encodeURIComponent leaves alone are safe", () => {
  const out = contentDisposition("100%'a'(b)*.pdf");
  assert.match(out, /^attachment; filename="100_'a'\(b\)\*\.pdf"; /);
  assert.ok(out.endsWith(`filename*=UTF-8''100%25%27a%27%28b%29%2A.pdf`), out);
});

test("contentDisposition: a lone surrogate is made well-formed instead of throwing", () => {
  let out = "";
  assert.doesNotThrow(() => {
    out = contentDisposition("a\ud83dz.pdf");
  });
  assert.ok(out.endsWith(`filename*=UTF-8''a%EF%BF%BDz.pdf`), out);
  assertHeaderSafe(out);
});

test("contentDisposition: an empty or all-removed name falls back to 'documento'", () => {
  assert.equal(contentDisposition(""), `attachment; filename="documento"; filename*=UTF-8''documento`);
  assert.match(contentDisposition('"\\'), /^attachment; filename="documento"; /);
});

test("contentDisposition: sanitized emoji name of 200 emoji plus .pdf is header-safe", () => {
  const out = contentDisposition(sanitizeFileName("😀".repeat(200) + ".pdf"));
  assertHeaderSafe(out);
  assert.match(out, /\.pdf"; filename\*=UTF-8''/);
});

test("contentDisposition: hostile names always give a valid header", () => {
  for (const n of ["\u202efdp.exe", "a\u2028b\u2029c.pdf", "😀.pdf", "..", "a;b=c.pdf", "x\u007fy.pdf", "ｆｕｌｌ.pdf"]) {
    assertHeaderSafe(contentDisposition(n));
  }
});

test("rawQueryParam returns the still-encoded value of the first matching key", () => {
  assert.equal(rawQueryParam("?sectionId=3&name=a%20b.pdf", "name"), "a%20b.pdf");
  assert.equal(rawQueryParam("sectionId=3&name=a&name=b", "name"), "a");
  assert.equal(rawQueryParam("?sectionId=3", "name"), null);
  assert.equal(rawQueryParam("", "name"), null);
  assert.equal(rawQueryParam("?xname=1&name=2", "name"), "2");
  assert.equal(rawQueryParam("?name=", "name"), "");
  // A value that itself contains "=" and "+" stays untouched.
  assert.equal(rawQueryParam("?name=a%2Bb=c+d", "name"), "a%2Bb=c+d");
});

test("decodeQueryValue decodes exactly once and returns null when malformed", () => {
  assert.equal(decodeQueryValue("a%20b%C3%A8.pdf"), "a bè.pdf");
  // A literal percent sign sent as %25 must survive (decoding twice would corrupt or reject it).
  assert.equal(decodeQueryValue("100%25.pdf"), "100%.pdf");
  assert.equal(decodeQueryValue("a+b.pdf"), "a+b.pdf");
  assert.equal(decodeQueryValue("%E0%A4%A"), null);
  assert.equal(decodeQueryValue("%"), null);
  assert.equal(decodeQueryValue("%ZZ"), null);
});

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  });
}

test("readBodyLimited concatenates the chunks", async () => {
  const body = streamOf([Buffer.from("ab"), Buffer.from("cd"), Buffer.from("e")]);
  const out = await readBodyLimited(body, 10);
  assert.ok(out && out.toString() === "abcde");
});

test("readBodyLimited accepts exactly the limit and rejects one byte more", async () => {
  const exact = await readBodyLimited(streamOf([Buffer.alloc(5, 1), Buffer.alloc(5, 2)]), 10);
  assert.equal(exact?.length, 10);
  const over = await readBodyLimited(streamOf([Buffer.alloc(5, 1), Buffer.alloc(6, 2)]), 10);
  assert.equal(over, null);
});

test("readBodyLimited stops pulling the stream once the limit is exceeded", async () => {
  let pulled = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulled++;
      controller.enqueue(Buffer.alloc(4, 1));
      if (pulled > 1000) controller.close();
    },
  });
  assert.equal(await readBodyLimited(body, 10), null);
  assert.ok(pulled < 20, `pulled ${pulled} chunks`);
});

test("readBodyLimited: a null body is an empty buffer", async () => {
  const out = await readBodyLimited(null, 10);
  assert.equal(out?.length, 0);
});

test("readBodyLimited works on a real Request body", async () => {
  const req = new Request("http://localhost/x", { method: "POST", body: Buffer.alloc(20, 7) });
  assert.equal(await readBodyLimited(req.body, 10), null);
  const req2 = new Request("http://localhost/x", { method: "POST", body: Buffer.alloc(8, 7) });
  assert.equal((await readBodyLimited(req2.body, 10))?.length, 8);
});
