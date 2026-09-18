import type { ReactNode } from "react";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { domClients } from "@/db/schema";
import type { StaffRole } from "@/lib/staff-auth";
import { GestioneSidebar } from "./GestioneSidebar";

const STATO_TABS: { stato: number; label: string }[] = [
  { stato: 1, label: "Attive" },
  { stato: 0, label: "In Attivazione" },
  { stato: 2, label: "Decadute" },
  { stato: 3, label: "Sospese" },
];

async function statoCounts() {
  const rows = await db.select({ stato: domClients.stato, n: sql<number>`count(*)::int` }).from(domClients).groupBy(domClients.stato);
  const map = new Map(rows.map(r => [r.stato, r.n]));
  return STATO_TABS.map(tab => ({ ...tab, count: map.get(tab.stato) ?? 0 }));
}

export async function GestioneShell({ role, active, username, children }: { role: StaffRole; active: "tariffe" | "domiciliazioni"; username: string; children: ReactNode }) {
  const tabs = await statoCounts();
  return (
    <div className="gestione-shell">
      <GestioneSidebar role={role} active={active} username={username} tabs={tabs} />
      <main className="gestione-main">{children}</main>
    </div>
  );
}
