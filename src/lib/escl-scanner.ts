import { PDFDocument } from "pdf-lib";

// Minimal eSCL (AirScan / Mopria "Scan") client. eSCL is a plain-HTTP protocol most modern
// network scanners/MFPs speak natively (no drivers needed) — see the Mopria eSCL spec.
// Scan region units are always 1/300 inch, independent of the requested resolution.
const UNITS_PER_INCH = 300;
const PAGE_SIZES = {
  a4: { widthIn: 8.27, heightIn: 11.69 },
  letter: { widthIn: 8.5, heightIn: 11 },
} as const;

export type PageSize = keyof typeof PAGE_SIZES;
export type ColorMode = "color" | "gray";
export type ScanSource = "platen" | "feeder" | "feederDuplex";

export type ScanOptions = {
  host: string; // scanner IP or hostname, e.g. "192.168.1.50"
  port?: number; // default 80 (eSCL is usually plain HTTP; some devices use 443/8080/8443)
  https?: boolean;
  resolution?: number; // dpi, default 200
  color?: ColorMode;
  source?: ScanSource;
  pageSize?: PageSize;
};

function baseUrl(opts: Pick<ScanOptions, "host" | "port" | "https">): string {
  const scheme = opts.https ? "https" : "http";
  const port = opts.port ?? (opts.https ? 443 : 80);
  return `${scheme}://${opts.host}:${port}/eSCL`;
}

/** A scan failure the operator can act on (empty feeder, jam...) — `code` lets the UI show a popup
 * instead of the raw HTTP error the scanner replied with. */
export class ScanError extends Error {
  constructor(public code: "adf-empty" | "adf-error", message: string) { super(message); }
}

const ADF_EMPTY_MESSAGE = "Nessun foglio nell'alimentatore automatico (ADF), oppure lo scanner è occupato. Inserisci i fogli nel caricatore e riprova.";
const ADF_PROBLEMS: Record<string, string> = {
  ScannerAdfEmpty: ADF_EMPTY_MESSAGE,
  ScannerAdfJam: "Inceppamento nell'alimentatore automatico (ADF): rimuovi i fogli inceppati e riprova.",
  ScannerAdfDoorOpen: "Lo sportello dell'alimentatore automatico (ADF) è aperto: chiudilo e riprova.",
  ScannerAdfHatchOpen: "Il coperchio dell'alimentatore automatico (ADF) è aperto: chiudilo e riprova.",
  ScannerAdfMultipickDetected: "Lo scanner ha prelevato più fogli insieme (ADF): separa i fogli e riprova.",
};

