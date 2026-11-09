// The persistence step of an upload, with its I/O injected so the order and the rollback can be tested
// without a database or a disk (tests/contab-upload.test.ts). No imports: pure.

export type UploadIo = {
  newName(): string;
  /** Encrypts and writes the file. */
  save(storedName: string, data: Buffer): Promise<void>;
  /** Inserts the database row for the stored file and returns its id. */
  add(storedName: string): Promise<number>;
  /** Deletes the stored file (a missing file is not an error). */
  remove(storedName: string): Promise<void>;
};

/**
 * Writes the file first, then the row. If the row cannot be added the file is removed again, so no
 * orphan stays on disk, and the original error is rethrown (a failing cleanup is only logged, through
 * `logError`, and never hides it). If writing the file fails nothing was added and nothing is removed:
 * the storage layer already cleans up its own temporary file.
 */
export async function storeUpload(
  io: UploadIo,
  data: Buffer,
  logError: (label: string, error: unknown) => void,
): Promise<{ id: number; storedName: string }> {
  const storedName = io.newName();
  await io.save(storedName, data);
  try {
    return { id: await io.add(storedName), storedName };
  } catch (error) {
    try {
      await io.remove(storedName);
    } catch (removeError) {
      logError("Contab upload: removing the orphan file failed", removeError);
    }
    throw error;
  }
}
