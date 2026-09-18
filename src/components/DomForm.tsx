"use client";
import { useState } from "react";
import type { InferSelectModel } from "drizzle-orm";
import type { domClients } from "@/db/schema";
import { cleanText } from "@/lib/dom-status";

type DomClient = InferSelectModel<typeof domClients>;

const SEDI = [
  { value: 0, label: "San Martino" },
  { value: 1, label: "XX Settembre" },
];
const TIPOLOGIE = [
  { value: 0, label: "Legale" },
  { value: 1, label: "Postale" },
  { value: 2, label: "Professionale" },
  { value: 3, label: "Avvocato" },
];
const STATI = [
  { value: 0, label: "In Attivazione" },
  { value: 1, label: "Attiva" },
  { value: 2, label: "Decaduta" },
  { value: 3, label: "Sospesa" },
  { value: -1, label: "Vuota" },
];

export function DomForm({ client, action, deleteAction, onClose }: { client?: DomClient; action: (formData: FormData) => void; deleteAction?: (formData: FormData) => void; onClose?: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const row = (left: React.ReactNode, right?: React.ReactNode) => (
    <tr>{left}{right ?? <><th /><td /></>}</tr>
  );
  const field = (label: string, input: React.ReactNode) => (
    <>
      <th>{label}</th>
      <td>{input}</td>
    </>
  );
  const text = (name: string, defaultValue?: string | null) => (
    <input name={name} defaultValue={cleanText(defaultValue)} />
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <form action={action}>
        {client && <input type="hidden" name="id" value={client.id} />}
        <table className="gestione-scheda-table gestione-scheda-table-paired gestione-scheda-table-edit">
          <tbody>
            {row(field("Ragione Sociale *", <input name="ragioneSociale" required defaultValue={client?.ragioneSociale ?? ""} />))}
            {row(
              field("Email", text("emailPosta", client?.emailPosta)),
              field("Email PEC", text("emailPec", client?.emailPec))
            )}
            {row(
              field("Amministratore", text("amministratore", client?.amministratore)),
              field("Telefono amministratore", text("telefonoAmm", client?.telefonoAmm))
            )}
            {row(
              field("Persona di riferimento", text("personaRif", client?.personaRif)),
              field("Telefono", text("telefono", client?.telefono))
            )}
            {row(
              field("Telefono urgenze", text("telefonoUrg", client?.telefonoUrg)),
              field("Sede", (
                <select name="sede" defaultValue={client?.sede ?? 1}>
                  {SEDI.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              ))
            )}
            {row(
              field("Tipologia", (
                <select name="tipologia" defaultValue={client?.tipologia ?? 0}>
                  {TIPOLOGIE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              )),
              field("Stato", (
                <select name="stato" defaultValue={client?.stato ?? 1}>
                  {STATI.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              ))
            )}
            {row(
              field("Inizio domiciliazione", <input name="inizioDom" type="date" defaultValue={client?.inizioDom ?? ""} />),
              field("Scadenza domiciliazione", <input name="scadenzaDom" type="date" defaultValue={client?.scadenzaDom ?? ""} />)
            )}
            {row(
              field("Scadenza pagamento", <input name="scadenzaPagamento" type="date" defaultValue={client?.scadenzaPagamento ?? ""} />),
              field("Prezzo rinnovo (€)", <input name="prezzoRinnovo" type="number" step="1" defaultValue={client?.prezzoRinnovo ?? ""} />)
            )}
            {row(
              field("Raccoglitore", <input name="raccoglitore" type="number" defaultValue={client?.raccoglitore ?? 0} />),
              field("Indirizzo spedizione posta", text("indSpedPosta", client?.indSpedPosta))
            )}
            {row(field("Note", <textarea name="note" rows={2} defaultValue={cleanText(client?.note)} />))}
            {row(
              field("Contratto firmato", <input type="checkbox" name="contrFirmato" defaultChecked={!!client?.contrFirmato} />),
              field("Controfirmato inviato", <input type="checkbox" name="controfirmatoInviato" defaultChecked={!!client?.controfirmatoInviato} />)
            )}
            {row(
              field("Modulo presente", <input type="checkbox" name="moduloCont" defaultChecked={!!client?.moduloCont} />),
              field("Doc. amministratore presente", <input type="checkbox" name="docAmmPres" defaultChecked={!!client?.docAmmPres} />)
            )}
            {row(
              field("Allegato 1 presente", <input type="checkbox" name="allegato1Pres" defaultChecked={!!client?.allegato1Pres} />),
              field("Visura presente", <input type="checkbox" name="visuraPres" defaultChecked={!!client?.visuraPres} />)
            )}
          </tbody>
        </table>

        {client && (
          <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#232f3e", marginBottom: 8 }}>Carica/aggiorna documenti PDF (i file saranno criptati AES-256):</p>
            <div className="dom-upload-grid">
              {[
                ["Contratto completo PDF", "con"],
                ["Modulo tenuta libri contabili", "mod"],
                ["Allegato (mail e contatti)", "all"],
                ["Doc. amministratore", "doc"],
                ["Adeguata verifica clientela", "avc"],
                ["Revoca", "rev"],
              ].map(([label, code]) => (
                <div key={code} className="dom-upload-row">
                  <span>{label}</span>
                  <input type="file" accept="application/pdf" disabled title="Non ancora disponibile: serve prima configurare lo spazio di archiviazione." />
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: "#999", marginTop: 6 }}>Caricamento non ancora attivo: va prima deciso e configurato dove conservare i file cifrati.</p>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button type="submit" className="gestione-btn gestione-btn-blue" style={{ padding: "9px 20px" }}>
            {client ? "Salva modifiche" : "Crea domiciliazione"}
          </button>
          {onClose && <button type="button" onClick={onClose} className="gestione-btn gestione-btn-outline" style={{ padding: "9px 20px" }}>Chiudi</button>}
        </div>
      </form>

      {client && deleteAction && (
        <form action={deleteAction} className="gestione-card" style={{ padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <input type="hidden" name="id" value={client.id} />
          <p style={{ fontSize: 13, color: "#666", margin: 0 }}>Eliminazione permanente del record.</p>
          {confirmDelete ? (
            <button type="submit" className="gestione-btn gestione-btn-red">Conferma eliminazione</button>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} style={{ color: "#dc3545", textDecoration: "underline", fontSize: 13, fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>Elimina domiciliazione</button>
          )}
        </form>
      )}

      <style>{`
        .dom-upload-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .dom-upload-row { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #444; background: #f8f8f8; border: 1px solid #eee; border-radius: 4px; padding: 8px 10px; }
        .dom-upload-row input[type="file"] { font-size: 11px; }
        @media (max-width: 640px) { .dom-upload-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
