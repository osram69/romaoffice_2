import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, inArray, like, or } from "drizzle-orm";

import { db, pool } from "@/db";
import { contabDownloads, contabFiles, contabSections } from "@/db/schema";
import {
  addFile,
  createSection,
  deleteFileRow,
  deleteSectionIfEmpty,
  getFile,
  listSectionsWithFiles,
  moveSection,
  recordDownload,
  renameSection,
} from "@/lib/contab-data";

// Everything here touches the database, so it only runs when TEST_DB points at a real dev database.
// The pure title rules are covered (and run everywhere) in contab-title.test.ts.
const dbTest = process.env.TEST_DB ? test : test.skip;

const PREFIX = "zz-test-";
const createdSections: number[] = [];

after(async () => {
  try {
    if (!process.env.TEST_DB) return;
    // Downloads first (they reference files), then files, then sections.
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
  } finally {
    await pool.end();
  }
});

async function newSection(label = "sezione") {
  const result = await createSection(`${PREFIX}${label}-${randomUUID().slice(0, 8)}`);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("createSection failed");
  createdSections.push(result.id);
  return result.id;
}

async function newFile(sectionId: number, name = `${PREFIX}${randomUUID().slice(0, 8)}.pdf`) {
  const id = await addFile({
    sectionId,
    originalName: name,
    mime: "application/pdf",
    sizeBytes: 1234,
    storedName: randomUUID(),
    uploadedBy: `${PREFIX}admin`,
  });
  return { id, name };
}

const findSection = async (id: number) => (await listSectionsWithFiles()).find(s => s.id === id);
const sectionIds = async () => (await listSectionsWithFiles()).map(s => s.id);

dbTest("a new section is the first one in the list", async () => {
  const id = await newSection();
  const list = await listSectionsWithFiles();
  assert.equal(list[0].id, id);
  assert.deepEqual(list[0].files, []);
  // The list is sorted by sort_order, highest first.
  for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].sortOrder >= list[i].sortOrder);
});

dbTest("a section is created with the title trimmed", async () => {
  const title = `${PREFIX}trim-${randomUUID().slice(0, 8)}`;
  const result = await createSection(`   ${title}  `);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  createdSections.push(result.id);
  assert.equal((await findSection(result.id))?.title, title);
});

dbTest("an empty title or one of 101 characters is refused and creates nothing", async () => {
  const before = (await sectionIds()).length;
  for (const title of ["", "   ", "a".repeat(101)]) {
    const result = await createSection(title);
    assert.equal(result.ok, false, JSON.stringify(title.slice(0, 5)));
  }
  assert.equal((await sectionIds()).length, before);
});

dbTest("a title of exactly 100 characters is accepted", async () => {
  const result = await createSection(PREFIX + "b".repeat(100 - PREFIX.length));
  assert.equal(result.ok, true);
  if (result.ok) createdSections.push(result.id);
});

dbTest("sections created at the same time all get a different sort_order", async () => {
  const results = await Promise.all(Array.from({ length: 5 }, () => createSection(`${PREFIX}parallel-${randomUUID().slice(0, 8)}`)));
  const ids: number[] = [];
  for (const result of results) {
    assert.equal(result.ok, true);
    if (result.ok) {
      createdSections.push(result.id);
      ids.push(result.id);
    }
  }
  const orders = (await listSectionsWithFiles()).filter(s => ids.includes(s.id)).map(s => s.sortOrder);
  assert.equal(orders.length, 5);
  assert.equal(new Set(orders).size, 5);
});

dbTest("moveSection down swaps two neighbouring sections, and up swaps them back", async () => {
  const a = await newSection("a");
  const b = await newSection("b"); // created last, so it sits above a
  let ids = await sectionIds();
  assert.ok(ids.indexOf(b) < ids.indexOf(a));
  assert.equal(ids.indexOf(a) - ids.indexOf(b), 1, "a and b are neighbours");

  await moveSection(b, "down");
  ids = await sectionIds();
  assert.ok(ids.indexOf(a) < ids.indexOf(b), "a is now above b");
  assert.equal(ids.indexOf(b) - ids.indexOf(a), 1);

  await moveSection(b, "up");
  ids = await sectionIds();
  assert.ok(ids.indexOf(b) < ids.indexOf(a), "back to the original order");
});

dbTest("moveSection up on the first section does nothing and does not throw", async () => {
  const top = await newSection("top");
  const before = await listSectionsWithFiles();
  assert.equal(before[0].id, top);
  await assert.doesNotReject(moveSection(top, "up"));
  const after = await listSectionsWithFiles();
  assert.deepEqual(after.map(s => [s.id, s.sortOrder]), before.map(s => [s.id, s.sortOrder]));
});

dbTest("moveSection with an unknown or invalid id does nothing and does not throw", async () => {
  const before = await listSectionsWithFiles();
  await assert.doesNotReject(moveSection(2_000_000_000, "up"));
  await assert.doesNotReject(moveSection(2_000_000_000, "down"));
  await assert.doesNotReject(moveSection(Number.NaN, "up"));
  await assert.doesNotReject(moveSection(-1, "down"));
  const after = await listSectionsWithFiles();
  assert.deepEqual(after.map(s => [s.id, s.sortOrder]), before.map(s => [s.id, s.sortOrder]));
});

dbTest("renameSection changes the title (trimmed) and refuses bad titles and unknown ids", async () => {
  const id = await newSection("rename");
  const title = `${PREFIX}renamed-${randomUUID().slice(0, 8)}`;
  assert.deepEqual(await renameSection(id, `  ${title} `), { ok: true });
  assert.equal((await findSection(id))?.title, title);

  assert.equal((await renameSection(id, "")).ok, false);
  assert.equal((await renameSection(id, "x".repeat(101))).ok, false);
  assert.equal((await findSection(id))?.title, title, "a refused rename keeps the old title");

  assert.equal((await renameSection(2_000_000_000, "zz-test-unknown")).ok, false);
});

