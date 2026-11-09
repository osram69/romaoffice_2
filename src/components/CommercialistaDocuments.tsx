import { formatContabDate, type ContabSectionDto } from "@/lib/contab-dto";
import { formatMb } from "@/lib/contab-files";

// The accountant's document list. A server component with no state: plain tables and plain links, so the page works
// without client JavaScript. It receives display DTOs only (no stored file name, no download history) and renders
// every name as React text, never as HTML.
const cell = { padding: "10px 12px", borderBottom: "1px solid #eee", verticalAlign: "middle" } as const;

export function CommercialistaDocuments({ sections }: { sections: ContabSectionDto[] }) {
  const hasFiles = sections.some(section => section.files.length > 0);
  if (!hasFiles) {
    return (
      <div className="gestione-card" style={{ padding: 20, maxWidth: 520 }}>
        <p style={{ margin: 0, fontSize: 14, color: "#555" }}>Nessun documento disponibile</p>
      </div>
    );
  }

  return (
    <>
      {sections.map(section => (
        <section key={section.id} aria-labelledby={`sezione-${section.id}`} className="gestione-card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
            <h2 id={`sezione-${section.id}`} style={{ margin: 0, fontSize: "1.1rem", color: "#232f3e", overflowWrap: "anywhere" }}>{section.title}</h2>
            {section.files.length > 0 && (
              <a href={`/api/contabilita/sections/${section.id}/zip`} className="gestione-btn gestione-btn-blue">
                Scarica tutto (ZIP)<span className="sr-only">: {section.title}</span>
              </a>
            )}
          </div>
          {section.files.length === 0 ? (
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "#777" }}>Nessun file in questa sezione</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="gestione-table">
                <caption className="sr-only">File della sezione {section.title}</caption>
                <thead>
                  <tr>
                    <th scope="col">Nome file</th>
                    <th scope="col">Dimensione</th>
                    <th scope="col">Caricato il</th>
                    <th scope="col"><span className="sr-only">Azioni</span></th>
                  </tr>
                </thead>
                <tbody>
                  {section.files.map(file => (
                    <tr key={file.id}>
                      <th scope="row" style={{ ...cell, textAlign: "left", fontWeight: 400, overflowWrap: "anywhere", minWidth: 140 }}>{file.originalName}</th>
                      <td style={{ whiteSpace: "nowrap" }}>{formatMb(file.sizeBytes)}</td>
                      <td>{formatContabDate(file.uploadedAt)}</td>
                      <td>
                        <a href={`/api/contabilita/files/${file.id}`} className="gestione-btn gestione-btn-outline" style={{ whiteSpace: "nowrap" }}>
                          Scarica<span className="sr-only"> {file.originalName}</span>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </>
  );
}
