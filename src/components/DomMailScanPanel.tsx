"use client";
import { useEffect, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Trash2 } from "lucide-react";
import { attachMailScanAction, getScannerConfigAction, listMailScansAction, removeMailScanAction, type MailScanSummary, type ScannerConfig } from "@/app/gestione-domiciliazioni-x9k2m7/actions";
import type { ColorMode, ScanSource } from "@/lib/escl-scanner";

// Only the local bridge's own port is a per-operator/browser setting (each PC runs its own bridge
// instance against the one shared scanner) — everything else (scanner IP, defaults) is configured
// once for the whole office in Configurazione Web (see getScannerConfigAction) and just fetched here.
const BRIDGE_PORT_KEY = "ros_escl_bridge_port";
function loadBridgePort(): string {
  try { return window.localStorage.getItem(BRIDGE_PORT_KEY) || "17866"; } catch { return "17866"; }
}
function saveBridgePort(port: string) {
  try { window.localStorage.setItem(BRIDGE_PORT_KEY, port); } catch { /* private mode / storage disabled */ }
}

// Each scanned page is its own single-page PDF from the moment it's split out of the scan
// response — so delete/reorder/final-merge can all just operate on a flat, ordered array without
// having to track which multi-page scan a page originally came from.
type PageItem = { id: string; pdfBase64: string; thumbnailUrl: string | null };

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Converts a large byte array to base64 without spreading it into String.fromCharCode's argument
// list (which overflows the call stack for anything beyond a few dozen KB of scanned PDF).
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  return btoa(binary);
}
function base64ToBytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

/** Splits a (possibly multi-page) scanned PDF into one single-page PDF per page — always the real
 * page count straight from the PDF structure, so it's correct even if the bridge's per-page
 * thumbnail data is missing (older bridge) or shorter than the actual page count. */
async function splitPdfPages(pdfBase64: string): Promise<string[]> {
  const doc = await PDFDocument.load(base64ToBytes(pdfBase64));
  const out: string[] = [];
  for (let i = 0; i < doc.getPageCount(); i++) {
    const single = await PDFDocument.create();
    const [copied] = await single.copyPages(doc, [i]);
    single.addPage(copied);
    out.push(bytesToBase64(await single.save()));
  }
  return out;
}

