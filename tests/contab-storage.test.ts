import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

process.env.AES_MASTER_KEY = "test-master-key";

import {
  newStoredName,
  readContabFile,
  removeContabFile,
  saveContabFile,
} from "@/lib/contab-storage";

let tmp: string;

before(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), "contab-storage-"));
  process.env.DOM_ARCHIVE_DIR = tmp;
});

after(async () => {
  await rm(tmp, { recursive: true, force: true });
});

test("newStoredName returns distinct UUID v4 values", () => {
  const a = newStoredName();
  const b = newStoredName();
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(a, b);
});

test("save then read returns the same buffer", async () => {
  const name = newStoredName();
  const data = Buffer.from("contenuto di prova è °", "utf8");
  await saveContabFile(name, data);
  assert.ok((await readContabFile(name)).equals(data));
});

test("the file on disk is under contabilita/<name>.enc and holds no plaintext", async () => {
  const name = newStoredName();
  const secret = "TESTO-IN-CHIARO-RISERVATO";
  await saveContabFile(name, Buffer.from(secret));
  const onDisk = await readFile(path.join(tmp, "contabilita", `${name}.enc`));
  assert.ok(!onDisk.includes(Buffer.from(secret)));
  assert.ok(onDisk.subarray(0, 5).equals(Buffer.from("ROSC1")));
});

test("readContabFile of a missing name throws 'File non trovato'", async () => {
  await assert.rejects(() => readContabFile(newStoredName()), /File non trovato/);
});

test("removeContabFile deletes the file and is idempotent", async () => {
  const name = newStoredName();
  await saveContabFile(name, Buffer.from("x"));
  await removeContabFile(name);
  await removeContabFile(name);
  await assert.rejects(() => readContabFile(name), /File non trovato/);
});

test("names that are not UUIDs are rejected by every function", async () => {
  for (const bad of ["../x", "..\\x", "abc", "", "a/b", `${newStoredName()}.enc`, `${newStoredName()}/../x`]) {
    await assert.rejects(() => saveContabFile(bad, Buffer.from("x")), /nome file/i, bad);
    await assert.rejects(() => readContabFile(bad), /nome file/i, bad);
    await assert.rejects(() => removeContabFile(bad), /nome file/i, bad);
  }
});

test("overwriting an existing stored name replaces the content", async () => {
  const name = newStoredName();
  await saveContabFile(name, Buffer.from("uno"));
  await saveContabFile(name, Buffer.from("due"));
  assert.equal((await readContabFile(name)).toString(), "due");
});

test("no .tmp files are left behind after writes", async () => {
  await saveContabFile(newStoredName(), Buffer.from("a"));
  await saveContabFile(newStoredName(), Buffer.alloc(100_000, 1));
  const files = await readdir(path.join(tmp, "contabilita"));
  assert.ok(files.length > 0);
  assert.deepEqual(files.filter((f) => f.endsWith(".tmp")), []);
});
