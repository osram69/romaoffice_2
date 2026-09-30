"use client";
import { useEffect, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { getFirmaDomiciliatarioAction } from "@/app/gestione-domiciliazioni-x9k2m7/actions";
import { uploadDomDocumentAction } from "@/app/gestione-domiciliazioni-x9k2m7/actions";

// pdf.js is only used here (to rasterize the operator's own uploaded PDF into thumbnails — pdf-lib
// can assemble PDFs but can't render one to an image, same limitation noted in escl-scanner.ts) so
// it's loaded from a CDN as an ES module rather than added as a project dependency, mirroring the
// CDN-loaded TinyMCE pattern already used elsewhere (ScadenzaEmailPanel and friends).
const PDFJS_VERSION = "6.3.289";
type PdfjsModule = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<PdfjsModule> | null = null;
function loadPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const mod = (await import(
        /* webpackIgnore: true */ `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.mjs`
      )) as PdfjsModule;
      mod.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;
      return mod;
    })();
  }
  return pdfjsPromise;
}

type Zone = "con" | "all" | "mod" | "avc";
const ZONES: { key: Zone; label: string }[] = [
  { key: "con", label: "Contratto" },
  { key: "all", label: "Allegato 1" },
  { key: "mod", label: "Modulo" },
  { key: "avc", label: "Allegato 3" },
];
type Lane = "unassigned" | Zone;
type ContractPage = { id: string; sourceIndex: number; thumbnailUrl: string };
type Lanes = Record<Lane, ContractPage[]>;
const EMPTY_LANES: Lanes = { unassigned: [], con: [], all: [], mod: [], avc: [] };

type SignaturePlacement = { pageId: string; xFrac: number; yFrac: number; wFrac: number; hFrac: number };

// Scanned contracts routinely run 15+ pages of full-page photocopy images — rendering each page
// once at this scale and re-encoding it as JPEG (rather than copying the original embedded image
// byte-for-byte) is what makes the quality slider below possible, the same idea as the mail-scan
// panel's JPEG recompression, just working from a rasterized page instead of the scanner's own JPEG.
const RENDER_SCALE = 1.4;
const DEFAULT_QUALITY = 0.75;

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }
function base64ToBytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}
function totalAssignedMb(lanes: Lanes): string {
  const zones: Lane[] = ["con", "all", "mod", "avc"];
  const bytes = zones.reduce((sum, lane) => sum + lanes[lane].reduce((s, p) => s + p.thumbnailUrl.length * 0.75, 0), 0);
  return (bytes / (1024 * 1024)).toFixed(1);
}

function findPage(lanes: Lanes, id: string): { page: ContractPage; lane: Lane } | null {
  for (const lane of Object.keys(lanes) as Lane[]) {
    const page = lanes[lane].find(p => p.id === id);
    if (page) return { page, lane };
  }
  return null;
}

