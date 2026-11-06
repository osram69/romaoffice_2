import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { STAFF_SESSION_COOKIE, getStaffUser } from "@/lib/staff-auth";
import { staffLogoutAction } from "@/lib/staff-actions";
import { GestioneShell } from "@/components/GestioneNav";
import { BrandWords } from "@/components/BrandWords";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

const LOGIN_PATH = "/gestione-tariffe-x9k2m7/login";

function BarePage({ username, children }: { username: string; children: ReactNode }) {
  return (
    <div className="gestione-shell">
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 24px", background: "#fff", borderBottom: "1px solid #e3e6ea" }}>
        <BrandWords />
        <form action={staffLogoutAction} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "#666" }}>{username}</span>
          <button type="submit" className="gestione-btn gestione-btn-outline">Esci</button>
        </form>
      </header>
      <main style={{ padding: 24 }}>{children}</main>
    </div>
  );
}

export default async function ChangePasswordPage() {
  const store = await cookies();
  // allowMustChange: this is the one page a user with a temporary password can open.
  const user = await getStaffUser(store.get(STAFF_SESSION_COOKIE)?.value, { allowMustChange: true });
  if (!user) redirect(LOGIN_PATH);

  const content = (
    <>
      <h1 className="gestione-h1" style={{ marginBottom: 16 }}>Cambia la mia password</h1>
      {user.mustChangePassword && (
        <div className="gestione-login-error" role="alert" style={{ maxWidth: 440 }}>Devi scegliere una nuova password per continuare.</div>
      )}
      <div className="gestione-card" style={{ maxWidth: 440, padding: 24 }}>
        <ChangePasswordForm />
      </div>
    </>
  );

  // No dashboard menu or dashboard data for the accountant, nor for anyone still on a temporary password
  // (they have not proven yet that the password is theirs): a bare page with the brand, the form and "Esci".
  if (user.role === "commercialista" || user.mustChangePassword) {
    return <BarePage username={user.username}>{content}</BarePage>;
  }

  return (
    <GestioneShell role={user.role} active="password" username={user.username}>
      {content}
    </GestioneShell>
  );
}
