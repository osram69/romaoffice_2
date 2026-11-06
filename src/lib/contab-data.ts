// Database layer of the accounting area ("Contabilità"): sections, file rows and the download log.
// The encrypted bytes live on disk (contab-storage.ts); this module only knows the rows.
import { and, asc, desc, eq, gt, isNotNull, lt, max, notExists, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { contabDownloads, contabFiles, contabSections } from "@/db/schema";
import { normalizeSectionTitle } from "./contab-title";

export type ContabFileRow = {
  id: number;
  sectionId: number;
  originalName: string;
  mime: string;
  sizeBytes: number;
  storedName: string;
  uploadedBy: string;
  uploadedAt: Date;
  lastDownloadAt: Date | null;
};

export type ContabSectionRow = { id: number; title: string; sortOrder: number; files: ContabFileRow[] };

type Result = { ok: true } | { ok: false; message: string };

const SECTION_NOT_FOUND = "Sezione non trovata.";
const SECTION_NOT_EMPTY = "La sezione contiene dei file: elimina prima i file, poi potrai eliminare la sezione.";

// Same key for every statement that reads and writes sort_order, so creations and moves never interleave.
const SORT_LOCK_KEY = 7430211;

const POSTGRES_MAX_INT = 2147483647;
const isValidId = (id: number) => Number.isSafeInteger(id) && id > 0 && id <= POSTGRES_MAX_INT;

// node-postgres puts the SQLSTATE in `code`; Drizzle may wrap the driver error in `cause`.
function hasSqlState(error: unknown, state: string): boolean {
  for (let current: unknown = error, depth = 0; current && typeof current === "object" && depth < 3; depth++) {
    if ((current as { code?: unknown }).code === state) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
const FOREIGN_KEY_VIOLATION = "23503";

const fileColumns = {
  id: contabFiles.id,
  sectionId: contabFiles.sectionId,
  originalName: contabFiles.originalName,
  mime: contabFiles.mime,
  sizeBytes: contabFiles.sizeBytes,
  storedName: contabFiles.storedName,
  uploadedBy: contabFiles.uploadedBy,
  uploadedAt: contabFiles.uploadedAt,
};

/** Sections from the top of the page down (highest sort_order first), each with its files (newest first). */
export async function listSectionsWithFiles(): Promise<ContabSectionRow[]> {
  const sections = await db.select({ id: contabSections.id, title: contabSections.title, sortOrder: contabSections.sortOrder })
    .from(contabSections)
    .orderBy(desc(contabSections.sortOrder), desc(contabSections.id));
  if (sections.length === 0) return [];

  const files = await db.select(fileColumns)
    .from(contabFiles)
    .orderBy(desc(contabFiles.uploadedAt), desc(contabFiles.id));

  // One grouped query for every file: no query per file.
  const lastDownloads = await db.select({ fileId: contabDownloads.fileId, last: max(contabDownloads.downloadedAt) })
    .from(contabDownloads)
    .where(isNotNull(contabDownloads.fileId))
    .groupBy(contabDownloads.fileId);
  const lastByFile = new Map<number, Date>();
  for (const row of lastDownloads) {
    if (row.fileId !== null && row.last) lastByFile.set(row.fileId, row.last);
  }

  const bySection = new Map<number, ContabFileRow[]>();
  for (const file of files) {
    const list = bySection.get(file.sectionId) ?? [];
    list.push({ ...file, lastDownloadAt: lastByFile.get(file.id) ?? null });
    bySection.set(file.sectionId, list);
  }
  return sections.map(section => ({ ...section, files: bySection.get(section.id) ?? [] }));
}

/** One section (id and title), or null when the id is invalid or unknown. */
export async function getSection(id: number): Promise<{ id: number; title: string } | null> {
  if (!isValidId(id)) return null;
  const [section] = await db.select({ id: contabSections.id, title: contabSections.title })
    .from(contabSections)
    .where(eq(contabSections.id, id))
    .limit(1);
  return section ?? null;
}

/** One section with its files in upload order (oldest first, so ZIP names stay stable); null when it does not exist. */
export async function getSectionWithFiles(id: number): Promise<{ id: number; title: string; files: Omit<ContabFileRow, "lastDownloadAt">[] } | null> {
  const section = await getSection(id);
  if (!section) return null;
  const files = await db.select(fileColumns)
    .from(contabFiles)
    .where(eq(contabFiles.sectionId, section.id))
    .orderBy(asc(contabFiles.uploadedAt), asc(contabFiles.id));
  return { ...section, files };
}

/** New sections go on top: sort_order is the current maximum plus one. */
export async function createSection(title: string): Promise<{ ok: true; id: number } | { ok: false; message: string }> {
  const checked = normalizeSectionTitle(title);
  if (!checked.ok) return checked;
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(${sql.raw(String(SORT_LOCK_KEY))})`);
    const [top] = await tx.select({ value: max(contabSections.sortOrder) }).from(contabSections);
    const [created] = await tx.insert(contabSections)
      .values({ title: checked.title, sortOrder: (top?.value ?? 0) + 1 })
      .returning({ id: contabSections.id });
    return { ok: true as const, id: created.id };
  });
}

export async function renameSection(id: number, title: string): Promise<Result> {
  const checked = normalizeSectionTitle(title);
  if (!checked.ok) return checked;
  if (!isValidId(id)) return { ok: false, message: SECTION_NOT_FOUND };
  const updated = await db.update(contabSections)
    .set({ title: checked.title })
    .where(eq(contabSections.id, id))
    .returning({ id: contabSections.id });
  if (updated.length === 0) return { ok: false, message: SECTION_NOT_FOUND };
  return { ok: true };
}

/**
 * "up" moves the section toward the top of the list (higher sort_order), "down" toward the bottom.
 * It swaps sort_order with the neighbour found by ordering on (sort_order, id); at the edges, or for an unknown id, nothing happens.
 */
export async function moveSection(id: number, direction: "up" | "down"): Promise<void> {
  if (!isValidId(id)) return;
  await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(${sql.raw(String(SORT_LOCK_KEY))})`);
    const [current] = await tx.select({ id: contabSections.id, sortOrder: contabSections.sortOrder })
      .from(contabSections)
      .where(eq(contabSections.id, id))
      .limit(1);
    if (!current) return;

    const [neighbour] = direction === "up"
      ? await tx.select({ id: contabSections.id, sortOrder: contabSections.sortOrder })
        .from(contabSections)
        .where(or(
          gt(contabSections.sortOrder, current.sortOrder),
          and(eq(contabSections.sortOrder, current.sortOrder), gt(contabSections.id, current.id)),
        ))
        .orderBy(asc(contabSections.sortOrder), asc(contabSections.id))
        .limit(1)
      : await tx.select({ id: contabSections.id, sortOrder: contabSections.sortOrder })
        .from(contabSections)
        .where(or(
          lt(contabSections.sortOrder, current.sortOrder),
          and(eq(contabSections.sortOrder, current.sortOrder), lt(contabSections.id, current.id)),
        ))
        .orderBy(desc(contabSections.sortOrder), desc(contabSections.id))
        .limit(1);
    if (!neighbour) return;

    await tx.update(contabSections).set({ sortOrder: neighbour.sortOrder }).where(eq(contabSections.id, current.id));
    await tx.update(contabSections).set({ sortOrder: current.sortOrder }).where(eq(contabSections.id, neighbour.id));
  });
}

