// Shared plumbing of the /api/contabilita routes: who may do what, and the response shapes.
// Permission rules (spec sections 2, 4.1 and 5):
//  - upload and delete: ONLY an admin with a valid second-password unlock (contabAccessFromRequest);
//  - download (file or ZIP): an admin with a valid unlock, or a commercialista with a valid session.
// Everything else is refused: operatore, admin without unlock, a user who must change password
// (getStaffUser gives null for them), no or expired session.
import { NextResponse, type NextRequest } from "next/server";
import { contabAccessFromRequest } from "./contab-auth";
import { readContabFile } from "./contab-storage";
import { logSafeError } from "./safe-log";
import { STAFF_SESSION_COOKIE, getStaffUser, type StaffUser } from "./staff-auth";

export const NO_STORE = "private, no-store";
export const LOCKED_MESSAGE = "Sblocco scaduto, reinserisci la password";
export const GENERIC_FAILURE = "Operazione non riuscita, riprova.";
const FORBIDDEN_MESSAGE = "Operazione non consentita.";

const POSTGRES_MAX_INT = 2147483647;

/** A positive integer written with digits only (no sign, no decimals, no exponent) that fits a Postgres integer. */
export function parseId(value: string | null | undefined): number | null {
  if (typeof value !== "string" || !/^[1-9][0-9]{0,9}$/.test(value)) return null;
  const id = Number(value);
  return id <= POSTGRES_MAX_INT ? id : null;
}

/** JSON with `Cache-Control: private, no-store`. Callers must never put paths, SQL, stack traces or stored names in `body`. */
export function jsonResponse(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": NO_STORE } });
}

export function lockedResponse(): NextResponse {
  return jsonResponse({ success: false, code: "locked", message: LOCKED_MESSAGE }, 401);
}

/** For HEAD: a HEAD must never run the download (it would decrypt the file and log a download). */
export function methodNotAllowed(allow: string): NextResponse {
  return new NextResponse(null, { status: 405, headers: { Allow: allow, "Cache-Control": NO_STORE } });
}

type Denied = { ok: false; response: NextResponse };

/** Upload and delete. Any 401 carries `code: "locked"` so the page can ask for the second password again. */
export async function requireContabAdmin(req: NextRequest): Promise<{ ok: true; user: StaffUser } | Denied> {
  const admin = await contabAccessFromRequest(req);
  if (admin) return { ok: true, user: admin };
  // Not an unlocked admin. A logged-in commercialista or operatore is forbidden (403); anyone else
  // (no session, expired session, admin without unlock) is told to unlock/log in again (401).
  const user = await getStaffUser(req.cookies.get(STAFF_SESSION_COOKIE)?.value);
  if (user && user.role !== "admin") {
    return { ok: false, response: jsonResponse({ success: false, code: "forbidden", message: FORBIDDEN_MESSAGE }, 403) };
  }
  return { ok: false, response: lockedResponse() };
}

/** Download of one file or of a ZIP. `isAccountant` decides whether the download is logged. */
export async function requireContabDownloader(req: NextRequest): Promise<{ ok: true; user: StaffUser; isAccountant: boolean } | Denied> {
  const admin = await contabAccessFromRequest(req);
  if (admin) return { ok: true, user: admin, isAccountant: false };
  const user = await getStaffUser(req.cookies.get(STAFF_SESSION_COOKIE)?.value);
  if (!user) {
    return { ok: false, response: jsonResponse({ error: "Non autorizzato.", code: "unauthorized" }, 401) };
  }
  // Exactly "commercialista": never "anything that is not admin/operatore".
  if (user.role === "commercialista") return { ok: true, user, isAccountant: true };
  if (user.role === "admin") {
    return { ok: false, response: jsonResponse({ error: LOCKED_MESSAGE, code: "locked" }, 401) };
  }
  return { ok: false, response: jsonResponse({ error: FORBIDDEN_MESSAGE, code: "forbidden" }, 403) };
}

/**
 * Reads and decrypts one stored file. `missing` is the row-without-file case (readContabFile throws "File non
 * trovato"): the routes answer 404, not 500. Any other failure (disk, wrong key, tampered file) is logged
 * without its message (logSafeError) and reported as a generic failure.
 */
export async function readStoredFile(storedName: string): Promise<{ ok: true; data: Buffer } | { ok: false; missing: boolean }> {
  try {
    return { ok: true, data: await readContabFile(storedName) };
  } catch (error) {
    if (error instanceof Error && error.message === "File non trovato") return { ok: false, missing: true };
    logSafeError("Contab file read failed", error);
    return { ok: false, missing: false };
  }
}
