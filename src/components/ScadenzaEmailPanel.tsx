"use client";
import { useState } from "react";
import { getScadenzaDraftAction, inviaScadenzaAction } from "@/app/gestione-domiciliazioni-x9k2m7/actions";

export function ScadenzaEmailPanel({ id, initialPrezzoRinnovo }: { id: number; initialPrezzoRinnovo: number | null }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [prezzo, setPrezzo] = useState(initialPrezzoRinnovo !== null ? String(initialPrezzoRinnovo) : "");
  const [status, setStatus] = useState<{ text: string; color: string } | null>(null);
  const [sending, setSending] = useState(false);

  async function load(regenerate: boolean) {
    setLoading(true);
    setStatus(null);
    const draft = await getScadenzaDraftAction(id, regenerate);
    setLoading(false);
    if (!draft.success) { setStatus({ text: draft.message || "Errore", color: "red" }); return; }
    setSubject(draft.subject || "");
    setHtml(draft.html || "");
    setPrezzo(draft.prezzoRinnovo !== null && draft.prezzoRinnovo !== undefined ? String(draft.prezzoRinnovo) : "");
  }

  async function open_() {
    setOpen(true);
    if (!html) await load(false);
  }

  async function send() {
    if (!confirm("Inviare questa email di scadenza? Verrà inviata via PEC se presente, altrimenti via email ordinaria.")) return;
    setSending(true);
    setStatus({ text: "Invio in corso...", color: "#555" });
    const formData = new FormData();
    formData.set("id", String(id));
    formData.set("html", html);
    formData.set("prezzoRinnovo", prezzo);
    const result = await inviaScadenzaAction(formData);
    setSending(false);
    setStatus(result.success ? { text: "Inviata con successo", color: "green" } : { text: result.message || "Errore", color: "red" });
  }

  if (!open) {
    return (
      <button type="button" className="gestione-btn gestione-btn-outline" onClick={open_}>
        Invia promemoria scadenza
      </button>
    );
  }

  return (
    <div className="gestione-card" style={{ padding: 16, marginTop: 4 }}>
      <h3 style={{ margin: "0 0 10px", fontSize: 14, color: "#232f3e" }}>Invia promemoria scadenza</h3>
      {loading ? <p style={{ fontSize: 13, color: "#666" }}>Caricamento bozza...</p> : (
        <>
          <div className="gestione-field" style={{ marginBottom: 10 }}>
            <label>Oggetto</label>
            <input value={subject} readOnly />
          </div>
          <div className="gestione-field" style={{ marginBottom: 10, maxWidth: 200 }}>
            <label>Prezzo rinnovo (€, senza IVA)</label>
            <input type="number" value={prezzo} onChange={e => setPrezzo(e.target.value)} />
          </div>
          <div className="gestione-field" style={{ marginBottom: 10 }}>
            <label>Testo email (HTML) — verificalo prima di inviare</label>
            <textarea value={html} onChange={e => setHtml(e.target.value)} rows={16} style={{ fontFamily: "monospace", fontSize: 12 }} />
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button type="button" className="gestione-btn gestione-btn-blue" disabled={sending} onClick={send}>Invia</button>
            <button type="button" className="gestione-btn gestione-btn-outline" disabled={sending || loading} onClick={() => load(true)}>Rigenera dal modello</button>
            <button type="button" className="gestione-btn gestione-btn-outline" onClick={() => setOpen(false)}>Chiudi</button>
            {status && <span style={{ fontSize: 12, color: status.color }}>{status.text}</span>}
          </div>
        </>
      )}
    </div>
  );
}
