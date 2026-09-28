"use client";
import { useEffect, useState } from "react";
import { PDFDocument } from "pdf-lib";
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

type ScanPage = { dataUrl: string | null };
type Chunk = { id: number; pdfBase64: string; pages: ScanPage[] };

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

export function DomMailScanPanel({ clientId, ragioneSociale, onClose, onPendingChange }: { clientId: number; ragioneSociale: string; onClose: () => void; onPendingChange: (hasPending: boolean) => void }) {
  const [bridgePort, setBridgePort] = useState(loadBridgePort);
  const [config, setConfig] = useState<ScannerConfig | null>(null);
  const [source, setSource] = useState<ScanSource>("platen");
  const [color, setColor] = useState<ColorMode>("gray");
  const [resolution, setResolution] = useState("200");
  const [chunks, setChunks] = useState<Chunk[]>([]);
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

      // Fall back to one generic placeholder "page" when the bridge doesn't send per-page data
      // (an older escl-bridge.ts still running, from before it started returning `pages`) — so the
      // scan still shows up as a tile instead of silently vanishing from the preview.
      const rawPages = (data.pages ?? []) as { base64: string; isImage: boolean; mimeType: string }[];
      const pages: ScanPage[] = rawPages.length
        ? rawPages.map(p => ({ dataUrl: p.isImage ? `data:${p.mimeType};base64,${p.base64}` : null }))
        : [{ dataUrl: null }];
      const next = [...chunks, { id: Date.now() + Math.random(), pdfBase64: data.pdf_base64 as string, pages }];
      setChunks(next);
      setStatus(rawPages.length
        ? { text: `Aggiunta scansione (${pages.length} pagine). Totale blocchi: ${next.length}.`, color: "green" }
        : { text: "Scansione aggiunta, ma senza anteprima: riavvia il bridge locale (npx tsx scripts/escl-bridge.ts) con la versione più recente.", color: "#a66a00" });
    } catch (error) {
      setStatus({ text: bridgeErrorMessage(error), color: "red" });
    } finally {
      setScanning(false);
    }
  }

  function discardLast() {
    if (!chunks.length) return;
    const next = chunks.slice(0, -1);
    setChunks(next);
    setStatus({ text: next.length ? "Ultima scansione rimossa." : "Tutte le scansioni sono state rimosse.", color: "#555" });
  }

  function clearAll() {
    if (!chunks.length) return;
    if (!confirm("Vuoi azzerare tutte le scansioni accumulate?")) return;
    setChunks([]);
    setStatus({ text: "Buffer svuotato.", color: "#555" });
  }

  async function confirmUpload() {
    if (!chunks.length) return;
    setUploading(true);
    setStatus({ text: "Unione pagine e caricamento...", color: "#555" });
    try {
      let mergedBase64: string;
      if (chunks.length === 1) {
        mergedBase64 = chunks[0].pdfBase64;
      } else {
        const merged = await PDFDocument.create();
        for (const chunk of chunks) {
          const doc = await PDFDocument.load(base64ToBytes(chunk.pdfBase64));
          const copied = await merged.copyPages(doc, doc.getPageIndices());
          copied.forEach(p => merged.addPage(p));
        }
        mergedBase64 = bytesToBase64(await merged.save());
      }

      const attached = await attachMailScanAction(clientId, mergedBase64);
      if (!attached.success) throw new Error(attached.message || "Salvataggio non riuscito");

      setStatus({ text: "Scansione allegata.", color: "green" });
      setChunks([]);
      setExistingScan(attached.scan ?? null);
      onPendingChange(true);
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

  const allPages = chunks.flatMap(c => c.pages);
  const busy = scanning || uploading;

  return (
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
                  Scanner: <b>{config?.host}{config?.port ? `:${config.port}` : ""}</b>. Ogni scansione si aggiunge alle precedenti: usa il caricatore solo quando devi acquisire più fogli in una volta.
                </div>
                <div className="scan-bridge-field" style={{ marginTop: 10 }}>
                  <label>Porta bridge locale</label>
                  <input type="text" value={bridgePort} disabled={busy} onChange={e => updateBridgePort(e.target.value)} style={{ width: "100%", height: 34, borderRadius: 8, border: "1px solid #cfd6e2", padding: "0 10px", fontSize: 13 }} />
                </div>
              </div>

              <div className="scan-bridge-preview-panel">
                <div className="scan-bridge-preview-header">
                  <h3 className="scan-bridge-preview-title">📄 Anteprima documento</h3>
                  <span className="scan-bridge-summary">{chunks.length > 0 ? `${chunks.length} scansioni · ${allPages.length} pagine` : ""}</span>
                </div>

                <div className="scan-bridge-thumbs">
                  {allPages.length === 0 ? (
                    <div className="scan-bridge-thumbs-empty">Nessuna scansione acquisita.<br />Premi &quot;Scansiona documento&quot; per iniziare.</div>
                  ) : (
                    allPages.map((page, i) => (
                      <div className="scan-bridge-thumb" key={i}>
                        {page.dataUrl ? <img src={page.dataUrl} alt={`Pagina ${i + 1}`} /> : <div className="scan-bridge-thumb-pdf">📄</div>}
                        <div className="scan-bridge-thumb-page">Pag. {i + 1}</div>
                      </div>
                    ))
                  )}
                </div>

                <div className="scan-bridge-actions">
                  <button type="button" className="scan-bridge-btn-discard" disabled={busy || !chunks.length} onClick={discardLast}>Scarta ultima</button>
                  <button type="button" className="scan-bridge-btn-clear" disabled={busy || !chunks.length} onClick={clearAll}>Svuota tutto</button>
                  <button type="button" className="scan-bridge-btn-upload" disabled={busy || !chunks.length} onClick={confirmUpload}>{uploading ? "Caricamento..." : "Conferma upload"}</button>
                </div>

                <div className="scan-bridge-status-bar" style={status ? { color: status.color } : undefined}>{status?.text}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function bridgeErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "TimeoutError") return "Nessuna risposta dal bridge/scanner (timeout).";
  if (error instanceof TypeError) return "Bridge locale non raggiungibile: avvia 'npx tsx scripts/escl-bridge.ts' su questo PC.";
  return error instanceof Error ? error.message : "Errore imprevisto";
}
