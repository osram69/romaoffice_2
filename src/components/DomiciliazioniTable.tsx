"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Check, Pencil, RotateCcw, Trash2 } from "lucide-react";
import type { InferSelectModel } from "drizzle-orm";
import type { domClients } from "@/db/schema";
import { cleanText, docStatus, DOC_LABELS, PRESENZA_FILE_BITS, scadenzaRowClass } from "@/lib/dom-status";
import type { DocType } from "@/lib/dom-archive";
import { DomForm } from "./DomForm";
import { DeleteIconButton } from "./DeleteIconButton";
import { ActionFormButton } from "./ActionFormButton";
import { ScadenzaEmailPanel } from "./ScadenzaEmailPanel";
import {
  updateDomiciliazioneAction, deleteDomiciliazioneAction,
  decadiDomiciliazioneAction, ripristinaDomiciliazioneAction, attivaDomiciliazioneAction,
} from "@/app/gestione-domiciliazioni-x9k2m7/actions";

type DomClient = InferSelectModel<typeof domClients>;

const STATI: Record<number, string> = { [-1]: "Vuota", 0: "In Attivazione", 1: "Attiva", 2: "Decaduta", 3: "Sospesa" };
const TIPOLOGIE: Record<number, string> = { 0: "Legale", 1: "Postale", 2: "Professionale", 3: "Avvocato" };

// Exact order/labels/link text from the legacy Decadute table (domiciliazioni.php, stato==2 branch).
const DECADUTE_DOC_COLUMNS: { key: DocType; header: string; linkText: string }[] = [
  { key: "con", header: "Contratto", linkText: "Apri Contr." },
  { key: "mod", header: "Libri Contabili", linkText: "Apri Modulo" },
  { key: "doc", header: "Doc. Ammin", linkText: "Apri Doc." },
  { key: "all", header: "Allegato 1", linkText: "Apri Allegato" },
  { key: "rev", header: "Revoca/Disdetta", linkText: "Apri Revoca" },
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
function notYet() { alert("Funzione non ancora disponibile."); }

// Mirrors the legacy Decadute-specific scadenza coloring (domiciliazioni.php, stato==2 branch):
// yellow if due within 10 days (or today), red (light) if already past due, otherwise plain.
function decaduteScadClass(scadenzaDom: string | null): string {
  if (!scadenzaDom) return "";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const plus10 = new Date(today); plus10.setDate(plus10.getDate() + 10);
  const date = new Date(scadenzaDom); date.setHours(0, 0, 0, 0);
  if ((date < plus10 && date > today) || date.getTime() === today.getTime()) return "gestione-scad-yellow";
  if (date > plus10) return "";
  return "gestione-scad-red";
}

// Mirrors the legacy scroll offset (domiciliazioni.php keydown handler): -55 to clear the fixed toggle.
function scrollToLetter(letter: string) {
  const el = document.getElementById(`letter_${letter}`);
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - 55 });
}

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

