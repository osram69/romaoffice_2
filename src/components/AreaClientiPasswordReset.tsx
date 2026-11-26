"use client";
import { useState } from "react";
import { sendNewAreaClientiPasswordAction, setAreaClientiPasswordAction } from "@/app/gestione-domiciliazioni-x9k2m7/actions";
import { passwordMeetsPolicy } from "@/lib/password-policy";
import { PasswordRequirementsList } from "./PasswordRequirementsList";
import { runWithFeedback } from "./Toaster";

export function AreaClientiPasswordReset({ id, hasPassword, loginEmail }: { id: number; hasPassword: boolean; loginEmail?: string | null }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; color: string } | null>(null);

  async function save() {
    setBusy(true);
    setStatus(null);
    const result = await setAreaClientiPasswordAction(id, password);
    setBusy(false);
    if (result.success) {
      setStatus({ text: "Password impostata. Al prossimo accesso il cliente dovrà cambiarla.", color: "green" });
      setPassword(""); setOpen(false);
    } else {
      setStatus({ text: result.message || "Errore", color: "red" });
    }
  }

  async function sendNew() {
    if (!loginEmail || !window.confirm(`Generare una nuova password provvisoria e inviarla a ${loginEmail}?\n\nLa password attuale smette di funzionare subito.`)) return;
    setBusy(true);
    setStatus(null);
    try {
      const result = await runWithFeedback(async () => { const r = await sendNewAreaClientiPasswordAction(id); setStatus({ text: r.message || (r.success ? "Inviata" : "Errore"), color: r.success ? "green" : "red" }); return r; }, "Nuova password inviata");
      if (!result) setStatus(s => s ?? { text: "Errore", color: "red" });
    } finally { setBusy(false); }
  }

  if (!open) {
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="gestione-btn gestione-btn-outline" disabled={busy} onClick={() => setOpen(true)}>
          {hasPassword ? "Reset password area clienti" : "Imposta password area clienti"}
        </button>
        {loginEmail && (
          <button type="button" className="gestione-btn gestione-btn-blue" disabled={busy} onClick={sendNew} title={`Genera una nuova password e la invia a ${loginEmail}`}>
            {busy ? "Invio..." : "Invia nuova password al cliente"}
          </button>
        )}
        {status && <span style={{ fontSize: 12, color: status.color }}>{status.text}</span>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="Nuova password" style={{ maxWidth: 220 }} />
        <button type="button" className="gestione-btn gestione-btn-blue" disabled={busy || !passwordMeetsPolicy(password)} onClick={save}>Salva</button>
        <button type="button" className="gestione-btn gestione-btn-outline" disabled={busy} onClick={() => { setOpen(false); setPassword(""); setStatus(null); }}>Annulla</button>
        {status && <span style={{ fontSize: 12, color: status.color }}>{status.text}</span>}
      </div>
      <PasswordRequirementsList password={password} lang="it" />
    </div>
  );
}
