import type { ReactNode } from "react";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { domClients } from "@/db/schema";
import type { StaffRole } from "@/lib/staff-auth";
import { GestioneSidebar } from "./GestioneSidebar";
import { createDomiciliazioneAction } from "@/app/gestione-domiciliazioni-x9k2m7/actions";

const STATO_TABS: { stato: number; label: string }[] = [
  { stato: 1, label: "Attive" },
  { stato: 0, label: "In Attivazione" },
  { stato: 2, label: "Decadute" },
];

async function statoCounts() {
  const rows = await db.select({ stato: domClients.stato, n: sql<number>`count(*)::int` }).from(domClients).groupBy(domClients.stato);
  const map = new Map(rows.map(r => [r.stato, r.n]));
  return STATO_TABS.map(tab => ({ ...tab, count: map.get(tab.stato) ?? 0 }));
}

export async function GestioneShell({ role, active, username, children }: { role: StaffRole; active: "tariffe" | "domiciliazioni" | "configurazione" | "ordini"; username: string; children: ReactNode }) {
  const tabs = await statoCounts();
  // Active companies, for the "società capofila" dropdown of the new/edit domiciliazione form.
  const capofile = active === "domiciliazioni" ? await db.select({ id: domClients.id, ragioneSociale: domClients.ragioneSociale }).from(domClients).where(eq(domClients.stato, 1)).orderBy(asc(domClients.ragioneSociale)) : [];
  return (
    <div className="gestione-shell">
      <GestioneSidebar role={role} active={active} username={username} tabs={tabs} newDomiciliazioneAction={active === "domiciliazioni" ? createDomiciliazioneAction : undefined} capofile={capofile} />
      <main className="gestione-main">{children}</main>
    </div>
  );
}
