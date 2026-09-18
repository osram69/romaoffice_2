import { Fragment } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { domClients } from "@/db/schema";
import { STAFF_SESSION_COOKIE, getStaffUser } from "@/lib/staff-auth";
import { GestioneShell } from "@/components/GestioneNav";
import { DeleteIconButton } from "@/components/DeleteIconButton";
import { cleanText, docStatus } from "@/lib/dom-status";
import { deleteDomiciliazioneAction } from "./actions";

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

function letterOf(name: string) {
  const ch = name.trim().charAt(0).toUpperCase();
  return /[0-9]/.test(ch) ? "#" : ch || "#";
}

export default async function DomiciliazioniPage({ searchParams }: { searchParams: Promise<{ stato?: string }> }) {
  const store = await cookies();
  const user = await getStaffUser(store.get(STAFF_SESSION_COOKIE)?.value);
  if (!user) redirect("/gestione-tariffe-x9k2m7/login?next=/gestione-domiciliazioni-x9k2m7");

  const { stato: statoParam } = await searchParams;
  const stato = statoParam !== undefined ? Number(statoParam) : 1;

  const rows = await db.select().from(domClients).where(eq(domClients.stato, stato)).orderBy(asc(domClients.ragioneSociale));

  let lastLetter = "";

  return (
    <GestioneShell role={user.role} active="domiciliazioni" username={user.username}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 className="gestione-h1" style={{ textAlign: "center", flex: 1 }}>Elenco Domiciliazioni {TABS.find(t => t.stato === stato)?.label ?? ""}</h1>
        <Link href="/gestione-domiciliazioni-x9k2m7/nuovo" className="gestione-btn gestione-btn-blue">+ Nuova</Link>
      </div>

      <div className="gestione-tabs" style={{ marginBottom: 16, justifyContent: "center", display: "flex" }}>
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
              <th>N°</th><th>Doc</th><th>Racc.</th><th>Ragione Sociale</th><th>Email</th><th>Email PEC</th><th>Telefono</th><th>Persona Rif.</th><th>Scadenza</th><th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const letter = letterOf(row.ragioneSociale);
              const showDivider = letter !== lastLetter;
              lastLetter = letter;
              return (
                <Fragment key={row.id}>
                  {showDivider && <tr className="gestione-letter-row"><td colSpan={10}>{letter}</td></tr>}
                  <tr>
                    <td style={{ color: "#999" }}>{index + 1}</td>
                    <td><span className={`gestione-doc-dot ${docStatus(row)}`} title="Stato documenti" /></td>
                    <td>{row.raccoglitore || ""}</td>
                    <td><Link href={`/gestione-domiciliazioni-x9k2m7/${row.id}`} className="gestione-ragione-link">{row.ragioneSociale}</Link></td>
                    <td>{row.emailPosta}</td>
                    <td>{row.emailPec}</td>
                    <td>{cleanText(row.telefono)}</td>
                    <td>{cleanText(row.personaRif)}</td>
                    <td>{fmtDate(row.scadenzaDom)}</td>
                    <td>
                      <div className="gestione-row-actions">
                        <Link href={`/gestione-domiciliazioni-x9k2m7/${row.id}/modifica`} className="gestione-icon-btn edit" aria-label={`Modifica ${row.ragioneSociale}`} title="Modifica">
                          <Pencil size={14} />
                        </Link>
                        <DeleteIconButton id={row.id} action={deleteDomiciliazioneAction} label={row.ragioneSociale} />
                      </div>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={10} style={{ textAlign: "center", color: "#999", padding: 24 }}>Nessuna domiciliazione in questo stato.</td></tr>}
          </tbody>
        </table>
      </div>
    </GestioneShell>
  );
}
