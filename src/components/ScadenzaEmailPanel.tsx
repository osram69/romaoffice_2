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
  // What's currently injected in place of "[PREZZO]" in the editor content — starts as the
  // placeholder itself, so the very first keystroke in the prezzo field has something to replace.
  const lastPrezzoText = useRef("[PREZZO]");
  const [editorReady, setEditorReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [prezzo, setPrezzo] = useState(initialPrezzoRinnovo !== null ? String(initialPrezzoRinnovo) : "");
  const [includeSconto, setIncludeSconto] = useState(false);
  const [availableMonths, setAvailableMonths] = useState<number[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
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

  // Swaps whatever price text is currently shown for a new one — "[PREZZO]" the first time, then
  // whatever was last injected — so the editor always mirrors the prezzo field without a full
  // server round-trip (and without resetting the rest of the text staff may have already edited).
  function syncPrezzoIntoEditor(newValue: string) {
    const newText = newValue.trim() || "[PREZZO]";
    const html = getEditorContent();
    if (!html || newText === lastPrezzoText.current) return;
    const updated = html.split(lastPrezzoText.current).join(newText);
    lastPrezzoText.current = newText;
    if (updated !== html) setEditorContent(updated);
  }

  function updatePrezzo(value: string) {
    setPrezzo(value);
    syncPrezzoIntoEditor(value);
  }

  // Initial mount / explicit "Rigenera dal modello": resets everything, including prezzo and the
  // month checkboxes, to the server's defaults.
  async function load() {
    setLoading(true);
    setStatus(null);
    const draft = await getScadenzaDraftAction(id);
    setLoading(false);
    if (!draft.success) { setStatus({ text: draft.message || "Errore", color: "red" }); return; }
    setSubject(draft.subject || "");
    const prezzoText = draft.prezzoRinnovo !== null && draft.prezzoRinnovo !== undefined ? String(draft.prezzoRinnovo) : "";
    setPrezzo(prezzoText);
    lastPrezzoText.current = prezzoText || "[PREZZO]";
    if (draft.scontoDefault !== undefined) setIncludeSconto(draft.scontoDefault);
    setAvailableMonths(draft.availableMonths ?? []);
    setSelectedMonths(draft.defaultMonths ?? []);
    setEditorContent(draft.html || "");
  }

  // Sconto/month checkbox toggles: regenerate the template server-side with the new setting, but
  // keep whatever prezzo is currently in the field instead of reverting to the saved DB value.
  async function regenerate(overrides: { sconto?: boolean; months?: number[] }) {
    setLoading(true);
    setStatus(null);
    const sconto = overrides.sconto ?? includeSconto;
    const months = overrides.months ?? selectedMonths;
    const draft = await getScadenzaDraftAction(id, true, sconto, months);
    setLoading(false);
    if (!draft.success) { setStatus({ text: draft.message || "Errore", color: "red" }); return; }
    lastPrezzoText.current = draft.prezzoRinnovo !== null && draft.prezzoRinnovo !== undefined ? String(draft.prezzoRinnovo) : "[PREZZO]";
    setEditorContent(draft.html || "");
    syncPrezzoIntoEditor(prezzo);
  }

  useEffect(() => {
    let cancelled = false;
    loadTinymce().then(() => {
      if (cancelled) return;
      window.tinymce?.init({
        selector: `#${editorId.current}`, height: 300, menubar: false, plugins: "lists link",
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

  async function toggleSconto(checked: boolean) {
    setIncludeSconto(checked);
    await regenerate({ sconto: checked });
  }

  async function toggleMonth(month: number, checked: boolean) {
    const next = checked ? [...selectedMonths, month].sort((a, b) => a - b) : selectedMonths.filter(m => m !== month);
    setSelectedMonths(next);
    await regenerate({ months: next });
  }

  async function send() {
    const html = getEditorContent();
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
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", marginBottom: 8 }}>
        <div className="gestione-field" style={{ flex: "2 1 260px", minWidth: 0 }}>
          <label>Oggetto</label>
          <input value={subject} readOnly />
        </div>
        <div className="gestione-field" style={{ width: 140 }}>
          <label>Prezzo rinnovo (€)</label>
          <input type="number" value={prezzo} disabled={busy} onChange={e => updatePrezzo(e.target.value)} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#232f3e", height: 34 }}>
          <input type="checkbox" checked={includeSconto} disabled={busy} onChange={e => toggleSconto(e.target.checked)} />
          Sconto non più applicabile
        </label>
      </div>

      {availableMonths.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 8, fontSize: 12 }}>
          <span style={{ fontWeight: 700, color: "#232f3e" }}>Offerte in email:</span>
          {availableMonths.map(m => (
            <label key={m} style={{ display: "flex", alignItems: "center", gap: 4, fontWeight: 600, color: "#232f3e" }}>
              <input type="checkbox" checked={selectedMonths.includes(m)} disabled={busy} onChange={e => toggleMonth(m, e.target.checked)} />
              {m} mesi
            </label>
          ))}
        </div>
      )}

      <div className="gestione-field" style={{ marginBottom: 8 }}>
        <label>Testo email — verificalo prima di inviare</label>
        <textarea id={editorId.current} defaultValue="" />
        {loading && <p style={{ fontSize: 12, color: "#666", margin: "4px 0 0" }}>Caricamento...</p>}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button type="button" className="gestione-btn gestione-btn-blue" disabled={busy || sending} onClick={send}>Invia</button>
        <button type="button" className="gestione-btn gestione-btn-outline" disabled={busy || sending} onClick={load}>Rigenera dal modello</button>
        {status && <span style={{ fontSize: 12, color: status.color }}>{status.text}</span>}
      </div>
    </div>
  );
}
