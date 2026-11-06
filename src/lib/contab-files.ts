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

// Characters that are invisible or reorder text: C0/C1 controls, zero-width characters and direction
// marks/overrides (e.g. U+202E, used to fake extensions), U+2028/U+2029 line and paragraph separators,
// direction isolates and the BOM. Written as escapes so they stay visible in the source.
const INVISIBLE_CHARS = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069\ufeff]/g;

// Cuts `text` to at most `maxUnits` UTF-16 units without ever splitting a surrogate pair: it walks
// code points, so the result is always well-formed (encodeURIComponent never throws on it).
function cutToUnits(text: string, maxUnits: number): string {
  let out = "";
  for (const ch of text) {
    if (out.length + ch.length > maxUnits) break;
    out += ch;
  }
  return out;
}

// Turns any client-supplied file name into a name that is safe to store and to put in a
// Content-Disposition header: well-formed Unicode, no directory parts, no control/bidi characters, no
// characters that are illegal on Windows, never empty, at most 150 UTF-16 units (extension kept).
export function sanitizeFileName(name: string): string {
  // toWellFormed() turns a lone surrogate into U+FFFD, so nothing downstream can throw on the name.
  let s = String(name ?? "").toWellFormed().normalize("NFC");
  s = s.replace(INVISIBLE_CHARS, "");
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
    const base = ext ? s.slice(0, dot) : s;
    // Cutting could expose a trailing space or dot: trim it before the extension is appended again.
    const cut = cutToUnits(base, MAX_NAME_LEN - ext.length).replace(/[.\s]+$/, "");
    s = (cut || FALLBACK_NAME) + ext;
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
      message: `Il file è troppo grande (${formatMb(data.length)}). Dimensione massima: ${CONTAB_MAX_BYTES / (1024 * 1024)} MB.`,
    };
  }
  if (ext === "pdf" && data.subarray(0, 4).toString("latin1") !== "%PDF") {
    return { ok: false, message: "Il file non sembra un PDF valido." };
  }
  return { ok: true, name: safe, mime: contabMimeFor(safe) };
}
