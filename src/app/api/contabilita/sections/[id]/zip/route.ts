import { NextRequest, NextResponse } from "next/server";
import {
  GENERIC_FAILURE,
  NO_STORE,
  jsonResponse,
  methodNotAllowed,
  parseId,
  readStoredFile,
  requireContabDownloader,
} from "@/lib/contab-api";
import { getSectionWithFiles, recordDownload } from "@/lib/contab-data";
import { contentDisposition } from "@/lib/contab-http";
import { CONTAB_ZIP_MAX_BYTES, zipEntryNames, zipFileName } from "@/lib/contab-zip";
import { buildZip } from "@/lib/zip-store";
import { logSafeError } from "@/lib/safe-log";

type Context = { params: Promise<{ id: string }> };

const TOO_BIG = `La sezione supera i ${CONTAB_ZIP_MAX_BYTES / (1024 * 1024)} MB: scarica i file uno alla volta.`;

// GET: every file of a section, decrypted, in one uncompressed ZIP named "<section title>.zip".
// Same permissions as a single download; the commercialista's download is logged once per file.
export async function GET(req: NextRequest, { params }: Context) {
  try {
    const access = await requireContabDownloader(req);
    if (!access.ok) return access.response;

    const sectionId = parseId((await params).id);
    const section = sectionId === null ? null : await getSectionWithFiles(sectionId);
    if (!section) return jsonResponse({ error: "Sezione non trovata." }, 404);
    if (section.files.length === 0) return jsonResponse({ error: "La sezione non contiene file." }, 404);

    // Cheap check on the recorded sizes first, so nothing is decrypted for a section that is certainly too big.
    const recorded = section.files.reduce((sum, file) => sum + file.sizeBytes, 0);
    if (recorded > CONTAB_ZIP_MAX_BYTES) return jsonResponse({ error: TOO_BIG }, 413);

    // Names are sanitized and made unique BEFORE buildZip, which writes names verbatim.
    const names = zipEntryNames(section.files.map(file => file.originalName));
    const entries: { name: string; data: Buffer; date: Date }[] = [];
    let total = 0;
    for (const [index, file] of section.files.entries()) {
      const read = await readStoredFile(file.storedName);
      if (!read.ok) {
        return read.missing
          ? jsonResponse({ error: "Un file della sezione non è più disponibile" }, 404)
          : jsonResponse({ error: GENERIC_FAILURE }, 500);
      }
      total += read.data.length;
      if (total > CONTAB_ZIP_MAX_BYTES) return jsonResponse({ error: TOO_BIG }, 413);
      entries.push({ name: names[index], data: read.data, date: file.uploadedAt });
    }
    const zip = buildZip(entries);

    // One download per file, only for the commercialista. A failure to log fails the request (audit trail).
    if (access.isAccountant) {
      for (const file of section.files) await recordDownload(file, access.user.username);
    }

    return new NextResponse(new Uint8Array(zip), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": contentDisposition(zipFileName(section.title)),
        "Content-Length": String(zip.length),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": NO_STORE,
      },
    });
  } catch (error) {
    logSafeError("Contab ZIP download failed", error);
    return jsonResponse({ error: GENERIC_FAILURE }, 500);
  }
}

// A HEAD request would otherwise run GET: it must not decrypt files or log downloads.
export function HEAD() {
  return methodNotAllowed("GET");
}
