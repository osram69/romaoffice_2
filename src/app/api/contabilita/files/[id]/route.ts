import { NextRequest, NextResponse } from "next/server";
import {
  GENERIC_FAILURE,
  NO_STORE,
  jsonResponse,
  methodNotAllowed,
  parseId,
  readStoredFile,
  requireContabAdmin,
  requireContabDownloader,
} from "@/lib/contab-api";
import { deleteFileRow, getFile, recordDownload } from "@/lib/contab-data";
import { contentDisposition } from "@/lib/contab-http";
import { removeContabFile } from "@/lib/contab-storage";
import { logSafeError } from "@/lib/safe-log";

type Context = { params: Promise<{ id: string }> };

// GET: decrypt and download one file. Admin with a valid unlock, or a commercialista (whose downloads are logged).
export async function GET(req: NextRequest, { params }: Context) {
  try {
    const access = await requireContabDownloader(req);
    if (!access.ok) return access.response;

    const id = parseId((await params).id);
    const file = id === null ? null : await getFile(id);
    if (!file) return jsonResponse({ error: "File non trovato." }, 404);

    const read = await readStoredFile(file.storedName);
    if (!read.ok) {
      return read.missing
        ? jsonResponse({ error: "Il file non è più disponibile" }, 404)
        : jsonResponse({ error: GENERIC_FAILURE }, 500);
    }

    // Only the accountant's downloads are logged. If logging fails the download fails too (500): the log is the audit trail.
    if (access.isAccountant) await recordDownload(file, access.user.username);

    return new NextResponse(new Uint8Array(read.data), {
      status: 200,
      headers: {
        "Content-Type": file.mime,
        "Content-Disposition": contentDisposition(file.originalName),
        "Content-Length": String(read.data.length),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": NO_STORE,
      },
    });
  } catch (error) {
    logSafeError("Contab download failed", error);
    return jsonResponse({ error: GENERIC_FAILURE }, 500);
  }
}

// DELETE: admin with a valid unlock only. Removes the row, then the encrypted file.
export async function DELETE(req: NextRequest, { params }: Context) {
  try {
    const access = await requireContabAdmin(req);
    if (!access.ok) return access.response;

    const id = parseId((await params).id);
    const row = id === null ? null : await deleteFileRow(id);
    if (!row) return jsonResponse({ success: false, message: "File non trovato." }, 404);

    try {
      await removeContabFile(row.storedName);
    } catch (error) {
      // The row is gone, so the file cannot be reached from the app any more; it stays encrypted on disk.
      logSafeError("Contab delete: removing the file from disk failed", error);
    }
    return jsonResponse({ success: true });
  } catch (error) {
    logSafeError("Contab delete failed", error);
    return jsonResponse({ success: false, message: GENERIC_FAILURE }, 500);
  }
}

// A HEAD request would otherwise run GET: it must not decrypt a file or log a download.
export function HEAD() {
  return methodNotAllowed("GET, DELETE");
}
