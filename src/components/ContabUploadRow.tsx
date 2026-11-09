"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Save } from "lucide-react";
import { checkContabFileMeta, formatMb } from "@/lib/contab-files";
import { interpretUploadResponse, uploadUrl } from "@/lib/contab-upload-client";

// Upload row of one section: "Scegli file", then `name — 0,42 MB` and the "Carica" button on the same row.
// The file is sent as the raw body of POST /api/contabilita/files with XMLHttpRequest, which (unlike fetch) reports upload progress.
// Only plain browser-side modules are imported here: nothing from the database or the disk code.

export function ContabUploadRow({ sectionId }: { sectionId: number }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<XMLHttpRequest | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [percent, setPercent] = useState<number | null>(null); // null: not uploading
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const uploading = percent !== null;

  // Leaving the page cancels a running upload.
  useEffect(() => () => requestRef.current?.abort(), []);

  function reset() {
    setFile(null);
    setPercent(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function choose(picked: File | undefined) {
    setError(null);
    setLocked(false);
    if (!picked) return reset();
    // Same checks and messages as the server, so a wrong file is refused before anything is sent.
    const checked = checkContabFileMeta(picked.name, picked.size);
    if (!checked.ok) {
      reset();
      setError(checked.message);
      return;
    }
    setFile(picked);
  }

  function upload() {
    if (!file || uploading) return;
    setError(null);
    setPercent(0);
    const xhr = new XMLHttpRequest();
    requestRef.current = xhr;
    const fail = (message: string) => {
      requestRef.current = null;
      setPercent(null);
      setError(message);
    };
    xhr.open("POST", uploadUrl(sectionId, file.name));
    xhr.upload.onprogress = event => {
      if (event.lengthComputable && event.total > 0) setPercent(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      const outcome = interpretUploadResponse(xhr.status, xhr.responseText);
      if (outcome.kind === "ok") {
        requestRef.current = null;
        reset();
        router.refresh();
      } else if (outcome.kind === "locked") {
        fail(outcome.message);
        setLocked(true);
      } else {
        fail(outcome.message);
      }
    };
    xhr.onerror = () => fail("Connessione interrotta, riprova.");
    xhr.ontimeout = () => fail("Il caricamento ha impiegato troppo tempo, riprova.");
    xhr.onabort = () => {
      requestRef.current = null;
    };
    xhr.send(file);
  }

  return (
    <div style={{ margin: "10px 0" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        <input ref={inputRef} type="file" hidden onChange={event => choose(event.target.files?.[0])} />
        <button type="button" className="gestione-btn gestione-btn-outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
          <Paperclip size={14} /> Scegli file
        </button>
        {file && (
          <>
            <span style={{ fontSize: 13, color: "#232f3e", wordBreak: "break-all" }}>{file.name} — {formatMb(file.size)}</span>
            <button type="button" className="gestione-btn gestione-btn-blue" disabled={uploading} onClick={upload} style={uploading ? { opacity: 0.7, cursor: "wait" } : undefined}>
              <Save size={14} /> {uploading ? `Carica ${percent}%` : "Carica"}
            </button>
          </>
        )}
      </div>
      {uploading && <progress value={percent ?? 0} max={100} aria-label="Avanzamento del caricamento" style={{ width: "100%", maxWidth: 320, height: 8, marginTop: 8 }} />}
      {error && (
        <div className="gestione-login-error" role="alert" style={{ marginTop: 8, marginBottom: 0, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          <span>{error}</span>
          {locked && <button type="button" className="gestione-btn gestione-btn-blue" onClick={() => window.location.reload()}>Ricarica la pagina</button>}
        </div>
      )}
    </div>
  );
}
