// Pure rules for the ZIP of a section (no I/O, no database): entry names and the file name of the archive.
import { sanitizeFileName } from "./contab-files";
import { uniqueZipNames } from "./zip-store";

// The archive is built in memory, so the plaintext of one section is capped.
export const CONTAB_ZIP_MAX_BYTES = 200 * 1024 * 1024;

/**
 * Names for the archive entries: every original name is sanitized first (no paths, no control characters,
 * at most 150 characters) and only then made unique ("a.pdf", "a (2).pdf"), because buildZip writes
 * names verbatim and sanitizing afterwards could create new duplicates.
 */
export function zipEntryNames(originalNames: string[]): string[] {
  return uniqueZipNames(originalNames.map(sanitizeFileName));
}

/** "<section title>.zip" as a safe file name: path separators in the title become dashes. */
export function zipFileName(sectionTitle: string): string {
  const base = sanitizeFileName(String(sectionTitle ?? "").replace(/[\\/]/g, "-"));
  return sanitizeFileName(`${base}.zip`);
}
