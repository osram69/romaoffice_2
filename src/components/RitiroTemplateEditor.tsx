"use client";
import { useEffect, useState } from "react";
import { updateRitiroTemplateAction } from "@/app/gestione-configurazione-x9k2m7/actions";
import { DEFAULT_RITIRO_EMAIL_HTML } from "@/lib/dom-ritiro-email";

// Same CDN-loaded TinyMCE integration as ScadenzaEmailPanel/RitiroCorrispondenzaPanel — duplicated
// rather than shared, since it's the only piece in common and this is the only editor on the page.
type TinyEditor = { getContent: () => string; setContent: (html: string) => void; remove: () => void; on: (event: string, cb: () => void) => void };
declare global {
  interface Window { tinymce?: { init: (opts: Record<string, unknown>) => void; get: (id: string) => TinyEditor | null }; }
}

const TINYMCE_SRC = "https://cdnjs.cloudflare.com/ajax/libs/tinymce/6.8.3/tinymce.min.js";
let tinymceLoadPromise: Promise<void> | null = null;

function loadTinymce(): Promise<void> {
  if (window.tinymce) return Promise.resolve();
  if (tinymceLoadPromise) return tinymceLoadPromise;
  tinymceLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TINYMCE_SRC;
    script.referrerPolicy = "origin";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Impossibile caricare l'editor"));
    document.head.appendChild(script);
  });
  return tinymceLoadPromise;
}

// Single instance on the page (unlike the per-company send panels), so a plain fixed id is enough
// — no need for a per-row ref.
const EDITOR_ID = "ritiro-template-editor";

export function RitiroTemplateEditor({ initialHtml }: { initialHtml: string | null }) {
  const [mode, setMode] = useState<"visual" | "html">("visual");
  const [html, setHtml] = useState(initialHtml?.trim() || DEFAULT_RITIRO_EMAIL_HTML);
  const [editorReady, setEditorReady] = useState(false);
  const [status, setStatus] = useState<{ text: string; color: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode !== "visual") return;
    let cancelled = false;
    loadTinymce().then(() => {
      if (cancelled) return;
      window.tinymce?.init({
        selector: `#${EDITOR_ID}`, height: 260, menubar: false, plugins: "lists link",
        toolbar: "undo redo | bold italic underline | bullist numlist | link",
        setup: (editor: TinyEditor) => {
          editor.on("init", () => { editor.setContent(html); setEditorReady(true); });
        },
      });
    }).catch(() => setStatus({ text: "Impossibile caricare l'editor di testo", color: "red" }));
    return () => { cancelled = true; setEditorReady(false); window.tinymce?.get(EDITOR_ID)?.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Switching view: capture whatever's currently shown into `html` before flipping mode, so
  // neither view ever loses an edit made in the other one.
  function switchToHtml() {
    setHtml(window.tinymce?.get(EDITOR_ID)?.getContent() ?? html);
    setMode("html");
  }

  async function save() {
    const finalHtml = mode === "visual" ? (window.tinymce?.get(EDITOR_ID)?.getContent() ?? html) : html;
    setSaving(true);
    setStatus(null);
    const formData = new FormData();
    formData.set("html", finalHtml);
    const result = await updateRitiroTemplateAction(formData);
    setSaving(false);
    if (result.success) { setHtml(finalHtml); setStatus({ text: "Salvato", color: "green" }); }
    else setStatus({ text: result.message || "Errore", color: "red" });
  }

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <button type="button" className="gestione-btn gestione-btn-outline" onClick={mode === "visual" ? switchToHtml : () => setMode("visual")}>
          {mode === "visual" ? "Codice HTML" : "Torna alla visuale"}
        </button>
      </div>
      {mode === "visual" ? (
        <div className="gestione-field" style={{ marginBottom: 8 }}>
          <textarea id={EDITOR_ID} defaultValue="" />
          {!editorReady && <p style={{ fontSize: 12, color: "#666", margin: "4px 0 0" }}>Caricamento...</p>}
        </div>
      ) : (
        <div className="gestione-field" style={{ marginBottom: 8 }}>
          <textarea value={html} onChange={e => setHtml(e.target.value)} rows={10} style={{ fontFamily: "monospace", fontSize: 12, width: "100%" }} />
        </div>
      )}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button type="button" className="gestione-btn gestione-btn-blue" disabled={saving} onClick={save}>Salva</button>
        {status && <span style={{ fontSize: 12, color: status.color }}>{status.text}</span>}
      </div>
    </div>
  );
}
