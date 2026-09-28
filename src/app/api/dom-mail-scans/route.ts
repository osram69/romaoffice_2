import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { domMailScans } from "@/db/schema";
import { STAFF_SESSION_COOKIE, getStaffUser } from "@/lib/staff-auth";
import { readMailScanDecrypted } from "@/lib/dom-archive";

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
