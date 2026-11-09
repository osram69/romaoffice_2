import test from "node:test";
import assert from "node:assert/strict";

import { storeUpload, type UploadIo } from "@/lib/contab-upload";

// Pure tests (no database, no disk): the order of operations and the rollback of an upload, with fake I/O.

function fakeIo(overrides: Partial<UploadIo> = {}) {
  const calls: string[] = [];
  const io: UploadIo = {
    newName: () => "stored-1",
    save: async name => {
      calls.push(`save:${name}`);
    },
    add: async name => {
      calls.push(`add:${name}`);
      return 42;
    },
    remove: async name => {
      calls.push(`remove:${name}`);
    },
    ...overrides,
  };
  return { io, calls };
}

test("storeUpload writes the file first, then adds the row, and returns both", async () => {
  const { io, calls } = fakeIo();
  const result = await storeUpload(io, Buffer.from("x"), () => assert.fail("nothing to log"));
  assert.deepEqual(result, { id: 42, storedName: "stored-1" });
  assert.deepEqual(calls, ["save:stored-1", "add:stored-1"]);
});

test("storeUpload removes the file when the row cannot be added, and rethrows the original error", async () => {
  const failure = new Error("db down");
  const { io, calls } = fakeIo({
    add: async name => {
      calls.push(`add:${name}`);
      throw failure;
    },
  });
  await assert.rejects(storeUpload(io, Buffer.from("x"), () => {}), error => error === failure);
  assert.deepEqual(calls, ["save:stored-1", "add:stored-1", "remove:stored-1"]);
});

test("storeUpload: a failing cleanup is logged and never hides the original error", async () => {
  const failure = new Error("db down");
  const logged: string[] = [];
  const { io } = fakeIo({
    add: async () => {
      throw failure;
    },
    remove: async () => {
      throw new Error("disk gone");
    },
  });
  await assert.rejects(
    storeUpload(io, Buffer.from("x"), label => logged.push(label)),
    error => error === failure,
  );
  assert.equal(logged.length, 1);
});

test("storeUpload: when saving fails nothing is added and nothing is removed", async () => {
  const failure = new Error("disk full");
  const { io, calls } = fakeIo({
    save: async name => {
      calls.push(`save:${name}`);
      throw failure;
    },
  });
  await assert.rejects(storeUpload(io, Buffer.from("x"), () => {}), error => error === failure);
  assert.deepEqual(calls, ["save:stored-1"]);
});
