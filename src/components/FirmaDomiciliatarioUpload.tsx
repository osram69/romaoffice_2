"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updateFirmaDomiciliatarioAction, removeFirmaDomiciliatarioAction } from "@/app/gestione-configurazione-x9k2m7/actions";

export function FirmaDomiciliatarioUpload({ previewDataUrl }: { previewDataUrl: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; color: string } | null>(null);

  async function upload() {
    const file = inputRef.current?.files?.[0];
    if (!file) { setStatus({ text: "Seleziona un file PNG.", color: "#555" }); return; }
    setBusy(true);
    setStatus({ text: "Caricamento...", color: "#555" });
    const formData = new FormData();
    formData.set("firma", file);
    const result = await updateFirmaDomiciliatarioAction(formData);
    setBusy(false);
    if (result.success) {
      if (inputRef.current) inputRef.current.value = "";
      setStatus({ text: "Salvata", color: "green" });
      router.refresh();
    } else {
      setStatus({ text: result.message || "Errore", color: "red" });
    }
  }

  async function remove() {
    if (!confirm("Eliminare la firma caricata? Andrà ricaricata prima di poter firmare nuovi contratti.")) return;
    setBusy(true);
    setStatus({ text: "Eliminazione...", color: "#555" });
    await removeFirmaDomiciliatarioAction();
    setBusy(false);
    setStatus({ text: "Eliminata", color: "green" });
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
      {previewDataUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- transient data: URL, not a static asset next/image can optimize
        <img src={previewDataUrl} alt="Firma domiciliatario attuale" style={{ height: 60, background: "#f4f6fa", border: "1px solid #dce1ea", borderRadius: 8, padding: 6 }} />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <input ref={inputRef} type="file" accept="image/png" disabled={busy} className="gestione-file-input" style={{ width: "auto" }} />
        <button type="button" className="gestione-btn gestione-btn-blue" disabled={busy} onClick={upload}>{previewDataUrl ? "Sostituisci" : "Carica"}</button>
        {previewDataUrl && <button type="button" className="gestione-btn gestione-btn-outline" disabled={busy} onClick={remove}>Rimuovi</button>}
        {status && <span style={{ fontSize: 12, color: status.color }}>{status.text}</span>}
      </div>
    </div>
  );
}