/** Deletes the section only when it holds no files; the check and the delete are a single statement. */
export async function deleteSectionIfEmpty(id: number): Promise<Result> {
  if (!isValidId(id)) return { ok: false, message: SECTION_NOT_FOUND };
  try {
    const deleted = await db.delete(contabSections)
      .where(and(
        eq(contabSections.id, id),
        notExists(db.select({ one: sql`1` }).from(contabFiles).where(eq(contabFiles.sectionId, id))),
      ))
      .returning({ id: contabSections.id });
    if (deleted.length === 1) return { ok: true };
  } catch (error) {
    // A file inserted at the very same moment makes the foreign key refuse the delete: that is "not empty", not a failure.
    if (hasSqlState(error, FOREIGN_KEY_VIOLATION)) return { ok: false, message: SECTION_NOT_EMPTY };
    throw error;
  }
  // Nothing deleted: either the section does not exist or it has files.
  const [existing] = await db.select({ id: contabSections.id }).from(contabSections).where(eq(contabSections.id, id)).limit(1);
  return { ok: false, message: existing ? SECTION_NOT_EMPTY : SECTION_NOT_FOUND };
}

export async function addFile(input: {
  sectionId: number;
  originalName: string;
  mime: string;
  sizeBytes: number;
  storedName: string;
  uploadedBy: string;
}): Promise<number> {
  const [created] = await db.insert(contabFiles).values({
    sectionId: input.sectionId,
    originalName: input.originalName,
    mime: input.mime,
    sizeBytes: input.sizeBytes,
    storedName: input.storedName,
    uploadedBy: input.uploadedBy,
  }).returning({ id: contabFiles.id });
  return created.id;
}

export async function getFile(id: number): Promise<ContabFileRow | null> {
  if (!isValidId(id)) return null;
  const [file] = await db.select(fileColumns).from(contabFiles).where(eq(contabFiles.id, id)).limit(1);
  if (!file) return null;
  const [last] = await db.select({ value: max(contabDownloads.downloadedAt) }).from(contabDownloads).where(eq(contabDownloads.fileId, id));
  return { ...file, lastDownloadAt: last?.value ?? null };
}

/**
 * Deletes the row and returns it, so the caller can remove the encrypted file from disk.
 * The download log keeps its rows: the schema sets file_id to NULL and file_name stays.
 */
export async function deleteFileRow(id: number): Promise<ContabFileRow | null> {
  if (!isValidId(id)) return null;
  return db.transaction(async tx => {
    const [last] = await tx.select({ value: max(contabDownloads.downloadedAt) }).from(contabDownloads).where(eq(contabDownloads.fileId, id));
    const [deleted] = await tx.delete(contabFiles).where(eq(contabFiles.id, id)).returning(fileColumns);
    return deleted ? { ...deleted, lastDownloadAt: last?.value ?? null } : null;
  });
}

/** Logs a download. If the file was deleted a moment ago the entry is still kept, without the file link. */
export async function recordDownload(file: { id: number; originalName: string }, username: string): Promise<void> {
  try {
    await db.insert(contabDownloads).values({ fileId: file.id, fileName: file.originalName, username });
  } catch (error) {
    if (!hasSqlState(error, FOREIGN_KEY_VIOLATION)) throw error;
    await db.insert(contabDownloads).values({ fileId: null, fileName: file.originalName, username });
  }
}
