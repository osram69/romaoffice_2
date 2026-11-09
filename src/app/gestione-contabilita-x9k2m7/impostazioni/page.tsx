import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { contabAccessFromCookies, hasContabPassword } from "@/lib/contab-auth";
import { listSectionsWithFiles } from "@/lib/contab-data";
import { toContabSettingsSectionDto } from "@/lib/contab-dto";
import { requireAdminUser } from "@/lib/staff-guards";
import { GestioneShell } from "@/components/GestioneNav";
import { ContabPasswordForm } from "@/components/ContabPasswordForm";
import { ContabSectionsAdmin } from "@/components/ContabSectionsAdmin";

const MAIN_PATH = "/gestione-contabilita-x9k2m7";
const BASE_PATH = `${MAIN_PATH}/impostazioni`;
const USERS_PATH = "/gestione-utenti-x9k2m7";

// Same protection as the main page: admin, then a valid unlock. Without the second password or without
// an unlock the admin goes back to the main page, which shows the matching form, and no data is read.
export default async function ContabilitaImpostazioniPage() {
  const admin = await requireAdminUser(BASE_PATH);
  if (!(await hasContabPassword())) redirect(MAIN_PATH);
  const unlocked = await contabAccessFromCookies();
  if (!unlocked) redirect(MAIN_PATH);

  // Only id, title and the number of files reach the browser.
  const sections = (await listSectionsWithFiles()).map(toContabSettingsSectionDto);

  return (
    <GestioneShell role={admin.role} active="contabilita" username={admin.username}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
        <h1 className="gestione-h1">Impostazioni di Contabilità</h1>
        <Link href={MAIN_PATH} className="gestione-btn gestione-btn-outline"><ArrowLeft size={14} /> Torna alla Contabilità</Link>
      </div>
      <p style={{ fontSize: 12, color: "#666", marginTop: 0, marginBottom: 20 }}>
        Gestisci le sezioni dei documenti e la password di Contabilità.
      </p>

      <ContabSectionsAdmin sections={sections} />
      <ContabPasswordForm />

      <div className="gestione-card" style={{ padding: 20, maxWidth: 520 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: "1.05rem", color: "#232f3e" }}>Accesso del commercialista</h2>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "#555" }}>
          L&apos;utenza e la password del commercialista si gestiscono in &quot;Utenti e password&quot;.
        </p>
        <Link href={USERS_PATH} className="gestione-btn gestione-btn-outline"><Users size={14} /> Utenti e password</Link>
      </div>
    </GestioneShell>
  );
}
