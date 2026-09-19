"use client";
import { useState } from "react";
import { setAreaClientiPasswordAction } from "@/app/gestione-domiciliazioni-x9k2m7/actions";

export function AreaClientiPasswordReset({ id, hasPassword }: { id: number; hasPassword: boolean }) {
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

  if (!open) {
    return (
      <button type="button" className="gestione-btn gestione-btn-outline" onClick={() => setOpen(true)}>
        {hasPassword ? "Reset password area clienti" : "Imposta password area clienti"}
      </button>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="Nuova password (min. 12 caratteri)" style={{ maxWidth: 220 }} />
      <button type="button" className="gestione-btn gestione-btn-blue" disabled={busy || password.length < 12} onClick={save}>Salva</button>
      <button type="button" className="gestione-btn gestione-btn-outline" disabled={busy} onClick={() => { setOpen(false); setPassword(""); setStatus(null); }}>Annulla</button>
      {status && <span style={{ fontSize: 12, color: status.color }}>{status.text}</span>}
    </div>
  );
}
