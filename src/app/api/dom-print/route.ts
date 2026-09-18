import { NextRequest, NextResponse } from "next/server";
import { STAFF_SESSION_COOKIE, getStaffUser } from "@/lib/staff-auth";
import { printListaCompleta, printRaccoglitori } from "@/lib/dom-print";

export async function GET(req: NextRequest) {
  const user = await getStaffUser(req.cookies.get(STAFF_SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const kind = req.nextUrl.searchParams.get("kind");
  try {
    if (kind === "lista") {
      const bytes = await printListaCompleta();
      return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="lista-domiciliazioni.pdf"' } });
    }
    if (kind === "raccoglitori") {
      const raccoglitore = Number(req.nextUrl.searchParams.get("raccoglitore") ?? 0);
      const bytes = await printRaccoglitori(raccoglitore);
      return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="raccoglitori-${raccoglitore}.pdf"` } });
    }
    return NextResponse.json({ error: "invalid kind" }, { status: 400 });
  } catch (error) {
    console.error("dom-print failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "generation-failed" }, { status: 500 });
  }
}
