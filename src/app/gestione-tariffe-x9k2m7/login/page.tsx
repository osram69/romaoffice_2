"use client";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { staffLoginAction } from "@/lib/staff-actions";

export default function StaffLoginPage() {
  const [state, action, pending] = useActionState(staffLoginAction, { error: false });
  const params = useSearchParams();
  const next = params.get("next") || "";
  return (
    <div className="gestione-login-page">
      <form action={action} className="gestione-login-box">
        <h1>Accesso Gestione</h1>
        {state.error && <div className="gestione-login-error">Username o password errati</div>}
        <input type="hidden" name="next" value={next} />
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input id="username" name="username" type="text" required autoFocus autoComplete="username" />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        <button type="submit" disabled={pending} className="gestione-btn-primary">
          {pending ? "Verifica..." : "Login"}
        </button>
      </form>
    </div>
  );
}
