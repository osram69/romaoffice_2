import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

process.env.AES_MASTER_KEY = "test-master-key";

import { encryptContab, decryptContab } from "@/lib/contab-crypto";

const MAGIC = Buffer.from("ROSC1");

test("roundtrip: decrypt(encrypt(x)) equals x for 0 byte, 1 byte and 1 MB", () => {
  for (const data of [Buffer.alloc(0), Buffer.from([0x7f]), randomBytes(1024 * 1024)]) {
    assert.ok(decryptContab(encryptContab(data)).equals(data));
  }
});

test("two encryptions of the same file differ (different IVs) and start with ROSC1", () => {
  const data = Buffer.from("same content");
  const a = encryptContab(data);
  const b = encryptContab(data);
  assert.ok(!a.equals(b));
  assert.ok(a.subarray(0, 5).equals(MAGIC));
  assert.ok(b.subarray(0, 5).equals(MAGIC));
  assert.ok(!a.subarray(5, 17).equals(b.subarray(5, 17)));
});

test("length = 5 + 12 + data.length + 16", () => {
  for (const n of [0, 1, 100, 4096]) {
    assert.equal(encryptContab(randomBytes(n)).length, 5 + 12 + n + 16);
  }
});

test("one flipped bit in ciphertext, tag or IV makes decryptContab throw", () => {
  const blob = encryptContab(Buffer.from("accounting file payload"));
  const ivOffset = 5;
  const cipherOffset = 17;
  const tagOffset = blob.length - 16;
  for (const offset of [ivOffset, cipherOffset, tagOffset, blob.length - 1]) {
    const tampered = Buffer.from(blob);
    tampered[offset] ^= 0x01;
    assert.throws(() => decryptContab(tampered), { message: "File non integro" });
  }
});

test("blob without ROSC1 prefix or shorter than 33 bytes throws \"Formato file non valido\"", () => {
  const good = encryptContab(Buffer.from("x"));
  const wrongPrefix = Buffer.from(good);
  wrongPrefix[0] = 0x58;
  assert.throws(() => decryptContab(wrongPrefix), { message: "Formato file non valido" });
  assert.throws(() => decryptContab(Buffer.alloc(0)), { message: "Formato file non valido" });
  assert.throws(() => decryptContab(Buffer.concat([MAGIC, randomBytes(27)])), { message: "Formato file non valido" }); // 32 bytes
  // 33 bytes with the right prefix is the empty-file minimum and must be accepted.
  assert.equal(decryptContab(encryptContab(Buffer.alloc(0))).length, 0);
});

test("a different AES_MASTER_KEY makes decryption fail", () => {
  const blob = encryptContab(Buffer.from("secret"));
  const original = process.env.AES_MASTER_KEY;
  process.env.AES_MASTER_KEY = "another-master-key";
  try {
    assert.throws(() => decryptContab(blob), { message: "File non integro" });
  } finally {
    process.env.AES_MASTER_KEY = original;
  }
  assert.equal(decryptContab(blob).toString(), "secret");
});

test("missing AES_MASTER_KEY throws instead of using a default", () => {
  const original = process.env.AES_MASTER_KEY;
  delete process.env.AES_MASTER_KEY;
  try {
    assert.throws(() => encryptContab(Buffer.from("x")), /AES_MASTER_KEY/);
  } finally {
    process.env.AES_MASTER_KEY = original;
  }
});