export function DomiciliazioniTable({ rows, stato }: { rows: DomClient[]; stato: number }) {
  const [viewing, setViewing] = useState<DomClient | null>(null);
  const [editing, setEditing] = useState<DomClient | null>(null);
  const [schedaTab, setSchedaTab] = useState<"dati" | "scadenza" | "proforma">("dati");
  function openScheda(row: DomClient) { setViewing(row); setSchedaTab("dati"); }
  let lastLetter = "";
  const decadute = stato === 2;
  const colCount = decadute ? 11 : 10;
  const letters = useMemo(() => Array.from(new Set(rows.map(r => letterOf(r.ragioneSociale)))).sort(), [rows]);

  // Mirrors the legacy keydown handler: press a letter key to jump to that section
  // (skipped while a modal is open, a modifier key is held, or a field has focus).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (viewing || editing) return;
      if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
      const active = document.activeElement as HTMLElement | null;
      if (active && (["INPUT", "TEXTAREA"].includes(active.tagName) || active.isContentEditable)) return;
      const key = e.key.toLocaleUpperCase();
      if (key.length === 1 && letters.includes(key)) scrollToLetter(key);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [letters, viewing, editing]);

  return (
    <>
      <div className="gestione-card" style={{ overflowX: "auto" }}>
        <table className="gestione-table dom-list-table">
          <thead>
            {decadute ? (
              <tr>
                <th>ID</th><th>Ragione Sociale</th>
                {DECADUTE_DOC_COLUMNS.map(c => <th key={c.key}>{c.header}</th>)}
                <th>Riferimento</th><th>Telefono</th><th style={{ width: 100 }}>Scadenza</th><th style={{ width: 110 }}>Ripristina</th>
              </tr>
            ) : (
              <tr>
                <th>N°</th><th>Doc</th><th>Racc.</th><th>Ragione Sociale</th>
                <th>Email</th><th>Email PEC</th>
                <th>Telefono</th><th>Persona Rif.</th><th>Scadenza</th><th>Azioni</th>
              </tr>
            )}
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const letter = letterOf(row.ragioneSociale);
              const showDivider = letter !== lastLetter;
              lastLetter = letter;
              return (
                <Fragment key={row.id}>
                  {showDivider && <tr id={`letter_${letter}`} className="gestione-letter-row"><td colSpan={colCount}>{letter}</td></tr>}
                  {decadute ? (
                    <tr className={index % 2 === 0 ? "row-even" : "row-odd"}>
                      <td style={{ color: "#999" }}>{index + 1}</td>
                      <td style={{ maxWidth: 220 }}>
                        <button type="button" className="gestione-ragione-link gestione-ragione-name" title={row.ragioneSociale} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit", textAlign: "left" }} onClick={() => openScheda(row)}>
                          {row.ragioneSociale}
                        </button>
                      </td>
                      {DECADUTE_DOC_COLUMNS.map(c => (
                        <td key={c.key}>
                          {(row.presenzaFile & PRESENZA_FILE_BITS[c.key]) === PRESENZA_FILE_BITS[c.key]
                            ? <a className="gestione-file-link" href={`/api/dom-documents?id=${row.id}&type=${c.key}`} target="_blank" rel="noopener noreferrer">{c.linkText}</a>
                            : <span style={{ color: "#999" }}>Non Disponibile</span>}
                        </td>
                      ))}
                      <td>{cleanText(row.personaRif)}</td>
                      <td>{cleanText(row.telefono)}</td>
                      <td className={decaduteScadClass(row.scadenzaDom)}>{fmtDate(row.scadenzaDom)}</td>
                      <td>
                        <div className="gestione-row-actions">
                          <ActionFormButton id={row.id} action={ripristinaDomiciliazioneAction} className="gestione-btn gestione-btn-outline" label="Ripristina" confirmText={`Ripristinare "${row.ragioneSociale}" tra le attive?`}>
                            <RotateCcw size={13} /> Ripristina
                          </ActionFormButton>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr className={index % 2 === 0 ? "row-even" : "row-odd"}>
                      <td style={{ color: "#999" }}>{index + 1}</td>
                      <td><span className={`gestione-doc-dot ${docStatus(row)}`} title="Stato documenti" /></td>
                      <td>{row.raccoglitore}</td>
                      <td style={{ maxWidth: 220 }}>
                        <button type="button" className={`gestione-ragione-link gestione-ragione-name${(row.presenzaFile & PRESENZA_FILE_BITS.rev) === PRESENZA_FILE_BITS.rev ? " revoca" : ""}`} title={row.ragioneSociale} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit", textAlign: "left" }} onClick={() => openScheda(row)}>
                          {row.ragioneSociale}
                        </button>
                      </td>
                      <td className="gestione-email-cell">{row.emailPosta}</td>
                      <td className="gestione-email-cell">{row.emailPec}</td>
                      <td>{cleanText(row.telefono)}</td>
                      <td>{cleanText(row.personaRif)}</td>
                      <td className={scadenzaRowClass(row)}>{fmtDate(row.scadenzaDom)}</td>
                      <td>
                        {stato === 0 ? (
                          // In Attivazione: activate, edit, or delete outright (never truly activated).
                          <div className="gestione-row-actions">
                            <ActionFormButton id={row.id} action={attivaDomiciliazioneAction} className="gestione-icon-btn edit" label="Attiva" confirmText={`Attivare "${row.ragioneSociale}"?`}>
                              <Check size={14} color="#28a745" />
                            </ActionFormButton>
                            <button type="button" className="gestione-icon-btn edit" aria-label={`Modifica ${row.ragioneSociale}`} title="Modifica" onClick={() => setEditing(row)}>
                              <Pencil size={14} />
                            </button>
                            <DeleteIconButton id={row.id} action={deleteDomiciliazioneAction} label={row.ragioneSociale} />
                          </div>
                        ) : (
                          // Attive: full action row. The trash icon here "decade" the record
                          // (moves it to Decadute) — it never permanently deletes.
                          <div className="gestione-row-actions">
                            <button type="button" className="gestione-action-btn gestione-action-allega" onClick={notYet}>Allega</button>
                            <button type="button" className="gestione-action-btn gestione-action-invia" onClick={notYet}>Invia</button>
                            <button type="button" className="gestione-action-btn gestione-action-pec" onClick={notYet}>PEC</button>
                            <button type="button" className="gestione-action-btn gestione-action-aperta" onClick={notYet}>Aperta</button>
                            <button type="button" className="gestione-icon-btn edit" aria-label={`Modifica ${row.ragioneSociale}`} title="Modifica" onClick={() => setEditing(row)}>
                              <Pencil size={14} />
                            </button>
                            <ActionFormButton id={row.id} action={decadiDomiciliazioneAction} className="gestione-icon-btn delete" label="Sposta tra le decadute" confirmText={`Spostare "${row.ragioneSociale}" tra le domiciliazioni decadute? Il record non viene eliminato.`}>
                              <Trash2 size={14} />
                            </ActionFormButton>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={colCount} style={{ textAlign: "center", color: "#999", padding: 24 }}>Nessuna domiciliazione in questo stato.</td></tr>}
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
              {(() => {
                const inScadenza = ["scad-yellow", "scad-yellow-dark"].includes(scadenzaRowClass(viewing));
                return (
                  <div className="gestione-tabs" style={{ marginBottom: 14 }}>
                    <button type="button" className={`gestione-tab${schedaTab === "dati" ? " active" : ""}`} onClick={() => setSchedaTab("dati")}>Dati Società</button>
                    {inScadenza && <button type="button" className={`gestione-tab${schedaTab === "scadenza" ? " active" : ""}`} onClick={() => setSchedaTab("scadenza")}>Gestione Scadenza</button>}
                    {inScadenza && <button type="button" className={`gestione-tab${schedaTab === "proforma" ? " active" : ""}`} onClick={() => setSchedaTab("proforma")}>Invio Proforma</button>}
                  </div>
                );
              })()}

              {schedaTab === "dati" && (
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
                    <tr>
                      <th>Allegati PDF</th>
                      <td colSpan={3}>
                        {(() => {
                          const present = DOC_LABELS.filter(d => (viewing.presenzaFile & PRESENZA_FILE_BITS[d.key]) === PRESENZA_FILE_BITS[d.key]);
                          if (present.length === 0) return <span style={{ color: "#aaa" }}>Nessun allegato presente</span>;
                          return present.map(d => (
                            <a key={d.key} className="gestione-file-link" style={{ marginRight: 8 }} href={`/api/dom-documents?id=${viewing.id}&type=${d.key}`} target="_blank" rel="noopener noreferrer">{d.label}</a>
                          ));
                        })()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}

              {schedaTab === "scadenza" && (
                <ScadenzaEmailPanel key={viewing.id} id={viewing.id} initialPrezzoRinnovo={viewing.prezzoRinnovo} />
              )}

              {schedaTab === "proforma" && (
                <p style={{ fontSize: 13, color: "#666" }}>Funzione non ancora disponibile.</p>
              )}
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
              <DomForm client={editing} action={updateDomiciliazioneAction} deleteAction={editing.stato === 0 ? deleteDomiciliazioneAction : undefined} onClose={() => setEditing(null)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
