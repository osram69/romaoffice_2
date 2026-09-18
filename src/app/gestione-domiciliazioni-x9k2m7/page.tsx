import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { domClients } from "@/db/schema";
import { STAFF_SESSION_COOKIE, getStaffUser } from "@/lib/staff-auth";
import { GestioneShell } from "@/components/GestioneNav";

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
    <GestioneShell role={user.role} active="domiciliazioni" username={user.username}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 className="gestione-h1">Domiciliazioni</h1>
        <Link href="/gestione-domiciliazioni-x9k2m7/nuovo" className="gestione-btn gestione-btn-blue">+ Nuova domiciliazione</Link>
      </div>

      <div className="gestione-tabs" style={{ marginBottom: 16 }}>
        {TABS.map(tab => (
          <Link key={tab.stato} href={`/gestione-domiciliazioni-x9k2m7?stato=${tab.stato}`} className={`gestione-tab${stato === tab.stato ? " active" : ""}`}>
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="gestione-card" style={{ overflowX: "auto" }}>
        <table className="gestione-table">
          <thead>
            <tr>
              <th>N°</th><th>Ragione Sociale</th><th>Email</th><th>Email PEC</th><th>Telefono</th><th>Persona Rif.</th><th>Scadenza</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id}>
                <td style={{ color: "#999" }}>{row.id}</td>
                <td style={{ fontWeight: 600 }}>{row.ragioneSociale}</td>
                <td>{row.emailPosta}</td>
                <td>{row.emailPec}</td>
                <td>{row.telefono}</td>
                <td>{row.personaRif}</td>
                <td>{fmtDate(row.scadenzaDom)}</td>
                <td>
                  <Link href={`/gestione-domiciliazioni-x9k2m7/${row.id}`} style={{ color: "#007bff", fontWeight: 600, fontSize: 12, textDecoration: "underline" }}>Modifica</Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", color: "#999", padding: 24 }}>Nessuna domiciliazione in questo stato.</td></tr>}
          </tbody>
        </table>
      </div>
    </GestioneShell>
  );
}
