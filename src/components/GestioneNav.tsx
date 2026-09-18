import type { ReactNode } from "react";
import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { domClients } from "@/db/schema";
import { staffLogoutAction } from "@/lib/staff-actions";
import type { StaffRole } from "@/lib/staff-auth";

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
      <aside className="gestione-sidebar">
        <div className="sidebar-header">Gestione ROS</div>
        <div className="sidebar-user">{username} · {role === "admin" ? "amministratore" : "operatore"}</div>
        <ul>
          <li className={active === "domiciliazioni" ? "active" : ""}>
            <Link href="/gestione-domiciliazioni-x9k2m7">Domiciliazioni</Link>
          </li>
          {tabs.map(tab => (
            <li key={tab.stato}>
              <Link href={`/gestione-domiciliazioni-x9k2m7?stato=${tab.stato}`}>
                {tab.label} <span className="gestione-badge">{tab.count}</span>
              </Link>
            </li>
          ))}
          {role === "admin" && (
            <li className={active === "tariffe" ? "active" : ""} style={{ borderTop: "2px solid #444" }}>
              <Link href="/gestione-tariffe-x9k2m7">Tariffe e Offerte</Link>
            </li>
          )}
          <li><form action={staffLogoutAction}><button type="submit" className="sidebar-link">Esci</button></form></li>
        </ul>
      </aside>
      <main className="gestione-main">{children}</main>
    </div>
  );
}
