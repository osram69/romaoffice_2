import { CustomerError, limit } from "@/lib/customer-auth";
import type { StaffUser } from "@/lib/staff-auth";
import { changeOwnPassword } from "@/lib/staff-users";
import { validatePasswordChange } from "./validate";

// Not in actions.ts on purpose: every export of a "use server" file becomes a callable endpoint, and this
// function trusts its caller to have authenticated `user` and `rawSession`.

export type PasswordChangeState = { error?: string; done?: boolean };

export const TOO_MANY_ATTEMPTS = "Troppi tentativi, riprova tra qualche minuto";
const UNAVAILABLE = "Servizio momentaneamente non disponibile, riprova tra qualche minuto.";

/** Validates, rate limits (5 attempts per user every 15 minutes) and changes the password. Never throws: failures come back as `{ error }`. */
export async function performPasswordChange(
  user: StaffUser,
  rawSession: string,
  input: { current: string; next: string; confirm: string },
): Promise<PasswordChangeState> {
  const invalid = validatePasswordChange(input);
  if (invalid) return { error: invalid };
  try {
    await limit("staff-pw-change:" + user.id, 5, 900);
  } catch (error) {
    if (error instanceof CustomerError && error.code === "limited") return { error: TOO_MANY_ATTEMPTS };
    console.error("staff password change: rate limiter failed", error);
    return { error: UNAVAILABLE };
  }
  try {
    const result = await changeOwnPassword(user.id, rawSession, input.current, input.next);
    return result.ok ? { done: true } : { error: result.message };
  } catch (error) {
    console.error("staff password change failed", error);
    return { error: UNAVAILABLE };
  }
}
