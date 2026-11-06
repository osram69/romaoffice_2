import { NextRequest } from "next/server";
import { CONTAB_MAX_BYTES, validateContabUpload } from "@/lib/contab-files";
import { GENERIC_FAILURE, jsonResponse, parseId, requireContabAdmin } from "@/lib/contab-api";
import { addFileRow, getSection } from "@/lib/contab-data";
import { decodeQueryValue, rawQueryParam, readBodyLimited } from "@/lib/contab-http";
import { newStoredName, removeContabFile, saveContabFile } from "@/lib/contab-storage";
import { storeUpload } from "@/lib/contab-upload";
import { logSafeError } from "@/lib/safe-log";

// Upload of one accounting file: POST /api/contabilita/files?sectionId=<n>&name=<encodeURIComponent(name)>
// with the file as the raw request body (not a Server Action, like api/dom-mail-scans). Admin with a valid
// second-password unlock only. The file is encrypted and written first, then the row is added; if the row
// cannot be added the file is removed again.

function fail(message: string, status: number) {
  return jsonResponse({ success: false, message }, status);
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireContabAdmin(req);
    if (!access.ok) return access.response;

    const sectionId = parseId(req.nextUrl.searchParams.get("sectionId"));
    if (sectionId === null) return fail("Sezione non valida.", 400);

    // The name is read from the raw query and decoded exactly once; a malformed sequence is a 400.
    const rawName = rawQueryParam(req.nextUrl.search, "name");
    const name = rawName === null ? null : decodeQueryValue(rawName);
    if (rawName === null || rawName === "") return fail("Nome del file mancante.", 400);
    if (name === null) return fail("Nome del file non valido.", 400);

    // Refuse by the declared size before reading a single byte of the body.
    const declared = req.headers.get("content-length");
    if (declared !== null) {
      if (!/^[0-9]{1,15}$/.test(declared)) return fail("Intestazione Content-Length non valida.", 400);
      if (Number(declared) > CONTAB_MAX_BYTES) return fail(tooBigMessage(), 413);
    }

    if (!(await getSection(sectionId))) return fail("Sezione non trovata.", 404);

    // ...and again by the bytes actually received (chunked bodies, or a lying Content-Length).
    const data = await readBodyLimited(req.body, CONTAB_MAX_BYTES);
    if (data === null) return fail(tooBigMessage(), 413);

    const checked = validateContabUpload(name, data);
    if (!checked.ok) return fail(checked.message, 400);

    // Write first, then the row; if the row cannot be added the file is removed again (storeUpload).
    let uploadedAt = new Date();
    const { id } = await storeUpload(
      {
        newName: newStoredName,
        save: saveContabFile,
        remove: removeContabFile,
        add: async storedName => {
          const created = await addFileRow({
            sectionId,
            originalName: checked.name,
            mime: checked.mime,
            sizeBytes: data.length,
            storedName,
            uploadedBy: access.user.username,
          });
          uploadedAt = created.uploadedAt;
          return created.id;
        },
      },
      data,
      logSafeError,
    );

    // The response carries only id, name, size and date: never the stored name or any path.
    return jsonResponse({
      success: true,
      file: { id, originalName: checked.name, sizeBytes: data.length, uploadedAt: uploadedAt.toISOString() },
    });
  } catch (error) {
    logSafeError("Contab upload failed", error);
    return fail(GENERIC_FAILURE, 500);
  }
}

function tooBigMessage() {
  return `Il file è troppo grande. Dimensione massima: ${CONTAB_MAX_BYTES / (1024 * 1024)} MB.`;
}
