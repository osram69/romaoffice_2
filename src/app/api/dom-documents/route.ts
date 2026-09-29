import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { domClients } from "@/db/schema";
import { STAFF_SESSION_COOKIE, getStaffUser } from "@/lib/staff-auth";
import { DOC_TYPES, readDecrypted, type DocType } from "@/lib/dom-archive";

export async function GET(req: NextRequest) {
  const user = await getStaffUser(req.cookies.get(STAFF_SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = Number(req.nextUrl.searchParams.get("id"));
  const docType = req.nextUrl.searchParams.get("type") as DocType | null;
  if (!id || !docType || !DOC_TYPES.includes(docType)) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const [row] = await db.select({ legacyId: domClients.legacyId }).from(domClients).where(eq(domClients.id, id)).limit(1);
  if (!row) return NextResponse.json({ error: "not-found" }, { status: 404 });

  try {
    const pdf = await readDecrypted(row.legacyId ?? id, docType);
    return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${row.legacyId ?? id}_${docType}.pdf"`, "Cache-Control": "private, no-store" } });
  } catch (error) {
    // Route is staff-authenticated above, so the real reason (missing/misconfigured
    // DOM_ARCHIVE_DIR, wrong file name, bad decryption key) is safe to surface here — it's what
    // makes a broken archive path debuggable instead of a bare "not-found" for every failure mode.
    const message = error instanceof Error ? error.message : String(error);
    console.error(`dom-documents lookup failed for id=${id} type=${docType} fileId=${row.legacyId ?? id}:`, message);
    return NextResponse.json({ error: "not-found", detail: message, fileId: row.legacyId ?? id }, { status: 404 });
  }
}
