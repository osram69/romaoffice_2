// Minimal independent ZIP reader, used only by tests (store-only archives, no ZIP64).
// It walks the central directory (EOCD -> entries -> local headers) so that it does not
// share any logic with the writer in src/lib/zip-store.ts.
export type ZipEntry = { name: string; data: Buffer; crc: number };

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;

export function readZip(zip: Buffer): ZipEntry[] {
  // The EOCD record is the last 22 bytes when there is no archive comment.
  let eocd = -1;
  for (let i = zip.length - 22; i >= 0 && i >= zip.length - 22 - 0xffff; i--) {
    if (zip.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("EOCD non trovato");

  const count = zip.readUInt16LE(eocd + 10);
  let pos = zip.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];

  for (let n = 0; n < count; n++) {
    if (zip.readUInt32LE(pos) !== CEN_SIG) throw new Error("Voce della directory centrale non valida");
    const flags = zip.readUInt16LE(pos + 8);
    const method = zip.readUInt16LE(pos + 10);
    const crc = zip.readUInt32LE(pos + 16);
    const compSize = zip.readUInt32LE(pos + 20);
    const size = zip.readUInt32LE(pos + 24);
    const nameLen = zip.readUInt16LE(pos + 28);
    const extraLen = zip.readUInt16LE(pos + 30);
    const commentLen = zip.readUInt16LE(pos + 32);
    const localOffset = zip.readUInt32LE(pos + 42);
    const name = zip.subarray(pos + 46, pos + 46 + nameLen).toString(flags & 0x0800 ? "utf8" : "latin1");
    pos += 46 + nameLen + extraLen + commentLen;

    if (method !== 0) throw new Error(`Metodo ${method} non supportato`);
    if (compSize !== size) throw new Error("Dimensioni incoerenti per una voce store");
    if (zip.readUInt32LE(localOffset) !== LOC_SIG) throw new Error("Header locale non valido");
    const lNameLen = zip.readUInt16LE(localOffset + 26);
    const lExtraLen = zip.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + lNameLen + lExtraLen;
    entries.push({ name, data: Buffer.from(zip.subarray(start, start + size)), crc });
  }
  return entries;
}
