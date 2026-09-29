"use client";
import { useEffect, useRef, useState } from "react";
import { getRitiroDraftAction, inviaRitiroAction } from "@/app/gestione-domiciliazioni-x9k2m7/actions";

// Same CDN-loaded TinyMCE integration as ScadenzaEmailPanel — duplicated rather than shared
// since it's the only piece both panels have in common, and each mounts its own editor instance.
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

export function RitiroCorrispondenzaPanel({ id }: { id: number }) {
  const editorId = useRef(`ritiro-editor-${id}`);
  const pendingHtml = useRef<string | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [status, setStatus] = useState<{ text: string; color: string } | null>(null);
  const [sending, setSending] = useState(false);

  function setEditorContent(html: string) {
    const editor = window.tinymce?.get(editorId.current);
    if (editor) editor.setContent(html);
    else pendingHtml.current = html;
  }
  function getEditorContent(): string {
    return window.tinymce?.get(editorId.current)?.getContent() ?? pendingHtml.current ?? "";
  }

  async function load(regenerate = false) {
    setLoading(true);
    setStatus(null);
    const draft = await getRitiroDraftAction(id, regenerate);
    setLoading(false);
    if (!draft.success) { setStatus({ text: draft.message || "Errore", color: "red" }); return; }
    setSubject(draft.subject || "");
    setEditorContent(draft.html || "");
  }

  useEffect(() => {
    let cancelled = false;
    loadTinymce().then(() => {
      if (cancelled) return;
      window.tinymce?.init({
        selector: `#${editorId.current}`, height: 260, menubar: false, plugins: "lists link",
        toolbar: "undo redo | bold italic underline | bullist numlist | link",
        setup: (editor: TinyEditor) => {
          editor.on("init", () => {
            setEditorReady(true);
            if (pendingHtml.current !== null) { editor.setContent(pendingHtml.current); pendingHtml.current = null; }
          });
        },
      });
    }).catch(() => setStatus({ text: "Impossibile caricare l'editor di testo", color: "red" }));
    load();
    return () => { cancelled = true; window.tinymce?.get(editorId.current)?.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function send() {
    const html = getEditorContent();
    if (!html.trim()) { setStatus({ text: "Testo email vuoto", color: "red" }); return; }
    if (!confirm("Inviare questa richiesta di ritiro corrispondenza? Verrà inviata via PEC se presente, altrimenti via email ordinaria.")) return;
    setSending(true);
    setStatus({ text: "Invio in corso...", color: "#555" });
    const formData = new FormData();
    formData.set("id", String(id));
    formData.set("html", html);
    const result = await inviaRitiroAction(formData);
    setSending(false);
    setStatus(result.success ? { text: "Inviata con successo", color: "green" } : { text: result.message || "Errore", color: "red" });
  }

  const busy = loading || !editorReady;

  return (
    <div>
      <div className="gestione-field" style={{ marginBottom: 8 }}>
        <label>Oggetto</label>
        <input value={subject} readOnly />
      </div>
      <div className="gestione-field" style={{ marginBottom: 8 }}>
        <label>Testo email — verificalo prima di inviare</label>
        <textarea id={editorId.current} defaultValue="" />
        {loading && <p style={{ fontSize: 12, color: "#666", margin: "4px 0 0" }}>Caricamento...</p>}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button type="button" className="gestione-btn gestione-btn-blue" disabled={busy || sending} onClick={send}>Invia</button>
        <button type="button" className="gestione-btn gestione-btn-outline" disabled={busy || sending} onClick={() => load(true)}>Rigenera dal modello</button>
        {status && <span style={{ fontSize: 12, color: status.color }}>{status.text}</span>}
      </div>
    </div>
  );
}
