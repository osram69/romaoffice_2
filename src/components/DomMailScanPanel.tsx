"use client";
import { useEffect, useState } from "react";
import { attachMailScanAction, listMailScansAction, removeMailScanAction, type MailScanSummary } from "@/app/gestione-domiciliazioni-x9k2m7/actions";
import type { ColorMode, ScanSource } from "@/lib/escl-scanner";

// Settings for reaching the scanner are a property of the operator's own PC/network, not of any
// one domiciliazione — remembered per browser, never sent to or read from the server.
const SETTINGS_KEY = "ros_escl_scanner_settings";
type ScannerSettings = { bridgePort: string; host: string; port: string; https: boolean; color: ColorMode; source: ScanSource; resolution: string };
const DEFAULT_SETTINGS: ScannerSettings = { bridgePort: "17866", host: "", port: "", https: false, color: "gray", source: "platen", resolution: "200" };

function loadSettings(): ScannerSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
function saveSettings(settings: ScannerSettings) {
  try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* private mode / storage disabled */ }
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function DomMailScanPanel({ clientId, ragioneSociale, onClose }: { clientId: number; ragioneSociale: string; onClose: () => void }) {
  const [settings, setSettings] = useState<ScannerSettings>(loadSettings);
  const [scans, setScans] = useState<MailScanSummary[]>([]);
  const [loadingScans, setLoadingScans] = useState(true);
  const [status, setStatus] = useState<{ text: string; color: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function refreshScans() {
    setLoadingScans(true);
    const result = await listMailScansAction(clientId);
    setLoadingScans(false);
    if (result.success) setScans(result.scans ?? []);
    else setStatus({ text: result.message || "Errore nel caricamento delle scansioni", color: "red" });
  }
  useEffect(() => { refreshScans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  function update<K extends keyof ScannerSettings>(key: K, value: ScannerSettings[K]) {
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveSettings(next);
  }

  function bridgeUrl(path: string) {
    return `http://127.0.0.1:${settings.bridgePort || "17866"}${path}`;
  }

  async function testScanner() {
    if (!settings.host.trim()) { setStatus({ text: "Inserisci l'indirizzo IP dello scanner.", color: "#555" }); return; }
    setBusy(true);
    setStatus({ text: "Verifica in corso...", color: "#555" });
    try {
      const params = new URLSearchParams({ host: settings.host.trim() });
      if (settings.port.trim()) params.set("port", settings.port.trim());
      if (settings.https) params.set("https", "1");
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
    if (!settings.host.trim()) { setStatus({ text: "Inserisci l'indirizzo IP dello scanner.", color: "#555" }); return; }
    setBusy(true);
    setStatus({ text: "Scansione in corso...", color: "#555" });
    try {
      const res = await fetch(bridgeUrl("/scan"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: settings.host.trim(),
          port: settings.port.trim() ? Number(settings.port.trim()) : undefined,
          https: settings.https,
          color: settings.color,
          source: settings.source,
          resolution: Number(settings.resolution) || 200,
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
    setScans(prev => prev.filter(s => s.id !== scanId));
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

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
            <label style={{ fontSize: 12, flex: "1 1 200px" }}>
              IP scanner
              <input type="text" placeholder="192.168.1.50" value={settings.host} disabled={busy} onChange={e => update("host", e.target.value)} style={{ width: "100%", marginTop: 2 }} />
            </label>
            <label style={{ fontSize: 12, width: 90 }}>
              Porta
              <input type="text" placeholder="80" value={settings.port} disabled={busy} onChange={e => update("port", e.target.value)} style={{ width: "100%", marginTop: 2 }} />
            </label>
            <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4, marginTop: 16 }}>
              <input type="checkbox" checked={settings.https} disabled={busy} onChange={e => update("https", e.target.checked)} /> HTTPS
            </label>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
            <label style={{ fontSize: 12, flex: "1 1 120px" }}>
              Colore
              <select value={settings.color} disabled={busy} onChange={e => update("color", e.target.value as ColorMode)} style={{ width: "100%", marginTop: 2 }}>
                <option value="gray">Bianco/nero</option>
                <option value="color">Colore</option>
              </select>
            </label>
            <label style={{ fontSize: 12, flex: "1 1 160px" }}>
              Sorgente
              <select value={settings.source} disabled={busy} onChange={e => update("source", e.target.value as ScanSource)} style={{ width: "100%", marginTop: 2 }}>
                <option value="platen">Piano</option>
                <option value="feeder">Caricatore (ADF)</option>
                <option value="feederDuplex">Caricatore fronte/retro</option>
              </select>
            </label>
            <label style={{ fontSize: 12, flex: "1 1 100px" }}>
              Risoluzione
              <select value={settings.resolution} disabled={busy} onChange={e => update("resolution", e.target.value)} style={{ width: "100%", marginTop: 2 }}>
                <option value="150">150 dpi</option>
                <option value="200">200 dpi</option>
                <option value="300">300 dpi</option>
              </select>
            </label>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <button type="button" className="gestione-btn gestione-btn-outline" disabled={busy} onClick={testScanner}>Verifica scanner</button>
            <button type="button" className="gestione-btn gestione-btn-blue" disabled={busy} onClick={scanAndAttach}>Scansiona e allega</button>
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
