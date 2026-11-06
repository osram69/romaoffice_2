"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { CONTAB_UNLOCK_COOKIE, contabAccessFromCookies, setInitialContabPassword, unlockContab } from "@/lib/contab-auth";
import { createSection, deleteFileRow, deleteSectionIfEmpty, moveSection, renameSection } from "@/lib/contab-data";
import { CONTAB_LOCKED_MESSAGE } from "@/lib/contab-messages";
import { removeContabFile } from "@/lib/contab-storage";
import { logSafeError } from "@/lib/safe-log";
import { STAFF_SESSION_COOKIE, type StaffUser } from "@/lib/staff-auth";
import { requireAdminUser } from "@/lib/staff-guards";
import { performContabPasswordChange } from "./change";
import { contabUnlockCookieOptions } from "./cookie";
import {
  parseCreateSectionInput,
  parseDirection,
  parseNewPasswordInput,
  parsePasswordChangeInput,
  parseRenameSectionInput,
  parseRowId,
  parseUnlockInput,
  type ContabFormState,
  type ContabResult,
} from "./parse";

const BASE_PATH = "/gestione-contabilita-x9k2m7";
const UNAVAILABLE = "Servizio momentaneamente non disponibile, riprova tra qualche minuto.";
const INVALID = { ok: false, message: "Dati non validi." } as const;
const LOCKED = { ok: false, message: CONTAB_LOCKED_MESSAGE } as const;

// Only async functions may be exported here: each export is a public endpoint. The library functions do not check who is
// calling, so every action starts with requireAdminUser (outside any try/catch: it redirects by throwing) and, except the
// unlock and the first-time password, then requires a valid second-password unlock (contabAccessFromCookies).
// Nothing typed (passwords, titles) is ever logged: failures go through logSafeError (error class and SQLSTATE only).

function refreshPages() {
  revalidatePath(BASE_PATH);
  revalidatePath(`${BASE_PATH}/impostazioni`);
}

/** Opens an unlock bound to the caller's staff session and sets its cookie. Returns an error message, or null on success. */
async function openUnlock(user: StaffUser, password: string): Promise<string | null> {
  const store = await cookies();
  const sessionRaw = store.get(STAFF_SESSION_COOKIE)?.value;
  if (!sessionRaw) return "Sessione scaduta, accedi di nuovo.";
  const result = await unlockContab(user, sessionRaw, password);
  if (!result.ok) return result.message;
  store.set(CONTAB_UNLOCK_COOKIE, result.unlockRaw, contabUnlockCookieOptions(process.env.NODE_ENV));
  return null;
}

export async function unlockContabAction(_prev: ContabFormState, formData: FormData): Promise<ContabFormState> {
  const admin = await requireAdminUser(BASE_PATH);
  const input = parseUnlockInput(formData);
  if (!input.ok) return { error: input.message };
  let failure: string | null;
  try {
    failure = await openUnlock(admin, input.password);
  } catch (error) {
    logSafeError("contab unlock action failed", error);
    return { error: UNAVAILABLE };
  }
  if (failure) return { error: failure };
  refreshPages();
  return { done: true };
}

export async function setInitialContabPasswordAction(_prev: ContabFormState, formData: FormData): Promise<ContabFormState> {
  const admin = await requireAdminUser(BASE_PATH);
  const input = parseNewPasswordInput(formData);
  if (!input.ok) return { error: input.message };
  try {
    const result = await setInitialContabPassword(input.password);
    if (!result.ok) return { error: result.message };
  } catch (error) {
    logSafeError("contab initial password failed", error);
    return { error: UNAVAILABLE };
  }
  // The admin has just chosen the password: unlock right away. If that fails the page simply asks for the password.
  try {
    await openUnlock(admin, input.password);
  } catch (error) {
    logSafeError("contab unlock after setup failed", error);
  }
  refreshPages();
  return { done: true };
}

