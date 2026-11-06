import { requireAdminUser } from "@/lib/staff-guards";
import { listStaffUsers } from "@/lib/staff-users";
import { GestioneShell } from "@/components/GestioneNav";
import { UserAdminPanel, type PanelUser } from "@/components/UserAdminPanel";

const BASE_PATH = "/gestione-utenti-x9k2m7";

export default async function UtentiPage() {
  const admin = await requireAdminUser(BASE_PATH);
  const rows = await listStaffUsers();
  // Only plain, display-ready fields cross to the client component (no hashes, dates already formatted).
  const users: PanelUser[] = rows.map(row => ({
    id: row.id,
    username: row.username,
    role: row.role,
    active: row.active,
    mustChangePassword: row.mustChangePassword,
    lastLogin: row.lastLoginAt ? row.lastLoginAt.toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "short" }) : "mai",
  }));

  return (
    <GestioneShell role={admin.role} active="utenti" username={admin.username}>
      <h1 className="gestione-h1" style={{ marginBottom: 8 }}>Utenti e password</h1>
      <p style={{ fontSize: 12, color: "#666", marginTop: -4, marginBottom: 20 }}>
        Crea gli accessi di operatori e commercialista e reimposta le loro password. Gli account non si cancellano: si disattivano.
        Il commercialista vede solo la pagina di download della contabilità.
      </p>
      <UserAdminPanel users={users} />
    </GestioneShell>
  );
}
