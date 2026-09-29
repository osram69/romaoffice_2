import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { domMailScans } from "@/db/schema";
import { STAFF_SESSION_COOKIE, getStaffUser } from "@/lib/staff-auth";
import { readMailScanDecrypted, removeMailScanEncrypted, saveMailScanEncrypted } from "@/lib/dom-archive";

const BASE_PATH = "/gestione-domiciliazioni-x9k2m7";

export async function GET(req: NextRequest) {
  const user = await getStaffUser(req.cookies.get(STAFF_SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const [row] = await db.select({ id: domMailScans.id }).from(domMailScans).where(eq(domMailScans.id, id)).limit(1);
  if (!row) return NextResponse.json({ error: "not-found" }, { status: 404 });

  try {
    const pdf = await readMailScanDecrypted(id);
    return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="posta_${id}.pdf"`, "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }
}

// Persists the "Allega" scan panel's merged PDF (see DomMailScanPanel.tsx's confirmUpload). A
// plain POST body, not a Server Action argument, on purpose: passing the merged PDF as a base64
// string through a Server Action tripped a React Flight "Maximum array nesting exceeded" guard on
// multi-page scans, even at a couple MB — a raw HTTP body never goes through RSC serialization.
//
// A client has at most one pending scan at a time: attaching a new one (e.g. because the first
// scan came out wrong) REPLACES it rather than accumulating a second one, matching the legacy
// tool's single scansione.pdf temp file.
export async function POST(req: NextRequest) {
  const user = await getStaffUser(req.cookies.get(STAFF_SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ success: false, message: "unauthorized" }, { status: 401 });

  const domClientId = Number(req.nextUrl.searchParams.get("clientId"));
  if (!domClientId) return NextResponse.json({ success: false, message: "Parametro clientId mancante" }, { status: 400 });

  const buffer = Buffer.from(await req.arrayBuffer());
  if (!buffer.length) return NextResponse.json({ success: false, message: "Nessun PDF ricevuto dallo scanner" }, { status: 400 });
  if (buffer.subarray(0, 4).toString("ascii") !== "%PDF") return NextResponse.json({ success: false, message: "Il file ricevuto non è un PDF valido" }, { status: 400 });

  try {
    const previous = await db.select({ id: domMailScans.id }).from(domMailScans).where(eq(domMailScans.domClientId, domClientId));
    for (const p of previous) await removeMailScanEncrypted(p.id);
    if (previous.length) await db.delete(domMailScans).where(eq(domMailScans.domClientId, domClientId));

    const [row] = await db.insert(domMailScans).values({ domClientId, scannedByUsername: user.username }).returning();
    await saveMailScanEncrypted(row.id, buffer);
    revalidatePath(BASE_PATH);
    return NextResponse.json({ success: true, scan: { id: row.id, createdAt: row.createdAt.toISOString(), scannedBy: row.scannedByUsername } });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Errore durante il salvataggio della scansione" }, { status: 500 });
  }
}
