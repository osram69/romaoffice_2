"use client";
import { useActionState } from "react";
import { loginAction } from "../actions";

export default function AdminLoginPage() {
  const [state, action, pending] = useActionState(loginAction, { error: false });
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form action={action} className="w-full max-w-sm bg-white rounded-lg shadow p-8 space-y-4">
        <h1 className="text-lg font-semibold text-slate-800">Gestione tariffe</h1>
        <p className="text-sm text-slate-500">Area riservata Roma Office Sharing.</p>
        {state.error && <p className="text-sm text-red-600">Password errata.</p>}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">Password</label>
          <input id="password" name="password" type="password" required autoFocus
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500" />
        </div>
        <button type="submit" disabled={pending} className="w-full bg-slate-800 text-white rounded py-2 text-sm font-semibold hover:bg-slate-700 disabled:opacity-60">
          {pending ? "Verifica..." : "Accedi"}
        </button>
      </form>
    </div>
  );
}
