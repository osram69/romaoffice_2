import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { domClients } from "@/db/schema";
import { STAFF_SESSION_COOKIE, getStaffUser } from "@/lib/staff-auth";
import { GestioneNav } from "@/components/GestioneNav";

const TABS: { stato: number; label: string }[] = [
  { stato: 1, label: "Attive" },
  { stato: 0, label: "In Attivazione" },
  { stato: 2, label: "Decadute" },
  { stato: 3, label: "Sospese" },
];

function fmtDate(value: string | null) {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

export default async function DomiciliazioniPage({ searchParams }: { searchParams: Promise<{ stato?: string }> }) {
  const store = await cookies();
  const user = await getStaffUser(store.get(STAFF_SESSION_COOKIE)?.value);
  if (!user) redirect("/gestione-tariffe-x9k2m7/login?next=/gestione-domiciliazioni-x9k2m7");

  const { stato: statoParam } = await searchParams;
  const stato = statoParam !== undefined ? Number(statoParam) : 1;

  const rows = await db.select().from(domClients).where(eq(domClients.stato, stato)).orderBy(asc(domClients.scadenzaDom));

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <GestioneNav role={user.role} active="domiciliazioni" username={user.username} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Domiciliazioni</h1>
        <Link href="/gestione-domiciliazioni-x9k2m7/nuovo" className="bg-slate-800 text-white rounded px-3 py-1.5 text-sm font-semibold hover:bg-slate-700">
          + Nuova domiciliazione
        </Link>
      </div>

      <div className="flex gap-2">
        {TABS.map(tab => (
          <Link key={tab.stato} href={`/gestione-domiciliazioni-x9k2m7?stato=${tab.stato}`}
            className={`text-sm font-semibold px-3 py-1.5 rounded ${stato === tab.stato ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-200"}`}>
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 uppercase border-b border-slate-200">
              <th className="py-2 px-3">N°</th>
              <th className="py-2 px-3">Ragione Sociale</th>
              <th className="py-2 px-3">Email</th>
              <th className="py-2 px-3">Email PEC</th>
              <th className="py-2 px-3">Telefono</th>
              <th className="py-2 px-3">Persona Rif.</th>
              <th className="py-2 px-3">Scadenza</th>
              <th className="py-2 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-2 px-3 text-slate-500">{row.id}</td>
                <td className="py-2 px-3 font-medium">{row.ragioneSociale}</td>
                <td className="py-2 px-3">{row.emailPosta}</td>
                <td className="py-2 px-3">{row.emailPec}</td>
                <td className="py-2 px-3">{row.telefono}</td>
                <td className="py-2 px-3">{row.personaRif}</td>
                <td className="py-2 px-3">{fmtDate(row.scadenzaDom)}</td>
                <td className="py-2 px-3">
                  <Link href={`/gestione-domiciliazioni-x9k2m7/${row.id}`} className="text-slate-700 underline text-xs font-semibold">Modifica</Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-slate-400">Nessuna domiciliazione in questo stato.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
