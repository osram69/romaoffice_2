"use client";
import { Fragment, useState } from "react";
import { Pencil } from "lucide-react";
import type { InferSelectModel } from "drizzle-orm";
import type { domClients } from "@/db/schema";
import { cleanText, docStatus } from "@/lib/dom-status";
import { DomForm } from "./DomForm";
import { DeleteIconButton } from "./DeleteIconButton";
import { updateDomiciliazioneAction, deleteDomiciliazioneAction } from "@/app/gestione-domiciliazioni-x9k2m7/actions";

type DomClient = InferSelectModel<typeof domClients>;

const STATI: Record<number, string> = { [-1]: "Vuota", 0: "In Attivazione", 1: "Attiva", 2: "Decaduta", 3: "Sospesa" };
const TIPOLOGIE: Record<number, string> = { 0: "Legale", 1: "Postale", 2: "Professionale", 3: "Avvocato" };

function fmtDate(value: string | null) {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}
function letterOf(name: string) {
  const ch = name.trim().charAt(0).toUpperCase();
  return /[0-9]/.test(ch) ? "#" : ch || "#";
}
function notYet() { alert("Funzione non ancora disponibile."); }

type Field = [string, string | number | null | undefined];
function cell(value: Field[1]) {
  return value === null || value === undefined || value === "" ? "—" : value;
}
function pairedRows(fields: Field[]) {
  const out = [];
  for (let i = 0; i < fields.length; i += 2) {
    const [label1, value1] = fields[i];
    const second = fields[i + 1];
    out.push(
      <tr key={label1}>
        <th>{label1}</th><td>{cell(value1)}</td>
        {second ? <><th>{second[0]}</th><td>{cell(second[1])}</td></> : <><th /><td /></>}
      </tr>
    );
  }
  return out;
}

export function DomiciliazioniTable({ rows }: { rows: DomClient[] }) {
  const [viewing, setViewing] = useState<DomClient | null>(null);
  const [editing, setEditing] = useState<DomClient | null>(null);
  let lastLetter = "";

  return (
    <>
      <div className="gestione-card" style={{ overflowX: "auto" }}>
        <table className="gestione-table dom-list-table">
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
                  <tr className={index % 2 === 0 ? "row-even" : "row-odd"}>
                    <td style={{ color: "#999" }}>{index + 1}</td>
                    <td><span className={`gestione-doc-dot ${docStatus(row)}`} title="Stato documenti" /></td>
                    <td>{row.raccoglitore}</td>
                    <td style={{ maxWidth: 220 }}>
                      <button type="button" className="gestione-ragione-link gestione-ragione-name" title={row.ragioneSociale} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, font: "inherit", textAlign: "left" }} onClick={() => setViewing(row)}>
                        {row.ragioneSociale}
                      </button>
                    </td>
                    <td>{row.emailPosta}</td>
                    <td>{row.emailPec}</td>
                    <td>{cleanText(row.telefono)}</td>
                    <td>{cleanText(row.personaRif)}</td>
                    <td>{fmtDate(row.scadenzaDom)}</td>
                    <td>
                      <div className="gestione-row-actions">
                        <button type="button" className="gestione-action-btn gestione-action-allega" onClick={notYet}>Allega</button>
                        <button type="button" className="gestione-action-btn gestione-action-invia" onClick={notYet}>Invia</button>
                        <button type="button" className="gestione-action-btn gestione-action-pec" onClick={notYet}>PEC</button>
                        <button type="button" className="gestione-action-btn gestione-action-aperta" onClick={notYet}>Aperta</button>
                        <button type="button" className="gestione-icon-btn edit" aria-label={`Modifica ${row.ragioneSociale}`} title="Modifica" onClick={() => setEditing(row)}>
                          <Pencil size={14} />
                        </button>
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

      {viewing && (
        <div className="gestione-modal-overlay" onClick={() => setViewing(null)}>
          <div className="gestione-modal-box" onClick={e => e.stopPropagation()}>
            <div className="gestione-modal-header">
              <h2>Scheda Società {viewing.ragioneSociale}</h2>
              <button type="button" className="gestione-modal-close" aria-label="Chiudi" onClick={() => setViewing(null)}>×</button>
            </div>
            <div className="gestione-modal-body">
              <table className="gestione-scheda-table gestione-scheda-table-paired">
                <tbody>
                  {pairedRows([
                    ["Stato", STATI[viewing.stato ?? -1]],
                    ["Tipologia", TIPOLOGIE[viewing.tipologia]],
                    ["Email", viewing.emailPosta],
                    ["Email PEC", viewing.emailPec],
                    ["Amministratore", cleanText(viewing.amministratore)],
                    ["Telefono amministratore", cleanText(viewing.telefonoAmm)],
                    ["Persona di riferimento", cleanText(viewing.personaRif)],
                    ["Telefono", cleanText(viewing.telefono)],
                    ["Telefono urgenze", cleanText(viewing.telefonoUrg)],
                    ["Raccoglitore", viewing.raccoglitore],
                    ["Inizio domiciliazione", fmtDate(viewing.inizioDom)],
                    ["Scadenza domiciliazione", fmtDate(viewing.scadenzaDom)],
                    ["Scadenza pagamento", fmtDate(viewing.scadenzaPagamento)],
                    ["Prezzo rinnovo", viewing.prezzoRinnovo !== null ? `${viewing.prezzoRinnovo} €` : null],
                    ["Indirizzo spedizione posta", cleanText(viewing.indSpedPosta)],
                    ["Note", cleanText(viewing.note)],
                    ["Contratto firmato", viewing.contrFirmato ? "Sì" : "No"],
                    ["Controfirmato inviato", viewing.controfirmatoInviato ? "Sì" : "No"],
                    ["Modulo", viewing.moduloCont ? "Sì" : "No"],
                    ["Doc. amministratore", viewing.docAmmPres ? "Sì" : "No"],
                    ["Allegato 1", viewing.allegato1Pres ? "Sì" : "No"],
                    ["Visura", viewing.visuraPres ? "Sì" : "No"],
                  ])}
                </tbody>
              </table>
            </div>
            <div className="gestione-modal-footer">
              <button type="button" className="gestione-btn gestione-btn-blue" onClick={() => { setEditing(viewing); setViewing(null); }} style={{ marginRight: 10 }}>
                <Pencil size={14} /> Modifica
              </button>
              <button type="button" className="gestione-btn gestione-btn-outline" onClick={() => setViewing(null)}>Chiudi</button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="gestione-modal-overlay" onClick={() => setEditing(null)}>
          <div className="gestione-modal-box" onClick={e => e.stopPropagation()}>
            <div className="gestione-modal-header">
              <h2>Modifica dati Società {editing.ragioneSociale}</h2>
              <button type="button" className="gestione-modal-close" aria-label="Chiudi" onClick={() => setEditing(null)}>×</button>
            </div>
            <div className="gestione-modal-body">
              <DomForm client={editing} action={updateDomiciliazioneAction} deleteAction={deleteDomiciliazioneAction} onClose={() => setEditing(null)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