dbTest("deleteSectionIfEmpty refuses a section with a file and asks to delete the files first", async () => {
  const id = await newSection("full");
  const file = await newFile(id);
  const result = await deleteSectionIfEmpty(id);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /elimina prima i file/i);
  assert.ok(await findSection(id), "the section is still there");
  assert.ok(await getFile(file.id), "and so is the file");

  // Once the file is gone the same call succeeds.
  assert.ok(await deleteFileRow(file.id));
  assert.deepEqual(await deleteSectionIfEmpty(id), { ok: true });
  assert.equal(await findSection(id), undefined);
});

dbTest("deleteSectionIfEmpty deletes an empty section, and reports a missing one without throwing", async () => {
  const id = await newSection("empty");
  assert.deepEqual(await deleteSectionIfEmpty(id), { ok: true });
  assert.equal(await findSection(id), undefined);
  const again = await deleteSectionIfEmpty(id);
  assert.equal(again.ok, false);
  assert.equal((await deleteSectionIfEmpty(Number.NaN)).ok, false);
});

dbTest("files of a section are listed newest first", async () => {
  const id = await newSection("files");
  const first = await newFile(id);
  const second = await newFile(id);
  const third = await newFile(id);
  const section = await findSection(id);
  assert.deepEqual(section?.files.map(f => f.id), [third.id, second.id, first.id]);
  const row = section!.files[2];
  assert.equal(row.originalName, first.name);
  assert.equal(row.sectionId, id);
  assert.equal(row.mime, "application/pdf");
  assert.equal(row.sizeBytes, 1234);
  assert.equal(row.uploadedBy, `${PREFIX}admin`);
  assert.ok(row.uploadedAt instanceof Date);
  assert.equal(row.lastDownloadAt, null);
});

dbTest("getFile returns the row, or null for an unknown id", async () => {
  const id = await newSection("get");
  const file = await newFile(id);
  const row = await getFile(file.id);
  assert.equal(row?.originalName, file.name);
  assert.equal(row?.lastDownloadAt, null);
  assert.equal(await getFile(2_000_000_000), null);
  assert.equal(await getFile(Number.NaN), null);
});

dbTest("recordDownload fills lastDownloadAt in the list and in getFile, per file", async () => {
  const id = await newSection("download");
  const downloaded = await newFile(id);
  const untouched = await newFile(id);
  assert.equal((await getFile(downloaded.id))?.lastDownloadAt, null);

  await recordDownload({ id: downloaded.id, originalName: downloaded.name }, `${PREFIX}commercialista`);
  const firstTime = (await getFile(downloaded.id))?.lastDownloadAt;
  assert.ok(firstTime instanceof Date);

  const section = await findSection(id);
  const listed = section!.files.find(f => f.id === downloaded.id)!;
  assert.ok(listed.lastDownloadAt instanceof Date);
  assert.equal(listed.lastDownloadAt.getTime(), firstTime.getTime());
  assert.equal(section!.files.find(f => f.id === untouched.id)!.lastDownloadAt, null);

  // A second download moves lastDownloadAt forward (it is the latest one).
  await new Promise(resolve => setTimeout(resolve, 20));
  await recordDownload({ id: downloaded.id, originalName: downloaded.name }, `${PREFIX}commercialista`);
  const secondTime = (await getFile(downloaded.id))?.lastDownloadAt;
  assert.ok(secondTime && secondTime.getTime() > firstTime.getTime());
  const rows = await db.select().from(contabDownloads).where(eq(contabDownloads.fileId, downloaded.id));
  assert.equal(rows.length, 2);
  assert.ok(rows.every(r => r.fileName === downloaded.name && r.username === `${PREFIX}commercialista`));
});

dbTest("recordDownload for a file that no longer exists still logs the entry, without the file link", async () => {
  const id = await newSection("gone");
  const file = await newFile(id);
  assert.ok(await deleteFileRow(file.id));
  await recordDownload({ id: file.id, originalName: file.name }, `${PREFIX}commercialista`);
  const rows = await db.select().from(contabDownloads).where(eq(contabDownloads.fileName, file.name));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].fileId, null);
});

dbTest("deleteFileRow returns the deleted row and keeps the download log with file_id NULL and the name", async () => {
  const id = await newSection("delete-file");
  const file = await newFile(id);
  const stored = (await getFile(file.id))!.storedName;
  await recordDownload({ id: file.id, originalName: file.name }, `${PREFIX}commercialista`);

  const deleted = await deleteFileRow(file.id);
  assert.ok(deleted);
  assert.equal(deleted.id, file.id);
  assert.equal(deleted.storedName, stored);
  assert.equal(deleted.originalName, file.name);
  assert.equal(deleted.sectionId, id);
  assert.ok(deleted.lastDownloadAt instanceof Date);

  assert.equal(await getFile(file.id), null);
  assert.deepEqual((await findSection(id))?.files, []);

  const rows = await db.select().from(contabDownloads).where(eq(contabDownloads.fileName, file.name));
  assert.equal(rows.length, 1, "the log row is kept");
  assert.equal(rows[0].fileId, null);
  assert.equal(rows[0].fileName, file.name);
  assert.equal(rows[0].username, `${PREFIX}commercialista`);

  assert.equal(await deleteFileRow(file.id), null, "a second delete finds nothing");
});
