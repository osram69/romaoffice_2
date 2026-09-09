import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { CustomerError } from "./customer-auth";

function encryptionKey() {
  const value = process.env.CUSTOMER_DOCUMENT_KEY;
  if (!value || !/^[a-f\d]{64}$/i.test(value)) throw new CustomerError("unavailable", 503);
  return Buffer.from(value, "hex");
}
function root() {
  // Runtime customer data is provisioned on a persistent private volume, not bundled.
  const path = resolve(/* turbopackIgnore: true */ process.env.CUSTOMER_STORAGE_PATH || "private/customer-contracts");
  const publicRoot = resolve("public");
  if (path === publicRoot || path.startsWith(publicRoot + sep) || path.split(sep).includes("public_html")) throw new Error("Private contracts cannot be stored under public/");
  return path;
}
export async function storeCustomerContract(content: Buffer) {
  if (content.length > 20 * 1024 * 1024 || content.subarray(0, 5).toString() !== "%PDF-") throw new Error("A PDF of up to 20 MB is required");
  const key = encryptionKey(); const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(content), cipher.final()]);
  const packed = Buffer.concat([Buffer.from("ROS1"), iv, cipher.getAuthTag(), encrypted]);
  const storageKey = `${randomUUID()}.enc`;
  await mkdir(root(), { recursive: true, mode: 0o700 });
  await writeFile(resolve(root(), storageKey), packed, { mode: 0o600, flag: "wx" });
  return storageKey;
}
export async function readCustomerContract(storageKey: string) {
  if (!/^[a-f\d-]{36}\.enc$/.test(storageKey)) throw new CustomerError("notFound", 404);
  const data = await readFile(/* turbopackIgnore: true */ resolve(root(), storageKey));
  if (data.subarray(0, 4).toString() !== "ROS1") throw new Error("Invalid document format");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), data.subarray(4, 16));
  decipher.setAuthTag(data.subarray(16, 32));
  return Buffer.concat([decipher.update(data.subarray(32)), decipher.final()]);
}
