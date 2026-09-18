import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
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

export async function saveEncrypted(fileId: number, type: DocType, data: Buffer) {
  const iv = randomBytes(16);
  const cipher = createCipheriv(CIPHER, archiveKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  const ciphertextB64 = ciphertext.toString("base64");
  const combined = Buffer.concat([Buffer.from(ciphertextB64, "utf8"), Buffer.from("::"), iv]);
  const dir = archiveDir();
  await mkdir(dir, { recursive: true });
  await writeFile(filePath(fileId, type), Buffer.from(combined.toString("base64"), "utf8"));
}

export async function readDecrypted(fileId: number, type: DocType): Promise<Buffer> {
  const raw = await readFile(filePath(fileId, type), "utf8");
  const combined = Buffer.from(raw, "base64");
  const separatorIndex = combined.indexOf("::");
  if (separatorIndex === -1) throw new Error("Formato file non valido");
  const ciphertextB64 = combined.subarray(0, separatorIndex).toString("utf8");
  const iv = combined.subarray(separatorIndex + 2);
  const ciphertext = Buffer.from(ciphertextB64, "base64");
  const decipher = createDecipheriv(CIPHER, archiveKey(), iv);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export async function removeEncrypted(fileId: number, type: DocType) {
  try { await unlink(filePath(fileId, type)); } catch { /* already gone */ }
}
