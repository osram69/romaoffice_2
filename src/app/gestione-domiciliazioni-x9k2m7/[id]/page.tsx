import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { domClients } from "@/db/schema";
import { STAFF_SESSION_COOKIE, getStaffUser } from "@/lib/staff-auth";
import { GestioneShell } from "@/components/GestioneNav";
import { cleanText } from "@/lib/dom-status";

const STATI: Record<number, string> = { [-1]: "Vuota", 0: "In Attivazione", 1: "Attiva", 2: "Decaduta", 3: "Sospesa" };
const TIPOLOGIE: Record<number, string> = { 0: "Legale", 1: "Postale", 2: "Professionale", 3: "Avvocato" };

function fmtDate(value: string | null) {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}
type Field = [string, string | number | null | undefined];
function cell(value: Field[1]) {
  return value === null || value === undefined || value === "" ? "—" : value;
}
function pairedRows(fields: Field[]) {
  const rows = [];
  for (let i = 0; i < fields.length; i += 2) {
    const [label1, value1] = fields[i];
    const second = fields[i + 1];
    rows.push(
      <tr key={label1}>
        <th>{label1}</th><td>{cell(value1)}</td>
        {second ? <><th>{second[0]}</th><td>{cell(second[1])}</td></> : <><th /><td /></>}
      </tr>
    );
  }
  return rows;
}

export default async function SchedaSocietaPage({ params }: { params: Promise<{ id: string }> }) {
  const store = await cookies();
  const user = await getStaffUser(store.get(STAFF_SESSION_COOKIE)?.value);
  if (!user) redirect("/gestione-tariffe-x9k2m7/login?next=/gestione-domiciliazioni-x9k2m7");

  const { id } = await params;
  const [client] = await db.select().from(domClients).where(eq(domClients.id, Number(id))).limit(1);
  if (!client) notFound();

  return (
    <GestioneShell role={user.role} active="domiciliazioni" username={user.username}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 className="gestione-h1">{client.ragioneSociale}</h1>
        <Link href={`/gestione-domiciliazioni-x9k2m7/${client.id}/modifica`} className="gestione-btn gestione-btn-blue">
          <Pencil size={14} /> Modifica
        </Link>
      </div>

      <div className="gestione-card" style={{ overflowX: "auto", padding: 4 }}>
        <table className="gestione-scheda-table gestione-scheda-table-paired">
          <tbody>
            {pairedRows([
              ["Stato", STATI[client.stato ?? -1]],
              ["Tipologia", TIPOLOGIE[client.tipologia]],
              ["Email", client.emailPosta],
              ["Email PEC", client.emailPec],
              ["Amministratore", cleanText(client.amministratore)],
              ["Telefono amministratore", cleanText(client.telefonoAmm)],
              ["Persona di riferimento", cleanText(client.personaRif)],
              ["Telefono", cleanText(client.telefono)],
              ["Telefono urgenze", cleanText(client.telefonoUrg)],
              ["Raccoglitore", client.raccoglitore],
              ["Inizio domiciliazione", fmtDate(client.inizioDom)],
              ["Scadenza domiciliazione", fmtDate(client.scadenzaDom)],
              ["Scadenza pagamento", fmtDate(client.scadenzaPagamento)],
              ["Prezzo rinnovo", client.prezzoRinnovo !== null ? `${client.prezzoRinnovo} €` : null],
              ["Indirizzo spedizione posta", cleanText(client.indSpedPosta)],
              ["Note", cleanText(client.note)],
              ["Contratto firmato", client.contrFirmato ? "Sì" : "No"],
              ["Controfirmato inviato", client.controfirmatoInviato ? "Sì" : "No"],
              ["Modulo", client.moduloCont ? "Sì" : "No"],
              ["Doc. amministratore", client.docAmmPres ? "Sì" : "No"],
              ["Allegato 1", client.allegato1Pres ? "Sì" : "No"],
              ["Visura", client.visuraPres ? "Sì" : "No"],
            ])}
          </tbody>
        </table>
      </div>
    </GestioneShell>
  );
}