export function ContractProcessorPanel({ clientId, file, onClose, onUploaded }: { clientId: number; file: File; onClose: () => void; onUploaded: (presenzaFile: number) => void }) {
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [lanes, setLanes] = useState<Lanes>(EMPTY_LANES);
  const [dragId, setDragId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<{ text: string; color: string } | null>(null);
  const [firmaDataUrl, setFirmaDataUrl] = useState<string | null>(null);
  const [placementPageId, setPlacementPageId] = useState<string | null>(null);
  const [signature, setSignature] = useState<SignaturePlacement | null>(null);
  const [quality, setQuality] = useState(DEFAULT_QUALITY);
  const previewRef = useRef<HTMLDivElement>(null);
  // The full-resolution render of each page, kept around so the quality slider can re-encode a
  // JPEG on the fly without re-rendering the PDF (slow) every time it moves.
  const canvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());

  useEffect(() => {
    getFirmaDomiciliatarioAction().then(r => setFirmaDataUrl(r.success ? r.dataUrl ?? null : null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setStatus(null);
      try {
        const buffer = await file.arrayBuffer();
        if (cancelled) return;
        setPdfBytes(buffer);
        const pdfjs = await loadPdfjs();
        // pdf.js's `data` option takes ownership of the buffer it's given, so it gets a copy —
        // the original stays untouched for pdf-lib to assemble the final pieces from later.
        const doc = await pdfjs.getDocument({ data: buffer.slice(0) }).promise;
        canvasesRef.current.clear();
        const pages: ContractPage[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          if (cancelled) return;
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: RENDER_SCALE });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas non disponibile");
          await page.render({ canvas, canvasContext: ctx, viewport }).promise;
          const id = `pg-${i}-${Math.random().toString(36).slice(2)}`;
          canvasesRef.current.set(id, canvas);
          pages.push({ id, sourceIndex: i - 1, thumbnailUrl: canvas.toDataURL("image/jpeg", DEFAULT_QUALITY) });
        }
        if (!cancelled) setLanes({ ...EMPTY_LANES, unassigned: pages });
      } catch (error) {
        if (!cancelled) setStatus({ text: `Impossibile leggere il PDF: ${error instanceof Error ? error.message : String(error)}`, color: "red" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [file]);

  function movePage(id: string, targetLane: Lane, targetIndex: number) {
    setLanes(prev => {
      const next: Lanes = { unassigned: [...prev.unassigned], con: [...prev.con], all: [...prev.all], mod: [...prev.mod], avc: [...prev.avc] };
      let moving: ContractPage | undefined;
      (Object.keys(next) as Lane[]).forEach(lane => {
        const idx = next[lane].findIndex(p => p.id === id);
        if (idx !== -1) [moving] = next[lane].splice(idx, 1);
      });
      if (!moving) return prev;
      next[targetLane].splice(clamp(targetIndex, 0, next[targetLane].length), 0, moving);
      return next;
    });
  }

  function handleDrop(lane: Lane, index: number) {
    if (dragId) movePage(dragId, lane, index);
    setDragId(null);
  }

  // Re-encodes every page's JPEG at the new quality from its already-rendered canvas (cheap: no
  // PDF re-rendering) so the thumbnails and the MB total both reflect the slider immediately.
  function applyQuality(next: number) {
    setQuality(next);
    setLanes(prev => {
      const recompress = (list: ContractPage[]) => list.map(p => {
        const canvas = canvasesRef.current.get(p.id);
        return canvas ? { ...p, thumbnailUrl: canvas.toDataURL("image/jpeg", next) } : p;
      });
      return { unassigned: recompress(prev.unassigned), con: recompress(prev.con), all: recompress(prev.all), mod: recompress(prev.mod), avc: recompress(prev.avc) };
    });
  }

  function openPlacement(pageId: string) {
    if (!firmaDataUrl) { setStatus({ text: "Nessuna firma configurata: caricala in Configurazione Web.", color: "red" }); return; }
    setPlacementPageId(pageId);
    if (!signature || signature.pageId !== pageId) {
      // Sensible starting box: centered horizontally, a bit above vertical middle, sized to a
      // plausible signature-line width — the operator drags/resizes it onto the real line anyway.
      setSignature({ pageId, xFrac: 0.25, yFrac: 0.45, wFrac: 0.35, hFrac: 0.35 * (158 / 524) });
    }
  }

  function dragSignature(e: React.MouseEvent) {
    e.preventDefault();
    const container = previewRef.current;
    if (!container || !signature) return;
    const rect = container.getBoundingClientRect();
    const startX = e.clientX, startY = e.clientY;
    const startXFrac = signature.xFrac, startYFrac = signature.yFrac;
    function onMove(ev: MouseEvent) {
      setSignature(s => {
        if (!s) return s;
        const xFrac = clamp(startXFrac + (ev.clientX - startX) / rect.width, 0, 1 - s.wFrac);
        const yFrac = clamp(startYFrac + (ev.clientY - startY) / rect.height, 0, 1 - s.hFrac);
        return { ...s, xFrac, yFrac };
      });
    }
    function onUp() { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function resizeSignature(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const container = previewRef.current;
    if (!container || !signature) return;
    const rect = container.getBoundingClientRect();
    const startX = e.clientX, startY = e.clientY;
    const startW = signature.wFrac, startH = signature.hFrac;
    function onMove(ev: MouseEvent) {
      setSignature(s => {
        if (!s) return s;
        const wFrac = clamp(startW + (ev.clientX - startX) / rect.width, 0.05, 1 - s.xFrac);
        const hFrac = clamp(startH + (ev.clientY - startY) / rect.height, 0.02, 1 - s.yFrac);
        return { ...s, wFrac, hFrac };
      });
    }
    function onUp() { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function requestClose() {
    const hasWork = lanes.con.length + lanes.all.length + lanes.mod.length + lanes.avc.length > 0;
    if (hasWork && !confirm("Chiudere senza caricare? Il lavoro di riordino/firma andrà perso.")) return;
    onClose();
  }

  async function processAndUpload() {
    if (!pdfBytes) return;
    const nonEmptyZones = ZONES.filter(z => lanes[z.key].length > 0);
    if (!nonEmptyZones.length) { setStatus({ text: "Assegna almeno una pagina a un tipo di documento.", color: "red" }); return; }
    setProcessing(true);
    setStatus({ text: "Elaborazione...", color: "#555" });
    try {
      // Real (point-space) size of every source page, so the recompressed JPEG lands on a page
      // the same physical size as the original — the render scale above is pixels, not points.
      const srcDoc = await PDFDocument.load(pdfBytes);
      const firmaBytes = signature && firmaDataUrl ? base64ToBytes(firmaDataUrl.split(",")[1]) : null;
      for (const zone of nonEmptyZones) {
        const zonePages = lanes[zone.key];
        const outDoc = await PDFDocument.create();
        for (const p of zonePages) {
          const { width, height } = srcDoc.getPage(p.sourceIndex).getSize();
          const canvas = canvasesRef.current.get(p.id);
          if (!canvas) throw new Error("Pagina non renderizzata correttamente, riprova a caricare il PDF");
          const jpegBytes = base64ToBytes(canvas.toDataURL("image/jpeg", quality).split(",")[1]);
          const image = await outDoc.embedJpg(jpegBytes);
          const page = outDoc.addPage([width, height]);
          page.drawImage(image, { x: 0, y: 0, width, height });
        }
        const sigIndex = signature ? zonePages.findIndex(p => p.id === signature.pageId) : -1;
        if (sigIndex !== -1 && signature && firmaBytes) {
          const page = outDoc.getPage(sigIndex);
          const { width, height } = page.getSize();
          const image = await outDoc.embedPng(firmaBytes);
          const w = signature.wFrac * width;
          const h = signature.hFrac * height;
          const x = signature.xFrac * width;
          const y = height - signature.yFrac * height - h;
          page.drawImage(image, { x, y, width: w, height: h });
        }
        setStatus({ text: `Caricamento ${zone.label}...`, color: "#555" });
        const bytes = await outDoc.save();
        const blob = new File([new Uint8Array(bytes)], `${zone.key}.pdf`, { type: "application/pdf" });
        const result = await uploadDomDocumentAction(clientId, zone.key, blob);
        if (!result.success) throw new Error(`${zone.label}: ${result.message || "errore durante il caricamento"}`);
        if (result.presenzaFile !== undefined) onUploaded(result.presenzaFile);
      }
      setStatus({ text: "Tutti i documenti sono stati caricati.", color: "green" });
      setTimeout(onClose, 1200);
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : "Errore durante l'elaborazione", color: "red" });
    } finally {
      setProcessing(false);
    }
  }

  const placement = placementPageId ? findPage(lanes, placementPageId) : null;

  function thumb(page: ContractPage, lane: Lane, index: number) {
    return (
      <div
        key={page.id}
        className="contract-proc-thumb"
        draggable
        onDragStart={() => setDragId(page.id)}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.stopPropagation(); handleDrop(lane, index); }}
        title="Trascina per riordinare o spostare"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- transient canvas-rendered data URL */}
        <img src={page.thumbnailUrl} alt={`Pagina`} onClick={() => openPlacement(page.id)} />
        {signature?.pageId === page.id && <span className="contract-proc-thumb-sig" title="Firma posizionata qui">✒</span>}
      </div>
    );
  }

  return (
    <div className="scan-bridge-overlay">
      <div className="scan-bridge-box" style={{ maxWidth: 1180 }} onClick={e => e.stopPropagation()}>
        <div className="scan-bridge-header">
          <div className="scan-bridge-brand">
            <img src="/LogoFull_trasp.svg" alt="Roma Office Sharing" />
          </div>
          <div className="scan-bridge-company">Carica Contratto e processa</div>
          <button type="button" className="scan-bridge-close" aria-label="Chiudi" onClick={requestClose}>×</button>
        </div>

        <div className="scan-bridge-body">
          {loading && <p style={{ fontSize: 13, color: "#666" }}>Lettura del PDF in corso...</p>}

          {!loading && (
            <>
              <p style={{ fontSize: 12, color: "#666", marginTop: 0 }}>
                Trascina le pagine (in qualunque ordine siano state scansionate) nelle caselle giuste. Clicca su una pagina per posizionarci la firma del domiciliatario.
              </p>

              <div className="gestione-field" style={{ maxWidth: 340, marginBottom: 12 }}>
                <label>Compressione {Math.round(quality * 100)}% · {totalAssignedMb(lanes)} MB assegnati</label>
                <input type="range" min={0.3} max={0.95} step={0.05} value={quality} onChange={e => applyQuality(Number(e.target.value))} />
              </div>

              <div className="contract-proc-lane" onDragOver={e => e.preventDefault()} onDrop={() => handleDrop("unassigned", lanes.unassigned.length)}>
                <div className="contract-proc-lane-title">Pagine da assegnare ({lanes.unassigned.length})</div>
                <div className="contract-proc-thumbs">
                  {lanes.unassigned.map((p, i) => thumb(p, "unassigned", i))}
                  {lanes.unassigned.length === 0 && <span className="contract-proc-empty">Tutte le pagine sono state assegnate</span>}
                </div>
              </div>

              <div className="contract-proc-zones">
                {ZONES.map(zone => (
                  <div key={zone.key} className="contract-proc-lane" onDragOver={e => e.preventDefault()} onDrop={() => handleDrop(zone.key, lanes[zone.key].length)}>
                    <div className="contract-proc-lane-title">{zone.label} ({lanes[zone.key].length})</div>
                    <div className="contract-proc-thumbs">
                      {lanes[zone.key].map((p, i) => thumb(p, zone.key, i))}
                      {lanes[zone.key].length === 0 && <span className="contract-proc-empty">Trascina qui</span>}
                    </div>
                  </div>
                ))}
              </div>

              {placement && (
                <div className="contract-proc-placement">
                  <div className="contract-proc-lane-title">
                    Posiziona la firma — trascina per spostarla, usa la maniglia in basso a destra per ridimensionarla
                    <button type="button" className="gestione-btn gestione-btn-outline" style={{ marginLeft: 10, fontSize: 11, padding: "2px 8px" }} onClick={() => { setSignature(null); setPlacementPageId(null); }}>Rimuovi firma da questa pagina</button>
                    <button type="button" className="gestione-btn gestione-btn-outline" style={{ marginLeft: 6, fontSize: 11, padding: "2px 8px" }} onClick={() => setPlacementPageId(null)}>Chiudi anteprima</button>
                  </div>
                  <div ref={previewRef} className="contract-proc-preview">
                    {/* eslint-disable-next-line @next/next/no-img-element -- transient canvas-rendered data URL */}
                    <img src={placement.page.thumbnailUrl} alt="Pagina selezionata" className="contract-proc-preview-page" draggable={false} />
                    {signature && signature.pageId === placementPageId && firmaDataUrl && (
                      <div
                        className="contract-proc-sig-box"
                        style={{ left: `${signature.xFrac * 100}%`, top: `${signature.yFrac * 100}%`, width: `${signature.wFrac * 100}%`, height: `${signature.hFrac * 100}%` }}
                        onMouseDown={dragSignature}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- transient data: URL fetched from an authenticated action, not a static asset */}
                        <img src={firmaDataUrl} alt="Firma" draggable={false} />
                        <div className="contract-proc-sig-handle" onMouseDown={resizeSignature} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14 }}>
                <button type="button" className="gestione-btn gestione-btn-blue" disabled={processing} onClick={processAndUpload}>{processing ? "Elaborazione..." : "Elabora e carica"}</button>
                {status && <span style={{ fontSize: 12, color: status.color }}>{status.text}</span>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
