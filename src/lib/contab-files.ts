// Pure upload policy for the accounting area (no I/O, no database): allowed types, size limit,
// safe file names, MIME types. Used by the upload routes before anything is written to disk.

export const CONTAB_MAX_BYTES = 25 * 1024 * 1024;

const MIME_BY_EXT: Record<string, string> = {
  xml: "application/xml",
  pdf: "application/pdf",
  p7m: "application/pkcs7-mime",
  zip: "application/zip",
  csv: "text/csv",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

export const CONTAB_EXTENSIONS: readonly string[] = Object.keys(MIME_BY_EXT);

const MAX_NAME_LEN = 150;
const FALLBACK_NAME = "documento";

function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
}

// Turns any client-supplied file name into a name that is safe to store and to put in a
// Content-Disposition header: no directory parts, no control/bidi characters, no characters that
// are illegal on Windows, never empty, at most 150 characters (extension kept).
export function sanitizeFileName(name: string): string {
  let s = String(name ?? "").normalize("NFC");
  // Control characters and invisible direction overrides (e.g. U+202E used to fake extensions).
  s = s.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g, "");
  // Keep only the last path component, whatever the separator.
  s = s.replace(/\\/g, "/");
  s = s.slice(s.lastIndexOf("/") + 1);
  s = s.replace(/[<>:"|?*]/g, "_");
  // Leading/trailing dots and spaces are meaningless (and special on Windows).
  s = s.replace(/^[.\s]+/, "").replace(/[.\s]+$/, "");
  if (!s) return FALLBACK_NAME;
  if (s.length > MAX_NAME_LEN) {
    const dot = s.lastIndexOf(".");
    const ext = dot > 0 && s.length - dot <= 12 ? s.slice(dot) : "";
    s = s.slice(0, MAX_NAME_LEN - ext.length) + ext;
    // Cutting could expose a trailing space or dot before the extension; clean up again.
    s = s.replace(/[.\s]+$/, "") || FALLBACK_NAME;
  }
  return s;
}

export function contabMimeFor(name: string): string {
  return MIME_BY_EXT[extensionOf(name)] ?? "application/octet-stream";
}

// Megabytes (1 MB = 1024*1024 bytes) with two decimals and an Italian decimal comma.
export function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2).replace(".", ",")} MB`;
}

export function validateContabUpload(
  name: string,
  data: Buffer,
): { ok: true; name: string; mime: string } | { ok: false; message: string } {
  const safe = sanitizeFileName(name);
  const ext = extensionOf(safe);
  if (!CONTAB_EXTENSIONS.includes(ext)) {
    return {
      ok: false,
      message: `Tipo di file non consentito. Formati ammessi: ${CONTAB_EXTENSIONS.join(", ")}.`,
    };
  }
  if (data.length === 0) {
    return { ok: false, message: "Il file è vuoto (0 byte)." };
  }
  if (data.length > CONTAB_MAX_BYTES) {
    return {
      ok: false,
      message: `Il file è troppo grande (${formatMb(data.length)}). Dimensione massima: 25 MB.`,
    };
  }
  if (ext === "pdf" && data.subarray(0, 4).toString("latin1") !== "%PDF") {
    return { ok: false, message: "Il file non sembra un PDF valido." };
  }
  return { ok: true, name: safe, mime: contabMimeFor(safe) };
}
