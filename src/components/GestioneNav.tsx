import type { ReactNode } from "react";
import { sql } from "drizzle-orm";
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

export async function GestioneShell({ role, active, username, children }: { role: StaffRole; active: "tariffe" | "domiciliazioni" | "configurazione"; username: string; children: ReactNode }) {
  const tabs = await statoCounts();
  return (
    <div className="gestione-shell">
      <GestioneSidebar role={role} active={active} username={username} tabs={tabs} newDomiciliazioneAction={active === "domiciliazioni" ? createDomiciliazioneAction : undefined} />
      <main className="gestione-main">{children}</main>
    </div>
  );
}
