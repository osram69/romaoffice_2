"use client";
import { useEffect, useState } from "react";
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

type ScanOptions = { color: ColorMode; source: ScanSource; resolution: string };

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function DomMailScanPanel({ clientId, ragioneSociale, onClose, onPendingChange }: { clientId: number; ragioneSociale: string; onClose: () => void; onPendingChange: (hasPending: boolean) => void }) {
  const [bridgePort, setBridgePort] = useState(loadBridgePort);
  const [config, setConfig] = useState<ScannerConfig | null>(null);
  const [options, setOptions] = useState<ScanOptions>({ color: "gray", source: "platen", resolution: "200" });
  const [scans, setScans] = useState<MailScanSummary[]>([]);
  const [loadingScans, setLoadingScans] = useState(true);
  const [status, setStatus] = useState<{ text: string; color: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function refreshScans() {
    setLoadingScans(true);
    const result = await listMailScansAction(clientId);
    setLoadingScans(false);
    if (result.success) {
      const found = result.scans ?? [];
      setScans(found);
      onPendingChange(found.length > 0);
    } else {
      setStatus({ text: result.message || "Errore nel caricamento delle scansioni", color: "red" });
    }
  }
  useEffect(() => {
    refreshScans();
    getScannerConfigAction().then(cfg => {
      setConfig(cfg);
      setOptions({ color: cfg.color, source: cfg.source, resolution: String(cfg.resolution) });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  function updateBridgePort(value: string) {
    setBridgePort(value);
    saveBridgePort(value);
  }
  function updateOption<K extends keyof ScanOptions>(key: K, value: ScanOptions[K]) {
    setOptions(prev => ({ ...prev, [key]: value }));
  }

  function bridgeUrl(path: string) {
    return `http://127.0.0.1:${bridgePort || "17866"}${path}`;
  }

  async function testScanner() {
    if (!config?.host) return;
    setBusy(true);
    setStatus({ text: "Verifica in corso...", color: "#555" });
    try {
      const params = new URLSearchParams({ host: config.host });
      if (config.port) params.set("port", String(config.port));
      if (config.https) params.set("https", "1");
      const res = await fetch(bridgeUrl(`/capabilities?${params}`), { signal: AbortSignal.timeout(10000) });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "Scanner non raggiungibile");
      setStatus({ text: `Scanner raggiunto (piano ${data.platenSupported ? "sì" : "no"}, ADF ${data.feederSupported ? "sì" : "no"}).`, color: "green" });
    } catch (error) {
      setStatus({ text: bridgeErrorMessage(error), color: "red" });
    } finally {
      setBusy(false);
    }
  }

  async function scanAndAttach() {
    if (!config?.host) return;
    setBusy(true);
    setStatus({ text: "Scansione in corso...", color: "#555" });
    try {
      const res = await fetch(bridgeUrl("/scan"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: config.host,
          port: config.port ?? undefined,
          https: config.https,
          color: options.color,
          source: options.source,
          resolution: Number(options.resolution) || 200,
        }),
        signal: AbortSignal.timeout(120000),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Scansione non riuscita");

      setStatus({ text: "Salvataggio...", color: "#555" });
      const attached = await attachMailScanAction(clientId, data.pdf_base64);
      if (!attached.success) throw new Error(attached.message || "Salvataggio non riuscito");

      setStatus({ text: "Scansione allegata.", color: "green" });
      await refreshScans();
    } catch (error) {
      setStatus({ text: bridgeErrorMessage(error), color: "red" });
    } finally {
      setBusy(false);
    }
  }

  async function removeScan(scanId: number) {
    if (!confirm("Eliminare questa scansione?")) return;
    setBusy(true);
    const result = await removeMailScanAction(scanId, clientId);
    setBusy(false);
    if (!result.success) { setStatus({ text: result.message || "Errore durante l'eliminazione", color: "red" }); return; }
    const next = scans.filter(s => s.id !== scanId);
    setScans(next);
    onPendingChange(next.length > 0);
  }

  return (
    <div className="gestione-modal-overlay" onClick={onClose}>
      <div className="gestione-modal-box" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div className="gestione-modal-header">
          <h2>Scansione posta — {ragioneSociale}</h2>
          <button type="button" className="gestione-modal-close" aria-label="Chiudi" onClick={onClose}>×</button>
        </div>
        <div className="gestione-modal-body">
          <p style={{ fontSize: 12, color: "#666", marginTop: 0 }}>
            Richiede il bridge locale eSCL in esecuzione su questo PC (<code>npx tsx scripts/escl-bridge.ts</code>), sulla stessa rete dello scanner.
          </p>

          {config && !config.host ? (
            <p style={{ fontSize: 12, color: "#A52A2A" }}>
              Nessuno scanner configurato. Un amministratore deve impostare IP e porta in <strong>Configurazione Web → Scanner posta</strong>.
            </p>
          ) : (
            <p style={{ fontSize: 12, color: "#666" }}>
              Scanner: <strong>{config?.host}{config?.port ? `:${config.port}` : ""}</strong> {config?.https ? "(HTTPS)" : ""} — modificabile in Configurazione Web.
              {" "}Porta bridge locale: <input type="text" value={bridgePort} disabled={busy} onChange={e => updateBridgePort(e.target.value)} style={{ width: 60 }} />
            </p>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
            <label style={{ fontSize: 12, flex: "1 1 120px" }}>
              Colore
              <select value={options.color} disabled={busy} onChange={e => updateOption("color", e.target.value as ColorMode)} style={{ width: "100%", marginTop: 2 }}>
                <option value="gray">Bianco/nero</option>
                <option value="color">Colore</option>
              </select>
            </label>
            <label style={{ fontSize: 12, flex: "1 1 160px" }}>
              Sorgente
              <select value={options.source} disabled={busy} onChange={e => updateOption("source", e.target.value as ScanSource)} style={{ width: "100%", marginTop: 2 }}>
                <option value="platen">Piano</option>
                <option value="feeder">Caricatore (ADF)</option>
                <option value="feederDuplex">Caricatore fronte/retro</option>
              </select>
            </label>
            <label style={{ fontSize: 12, flex: "1 1 100px" }}>
              Risoluzione
              <select value={options.resolution} disabled={busy} onChange={e => updateOption("resolution", e.target.value)} style={{ width: "100%", marginTop: 2 }}>
                <option value="150">150 dpi</option>
                <option value="200">200 dpi</option>
                <option value="300">300 dpi</option>
              </select>
            </label>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <button type="button" className="gestione-btn gestione-btn-outline" disabled={busy || !config?.host} onClick={testScanner}>Verifica scanner</button>
            <button type="button" className="gestione-btn gestione-btn-blue" disabled={busy || !config?.host} onClick={scanAndAttach}>Scansiona e allega</button>
            {status && <span style={{ fontSize: 12, color: status.color }}>{status.text}</span>}
          </div>

          <p style={{ fontSize: 12, fontWeight: 700, color: "#232f3e", marginBottom: 4 }}>Scansioni allegate:</p>
          {loadingScans ? (
            <p style={{ fontSize: 12, color: "#999" }}>Caricamento...</p>
          ) : scans.length === 0 ? (
            <p style={{ fontSize: 12, color: "#999" }}>Nessuna scansione presente.</p>
          ) : (
            <table className="gestione-scheda-table gestione-scheda-table-paired">
              <tbody>
                {scans.map(scan => (
                  <tr key={scan.id}>
                    <td>
                      <a className="gestione-file-link" href={`/api/dom-mail-scans?id=${scan.id}`} target="_blank" rel="noopener noreferrer">{fmtDateTime(scan.createdAt)}</a>
                    </td>
                    <td style={{ color: "#666" }}>{scan.scannedBy || "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      <button type="button" className="gestione-btn gestione-btn-outline" style={{ fontSize: 11, padding: "3px 8px" }} disabled={busy} onClick={() => removeScan(scan.id)}>Rimuovi</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="gestione-modal-footer">
          <button type="button" className="gestione-btn gestione-btn-outline" onClick={onClose}>Chiudi</button>
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