/** Best-effort ADF state from /ScannerStatus (not every device reports it) — null when unknown. */
async function getAdfState(opts: Pick<ScanOptions, "host" | "port" | "https">): Promise<string | null> {
  try {
    const res = await fetch(`${baseUrl(opts)}/ScannerStatus`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return (await res.text()).match(/AdfState>\s*([A-Za-z]+)\s*</)?.[1] ?? null;
  } catch { return null; }
}

export type ScannerCapabilities = { raw: string; platenSupported: boolean; feederSupported: boolean };

export async function getScannerCapabilities(opts: Pick<ScanOptions, "host" | "port" | "https">): Promise<ScannerCapabilities> {
  const res = await fetch(`${baseUrl(opts)}/ScannerCapabilities`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`ScannerCapabilities HTTP ${res.status}`);
  const raw = await res.text();
  return { raw, platenSupported: raw.includes("Platen"), feederSupported: raw.includes("Feeder") || raw.includes("Adf") };
}

function pwgInputSource(source: ScanSource): string {
  return source === "platen" ? "Platen" : "Feeder";
}

function buildScanSettingsXml(opts: Required<Pick<ScanOptions, "resolution" | "color" | "source" | "pageSize">>): string {
  const size = PAGE_SIZES[opts.pageSize];
  const width = Math.round(size.widthIn * UNITS_PER_INCH);
  const height = Math.round(size.heightIn * UNITS_PER_INCH);
  const colorMode = opts.color === "color" ? "RGB24" : "Grayscale8";
  const duplex = opts.source === "feederDuplex";
  return `<?xml version="1.0" encoding="UTF-8"?>
<scan:ScanSettings xmlns:scan="http://schemas.hp.com/imaging/escl/2011/05/03" xmlns:pwg="http://www.pwg.org/schemas/2010/12/sm">
  <pwg:Version>2.0</pwg:Version>
  <pwg:ScanRegions>
    <pwg:ScanRegion>
      <pwg:Height>${height}</pwg:Height>
      <pwg:Width>${width}</pwg:Width>
      <pwg:XOffset>0</pwg:XOffset>
      <pwg:YOffset>0</pwg:YOffset>
    </pwg:ScanRegion>
  </pwg:ScanRegions>
  <pwg:InputSource>${pwgInputSource(opts.source)}</pwg:InputSource>
  <scan:ColorMode>${colorMode}</scan:ColorMode>
  <scan:XResolution>${opts.resolution}</scan:XResolution>
  <scan:YResolution>${opts.resolution}</scan:YResolution>
  <scan:Duplex>${duplex}</scan:Duplex>
  <pwg:DocumentFormat>image/jpeg</pwg:DocumentFormat>
  <scan:DocumentFormatExt>image/jpeg</scan:DocumentFormatExt>
</scan:ScanSettings>`;
}

/** Starts one eSCL scan job and returns the job's resource URL (from the Location header). */
async function createScanJob(opts: Required<Omit<ScanOptions, "host" | "port" | "https">> & Pick<ScanOptions, "host" | "port" | "https">): Promise<string> {
  const res = await fetch(`${baseUrl(opts)}/ScanJobs`, {
    method: "POST",
    headers: { "Content-Type": "application/xml" },
    body: buildScanSettingsXml(opts),
    signal: AbortSignal.timeout(10000),
  });
  const body = res.status === 201 ? "" : await res.text().catch(() => "");
  // HP devices answer 503 "Scanner busy" when asked to scan from an empty feeder.
  if (res.status === 503 && opts.source !== "platen") throw new ScanError("adf-empty", ADF_EMPTY_MESSAGE);
  if (res.status !== 201) throw new Error(`ScanJobs HTTP ${res.status}: ${body}`);
  const location = res.headers.get("Location");
  if (!location) throw new Error("Scanner did not return a job Location");
  return location.startsWith("http") ? location : `${baseUrl(opts)}/../${location}`.replace(/\/eSCL\/\.\.\//, "/");
}

/** Fetches one page from an open job. Returns null once the scanner has no more pages
 * (HTTP 404/409 is the eSCL convention for "job exhausted"). */
async function fetchNextDocument(jobUrl: string): Promise<Buffer | null> {
  const res = await fetch(`${jobUrl}/NextDocument`, { signal: AbortSignal.timeout(60000) });
  if (res.status === 404 || res.status === 409) return null;
  if (!res.ok) throw new Error(`NextDocument HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function deleteJob(jobUrl: string): Promise<void> {
  try { await fetch(jobUrl, { method: "DELETE", signal: AbortSignal.timeout(5000) }); } catch { /* best-effort cleanup */ }
}

export type ScannedPage = { data: Buffer; format: "pdf" | "jpeg" | "png" };

function pageFormat(page: Buffer): ScannedPage["format"] {
  if (page.subarray(0, 4).toString("ascii") === "%PDF") return "pdf";
  if (page[0] === 0xff && page[1] === 0xd8) return "jpeg";
  return "png";
}

/** Scans one document (single page from the flatbed, or every page the feeder holds) and returns
 * each page's raw bytes as the scanner sent them. The scan request asks for image/jpeg (see
 * buildScanSettingsXml) specifically so real thumbnails can be shown — pdf-lib can only assemble
 * a PDF, not rasterize one, so if a device ignored that and sent PDF pages anyway there'd be no
 * cheap way to preview them; the "pdf" branch below exists only as a fallback for that case (a
 * generic icon is shown instead of a thumbnail — see DomMailScanPanel). Kept separate from
 * pagesToPdf so callers that want individual page thumbnails don't have to re-parse a merged PDF
 * to get them back out. */
export async function scanPages(options: ScanOptions): Promise<ScannedPage[]> {
  const opts = {
    host: options.host, port: options.port, https: options.https,
    resolution: options.resolution ?? 200,
    color: options.color ?? "gray" as ColorMode,
    source: options.source ?? "platen" as ScanSource,
    pageSize: options.pageSize ?? "a4" as PageSize,
  };
  if (opts.source !== "platen") {
    const adfProblem = ADF_PROBLEMS[(await getAdfState(opts)) ?? ""];
    if (adfProblem) throw new ScanError(adfProblem === ADF_EMPTY_MESSAGE ? "adf-empty" : "adf-error", adfProblem);
  }
  const jobUrl = await createScanJob(opts);
  try {
    const pages: ScannedPage[] = [];
    while (true) {
      const page = await fetchNextDocument(jobUrl);
      if (!page) break;
      pages.push({ data: page, format: pageFormat(page) });
      if (opts.source === "platen") break; // flatbed: exactly one page per job
    }
    if (pages.length === 0) throw new Error("Lo scanner non ha restituito alcuna pagina");
    return pages;
  } finally {
    await deleteJob(jobUrl);
  }
}

/** Merges scanned pages (as returned by scanPages) into a single PDF, embedding JPEG/PNG pages as
 * full-page images and copying already-PDF pages in as-is. */
export async function pagesToPdf(pages: ScannedPage[]): Promise<Buffer> {
  const outDoc = await PDFDocument.create();
  for (const page of pages) {
    if (page.format === "pdf") {
      const pageDoc = await PDFDocument.load(page.data);
      const copied = await outDoc.copyPages(pageDoc, pageDoc.getPageIndices());
      copied.forEach(p => outDoc.addPage(p));
    } else {
      const image = page.format === "jpeg" ? await outDoc.embedJpg(page.data) : await outDoc.embedPng(page.data);
      const p = outDoc.addPage([image.width, image.height]);
      p.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    }
  }
  return Buffer.from(await outDoc.save());
}

/** Scans one document and returns a single merged PDF — convenience wrapper over
 * scanPages + pagesToPdf for callers that don't need individual pages (e.g. per-page thumbnails). */
export async function scanToPdf(options: ScanOptions): Promise<Buffer> {
  return pagesToPdf(await scanPages(options));
}
