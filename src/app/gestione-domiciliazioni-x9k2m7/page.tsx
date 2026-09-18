import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { domClients } from "@/db/schema";
import { STAFF_SESSION_COOKIE, getStaffUser } from "@/lib/staff-auth";
import { GestioneShell } from "@/components/GestioneNav";
import { DomiciliazioniTable } from "@/components/DomiciliazioniTable";

const LABELS: Record<number, string> = { 1: "Attive", 0: "In Attivazione", 2: "Decadute", 3: "Sospese" };

export default async function DomiciliazioniPage({ searchParams }: { searchParams: Promise<{ stato?: string }> }) {
  const store = await cookies();
  const user = await getStaffUser(store.get(STAFF_SESSION_COOKIE)?.value);
  if (!user) redirect("/gestione-tariffe-x9k2m7/login?next=/gestione-domiciliazioni-x9k2m7");

  const { stato: statoParam } = await searchParams;
  const stato = statoParam !== undefined ? Number(statoParam) : 1;

  const rows = await db.select().from(domClients).where(eq(domClients.stato, stato)).orderBy(asc(domClients.ragioneSociale));

  return (
    <GestioneShell role={user.role} active="domiciliazioni" username={user.username}>
      <h1 className="gestione-h1" style={{ textAlign: "center", marginBottom: 24 }}>Elenco Domiciliazioni {LABELS[stato] ?? ""}</h1>
      <DomiciliazioniTable rows={rows} />
    </GestioneShell>
  );
}
