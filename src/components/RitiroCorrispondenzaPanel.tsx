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

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function daysAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return days <= 0 ? "oggi" : days === 1 ? "ieri" : `${days} giorni fa`;
}

export function RitiroCorrispondenzaPanel({ id, lastSentAt, previouslySent, hasPec = true }: { id: number; lastSentAt: string | null; previouslySent: boolean; hasPec?: boolean }) {
  const editorId = useRef(`ritiro-editor-${id}`);
  const pendingHtml = useRef<string | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [status, setStatus] = useState<{ text: string; color: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [viaPec, setViaPec] = useState(false);
  const [sentAt, setSentAt] = useState<string | null>(lastSentAt);

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
    if (!subject.trim()) { setStatus({ text: "Oggetto email vuoto", color: "red" }); return; }
    if (!confirm(viaPec ? "Inviare questa richiesta di ritiro corrispondenza via PEC (con in copia le email ordinarie del cliente)?" : "Inviare questa richiesta di ritiro corrispondenza via email ordinaria?")) return;
    setSending(true);
    setStatus({ text: "Invio in corso...", color: "#555" });
    const formData = new FormData();
    formData.set("id", String(id));
    formData.set("html", html);
    formData.set("subject", subject);
    if (viaPec) formData.set("pec", "on");
    const result = await inviaRitiroAction(formData);
    setSending(false);
    if (result.success) setSentAt(new Date().toISOString());
    setStatus(result.success ? { text: "Inviata con successo", color: "green" } : { text: result.message || "Errore", color: "red" });
  }

  const busy = loading || !editorReady;

  return (
    <div>
      {sentAt ? (
        <p role="alert" style={{ margin: "0 0 8px", color: "#c00", fontSize: 13, fontWeight: 700 }}>
          Attenzione: l&apos;avviso di ritiro è già stato inviato a questa società il {fmtDateTime(sentAt)} ({daysAgo(sentAt)}).
        </p>
      ) : previouslySent ? (
        <p role="alert" style={{ margin: "0 0 8px", color: "#c00", fontSize: 13, fontWeight: 700 }}>
          Attenzione: l&apos;avviso di ritiro è già stato inviato a questa società in passato (data non registrata).
        </p>
      ) : null}
      <div className="gestione-field" style={{ marginBottom: 8 }}>
        <label>Oggetto</label>
        <input value={subject} onChange={e => setSubject(e.target.value)} maxLength={300} />
      </div>
      <div className="gestione-field" style={{ marginBottom: 8 }}>
        <label>Testo email — verificalo prima di inviare</label>
        <textarea id={editorId.current} defaultValue="" />
        {loading && <p style={{ fontSize: 12, color: "#666", margin: "4px 0 0" }}>Caricamento...</p>}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#232f3e" }} title={hasPec ? "Invia dalla PEC alla PEC del cliente, con in copia le sue email ordinarie" : "Questa società non ha un indirizzo PEC"}>
          <input type="checkbox" checked={viaPec} disabled={busy || sending || !hasPec} onChange={e => setViaPec(e.target.checked)} />
          Invia come PEC{!hasPec ? " (nessuna PEC)" : ""}
        </label>
        <button type="button" className="gestione-btn gestione-btn-blue" disabled={busy || sending} onClick={send}>{viaPec ? "Invia PEC" : "Invia"}</button>
        <button type="button" className="gestione-btn gestione-btn-outline" disabled={busy || sending} onClick={() => load(true)}>Rigenera dal modello</button>
        {status && <span style={{ fontSize: 12, color: status.color }}>{status.text}</span>}
      </div>
    </div>
  );
}
