"use client";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { staffLoginAction } from "@/lib/staff-actions";

export default function StaffLoginPage() {
  const [state, action, pending] = useActionState(staffLoginAction, { error: false });
  const params = useSearchParams();
  const next = params.get("next") || "";
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form action={action} className="w-full max-w-sm bg-white rounded-lg shadow p-8 space-y-4">
        <h1 className="text-lg font-semibold text-slate-800">Gestione Roma Office Sharing</h1>
        <p className="text-sm text-slate-500">Area riservata staff.</p>
        {state.error && <p className="text-sm text-red-600">Credenziali non valide.</p>}
        <input type="hidden" name="next" value={next} />
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1">Utente</label>
          <input id="username" name="username" type="text" required autoFocus autoComplete="username"
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500" />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">Password</label>
          <input id="password" name="password" type="password" required autoComplete="current-password"
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500" />
        </div>
        <button type="submit" disabled={pending} className="w-full bg-slate-800 text-white rounded py-2 text-sm font-semibold hover:bg-slate-700 disabled:opacity-60">
          {pending ? "Verifica..." : "Accedi"}
        </button>
      </form>
    </div>
  );
}
