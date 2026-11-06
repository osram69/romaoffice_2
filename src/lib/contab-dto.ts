// What the accounting pages may hand to the browser. A ContabFileRow carries `storedName` (the name of the
// encrypted file on the server disk) and other server-only fields: they are never passed to a client component
// or put in JSON, only the fields below. Plain module, no database access (the imports are types only).
import type { ContabFileRow, ContabSectionRow } from "./contab-data";

export type ContabFileDto = {
  id: number;
  originalName: string;
  sizeBytes: number;
  uploadedAt: string;
  lastDownloadAt: string | null;
};

export type ContabSectionDto = { id: number; title: string; files: ContabFileDto[] };

export type ContabSettingsSectionDto = { id: number; title: string; fileCount: number };

// Fields are picked one by one on purpose: a spread would carry any new column of the row to the browser.
export function toContabFileDto(row: ContabFileRow): ContabFileDto {
  return {
    id: row.id,
    originalName: row.originalName,
    sizeBytes: row.sizeBytes,
    uploadedAt: row.uploadedAt.toISOString(),
    lastDownloadAt: row.lastDownloadAt ? row.lastDownloadAt.toISOString() : null,
  };
}

export function toContabSectionDto(section: ContabSectionRow): ContabSectionDto {
  return { id: section.id, title: section.title, files: section.files.map(toContabFileDto) };
}

export function toContabSettingsSectionDto(section: ContabSectionRow): ContabSettingsSectionDto {
  return { id: section.id, title: section.title, fileCount: section.files.length };
}

/** "06/11/2026, 10:30" in Rome time; an empty string for null or an invalid date. */
export function formatContabDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