export async function createSectionAction(formData: FormData): Promise<ContabResult> {
  await requireAdminUser(BASE_PATH);
  const unlocked = await contabAccessFromCookies();
  if (!unlocked) return LOCKED;
  const input = parseCreateSectionInput(formData);
  if (!input.ok) return { ok: false, message: input.message };
  try {
    const result = await createSection(input.title);
    if (!result.ok) return { ok: false, message: result.message };
  } catch (error) {
    logSafeError("contab section creation failed", error);
    return { ok: false, message: UNAVAILABLE };
  }
  refreshPages();
  return { ok: true, message: "Sezione creata. La trovi in cima all'elenco." };
}

export async function renameSectionAction(formData: FormData): Promise<ContabResult> {
  await requireAdminUser(BASE_PATH);
  const unlocked = await contabAccessFromCookies();
  if (!unlocked) return LOCKED;
  const input = parseRenameSectionInput(formData);
  if (!input.ok) return { ok: false, message: input.message };
  try {
    const result = await renameSection(input.sectionId, input.title);
    if (!result.ok) return { ok: false, message: result.message };
  } catch (error) {
    logSafeError("contab section rename failed", error);
    return { ok: false, message: UNAVAILABLE };
  }
  refreshPages();
  return { ok: true, message: "Sezione rinominata." };
}

export async function moveSectionAction(sectionId: number, direction: string): Promise<ContabResult> {
  await requireAdminUser(BASE_PATH);
  const unlocked = await contabAccessFromCookies();
  if (!unlocked) return LOCKED;
  const id = parseRowId(sectionId);
  const way = parseDirection(direction);
  if (id === null || way === null) return INVALID;
  try {
    await moveSection(id, way);
  } catch (error) {
    logSafeError("contab section move failed", error);
    return { ok: false, message: UNAVAILABLE };
  }
  refreshPages();
  return { ok: true };
}

export async function deleteSectionAction(sectionId: number): Promise<ContabResult> {
  await requireAdminUser(BASE_PATH);
  const unlocked = await contabAccessFromCookies();
  if (!unlocked) return LOCKED;
  const id = parseRowId(sectionId);
  if (id === null) return INVALID;
  try {
    const result = await deleteSectionIfEmpty(id);
    if (!result.ok) return { ok: false, message: result.message };
  } catch (error) {
    logSafeError("contab section delete failed", error);
    return { ok: false, message: UNAVAILABLE };
  }
  refreshPages();
  return { ok: true, message: "Sezione eliminata." };
}

export async function changeContabPasswordAction(formData: FormData): Promise<ContabResult> {
  await requireAdminUser(BASE_PATH);
  const unlocked = await contabAccessFromCookies();
  if (!unlocked) return LOCKED;
  const input = parsePasswordChangeInput(formData);
  if (!input.ok) return { ok: false, message: input.message };
  let rawSession: string | undefined;
  try {
    rawSession = (await cookies()).get(STAFF_SESSION_COOKIE)?.value;
  } catch (error) {
    logSafeError("contab password change: cookies unavailable", error);
    return { ok: false, message: UNAVAILABLE };
  }
  // Unreachable in practice (the unlock above is bound to this session) but kept fail-closed.
  if (!rawSession) return LOCKED;
  const result = await performContabPasswordChange(unlocked, rawSession, input);
  if (result.ok) refreshPages();
  return result;
}

export async function deleteContabFileAction(fileId: number): Promise<ContabResult> {
  await requireAdminUser(BASE_PATH);
  const unlocked = await contabAccessFromCookies();
  if (!unlocked) return LOCKED;
  const id = parseRowId(fileId);
  if (id === null) return INVALID;
  try {
    const row = await deleteFileRow(id);
    if (!row) return { ok: false, message: "File non trovato: forse è già stato eliminato." };
    // The row is gone; remove the encrypted file too. If that fails the orphan is unreachable from the app: log and go on.
    try {
      await removeContabFile(row.storedName);
    } catch (error) {
      logSafeError("contab file removal from disk failed", error);
    }
  } catch (error) {
    logSafeError("contab file delete failed", error);
    return { ok: false, message: UNAVAILABLE };
  }
  refreshPages();
  return { ok: true, message: "File eliminato." };
}
