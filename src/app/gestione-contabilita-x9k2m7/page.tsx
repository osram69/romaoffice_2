import Link from "next/link";
import type { ReactNode } from "react";
import { Download, Settings } from "lucide-react";
import { contabAccessFromCookies, hasContabPassword } from "@/lib/contab-auth";
import { listSectionsWithFiles } from "@/lib/contab-data";
import { formatContabDate, toContabSectionDto } from "@/lib/contab-dto";
import { formatMb } from "@/lib/contab-files";
import { requireAdminUser } from "@/lib/staff-guards";
import { GestioneShell } from "@/components/GestioneNav";
import { ContabCreatePasswordForm, ContabUnlockForm } from "@/components/ContabUnlockForm";
import { ContabDeleteFileButton } from "@/components/ContabDeleteFileButton";
import { ContabUploadRow } from "@/components/ContabUploadRow";

const BASE_PATH = "/gestione-contabilita-x9k2m7";

// Reads cookies (staff session and unlock), so it is rendered on every request and never cached.
// Order matters: admin first, then the second-password state, and only after the unlock check has passed
// is a single row of sections or files read from the database.
export default async function ContabilitaPage() {
  const admin = await requireAdminUser(BASE_PATH);
  const shell = (heading: string, children: ReactNode) => (
    <GestioneShell role={admin.role} active="contabilita" username={admin.username}>
      <h1 className="gestione-h1" style={{ marginBottom: 8 }}>{heading}</h1>
      {children}
    </GestioneShell>
  );

  if (!(await hasContabPassword())) {
    return shell("Contabilità", <ContabCreatePasswordForm />);
  }
  const unlocked = await contabAccessFromCookies();
  if (!unlocked) {
    return shell("Contabilità", <ContabUnlockForm />);
  }

  // Display-only DTOs: no stored file name or server path ever leaves this page.
  const sections = (await listSectionsWithFiles()).map(toContabSectionDto);

  return (
    <GestioneShell role={admin.role} active="contabilita" username={admin.username}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
        <h1 className="gestione-h1">Contabilità</h1>
        <Link href={`${BASE_PATH}/impostazioni`} className="gestione-btn gestione-btn-outline"><Settings size={14} /> Impostazioni</Link>
      </div>
      <p style={{ fontSize: 12, color: "#666", marginTop: 0, marginBottom: 20 }}>
        I documenti sono cifrati. Il commercialista li scarica dalla sua pagina; qui vedi anche quando ha scaricato l&apos;ultima volta ciascun file.
      </p>

      {sections.length === 0 ? (
        <div className="gestione-card" style={{ padding: 20, maxWidth: 520 }}>
          <p style={{ margin: 0, fontSize: 13, color: "#555" }}>
            Non c&apos;è ancora nessuna sezione. Creane una dalle <Link href={`${BASE_PATH}/impostazioni`} style={{ color: "#007bff" }}>impostazioni</Link> (per esempio &quot;1° trimestre 2026&quot;), poi potrai caricare i documenti.
          </p>
        </div>
      ) : (
        sections.map(section => (
          <section key={section.id} className="gestione-card" style={{ padding: 20, marginBottom: 20 }}>
            <h2 style={{ margin: "0 0 4px", fontSize: "1.1rem", color: "#232f3e" }}>{section.title}</h2>
            <ContabUploadRow sectionId={section.id} />
            {section.files.length === 0 ? (
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "#777" }}>Nessun file in questa sezione.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="gestione-table">
                  <thead>
                    <tr><th>File</th><th>Dimensione</th><th>Caricato il</th><th>Ultimo download del commercialista</th><th></th></tr>
                  </thead>
                  <tbody>
                    {section.files.map(file => (
                      <tr key={file.id}>
                        <td style={{ wordBreak: "break-all" }}>{file.originalName}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{formatMb(file.sizeBytes)}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{formatContabDate(file.uploadedAt)}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{file.lastDownloadAt ? formatContabDate(file.lastDownloadAt) : "—"}</td>
                        <td>
                          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 8 }}>
                            <a href={`/api/contabilita/files/${file.id}`} className="gestione-btn gestione-btn-outline"><Download size={14} /> Scarica</a>
                            <ContabDeleteFileButton fileId={file.id} name={file.originalName} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))
      )}
    </GestioneShell>
  );
}
