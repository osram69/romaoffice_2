import { staffLogoutAction } from "@/lib/staff-actions";
import type { StaffRole } from "@/lib/staff-auth";

export function GestioneNav({ role, active, username }: { role: StaffRole; active: "tariffe" | "domiciliazioni"; username: string }) {
  const linkClass = (key: string) => `text-sm font-semibold px-3 py-1.5 rounded ${active === key ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-200"}`;
  return (
    <div className="flex items-center justify-between bg-white rounded-lg shadow p-3 mb-6">
      <nav className="flex items-center gap-2">
        <a href="/gestione-domiciliazioni-x9k2m7" className={linkClass("domiciliazioni")}>Domiciliazioni</a>
        {role === "admin" && <a href="/gestione-tariffe-x9k2m7" className={linkClass("tariffe")}>Tariffe</a>}
      </nav>
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <span>{username} · {role === "admin" ? "amministratore" : "operatore"}</span>
        <form action={staffLogoutAction}><button className="underline">Esci</button></form>
      </div>
    </div>
  );
}
