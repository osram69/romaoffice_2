"use client";
import { useActionState, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { setInitialContabPasswordAction, unlockContabAction } from "@/app/gestione-contabilita-x9k2m7/actions";
import { PasswordRequirementsList } from "./PasswordRequirementsList";
import { PASSWORD_MAX_LENGTH, passwordMeetsPolicy } from "@/lib/password-policy";

const disabledStyle = { opacity: 0.6, cursor: "not-allowed" } as const;

/** Second password, asked once per working session (the unlock lasts 30 minutes of inactivity). */
export function ContabUnlockForm() {
  const [state, action, pending] = useActionState(unlockContabAction, {});
  const [password, setPassword] = useState("");

  return (
    <form action={action} className="gestione-card" style={{ padding: 20, maxWidth: 420, display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ margin: 0, fontSize: 13, color: "#555" }}>
        Per aprire la Contabilità inserisci la password di Contabilità. Lo sblocco dura 30 minuti dall&apos;ultima attività.
      </p>
      {state.error && <div className="gestione-login-error" role="alert" style={{ marginBottom: 0 }}>{state.error}</div>}
      <div className="gestione-field">
        <label htmlFor="contab-password">Password di Contabilità</label>
        <input id="contab-password" name="password" type="password" required autoFocus autoComplete="current-password" maxLength={PASSWORD_MAX_LENGTH} value={password} onChange={e => setPassword(e.target.value)} />
      </div>
      <div>
        <button type="submit" className="gestione-btn gestione-btn-blue" disabled={pending || password.length === 0} style={pending || password.length === 0 ? disabledStyle : undefined}>
          <LockKeyhole size={14} /> {pending ? "Verifica..." : "Sblocca"}
        </button>
      </div>
    </form>
  );
}

/** First visit: nobody has chosen the second password yet. */
export function ContabCreatePasswordForm() {
  const [state, action, pending] = useActionState(setInitialContabPasswordAction, {});
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const ready = passwordMeetsPolicy(next) && next === confirm;

  return (
    <form action={action} className="gestione-card" style={{ padding: 20, maxWidth: 420, display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ margin: 0, fontSize: 13, color: "#555" }}>
        La Contabilità è protetta da una seconda password, diversa da quella del tuo accesso. Sceglila ora: te la chiederemo a ogni nuova sessione di lavoro.
        Conservala con cura: se la perdi si può reimpostare solo dal server.
      </p>
      {state.error && <div className="gestione-login-error" role="alert" style={{ marginBottom: 0 }}>{state.error}</div>}
      <div className="gestione-field">
        <label htmlFor="contab-new">Nuova password di Contabilità</label>
        <input id="contab-new" name="next" type="password" required autoComplete="new-password" maxLength={PASSWORD_MAX_LENGTH} value={next} onChange={e => setNext(e.target.value)} />
        <PasswordRequirementsList password={next} lang="it" />
      </div>
      <div className="gestione-field">
        <label htmlFor="contab-confirm">Ripeti la password</label>
        <input id="contab-confirm" name="confirm" type="password" required autoComplete="new-password" maxLength={PASSWORD_MAX_LENGTH} value={confirm} onChange={e => setConfirm(e.target.value)} />
        {confirm.length > 0 && next !== confirm && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#c0392b" }}>Le due password non coincidono.</p>}
      </div>
      <div>
        <button type="submit" className="gestione-btn gestione-btn-blue" disabled={pending || !ready} style={pending || !ready ? disabledStyle : undefined}>
          {pending ? "Salvataggio..." : "Crea password"}
        </button>
      </div>
    </form>
  );
}
