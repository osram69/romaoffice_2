"use client";
import { Fragment, useState, useTransition } from "react";
import { createUserAction, resetUserPasswordAction, toggleUserActiveAction } from "@/app/gestione-utenti-x9k2m7/actions";
import type { ActionResult } from "@/app/gestione-utenti-x9k2m7/parse";
import { PasswordRequirementsList } from "./PasswordRequirementsList";
import { PASSWORD_MAX_LENGTH, passwordMeetsPolicy } from "@/lib/password-policy";

export type PanelUser = { id: string; username: string; role: "admin" | "operatore" | "commercialista"; active: boolean; mustChangePassword: boolean; lastLogin: string };

const ROLE_LABEL: Record<PanelUser["role"], string> = { admin: "Amministratore", operatore: "Operatore", commercialista: "Commercialista" };
const disabledStyle = { opacity: 0.6, cursor: "not-allowed" } as const;

type Reveal = { username: string; password: string };

/** The generated password lives only here, until the admin closes the box or starts another action. */
function GeneratedBox({ reveal, onClose }: { reveal: Reveal; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reveal.password);
      setCopied(true);
    } catch {
      setCopied(false); // clipboard blocked: the password can still be selected by hand
    }
  };
  return (
    <div role="status" className="gestione-card" style={{ padding: 16, marginBottom: 16, border: "2px solid #ff7900" }}>
      <p style={{ margin: "0 0 8px", fontSize: 13 }}>Password generata per <strong>{reveal.username}</strong>:</p>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <code style={{ fontSize: 16, padding: "6px 10px", background: "#f8f8f8", border: "1px solid #c8c8c8", borderRadius: 4, userSelect: "all" }}>{reveal.password}</code>
        <button type="button" className="gestione-btn gestione-btn-outline" onClick={copy}>{copied ? "Copiata" : "Copia"}</button>
        <button type="button" className="gestione-btn gestione-btn-blue" onClick={onClose}>Ho copiato la password</button>
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 12, color: "#c0392b", fontWeight: 600 }}>Non verrà mostrata di nuovo. Comunicala all&apos;utente: al primo accesso dovrà sceglierne una nuova.</p>
    </div>
  );
}

function PasswordFields({ password, setPassword, id }: { password: string; setPassword: (value: string) => void; id: string }) {
  return (
    <div className="gestione-field">
      <label htmlFor={id}>Password (oppure usa &quot;Genera&quot;)</label>
      <input id={id} type="password" autoComplete="new-password" maxLength={PASSWORD_MAX_LENGTH} value={password} onChange={e => setPassword(e.target.value)} />
      <PasswordRequirementsList password={password} lang="it" />
    </div>
  );
}

