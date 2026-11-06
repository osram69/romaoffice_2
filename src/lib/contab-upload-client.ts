// Pure helpers of the browser uploader (no database, no server modules: it is bundled for the client).
import { CONTAB_MAX_BYTES } from "./contab-files";
import { CONTAB_GENERIC_FAILURE, CONTAB_LOCKED_MESSAGE } from "./contab-messages";

const MAX_SERVER_MESSAGE = 300;

/** Upload URL: the name goes through encodeURIComponent; the server decodes it exactly once. */
export function uploadUrl(sectionId: number, fileName: string): string {
  // encodeURIComponent throws on a lone surrogate; make the name well-formed first.
  const name = typeof fileName.toWellFormed === "function" ? fileName.toWellFormed() : fileName;
  return `/api/contabilita/files?sectionId=${sectionId}&name=${encodeURIComponent(name)}`;
}

export type UploadOutcome = { kind: "ok" } | { kind: "locked"; message: string } | { kind: "error"; message: string };

function parseBody(text: string): { success?: unknown; code?: unknown; message?: unknown } {
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

/** Turns the HTTP answer of POST /api/contabilita/files into what the row must show. */
export function interpretUploadResponse(status: number, bodyText: string): UploadOutcome {
  const body = parseBody(bodyText);
  if (status >= 200 && status < 300) {
    return body.success === true ? { kind: "ok" } : { kind: "error", message: CONTAB_GENERIC_FAILURE };
  }
  if (status === 401 && body.code === "locked") return { kind: "locked", message: CONTAB_LOCKED_MESSAGE };
  if (typeof body.message === "string" && body.message.length > 0 && body.message.length <= MAX_SERVER_MESSAGE) {
    return { kind: "error", message: body.message };
  }
  if (status === 413) return { kind: "error", message: `Il file è troppo grande. Dimensione massima: ${CONTAB_MAX_BYTES / (1024 * 1024)} MB.` };
  return { kind: "error", message: CONTAB_GENERIC_FAILURE };
}
