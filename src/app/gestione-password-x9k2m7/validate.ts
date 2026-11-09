import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, passwordMeetsPolicy } from "@/lib/password-policy";

/**
 * Pure checks for the change-password form. Returns an Italian error message, or null when the input is fine.
 * Length caps come first so an oversized value is rejected before anything is hashed.
 */
export function validatePasswordChange({ current, next, confirm }: { current: string; next: string; confirm: string }): string | null {
  if (current.length > PASSWORD_MAX_LENGTH) return "La password attuale è troppo lunga.";
  if (next.length > PASSWORD_MAX_LENGTH) return `La nuova password non può superare ${PASSWORD_MAX_LENGTH} caratteri.`;
  if (confirm.length > PASSWORD_MAX_LENGTH) return "La conferma della password è troppo lunga.";
  if (!current) return "Inserisci la password attuale.";
  if (!passwordMeetsPolicy(next)) {
    return `La nuova password deve avere da ${PASSWORD_MIN_LENGTH} a ${PASSWORD_MAX_LENGTH} caratteri, con maiuscola, minuscola, numero e carattere speciale.`;
  }
  if (next !== confirm) return "La conferma non coincide con la nuova password.";
  if (next === current) return "La nuova password deve essere diversa da quella attuale.";
  return null;
}
