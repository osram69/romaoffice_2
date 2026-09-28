"use client";
import { useEffect, useState } from "react";
import { getMailScanDraftAction, sendMailScanAction, type MailScanChannel } from "@/app/gestione-domiciliazioni-x9k2m7/actions";

const CHANNEL_LABEL: Record<MailScanChannel, string> = { ordinaria: "Invia (email ordinaria)", pec: "Invia via PEC", aperta: "Segna come Aperta" };

export function DomMailScanSendPanel({ clientId, ragioneSociale, channel, onClose, onSent }: { clientId: number; ragioneSociale: string; channel: MailScanChannel; onClose: () => void; onSent: () => void }) {
  const [loading, setLoading] = useState(true);
  const [scanId, setScanId] = useState<number | null>(null);
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [status, setStatus] = useState<{ text: string; color: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    getMailScanDraftAction(clientId, channel).then(result => {
      setLoading(false);
      if (!result.success || !result.draft) { setStatus({ text: result.message || "Errore", color: "red" }); return; }
      setScanId(result.draft.scanId);
      setSubject(result.draft.subject);
      setText(result.draft.text);
    });
  }, [clientId, channel]);

  async function send() {
    if (!scanId) return;
    setSending(true);
    setStatus({ text: "Invio in corso...", color: "#555" });
    const result = await sendMailScanAction(clientId, scanId, channel, subject, text);
    setSending(false);
    if (!result.success) { setStatus({ text: result.message || "Errore durante l'invio", color: "red" }); return; }
    setStatus({ text: "Inviato.", color: "green" });
    setSent(true);
    onSent();
  }

  return (
    <div className="gestione-modal-overlay" onClick={onClose}>
      <div className="gestione-modal-box" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div className="gestione-modal-header">
          <h2>{CHANNEL_LABEL[channel]} — {ragioneSociale}</h2>
          <button type="button" className="gestione-modal-close" aria-label="Chiudi" onClick={onClose}>×</button>
        </div>
        <div className="gestione-modal-body">
          {loading ? (
            <p style={{ fontSize: 13, color: "#666" }}>Caricamento...</p>
          ) : !scanId ? (
            <p style={{ fontSize: 13, color: status?.color || "#666" }}>{status?.text}</p>
          ) : (
            <>
              <p style={{ fontSize: 12, color: "#666", marginTop: 0 }}>
                Verifica testo e oggetto prima di inviare — la scansione allegata viene rimossa dal server una volta inviata. L&apos;informativa su esclusione di responsabilità e riservatezza viene aggiunta automaticamente in fondo all&apos;email e non è modificabile qui.
              </p>
              <div className="gestione-field" style={{ marginBottom: 10 }}>
                <label>Oggetto</label>
                <input type="text" value={subject} disabled={sending || sent} onChange={e => setSubject(e.target.value)} style={{ width: "100%" }} />
              </div>
              <div className="gestione-field" style={{ marginBottom: 10 }}>
                <label>Testo email</label>
                <textarea value={text} disabled={sending || sent} onChange={e => setText(e.target.value)} rows={7} style={{ width: "100%" }} />
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button type="button" className="gestione-btn gestione-btn-blue" disabled={sending || sent} onClick={send}>Invia</button>
                {status && <span style={{ fontSize: 12, color: status.color }}>{status.text}</span>}
              </div>
            </>
          )}
        </div>
        <div className="gestione-modal-footer">
          <button type="button" className="gestione-btn gestione-btn-outline" onClick={onClose}>Chiudi</button>
        </div>
      </div>
    </div>
  );
}
