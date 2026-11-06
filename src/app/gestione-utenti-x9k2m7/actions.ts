"use server";
import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/staff-guards";
import { createStaffUser, generatePassword, resetStaffPassword, setStaffActive } from "@/lib/staff-users";
import { parseCreateInput, parseResetInput, parseToggleInput, type ActionResult } from "./parse";

const BASE_PATH = "/gestione-utenti-x9k2m7";
const UNAVAILABLE = "Servizio momentaneamente non disponibile, riprova tra qualche minuto.";

// Only async functions may be exported here: each export is a public endpoint. The library functions do not
// check who is calling, so each action authenticates as admin first and takes the actor from the session, never from the form.
// Neither the typed nor the generated password is ever logged; a generated one is only returned to the caller.

export async function createUserAction(formData: FormData): Promise<ActionResult> {
  await requireAdminUser(BASE_PATH);
  const input = parseCreateInput(formData);
  if (!input.ok) return { ok: false, message: input.message };
  const password = input.generate ? generatePassword() : input.password!;
  try {
    const result = await createStaffUser({ username: input.username, role: input.role, password });
    if (!result.ok) return { ok: false, message: result.message };
  } catch (error) {
    console.error("staff user creation failed", error instanceof Error ? error.message : "unknown error");
    return { ok: false, message: UNAVAILABLE };
  }
  revalidatePath(BASE_PATH);
  return { ok: true, message: "Utente creato. Al primo accesso dovrà scegliere una nuova password.", ...(input.generate ? { generatedPassword: password } : {}) };
}

export async function resetUserPasswordAction(formData: FormData): Promise<ActionResult> {
  await requireAdminUser(BASE_PATH);
  const input = parseResetInput(formData);
  if (!input.ok) return { ok: false, message: input.message };
  const password = input.generate ? generatePassword() : input.password!;
  try {
    const result = await resetStaffPassword(input.targetId, password);
    if (!result.ok) return { ok: false, message: result.message };
  } catch (error) {
    console.error("staff password reset failed", error instanceof Error ? error.message : "unknown error");
    return { ok: false, message: UNAVAILABLE };
  }
  revalidatePath(BASE_PATH);
  return { ok: true, message: "Password reimpostata. Le sessioni dell'utente sono state chiuse e dovrà sceglierne una nuova al prossimo accesso.", ...(input.generate ? { generatedPassword: password } : {}) };
}

export async function toggleUserActiveAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdminUser(BASE_PATH);
  const input = parseToggleInput(formData);
  if (!input.ok) return { ok: false, message: input.message };
  try {
    const result = await setStaffActive(admin.id, input.targetId, input.active);
    if (!result.ok) return { ok: false, message: result.message };
  } catch (error) {
    console.error("staff user activation change failed", error instanceof Error ? error.message : "unknown error");
    return { ok: false, message: UNAVAILABLE };
  }
  revalidatePath(BASE_PATH);
  return { ok: true, message: input.active ? "Utente riattivato." : "Utente disattivato." };
}
