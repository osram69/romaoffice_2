"use client";
import { useActionState, useState } from "react";
import { changePasswordAction } from "@/app/gestione-password-x9k2m7/actions";
import { PasswordRequirementsList } from "./PasswordRequirementsList";
import { PASSWORD_MAX_LENGTH, passwordMeetsPolicy } from "@/lib/password-policy";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, {});
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const ready = current.length > 0 && passwordMeetsPolicy(next) && next === confirm && next !== current;

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {state.error && <div className="gestione-login-error" role="alert" style={{ marginBottom: 0 }}>{state.error}</div>}
      <div className="gestione-field">
        <label htmlFor="current">Password attuale</label>
        <input id="current" name="current" type="password" required autoComplete="current-password" maxLength={PASSWORD_MAX_LENGTH} value={current} onChange={e => setCurrent(e.target.value)} />
      </div>
      <div className="gestione-field">
        <label htmlFor="next">Nuova password</label>
        <input id="next" name="next" type="password" required autoComplete="new-password" maxLength={PASSWORD_MAX_LENGTH} value={next} onChange={e => setNext(e.target.value)} />
        <PasswordRequirementsList password={next} lang="it" />
      </div>
      <div className="gestione-field">
        <label htmlFor="confirm">Conferma nuova password</label>
        <input id="confirm" name="confirm" type="password" required autoComplete="new-password" maxLength={PASSWORD_MAX_LENGTH} value={confirm} onChange={e => setConfirm(e.target.value)} />
        {confirm.length > 0 && next !== confirm && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#c0392b" }}>La conferma non coincide.</p>}
        {next.length > 0 && current.length > 0 && next === current && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#c0392b" }}>La nuova password deve essere diversa da quella attuale.</p>}
      </div>
      <div>
        <button type="submit" className="gestione-btn gestione-btn-blue" disabled={pending || !ready} style={pending || !ready ? { opacity: 0.6, cursor: "not-allowed" } : undefined}>
          {pending ? "Salvataggio..." : "Cambia password"}
        </button>
      </div>
    </form>
  );
}
