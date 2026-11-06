import { PASSWORD_MAX_LENGTH } from "./password-policy";

/**
 * Bounds the work done for a submitted password. A password longer than PASSWORD_MAX_LENGTH can never be the right one
 * (the policy caps stored passwords), so it is cut to the cap, which keeps the hashing cost bounded, and flagged:
 * the caller still hashes `candidate` (same work as any other attempt) but must refuse when `withinLimit` is false.
 * Without the flag a long password whose first characters are right would be accepted.
 */
export function boundPassword(password: string): { candidate: string; withinLimit: boolean } {
  const withinLimit = password.length <= PASSWORD_MAX_LENGTH;
  return { candidate: withinLimit ? password : password.slice(0, PASSWORD_MAX_LENGTH), withinLimit };
}
