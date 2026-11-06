"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { createSectionAction, deleteSectionAction, moveSectionAction, renameSectionAction } from "@/app/gestione-contabilita-x9k2m7/actions";
import type { ContabResult } from "@/app/gestione-contabilita-x9k2m7/parse";
import { CONTAB_GENERIC_FAILURE, CONTAB_LOCKED_MESSAGE } from "@/lib/contab-messages";
import type { ContabSettingsSectionDto } from "@/lib/contab-dto";
import { SECTION_TITLE_MAX, normalizeSectionTitle } from "@/lib/contab-title";

const disabledStyle = { opacity: 0.5, cursor: "not-allowed" } as const;

/** New section form and the list of sections (rename, move up/down, delete). Sections are shown in the same order as on the main page. */
export function ContabSectionsAdmin({ sections }: { sections: ContabSettingsSectionDto[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [title, setTitle] = useState("");
  const [renaming, setRenaming] = useState<{ id: number; title: string } | null>(null);

  function run(action: () => Promise<ContabResult>, onSuccess?: () => void) {
    setFeedback(null);
    startTransition(async () => {
      let result: ContabResult;
      try {
        result = await action();
      } catch {
        result = { ok: false, message: CONTAB_GENERIC_FAILURE };
      }
      if (!result.ok && result.message === CONTAB_LOCKED_MESSAGE) {
        // The unlock expired: refreshing sends the admin back to the password form.
        router.refresh();
        return;
      }
      if (result.message) setFeedback({ ok: result.ok, message: result.message });
      else if (!result.ok) setFeedback({ ok: false, message: CONTAB_GENERIC_FAILURE });
      if (result.ok) onSuccess?.();
    });
  }

  const create = () => {
    const fd = new FormData();
    fd.set("title", title);
    run(() => createSectionAction(fd), () => setTitle(""));
  };

  const rename = () => {
    if (!renaming) return;
    const fd = new FormData();
    fd.set("sectionId", String(renaming.id));
    fd.set("title", renaming.title);
    run(() => renameSectionAction(fd), () => setRenaming(null));
  };

  const remove = (section: ContabSettingsSectionDto) => {
    if (!window.confirm(`Eliminare la sezione "${section.title}"?`)) return;
    run(() => deleteSectionAction(section.id));
  };

  const createReady = normalizeSectionTitle(title).ok;
  const renameReady = renaming !== null && normalizeSectionTitle(renaming.title).ok;

  return (
    <div>
      {feedback && (
        <div className={feedback.ok ? undefined : "gestione-login-error"} role={feedback.ok ? "status" : "alert"} style={feedback.ok ? { background: "#e6f4ea", color: "#1a7f37", padding: "8px 12px", borderRadius: 4, marginBottom: 16, fontSize: 13 } : { marginBottom: 16 }}>
          {feedback.message}
        </div>
      )}

      <div className="gestione-card" style={{ padding: 20, marginBottom: 24, maxWidth: 520 }}>
        <h2 style={{ margin: "0 0 12px", fontSize: "1.05rem", color: "#232f3e" }}>Nuova sezione</h2>
        <form onSubmit={e => { e.preventDefault(); if (createReady && !pending) create(); }} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="gestione-field">
            <label htmlFor="section-title">Titolo</label>
            <input id="section-title" autoComplete="off" maxLength={SECTION_TITLE_MAX} placeholder="Per esempio: 1° trimestre 2026" value={title} onChange={e => setTitle(e.target.value)} />
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#777" }}>Da 1 a {SECTION_TITLE_MAX} caratteri. La nuova sezione compare in cima all&apos;elenco.</p>
          </div>
          <div>
            <button type="submit" className="gestione-btn gestione-btn-blue" disabled={pending || !createReady} style={pending || !createReady ? disabledStyle : undefined}>Crea sezione</button>
          </div>
        </form>
      </div>

      <div className="gestione-card" style={{ padding: 20, marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: "1.05rem", color: "#232f3e" }}>Sezioni</h2>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "#777" }}>Nell&apos;ordine in cui compaiono nella pagina Contabilità. Una sezione si può eliminare solo quando è vuota.</p>
        {sections.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "#555" }}>Non c&apos;è ancora nessuna sezione: creane una qui sopra.</p>
        ) : (
          <table className="gestione-table">
            <thead>
              <tr><th>Titolo</th><th>File</th><th>Ordine</th><th>Azioni</th></tr>
            </thead>
            <tbody>
              {sections.map((section, index) => {
                const editing = renaming?.id === section.id;
                const empty = section.fileCount === 0;
                return (
                  <tr key={section.id}>
                    <td>
                      {editing ? (
                        <form onSubmit={e => { e.preventDefault(); if (renameReady && !pending) rename(); }} style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          <input aria-label="Nuovo titolo della sezione" autoFocus maxLength={SECTION_TITLE_MAX} value={renaming.title} onChange={e => setRenaming({ id: section.id, title: e.target.value })} style={{ flex: "1 1 220px", fontSize: 13, padding: "5px 8px", border: "1px solid #c8c8c8", borderRadius: 4 }} />
                          <button type="submit" className="gestione-btn gestione-btn-blue" disabled={pending || !renameReady} style={pending || !renameReady ? disabledStyle : undefined}>Salva</button>
                          <button type="button" className="gestione-btn gestione-btn-outline" disabled={pending} onClick={() => setRenaming(null)}>Annulla</button>
                        </form>
                      ) : (
                        <strong>{section.title}</strong>
                      )}
                    </td>
                    <td>{section.fileCount}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button type="button" className="gestione-btn gestione-btn-outline" title="Sposta su" aria-label={`Sposta su: ${section.title}`} disabled={pending || index === 0} style={pending || index === 0 ? disabledStyle : undefined} onClick={() => run(() => moveSectionAction(section.id, "up"))}><ChevronUp size={14} /></button>{" "}
                      <button type="button" className="gestione-btn gestione-btn-outline" title="Sposta giù" aria-label={`Sposta giù: ${section.title}`} disabled={pending || index === sections.length - 1} style={pending || index === sections.length - 1 ? disabledStyle : undefined} onClick={() => run(() => moveSectionAction(section.id, "down"))}><ChevronDown size={14} /></button>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                        <button type="button" className="gestione-btn gestione-btn-outline" disabled={pending || editing} style={pending || editing ? disabledStyle : undefined} onClick={() => setRenaming({ id: section.id, title: section.title })}><Pencil size={14} /> Rinomina</button>
                        <button type="button" className="gestione-btn gestione-btn-red" disabled={pending || !empty} style={pending || !empty ? disabledStyle : undefined} onClick={() => remove(section)}><Trash2 size={14} /> Elimina</button>
                        {!empty && <span style={{ fontSize: 12, color: "#777" }}>Contiene {section.fileCount} file: eliminali prima dalla pagina Contabilità.</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
