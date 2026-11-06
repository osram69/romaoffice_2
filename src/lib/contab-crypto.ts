import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

// Accounting files are stored as: "ROSC1" (5 bytes) | IV (12 bytes) | ciphertext | GCM tag (16 bytes).
// The key is derived from AES_MASTER_KEY with HKDF-SHA256, so it is distinct from the key
// used for the domiciliazioni PDFs (see dom-archive.ts), which stays on its legacy format.
const MAGIC = Buffer.from("ROSC1");
const IV_LEN = 12;
const TAG_LEN = 16;
const HEADER_LEN = MAGIC.length + IV_LEN;
const MIN_LEN = HEADER_LEN + TAG_LEN;

// Derived on every call (no cache): the master key is read from the environment each time.
function contabKey(): Buffer {
  const master = process.env.AES_MASTER_KEY;
  if (!master) throw new Error("AES_MASTER_KEY non configurata");
  return Buffer.from(hkdfSync("sha256", master, "ros-contabilita-v1", "file-encryption", 32));
}

export function encryptContab(data: Buffer): Buffer {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", contabKey(), iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([MAGIC, iv, encrypted, cipher.getAuthTag()]);
}

export function decryptContab(blob: Buffer): Buffer {
  if (blob.length < MIN_LEN || !blob.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("Formato file non valido");
  }
  const iv = blob.subarray(MAGIC.length, HEADER_LEN);
  const tag = blob.subarray(blob.length - TAG_LEN);
  const encrypted = blob.subarray(HEADER_LEN, blob.length - TAG_LEN);
  try {
    const decipher = createDecipheriv("aes-256-gcm", contabKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  } catch (e) {
    // Missing key is a configuration error, not a tampered file.
    if (e instanceof Error && e.message === "AES_MASTER_KEY non configurata") throw e;
    throw new Error("File non integro");
  }
}
