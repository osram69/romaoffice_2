import { listSectionsWithFiles } from "@/lib/contab-data";
import { toContabSectionDto } from "@/lib/contab-dto";
import { PASSWORD_CHANGE_PATH } from "@/lib/staff-auth";
import { requireCommercialista } from "@/lib/staff-guards";
import { staffLogoutAction } from "@/lib/staff-actions";
import { BrandWords } from "@/components/BrandWords";
import { CommercialistaDocuments } from "@/components/CommercialistaDocuments";

export const dynamic = "force-dynamic";

// The accountant's whole area: brand, "Cambia password", "Esci" and the documents. No dashboard menu, no upload,
// no settings. Plain links and one logout form, so it needs no client JavaScript.
export default async function CommercialistaPage() {
  const user = await requireCommercialista();
  // Display-only DTOs: no stored file name or server path ever reaches the markup.
  const sections = (await listSectionsWithFiles()).map(toContabSectionDto);

  return (
    <div className="gestione-shell">
      <header style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 24px", background: "#fff", borderBottom: "1px solid #e3e6ea" }}>
        <BrandWords />
        <nav aria-label="Account" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
          <span style={{ color: "#666" }}>{user.username}</span>
          <a href={PASSWORD_CHANGE_PATH} className="gestione-btn gestione-btn-outline">Cambia password</a>
          <form action={staffLogoutAction} style={{ margin: 0 }}>
            <button type="submit" className="gestione-btn gestione-btn-outline">Esci</button>
          </form>
        </nav>
      </header>
      <main style={{ padding: 24, maxWidth: 960, marginInline: "auto" }}>
        <h1 className="gestione-h1" style={{ marginBottom: 20 }}>Documentazione contabile</h1>
        <CommercialistaDocuments sections={sections} />
      </main>
    </div>
  );
}
