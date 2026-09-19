"use client";
import { useEffect, useRef, useState } from "react";
import { getScadenzaDraftAction, inviaScadenzaAction } from "@/app/gestione-domiciliazioni-x9k2m7/actions";

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

export function ScadenzaEmailPanel({ id, initialPrezzoRinnovo }: { id: number; initialPrezzoRinnovo: number | null }) {
  const editorId = useRef(`scadenza-editor-${id}`);
  const pendingHtml = useRef<string | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [prezzo, setPrezzo] = useState(initialPrezzoRinnovo !== null ? String(initialPrezzoRinnovo) : "");
  const [includeSconto, setIncludeSconto] = useState(false);
  const [status, setStatus] = useState<{ text: string; color: string } | null>(null);
  const [sending, setSending] = useState(false);

  function setEditorContent(html: string) {
    const editor = window.tinymce?.get(editorId.current);
    if (editor) editor.setContent(html);
    else pendingHtml.current = html;
  }

  async function load(regenerate: boolean, forceSconto?: boolean) {
    setLoading(true);
    setStatus(null);
    const draft = await getScadenzaDraftAction(id, regenerate, regenerate ? forceSconto : undefined);
    setLoading(false);
    if (!draft.success) { setStatus({ text: draft.message || "Errore", color: "red" }); return; }
    setSubject(draft.subject || "");
    setPrezzo(draft.prezzoRinnovo !== null && draft.prezzoRinnovo !== undefined ? String(draft.prezzoRinnovo) : "");
    if (draft.scontoDefault !== undefined && forceSconto === undefined) setIncludeSconto(draft.scontoDefault);
    setEditorContent(draft.html || "");
  }

  useEffect(() => {
    let cancelled = false;
    loadTinymce().then(() => {
      if (cancelled) return;
      window.tinymce?.init({
        selector: `#${editorId.current}`, height: 380, menubar: false, plugins: "lists link",
        toolbar: "undo redo | bold italic underline | bullist numlist | link",
        setup: (editor: TinyEditor) => {
          editor.on("init", () => {
            setEditorReady(true);
            if (pendingHtml.current !== null) { editor.setContent(pendingHtml.current); pendingHtml.current = null; }
          });
        },
      });
    }).catch(() => setStatus({ text: "Impossibile caricare l'editor di testo", color: "red" }));
    load(false);
    return () => { cancelled = true; window.tinymce?.get(editorId.current)?.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function toggleSconto(checked: boolean) {
    setIncludeSconto(checked);
    await load(true, checked);
  }

  async function send() {
    const html = window.tinymce?.get(editorId.current)?.getContent() || "";
    if (!html.trim()) { setStatus({ text: "Testo email vuoto", color: "red" }); return; }
    if (!confirm("Inviare questa email di scadenza? Verrà inviata via PEC se presente, altrimenti via email ordinaria.")) return;
    setSending(true);
    setStatus({ text: "Invio in corso...", color: "#555" });
    const formData = new FormData();
    formData.set("id", String(id));
    formData.set("html", html);
    formData.set("prezzoRinnovo", prezzo);
    const result = await inviaScadenzaAction(formData);
    setSending(false);
    setStatus(result.success ? { text: "Inviata con successo", color: "green" } : { text: result.message || "Errore", color: "red" });
  }

  const busy = loading || !editorReady;

  return (
    <div>
      <div className="gestione-field" style={{ marginBottom: 10 }}>
        <label>Oggetto</label>
        <input value={subject} readOnly />
      </div>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 10 }}>
        <div className="gestione-field" style={{ maxWidth: 200 }}>
          <label>Prezzo rinnovo (€, senza IVA)</label>
          <input type="number" value={prezzo} onChange={e => setPrezzo(e.target.value)} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#232f3e", marginTop: 20 }}>
          <input type="checkbox" checked={includeSconto} disabled={busy} onChange={e => toggleSconto(e.target.checked)} />
          Includi dicitura &quot;sconto attivazioni non più applicabile&quot;
        </label>
      </div>
      <div className="gestione-field" style={{ marginBottom: 10 }}>
        <label>Testo email — verificalo prima di inviare</label>
        <textarea id={editorId.current} defaultValue="" />
        {loading && <p style={{ fontSize: 13, color: "#666" }}>Caricamento bozza...</p>}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button type="button" className="gestione-btn gestione-btn-blue" disabled={busy || sending} onClick={send}>Invia</button>
        <button type="button" className="gestione-btn gestione-btn-outline" disabled={busy || sending} onClick={() => load(true, includeSconto)}>Rigenera dal modello</button>
        {status && <span style={{ fontSize: 12, color: status.color }}>{status.text}</span>}
      </div>
    </div>
  );
}
