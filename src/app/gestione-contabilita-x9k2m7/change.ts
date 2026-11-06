import { changeContabPassword } from "@/lib/contab-auth";
import { CustomerError, limit } from "@/lib/customer-auth";
import { logSafeError } from "@/lib/safe-log";
import type { StaffUser } from "@/lib/staff-auth";
import { validatePasswordChange } from "../gestione-password-x9k2m7/validate";
import type { ContabResult } from "./parse";

// Not in actions.ts on purpose: every export of a "use server" file becomes a callable endpoint, and this
// function trusts its caller to have authenticated `user` (admin with a valid unlock) and `rawSession`.

export const TOO_MANY_ATTEMPTS = "Troppi tentativi, riprova tra qualche minuto";
const UNAVAILABLE = "Servizio momentaneamente non disponibile, riprova tra qualche minuto.";

/**
 * Validates (length caps first), rate limits (5 attempts per admin every 15 minutes) and changes the second password.
 * On success every other unlock is closed and the one of `rawSession` stays. Never throws: failures come back as `{ ok: false, message }`.
 */
export async function performContabPasswordChange(
  user: StaffUser,
  rawSession: string,
  input: { current: string; next: string; confirm: string },
): Promise<ContabResult> {
  const invalid = validatePasswordChange(input);
  if (invalid) return { ok: false, message: invalid };
  try {
    await limit("contab-pw-change:" + user.id, 5, 900);
  } catch (error) {
    if (error instanceof CustomerError && error.code === "limited") return { ok: false, message: TOO_MANY_ATTEMPTS };
    logSafeError("contab password change: rate limiter failed", error);
    return { ok: false, message: UNAVAILABLE };
  }
  try {
    const result = await changeContabPassword(input.current, input.next, rawSession);
    return result.ok ? { ok: true, message: "Password di Contabilità cambiata. Le altre sessioni sbloccate sono state chiuse." } : { ok: false, message: result.message };
  } catch (error) {
    logSafeError("contab password change failed", error);
    return { ok: false, message: UNAVAILABLE };
  }
}
