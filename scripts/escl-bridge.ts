/**
 * Local eSCL scanner bridge — run this on the office PC that's on the same network as the
 * scanner (the eSCL protocol is plain HTTP over the LAN; a browser on a remote server can't
 * reach it directly, same reason the legacy tool needed its own local Python bridge for TWAIN).
 *
 * Start:  npx tsx scripts/escl-bridge.ts [port]     (default port 17866)
 *
 * Endpoints (JSON, CORS-open so the Next.js app's browser tab can call it from any origin):
 *   GET  /ping                                        -> { ok: true }
 *   GET  /capabilities?host=<scanner-ip>&port=&https=  -> { ok, platenSupported, feederSupported }
 *   POST /scan   body: { host, port?, https?, resolution?, color?, source?, pageSize? }
 *                -> { success, pdf_base64, filename } | { success:false, message }
 */
import { createServer } from "node:http";
import { getScannerCapabilities, scanToPdf, type ScanOptions } from "../src/lib/escl-scanner";

const PORT = Number(process.argv[2]) || 17866;

function withCors(res: import("node:http").ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res: import("node:http").ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

const server = createServer(async (req, res) => {
  withCors(res);
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  if (req.method === "GET" && url.pathname === "/ping") {
    return sendJson(res, 200, { ok: true, version: "escl-bridge-0.1" });
  }

  if (req.method === "GET" && url.pathname === "/capabilities") {
    const host = url.searchParams.get("host");
    if (!host) return sendJson(res, 400, { ok: false, message: "Parametro host mancante" });
    try {
      const caps = await getScannerCapabilities({
        host, port: url.searchParams.get("port") ? Number(url.searchParams.get("port")) : undefined,
        https: url.searchParams.get("https") === "1",
      });
      return sendJson(res, 200, { ok: true, platenSupported: caps.platenSupported, feederSupported: caps.feederSupported });
    } catch (error) {
      return sendJson(res, 502, { ok: false, message: error instanceof Error ? error.message : "Errore scanner" });
    }
  }

  if (req.method === "POST" && url.pathname === "/scan") {
    try {
      const payload = JSON.parse((await readBody(req)) || "{}") as Partial<ScanOptions>;
      if (!payload.host) return sendJson(res, 400, { success: false, message: "Parametro host mancante" });
      const pdf = await scanToPdf(payload as ScanOptions);
      return sendJson(res, 200, {
        success: true,
        pdf_base64: pdf.toString("base64"),
        filename: `scan_${new Date().toISOString().replace(/[:.]/g, "-")}.pdf`,
      });
    } catch (error) {
      return sendJson(res, 502, { success: false, message: error instanceof Error ? error.message : "Errore durante la scansione" });
    }
  }

  sendJson(res, 404, { ok: false, message: "Non trovato" });
});

server.listen(PORT, () => {
  console.log(`eSCL bridge in ascolto su http://localhost:${PORT}`);
  console.log(`Prova:  curl "http://localhost:${PORT}/capabilities?host=<IP_SCANNER>"`);
});
