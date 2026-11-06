import { PASSWORD_MAX_LENGTH } from "@/lib/password-policy";
import { normalizeUsername } from "@/lib/staff-users";

// Pure input parsing for the admin actions. It lives outside actions.ts because every export of a
// "use server" file becomes a callable endpoint. Nothing here touches the database.

export type ActionResult = { ok: boolean; message?: string; generatedPassword?: string };

type FormLike = { get(name: string): FormDataEntryValue | null };
type Parsed<T> = ({ ok: true } & T) | { ok: false; message: string };

const MAX_USERNAME_INPUT = 200; // generous bound before normalising; the real limit (60) is checked by the library
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const CREATABLE_ROLES = ["operatore", "commercialista"] as const;
export type CreatableRole = (typeof CREATABLE_ROLES)[number];

const INVALID = { ok: false, message: "Dati non validi." } as const;

const text = (form: FormLike, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : null;
};

/** `generate` true means the server picks the password and any typed one is ignored. */
function passwordChoice(form: FormLike): { generate: true } | { generate: false; password: string } | null {
  const mode = text(form, "mode");
  if (mode === "generate") return { generate: true };
  if (mode !== "typed") return null;
  const password = text(form, "password");
  if (!password || password.length > PASSWORD_MAX_LENGTH) return null;
  return { generate: false, password };
}

export function parseCreateInput(form: FormLike): Parsed<{ username: string; role: CreatableRole; generate: boolean; password?: string }> {
  const rawUsername = text(form, "username");
  const role = text(form, "role");
  const choice = passwordChoice(form);
  if (!rawUsername || rawUsername.length > MAX_USERNAME_INPUT || !choice) return INVALID;
  if (!role || !(CREATABLE_ROLES as readonly string[]).includes(role)) return { ok: false, message: "Ruolo non valido." };
  return { ok: true, username: normalizeUsername(rawUsername), role: role as CreatableRole, ...choice };
}

export function parseResetInput(form: FormLike): Parsed<{ targetId: string; generate: boolean; password?: string }> {
  const targetId = text(form, "targetId");
  const choice = passwordChoice(form);
  if (!targetId || !UUID_PATTERN.test(targetId) || !choice) return INVALID;
  return { ok: true, targetId, ...choice };
}

export function parseToggleInput(form: FormLike): Parsed<{ targetId: string; active: boolean }> {
  const targetId = text(form, "targetId");
  const active = text(form, "active");
  if (!targetId || !UUID_PATTERN.test(targetId) || (active !== "true" && active !== "false")) return INVALID;
  return { ok: true, targetId, active: active === "true" };
}