export function DomMailScanPanel({ clientId, ragioneSociale, onClose, onPendingChange }: { clientId: number; ragioneSociale: string; onClose: () => void; onPendingChange: (hasPending: boolean) => void }) {
  const [bridgePort, setBridgePort] = useState(loadBridgePort);
  const [config, setConfig] = useState<ScannerConfig | null>(null);
  const [source, setSource] = useState<ScanSource>("platen");
  const [color, setColor] = useState<ColorMode>("gray");
  const [resolution, setResolution] = useState("200");
  const [pages, setPages] = useState<PageItem[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [zoomed, setZoomed] = useState<PageItem | null>(null);
  const [existingScan, setExistingScan] = useState<MailScanSummary | null>(null);
  const [status, setStatus] = useState<{ text: string; color: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removingExisting, setRemovingExisting] = useState(false);

  useEffect(() => {
    getScannerConfigAction().then(cfg => {
      setConfig(cfg);
      setSource(cfg.source);
      setColor(cfg.color);
      setResolution(String(cfg.resolution));
    });
    listMailScansAction(clientId).then(result => {
      if (result.success) setExistingScan(result.scans?.[0] ?? null);
    });
  }, [clientId]);

  function updateBridgePort(value: string) {
    setBridgePort(value);
    saveBridgePort(value);
  }

  function bridgeUrl(path: string) {
    return `http://127.0.0.1:${bridgePort || "17866"}${path}`;
  }

  async function doScan() {
    if (!config?.host) return;
    setScanning(true);
    setStatus({ text: "Scansione in corso...", color: "#555" });
    try {
      const res = await fetch(bridgeUrl("/scan"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: config.host, port: config.port ?? undefined, https: config.https,
          color, source, resolution: Number(resolution) || 200,
        }),
        signal: AbortSignal.timeout(120000),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Scansione non riuscita");

      const rawPages = (data.pages ?? []) as { base64: string; isImage: boolean; mimeType: string }[];
      const singlePagePdfs = await splitPdfPages(data.pdf_base64 as string);
      const newPages: PageItem[] = singlePagePdfs.map((pdfBase64, i) => ({
        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
        pdfBase64,
        thumbnailUrl: rawPages[i]?.isImage ? `data:${rawPages[i].mimeType};base64,${rawPages[i].base64}` : null,
      }));
      setPages(prev => [...prev, ...newPages]);
      setStatus(rawPages.length
        ? { text: `Aggiunte ${newPages.length} pagine. Totale: ${pages.length + newPages.length}.`, color: "green" }
        : { text: "Pagine aggiunte, ma senza anteprima: riavvia il bridge locale (npx tsx scripts/escl-bridge.ts) con la versione più recente.", color: "#a66a00" });
    } catch (error) {
      setStatus({ text: bridgeErrorMessage(error), color: "red" });
    } finally {
      setScanning(false);
    }
  }

  function removePage(id: string) {
    setPages(prev => prev.filter(p => p.id !== id));
  }

  function clearAll() {
    if (!pages.length) return;
    if (!confirm("Vuoi azzerare tutte le pagine acquisite?")) return;
    setPages([]);
    setStatus({ text: "Buffer svuotato.", color: "#555" });
  }

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) { setDragIndex(null); return; }
    setPages(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setDragIndex(null);
  }

  function openPage(page: PageItem) {
    if (page.thumbnailUrl) { setZoomed(page); return; }
    const bytes = base64ToBytes(page.pdfBase64);
    // base64ToBytes always allocates a fresh ArrayBuffer (never SharedArrayBuffer), so this cast
    // just satisfies BlobPart's stricter typing, it doesn't change what's actually constructed.
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const url = URL.createObjectURL(new Blob([buffer], { type: "application/pdf" }));
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function confirmUpload() {
    if (!pages.length) return;
    setUploading(true);
    setStatus({ text: "Unione pagine e caricamento...", color: "#555" });
    try {
      let mergedBase64: string;
      if (pages.length === 1) {
        mergedBase64 = pages[0].pdfBase64;
      } else {
        const merged = await PDFDocument.create();
        for (const page of pages) {
          const doc = await PDFDocument.load(base64ToBytes(page.pdfBase64));
          const [copied] = await merged.copyPages(doc, [0]);
          merged.addPage(copied);
        }
        mergedBase64 = bytesToBase64(await merged.save());
      }

      const attached = await attachMailScanAction(clientId, mergedBase64);
      if (!attached.success) throw new Error(attached.message || "Salvataggio non riuscito");

      // Close rather than staying open on the "già in sospeso" note: once attached, the operator's
      // next step is Invia/PEC/Aperta on the row, not another look at this panel.
      onPendingChange(true);
      onClose();
    } catch (error) {
      setStatus({ text: bridgeErrorMessage(error), color: "red" });
    } finally {
      setUploading(false);
    }
  }

  async function removeExisting() {
    if (!existingScan) return;
    if (!confirm("Eliminare la scansione in sospeso?")) return;
    setRemovingExisting(true);
    const result = await removeMailScanAction(existingScan.id, clientId);
    setRemovingExisting(false);
    if (!result.success) { setStatus({ text: result.message || "Errore durante l'eliminazione", color: "red" }); return; }
    setExistingScan(null);
    onPendingChange(false);
  }

  const busy = scanning || uploading;

  return (
    <>
      <div className="scan-bridge-overlay" onClick={onClose}>
        <div className="scan-bridge-box" onClick={e => e.stopPropagation()}>
          <div className="scan-bridge-header">
            <div className="scan-bridge-brand">
              <img src="/logo-mark.svg" alt="" />
              <div>
                <div className="scan-bridge-brand-name">ROMA OFFICE SHARING</div>
                <div className="scan-bridge-brand-subtitle">Scansione posta</div>
              </div>
            </div>
            <div className="scan-bridge-company" title={ragioneSociale}>{ragioneSociale}</div>
            <button type="button" className="scan-bridge-close" aria-label="Chiudi" onClick={onClose}>×</button>
          </div>

          <div className="scan-bridge-body">
            {existingScan && (
              <div className="scan-bridge-pending-note">
                Scansione già in sospeso ({fmtDateTime(existingScan.createdAt)}).
                <a href={`/api/dom-mail-scans?id=${existingScan.id}`} target="_blank" rel="noopener noreferrer">Apri</a>
                <button type="button" className="gestione-btn gestione-btn-outline" style={{ fontSize: 11, padding: "2px 8px" }} disabled={removingExisting} onClick={removeExisting}>Rimuovi</button>
                <span style={{ marginLeft: "auto" }}>Scansionando qui sotto la sostituirai.</span>
              </div>
            )}

            {config && !config.host ? (
              <p style={{ fontSize: 12, color: "#A52A2A" }}>
                Nessuno scanner configurato. Un amministratore deve impostare IP e porta in <strong>Configurazione Web → Scanner posta</strong>.
              </p>
            ) : (
              <div className="scan-bridge-shell">
                <div className="scan-bridge-settings">
                  <div className="scan-bridge-panel-title">Impostazioni scanner</div>

                  <div className="scan-bridge-field">
                    <label>Sorgente</label>
                    <select value={source} disabled={busy} onChange={e => setSource(e.target.value as ScanSource)}>
                      <option value="platen">Piano</option>
                      <option value="feeder">Caricatore (ADF)</option>
                      <option value="feederDuplex">Caricatore fronte/retro</option>
                    </select>
                  </div>
                  <div className="scan-bridge-field">
                    <label>Colore</label>
                    <select value={color} disabled={busy} onChange={e => setColor(e.target.value as ColorMode)}>
                      <option value="gray">Bianco/nero</option>
                      <option value="color">Colore</option>
                    </select>
                  </div>
                  <div className="scan-bridge-field">
                    <label>Risoluzione</label>
                    <select value={resolution} disabled={busy} onChange={e => setResolution(e.target.value)}>
                      <option value="50">50 dpi</option>
                      <option value="100">100 dpi</option>
                      <option value="150">150 dpi</option>
                      <option value="200">200 dpi</option>
                      <option value="300">300 dpi</option>
                    </select>
                  </div>

                  <button type="button" className="scan-bridge-scan-btn" disabled={busy || !config?.host} onClick={doScan}>
                    {scanning ? "Scansione in corso..." : "Scansiona documento"}
                  </button>

                  <div className="scan-bridge-hint">
                    Scanner: <b>{config?.host}{config?.port ? `:${config.port}` : ""}</b>. Ogni scansione aggiunge pagine alle precedenti — clicca una miniatura per ingrandirla, trascinala per riordinarla, usa il cestino per eliminarla.
                  </div>
                  <div className="scan-bridge-field" style={{ marginTop: 10 }}>
                    <label>Porta bridge locale</label>
                    <input type="text" value={bridgePort} disabled={busy} onChange={e => updateBridgePort(e.target.value)} style={{ width: "100%", height: 34, borderRadius: 8, border: "1px solid #cfd6e2", padding: "0 10px", fontSize: 13 }} />
                  </div>
                </div>

                <div className="scan-bridge-preview-panel">
                  <div className="scan-bridge-preview-header">
                    <h3 className="scan-bridge-preview-title">📄 Anteprima documento</h3>
                    <span className="scan-bridge-summary">{pages.length > 0 ? `${pages.length} pagine` : ""}</span>
                  </div>

                  <div className="scan-bridge-thumbs">
                    {pages.length === 0 ? (
                      <div className="scan-bridge-thumbs-empty">Nessuna scansione acquisita.<br />Premi &quot;Scansiona documento&quot; per iniziare.</div>
                    ) : (
                      pages.map((page, i) => (
                        <div
                          className={`scan-bridge-thumb${dragIndex === i ? " dragging" : ""}`}
                          key={page.id}
                          draggable
                          onDragStart={() => setDragIndex(i)}
                          onDragOver={e => e.preventDefault()}
                          onDrop={() => handleDrop(i)}
                          onDragEnd={() => setDragIndex(null)}
                          title="Trascina per riordinare, clicca per ingrandire"
                        >
                          <button type="button" className="scan-bridge-thumb-delete" aria-label={`Elimina pagina ${i + 1}`} onClick={() => removePage(page.id)}>
                            <Trash2 size={13} />
                          </button>
                          <div className="scan-bridge-thumb-open" onClick={() => openPage(page)}>
                            {page.thumbnailUrl ? <img src={page.thumbnailUrl} alt={`Pagina ${i + 1}`} /> : <div className="scan-bridge-thumb-pdf">📄</div>}
                          </div>
                          <div className="scan-bridge-thumb-page">Pag. {i + 1}</div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="scan-bridge-actions">
                    <button type="button" className="scan-bridge-btn-clear" disabled={busy || !pages.length} onClick={clearAll}>Svuota tutto</button>
                    <button type="button" className="scan-bridge-btn-upload" disabled={busy || !pages.length} onClick={confirmUpload}>{uploading ? "Caricamento..." : "Conferma upload"}</button>
                  </div>

                  <div className="scan-bridge-status-bar" style={status ? { color: status.color } : undefined}>{status?.text}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {zoomed && (
        <div className="scan-bridge-zoom-overlay" onClick={() => setZoomed(null)}>
          <img src={zoomed.thumbnailUrl ?? undefined} alt="Pagina ingrandita" />
          <button type="button" className="scan-bridge-zoom-close" aria-label="Chiudi anteprima" onClick={() => setZoomed(null)}>×</button>
        </div>
      )}
    </>
  );
}

function bridgeErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "TimeoutError") return "Nessuna risposta dal bridge/scanner (timeout).";
  if (error instanceof TypeError) return "Bridge locale non raggiungibile: avvia 'npx tsx scripts/escl-bridge.ts' su questo PC.";
  return error instanceof Error ? error.message : "Errore imprevisto";
}
