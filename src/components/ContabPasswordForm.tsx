"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeContabPasswordAction } from "@/app/gestione-contabilita-x9k2m7/actions";
import { PasswordRequirementsList } from "./PasswordRequirementsList";
import { CONTAB_GENERIC_FAILURE, CONTAB_LOCKED_MESSAGE } from "@/lib/contab-messages";
import { PASSWORD_MAX_LENGTH, passwordMeetsPolicy } from "@/lib/password-policy";

/** "Cambia password di Contabilità": asks the current second password, then the new one twice. */
export function ContabPasswordForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const ready = current.length > 0 && passwordMeetsPolicy(next) && next === confirm && next !== current;

  function submit() {
    if (!ready || pending) return;
    const fd = new FormData();
    fd.set("current", current);
    fd.set("next", next);
    fd.set("confirm", confirm);
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await changeContabPasswordAction(fd);
        if (result.ok) {
          setCurrent("");
          setNext("");
          setConfirm("");
          setFeedback({ ok: true, message: result.message ?? "Password cambiata." });
        } else if (result.message === CONTAB_LOCKED_MESSAGE) {
          router.refresh();
        } else {
          setFeedback({ ok: false, message: result.message ?? CONTAB_GENERIC_FAILURE });
        }
      } catch {
        setFeedback({ ok: false, message: CONTAB_GENERIC_FAILURE });
      }
    });
  }

  return (
    <div className="gestione-card" style={{ padding: 20, marginBottom: 24, maxWidth: 520 }}>
      <h2 style={{ margin: "0 0 12px", fontSize: "1.05rem", color: "#232f3e" }}>Cambia password di Contabilità</h2>
      {feedback && (
        <div className={feedback.ok ? undefined : "gestione-login-error"} role={feedback.ok ? "status" : "alert"} style={feedback.ok ? { background: "#e6f4ea", color: "#1a7f37", padding: "8px 12px", borderRadius: 4, marginBottom: 12, fontSize: 13 } : { marginBottom: 12 }}>
          {feedback.message}
        </div>
      )}
      <form onSubmit={e => { e.preventDefault(); submit(); }} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="gestione-field">
          <label htmlFor="contab-current">Password attuale</label>
          <input id="contab-current" type="password" autoComplete="current-password" maxLength={PASSWORD_MAX_LENGTH} value={current} onChange={e => setCurrent(e.target.value)} />
        </div>
        <div className="gestione-field">
          <label htmlFor="contab-next">Nuova password</label>
          <input id="contab-next" type="password" autoComplete="new-password" maxLength={PASSWORD_MAX_LENGTH} value={next} onChange={e => setNext(e.target.value)} />
          <PasswordRequirementsList password={next} lang="it" />
        </div>
        <div className="gestione-field">
          <label htmlFor="contab-confirm-next">Ripeti la nuova password</label>
          <input id="contab-confirm-next" type="password" autoComplete="new-password" maxLength={PASSWORD_MAX_LENGTH} value={confirm} onChange={e => setConfirm(e.target.value)} />
          {confirm.length > 0 && next !== confirm && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#c0392b" }}>Le due password non coincidono.</p>}
          {next.length > 0 && current.length > 0 && next === current && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#c0392b" }}>La nuova password deve essere diversa da quella attuale.</p>}
        </div>
        <div>
          <button type="submit" className="gestione-btn gestione-btn-blue" disabled={pending || !ready} style={pending || !ready ? { opacity: 0.6, cursor: "not-allowed" } : undefined}>
            {pending ? "Salvataggio..." : "Cambia password"}
          </button>
        </div>
      </form>
    </div>
  );
}
