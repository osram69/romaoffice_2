import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { domClients, domMailScans } from "@/db/schema";
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
  // Drives which rows show Invia/PEC/Aperta as enabled ("dimmed" otherwise, matching the legacy
  // tool): a client has a pending mail scan once Allega has been used and until it's sent/discarded.
  const attive = await db.select({ id: domClients.id, ragioneSociale: domClients.ragioneSociale }).from(domClients).where(eq(domClients.stato, 1)).orderBy(asc(domClients.ragioneSociale));
  // How many (non-decaduta) aggiuntive depend on each company: the ones with a count are shown as "società capofila" on hover.
  const dependents = await db.select({ id: domClients.capofilaId, n: sql<number>`count(*)::int` }).from(domClients)
    .where(and(eq(domClients.aggiuntiva, true), isNotNull(domClients.capofilaId), inArray(domClients.stato, [0, 1]))).groupBy(domClients.capofilaId);
  const pendingScans = await db.selectDistinct({ domClientId: domMailScans.domClientId }).from(domMailScans);

  return (
    <GestioneShell role={user.role} active="domiciliazioni" username={user.username}>
      <h1 className="gestione-h1" style={{ textAlign: "center", marginBottom: 24 }}>Elenco Domiciliazioni {LABELS[stato] ?? ""}</h1>
      <DomiciliazioniTable rows={rows} stato={stato} pendingScanIds={pendingScans.map(p => p.domClientId)} capofile={attive} aggiuntiveCount={Object.fromEntries(dependents.filter(d => d.id !== null).map(d => [d.id as number, d.n]))} />
    </GestioneShell>
  );
}