export function UserAdminPanel({ users }: { users: PanelUser[] }) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);

  // new-user form
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"operatore" | "commercialista">("operatore");
  const [password, setPassword] = useState("");

  // inline reset form (one row at a time)
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  function run(action: (fd: FormData) => Promise<ActionResult>, fd: FormData, subject: string, onSuccess?: () => void) {
    setFeedback(null);
    setReveal(null);
    startTransition(async () => {
      let result: ActionResult;
      try {
        result = await action(fd);
      } catch {
        result = { ok: false, message: "Operazione non riuscita, riprova." };
      }
      setFeedback({ ok: result.ok, message: result.message ?? (result.ok ? "Fatto." : "Operazione non riuscita.") });
      if (result.ok) {
        if (result.generatedPassword) setReveal({ username: subject, password: result.generatedPassword });
        onSuccess?.();
      }
    });
  }

  const submitCreate = (generate: boolean) => {
    const fd = new FormData();
    fd.set("username", username);
    fd.set("role", role);
    fd.set("mode", generate ? "generate" : "typed");
    if (!generate) fd.set("password", password);
    run(createUserAction, fd, username.trim().toLowerCase(), () => { setUsername(""); setPassword(""); });
  };

  const submitReset = (user: PanelUser, generate: boolean) => {
    const fd = new FormData();
    fd.set("targetId", user.id);
    fd.set("mode", generate ? "generate" : "typed");
    if (!generate) fd.set("password", resetPassword);
    run(resetUserPasswordAction, fd, user.username, () => { setResetFor(null); setResetPassword(""); });
  };

  const toggle = (user: PanelUser) => {
    const fd = new FormData();
    fd.set("targetId", user.id);
    fd.set("active", String(!user.active));
    run(toggleUserActiveAction, fd, user.username);
  };

  const hasUsername = username.trim().length > 0;
  const createReady = hasUsername && passwordMeetsPolicy(password);
  const resetReady = passwordMeetsPolicy(resetPassword);

  return (
    <div>
      {feedback && (
        <div className={feedback.ok ? undefined : "gestione-login-error"} role={feedback.ok ? "status" : "alert"} style={feedback.ok ? { background: "#e6f4ea", color: "#1a7f37", padding: "8px 12px", borderRadius: 4, marginBottom: 16, fontSize: 13 } : { marginBottom: 16 }}>
          {feedback.message}
        </div>
      )}
      {reveal && <GeneratedBox reveal={reveal} onClose={() => setReveal(null)} />}

      <div className="gestione-card" style={{ padding: 20, marginBottom: 24, maxWidth: 520 }}>
        <h2 style={{ margin: "0 0 12px", fontSize: "1.05rem", color: "#232f3e" }}>Nuovo utente</h2>
        <form onSubmit={e => { e.preventDefault(); if (createReady && !pending) submitCreate(false); }} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="gestione-field">
            <label htmlFor="new-username">Nome utente</label>
            <input id="new-username" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={60} value={username} onChange={e => setUsername(e.target.value)} />
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#777" }}>Da 3 a 60 caratteri: lettere minuscole, numeri, punto, trattino o underscore.</p>
          </div>
          <div className="gestione-field">
            <label htmlFor="new-role">Ruolo</label>
            <select id="new-role" value={role} onChange={e => setRole(e.target.value === "commercialista" ? "commercialista" : "operatore")}>
              <option value="operatore">Operatore</option>
              <option value="commercialista">Commercialista</option>
            </select>
          </div>
          <PasswordFields id="new-password" password={password} setPassword={setPassword} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button type="submit" className="gestione-btn gestione-btn-blue" disabled={pending || !createReady} style={pending || !createReady ? disabledStyle : undefined}>Crea utente</button>
            <button type="button" className="gestione-btn gestione-btn-outline" disabled={pending || !hasUsername} style={pending || !hasUsername ? disabledStyle : undefined} onClick={() => submitCreate(true)}>Genera password e crea</button>
          </div>
        </form>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="gestione-table">
          <thead>
            <tr><th>Nome utente</th><th>Ruolo</th><th>Stato</th><th>Ultimo accesso</th><th>Password</th><th></th></tr>
          </thead>
          <tbody>
            {users.map(user => (
              <Fragment key={user.id}>
                <tr>
                  <td>{user.username}</td>
                  <td>{ROLE_LABEL[user.role]}</td>
                  <td>{user.active ? "Attivo" : "Disattivato"}</td>
                  <td>{user.lastLogin}</td>
                  <td>{user.mustChangePassword ? "Da cambiare al primo accesso" : "Scelta dall'utente"}</td>
                  <td>
                    {user.role !== "admin" && (
                      <div className="gestione-row-actions">
                        <button type="button" className="gestione-btn gestione-btn-outline" disabled={pending} onClick={() => { setResetFor(resetFor === user.id ? null : user.id); setResetPassword(""); }}>Reimposta password</button>
                        <button type="button" className={`gestione-btn ${user.active ? "gestione-btn-red" : "gestione-btn-blue"}`} disabled={pending} onClick={() => toggle(user)}>{user.active ? "Disattiva" : "Riattiva"}</button>
                      </div>
                    )}
                  </td>
                </tr>
                {user.role !== "admin" && resetFor === user.id && (
                  <tr>
                    <td colSpan={6} style={{ background: "#f8f9fa" }}>
                      <form onSubmit={e => { e.preventDefault(); if (resetReady && !pending) submitReset(user, false); }} style={{ maxWidth: 420, padding: "8px 0", display: "flex", flexDirection: "column", gap: 10 }}>
                        <strong>Reimposta la password di {user.username}</strong>
                        <PasswordFields id={`reset-${user.id}`} password={resetPassword} setPassword={setResetPassword} />
                        <p style={{ margin: 0, fontSize: 12, color: "#777" }}>Le sessioni aperte dell&apos;utente verranno chiuse e al prossimo accesso dovrà scegliere una nuova password.</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          <button type="submit" className="gestione-btn gestione-btn-blue" disabled={pending || !resetReady} style={pending || !resetReady ? disabledStyle : undefined}>Imposta password</button>
                          <button type="button" className="gestione-btn gestione-btn-outline" disabled={pending} onClick={() => submitReset(user, true)}>Genera password e imposta</button>
                          <button type="button" className="gestione-btn gestione-btn-outline" disabled={pending} onClick={() => { setResetFor(null); setResetPassword(""); }}>Annulla</button>
                        </div>
                      </form>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
