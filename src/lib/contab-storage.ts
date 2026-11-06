import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { archiveRoot } from "@/lib/dom-archive";
import { decryptContab, encryptContab } from "@/lib/contab-crypto";

// Encrypted accounting files live in <DOM_ARCHIVE_DIR>/contabilita/<uuid>.enc. The stored name is
// always a server-generated UUID, never derived from the uploaded file name; anything else is
// refused so a hostile value can never escape the folder.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function contabDir(): string {
  return path.join(archiveRoot(), "contabilita");
}

function filePathFor(storedName: string): string {
  if (!UUID_RE.test(storedName)) throw new Error("Nome file non valido");
  return path.join(contabDir(), `${storedName}.enc`);
}

export function newStoredName(): string {
  return randomUUID();
}

export async function saveContabFile(storedName: string, data: Buffer): Promise<void> {
  const target = filePathFor(storedName);
  const blob = encryptContab(data);
  await mkdir(contabDir(), { recursive: true });
  // Write to a temporary file and rename, so a crash never leaves a half-written .enc behind.
  const tmp = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(tmp, blob, { mode: 0o600 });
    await rename(tmp, target);
  } catch (e) {
    await unlink(tmp).catch(() => {});
    throw e;
  }
}

export async function readContabFile(storedName: string): Promise<Buffer> {
  const target = filePathFor(storedName);
  let blob: Buffer;
  try {
    blob = await readFile(target);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") throw new Error("File non trovato");
    throw e;
  }
  return decryptContab(blob);
}

export async function removeContabFile(storedName: string): Promise<void> {
  const target = filePathFor(storedName);
  try {
    await unlink(target);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
}
