import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// File-format-compatible with the legacy PHP tool (show_enc_pdf.php / ajax_upload_enc.php):
// AES-256-CTR, PHP's openssl_encrypt(..., 0, iv) base64-encodes the ciphertext itself, then the
// whole file is base64( <base64 ciphertext> + '::' + <raw iv bytes> ). Matching this means files
// written by either system stay readable by the other.
const CIPHER = "aes-256-ctr";

export const DOC_TYPES = ["con", "mod", "all", "doc", "avc", "rev"] as const;
export type DocType = (typeof DOC_TYPES)[number];

function archiveDir() {
  const dir = process.env.DOM_ARCHIVE_DIR;
  if (!dir) throw new Error("DOM_ARCHIVE_DIR non configurata");
  // A web address here silently succeeds (Node treats it as a relative filesystem path — e.g.
  // "http://host/x" becomes a literal "http:/host/x" folder under the process's working
  // directory) instead of failing loudly, which is exactly how a real archive ended up lost
  // once. DOM_ARCHIVE_DIR must be the absolute filesystem path on the server, not a URL.
  if (/^https?:\/\//i.test(dir)) throw new Error("DOM_ARCHIVE_DIR deve essere un percorso assoluto sul filesystem del server (es. /home/utente/domains/tuosito.it/archivio_dmcl), non un indirizzo web");
  if (!path.isAbsolute(dir)) throw new Error("DOM_ARCHIVE_DIR deve essere un percorso assoluto (deve iniziare con /), non relativo");
  return dir;
}
function archiveKey() {
  const key = process.env.AES_MASTER_KEY;
  if (!key) throw new Error("AES_MASTER_KEY non configurata");
  // The legacy key is an arbitrary passphrase string, not raw key bytes — PHP's openssl_encrypt
  // truncates/pads a string key to the cipher's key length internally (EVP_BytesToKey-less: for
  // "AES-256-CTR" with a string key. PHP treats the key argument as raw bytes and this simply
  // uses the first 32 bytes / zero-pads it. We reproduce that exactly for byte compatibility.
  const buf = Buffer.alloc(32);
  Buffer.from(key, "utf8").copy(buf);
  return buf;
}
function filePath(fileId: number, type: DocType) {
  return path.join(archiveDir(), `${fileId}_${type}.pdf.enc`);
}

// Mail scans are deliberately NOT kept in archiveDir(): that folder is the permanent, backed-up
// contractual archive (con/mod/all/doc/avc/rev), while a mail scan is a working document that
// only needs to survive until staff sends/marks it — a genuinely different retention need, so it
// gets its own directory (defaults to the OS temp dir; set DOM_MAIL_SCANS_DIR to override, e.g.
// if the host's default temp dir is cleared too aggressively for same-day turnaround).
function mailScanDir() {
  const dir = process.env.DOM_MAIL_SCANS_DIR;
  if (!dir) return path.join(os.tmpdir(), "dom-mail-scans");
  if (/^https?:\/\//i.test(dir)) throw new Error("DOM_MAIL_SCANS_DIR deve essere un percorso assoluto sul filesystem del server, non un indirizzo web");
  if (!path.isAbsolute(dir)) throw new Error("DOM_MAIL_SCANS_DIR deve essere un percorso assoluto (deve iniziare con /), non relativo");
  return dir;
}
function mailScanFilePath(scanId: number) {
  return path.join(mailScanDir(), `posta_${scanId}.pdf.enc`);
}

// Same AES-256-CTR scheme as the file-based archive below, just returning the encoded string
// directly instead of writing it to a path — for the one asset that belongs in a DB column, not a
// file: the domiciliatario signature (see firmaDomiciliatarioPng in siteConfig). Storing it in the
// database rather than in a file, and encrypted rather than plain, means it survives a redeploy
// (this project's git repo is public — it must never end up committed as a plain file) and isn't
// readable from a database dump alone.
export function encryptBytes(data: Buffer): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(CIPHER, archiveKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  const ciphertextB64 = ciphertext.toString("base64");
  const combined = Buffer.concat([Buffer.from(ciphertextB64, "utf8"), Buffer.from("::"), iv]);
  return combined.toString("base64");
}
export function decryptBytes(encoded: string): Buffer {
  const combined = Buffer.from(encoded, "base64");
  const separatorIndex = combined.indexOf("::");
  if (separatorIndex === -1) throw new Error("Formato dati non valido");
  const ciphertextB64 = combined.subarray(0, separatorIndex).toString("utf8");
  const iv = combined.subarray(separatorIndex + 2);
  const ciphertext = Buffer.from(ciphertextB64, "base64");
  const decipher = createDecipheriv(CIPHER, archiveKey(), iv);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

async function encryptToFile(targetPath: string, data: Buffer) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, encryptBytes(data));
}
async function decryptFromFile(sourcePath: string): Promise<Buffer> {
  return decryptBytes(await readFile(sourcePath, "utf8"));
}

export async function saveEncrypted(fileId: number, type: DocType, data: Buffer) {
  await encryptToFile(filePath(fileId, type), data);
}

export async function readDecrypted(fileId: number, type: DocType): Promise<Buffer> {
  return decryptFromFile(filePath(fileId, type));
}

export async function removeEncrypted(fileId: number, type: DocType) {
  try { await unlink(filePath(fileId, type)); } catch { /* already gone */ }
}

// Mail scans (see dom_mail_scans in schema.ts): one encrypted file per scan, keyed by the row's
// own id rather than by DocType, since a client can receive mail — and so be scanned — repeatedly.
export async function saveMailScanEncrypted(scanId: number, data: Buffer) {
  await encryptToFile(mailScanFilePath(scanId), data);
}

export async function readMailScanDecrypted(scanId: number): Promise<Buffer> {
  return decryptFromFile(mailScanFilePath(scanId));
}

export async function removeMailScanEncrypted(scanId: number) {
  try { await unlink(mailScanFilePath(scanId)); } catch { /* already gone */ }
}
