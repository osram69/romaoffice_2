// Small HTTP helpers for the accounting routes. No imports and no database: pure, so they are tested
// locally (tests/contab-http.test.ts).

const FALLBACK_NAME = "documento";

// Content-Disposition for a download: an ASCII `filename` for old clients plus the real name in
// `filename*` (RFC 6266 / RFC 5987, UTF-8, percent-encoded). The input is made well-formed first
// (a lone surrogate becomes U+FFFD) because encodeURIComponent throws on one, and control characters
// are dropped so no CR/LF can ever reach the header or the downloaded file name.
export function contentDisposition(name: string): string {
  const clean = String(name ?? "").toWellFormed().replace(/[\x00-\x1f\x7f]/g, "") || FALLBACK_NAME;
  // Fallback: no quotes or backslashes (they would end or escape the quoted string), no "%" (some
  // clients percent-decode this form), and one underscore per non-ASCII or non-printable code point.
  const ascii = clean.replace(/["\\]/g, "").replace(/%/g, "_").replace(/[^\x20-\x7e]/gu, "_").trim() || FALLBACK_NAME;
  // encodeURIComponent leaves ' ( ) * alone; RFC 5987 attr-char does not allow them.
  const encoded = encodeURIComponent(clean).replace(/['()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase());
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

/**
 * The raw (still percent-encoded) value of the first `key` in a query string, or null when absent.
 * `URLSearchParams.get` decodes for you; going through it and then calling decodeURIComponent would
 * decode twice (so a name containing "%" would be corrupted or refused), and it never reports a
 * malformed sequence. The caller decodes exactly once with `decodeQueryValue`.
 */
export function rawQueryParam(search: string, key: string): string | null {
  const query = search.startsWith("?") ? search.slice(1) : search;
  if (!query) return null;
  for (const part of query.split("&")) {
    const eq = part.indexOf("=");
    const name = eq < 0 ? part : part.slice(0, eq);
    if (name === key) return eq < 0 ? "" : part.slice(eq + 1);
  }
  return null;
}

/** decodeURIComponent that answers null instead of throwing on a malformed sequence. "+" stays "+". */
export function decodeQueryValue(raw: string): string | null {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

/**
 * Reads a request body of at most `max` bytes. Returns null as soon as the received bytes exceed it (the stream
 * is cancelled, so an oversized or endless chunked upload is never buffered), whatever Content-Length said.
 */
export async function readBodyLimited(body: ReadableStream<Uint8Array> | null, max: number): Promise<Buffer | null> {
  if (!body) return Buffer.alloc(0);
  const reader = body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(Buffer.from(value.buffer, value.byteOffset, value.byteLength));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}
