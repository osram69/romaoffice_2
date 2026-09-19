"use client";
import { useEffect, useRef, useState } from "react";
import { uploadDomDocumentAction, removeDomDocumentAction } from "@/app/gestione-domiciliazioni-x9k2m7/actions";
import { PRESENZA_FILE_BITS } from "@/lib/dom-status";
import type { DocType } from "@/lib/dom-archive";

const DOC_UPLOADS: { lab: string; key: DocType }[] = [
  { lab: "Contratto", key: "con" },
  { lab: "Modulo", key: "mod" },
  { lab: "Allegato 1", key: "all" },
  { lab: "Documento Amm.", key: "doc" },
  { lab: "Adeguata Verifica", key: "avc" },
  { lab: "Revoca/Disdetta", key: "rev" },
];

function UploadRow({ id, docType, label, present, onChange, onBusyChange }: { id: number; docType: DocType; label: string; present: boolean; onChange: (presenzaFile: number) => void; onBusyChange: (busy: boolean) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hasFile, setHasFile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; color: string } | null>(null);

  function setBusyState(value: boolean) { setBusy(value); onBusyChange(value); }

  async function upload() {
    const file = inputRef.current?.files?.[0];
    if (!file) { setStatus({ text: "Seleziona un file.", color: "#555" }); return; }
    setBusyState(true);
    setStatus({ text: "Caricamento...", color: "#555" });
    try {
      const result = await uploadDomDocumentAction(id, docType, file);
      if (result.success) {
        setStatus({ text: "OK", color: "green" });
        if (result.presenzaFile !== undefined) onChange(result.presenzaFile);
      } else {
        setStatus({ text: result.message || "Errore", color: "red" });
      }
    } catch {
      setStatus({ text: "Errore imprevisto durante il caricamento. La sessione potrebbe essere scaduta: ricarica la pagina.", color: "red" });
    } finally {
      setBusyState(false);
    }
  }

  async function remove() {
    setBusyState(true);
    setStatus({ text: "Rimozione...", color: "#555" });
    try {
      const result = await removeDomDocumentAction(id, docType);
      if (inputRef.current) inputRef.current.value = "";
      setHasFile(false);
      if (result.presenzaFile !== undefined) onChange(result.presenzaFile);
      setStatus(result.success ? { text: "Rimosso", color: "green" } : { text: result.message || "Errore", color: "red" });
    } catch {
      setStatus({ text: "Errore imprevisto durante la rimozione. La sessione potrebbe essere scaduta: ricarica la pagina.", color: "red" });
    } finally {
      setBusyState(false);
    }
  }

  return (
    <>
      <th><label>{label}</label></th>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <input ref={inputRef} type="file" accept="application/pdf" style={{ width: "auto", maxWidth: 145 }} disabled={present || busy} onChange={e => setHasFile(!!e.target.files?.length)} />
          <button type="button" className="gestione-upload-btn" title="Carica" disabled={present || busy || !hasFile} onClick={upload}>💾</button>
          {present && <button type="button" className="gestione-btn gestione-btn-outline" style={{ fontSize: 11, padding: "3px 8px" }} disabled={busy} onClick={remove}>Rimuovi</button>}
          {status && <span style={{ fontSize: 11, color: status.color }}>{status.text}</span>}
        </div>
      </td>
    </>
  );
}

export function DomDocumentUploads({ id, presenzaFile: initialPresenzaFile, onUploadingChange }: { id: number; presenzaFile: number; onUploadingChange?: (uploading: boolean) => void }) {
  const [presenzaFile, setPresenzaFile] = useState(initialPresenzaFile);
  const busyRows = useRef(new Set<DocType>());

  function reportBusy(docType: DocType, busy: boolean) {
    if (busy) busyRows.current.add(docType); else busyRows.current.delete(docType);
    onUploadingChange?.(busyRows.current.size > 0);
  }
  useEffect(() => () => onUploadingChange?.(false), [onUploadingChange]);

  return (
    <div style={{ marginTop: 10 }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: "#232f3e", marginBottom: 4 }}>Carica/aggiorna documenti PDF (i file saranno criptati AES-256):</p>
      <table className="gestione-scheda-table gestione-scheda-table-paired gestione-scheda-table-edit">
        <tbody>
          <tr>
            <th><label>Contratto completo (PDF 16 pagine)</label></th>
            <td colSpan={3}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <input type="file" accept="application/pdf" style={{ width: "auto", maxWidth: 200 }} />
                <button type="button" className="gestione-upload-btn" title="Carica e processa" onClick={() => alert("Funzione non ancora disponibile.")}>💾 Carica e Processa</button>
              </div>
            </td>
          </tr>
          {Array.from({ length: Math.ceil(DOC_UPLOADS.length / 2) }, (_, i) => [DOC_UPLOADS[i * 2], DOC_UPLOADS[i * 2 + 1]]).map(([a, b], i) => (
            <tr key={i}>
              <UploadRow id={id} docType={a.key} label={a.lab} present={(presenzaFile & PRESENZA_FILE_BITS[a.key]) === PRESENZA_FILE_BITS[a.key]} onChange={setPresenzaFile} onBusyChange={busy => reportBusy(a.key, busy)} />
              {b ? <UploadRow id={id} docType={b.key} label={b.lab} present={(presenzaFile & PRESENZA_FILE_BITS[b.key]) === PRESENZA_FILE_BITS[b.key]} onChange={setPresenzaFile} onBusyChange={busy => reportBusy(b.key, busy)} /> : <><th /><td /></>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
