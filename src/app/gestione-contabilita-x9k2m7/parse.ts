import { normalizeSectionTitle } from "@/lib/contab-title";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, passwordMeetsPolicy } from "@/lib/password-policy";

// Pure input parsing for the accounting actions. It lives outside actions.ts because every export of a
// "use server" file becomes a callable endpoint. Nothing here touches the database.

export type ContabResult = { ok: boolean; message?: string };
/** State of the forms driven by useActionState. */
export type ContabFormState = { error?: string; done?: boolean };

type FormLike = { get(name: string): FormDataEntryValue | null };
type Parsed<T> = ({ ok: true } & T) | { ok: false; message: string };

const POSTGRES_MAX_INT = 2147483647;
const MAX_TITLE_INPUT = 1000; // generous bound before the real rule (1 to 100 characters) is applied
const INVALID = "Dati non validi.";

const text = (form: FormLike, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : null;
};

/** A positive integer that fits a Postgres integer, given as a number or as digits only; anything else is null. */
export function parseRowId(value: unknown): number | null {
  if (typeof value === "string") {
    if (!/^[1-9][0-9]{0,9}$/.test(value)) return null;
    value = Number(value);
  }
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= POSTGRES_MAX_INT ? value : null;
}

export function parseDirection(value: unknown): "up" | "down" | null {
  return value === "up" || value === "down" ? value : null;
}

function parseTitle(raw: string | null): Parsed<{ title: string }> {
  if (raw === null) return { ok: false, message: INVALID };
  // A title longer than the cap is refused (with the usual message) without measuring it character by character.
  const checked = normalizeSectionTitle(raw.length > MAX_TITLE_INPUT ? "" : raw);
  return checked.ok ? { ok: true, title: checked.title } : checked;
}

export function parseCreateSectionInput(form: FormLike): Parsed<{ title: string }> {
  return parseTitle(text(form, "title"));
}

export function parseRenameSectionInput(form: FormLike): Parsed<{ sectionId: number; title: string }> {
  const sectionId = parseRowId(text(form, "sectionId"));
  if (sectionId === null) return { ok: false, message: INVALID };
  const title = parseTitle(text(form, "title"));
  return title.ok ? { ok: true, sectionId, title: title.title } : title;
}

/** The unlock password is passed on as typed (the library bounds its length and counts the attempt). */
export function parseUnlockInput(form: FormLike): Parsed<{ password: string }> {
  const password = text(form, "password");
  if (!password) return { ok: false, message: "Inserisci la password." };
  return { ok: true, password };
}

/** First-time password: both fields present, within the length cap, meeting the policy, and equal. */
export function parseNewPasswordInput(form: FormLike): Parsed<{ password: string }> {
  const next = text(form, "next");
  const confirm = text(form, "confirm");
  if (next === null || confirm === null) return { ok: false, message: INVALID };
  if (next.length > PASSWORD_MAX_LENGTH || confirm.length > PASSWORD_MAX_LENGTH) {
    return { ok: false, message: `La password non può superare ${PASSWORD_MAX_LENGTH} caratteri.` };
  }
  if (!passwordMeetsPolicy(next)) {
    return { ok: false, message: `La password deve avere da ${PASSWORD_MIN_LENGTH} a ${PASSWORD_MAX_LENGTH} caratteri, con maiuscola, minuscola, numero e carattere speciale.` };
  }
  if (next !== confirm) return { ok: false, message: "La conferma non coincide con la password." };
  return { ok: true, password: next };
}

/** The three fields of the change-password form, as typed; the rules are applied by validatePasswordChange. */
export function parsePasswordChangeInput(form: FormLike): Parsed<{ current: string; next: string; confirm: string }> {
  const current = text(form, "current");
  const next = text(form, "next");
  const confirm = text(form, "confirm");
  if (current === null || next === null || confirm === null) return { ok: false, message: INVALID };
  return { ok: true, current, next, confirm };
}
