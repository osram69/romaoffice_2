import "dotenv/config";
import { randomInt } from "node:crypto";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, passwordMeetsPolicy } from "@/lib/password-policy";
import { logSafeError } from "@/lib/safe-log";

// Resets the second password of the Contabilità area (the one asked after the staff login) when the admin forgot it.
//   npx tsx scripts/reset-contab-password.ts [new-password]
// Without a password a random one that satisfies the password policy is generated and printed once.
// With DATABASE_URL available (Hostinger terminal, or a local .env) the database is updated directly; otherwise the
// script prints the SQL to paste into the Supabase SQL editor: the hash is computed locally, so no DB access is needed.
// Either way every active Contabilità unlock is dropped, so whoever was unlocked must enter the new password.

// Characters that are easy to confuse (0/O, 1/l/I) are left out so the password can be read out or copied by hand.
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SPECIAL = "!@#$%&*?-_+=";
const pick = (alphabet: string) => alphabet[randomInt(alphabet.length)];

function generatePassword() {
  const all = UPPER + LOWER + DIGITS + SPECIAL;
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SPECIAL)];
  while (chars.length < 16) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

async function main() {
  const [given] = process.argv.slice(2);
  const password = given || generatePassword();
  if (!passwordMeetsPolicy(password)) {
    console.error(`La password deve avere da ${PASSWORD_MIN_LENGTH} a ${PASSWORD_MAX_LENGTH} caratteri, con maiuscola, minuscola, numero e carattere speciale.`);
    process.exit(1);
  }

  // "@/db" refuses to load without DATABASE_URL, but computing the hash needs customer-auth, which imports it. The pool is
  // lazy, so a placeholder is enough when only the SQL is printed: nothing ever connects to it.
  const hasDatabase = Boolean(process.env.DATABASE_URL);
  if (!hasDatabase) process.env.DATABASE_URL = "postgres://unused:unused@127.0.0.1:1/unused";
  const { hashPassword } = await import("@/lib/customer-auth");
  const passwordHash = await hashPassword(password);
  const shown = given ? "" : `\nNuova password: ${password}`;

  if (!hasDatabase) {
    console.log(`INSERT INTO contab_access (id, password_hash, updated_at) VALUES (1, '${passwordHash.replace(/'/g, "''")}', now()) ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = now();`);
    console.log("DELETE FROM contab_unlocks;");
    console.log(`\nEsegui le due righe SQL qui sopra nell'editor SQL di Supabase.${shown}`);
    return;
  }

  const { db, pool } = await import("@/db");
  const { contabAccess, contabUnlocks } = await import("@/db/schema");
  try {
    await db.transaction(async tx => {
      await tx.insert(contabAccess).values({ id: 1, passwordHash })
        .onConflictDoUpdate({ target: contabAccess.id, set: { passwordHash, updatedAt: new Date() } });
      await tx.delete(contabUnlocks);
    });
    console.log(`Seconda password di Contabilità reimpostata; gli sblocchi attivi sono stati chiusi.${shown}`);
  } finally {
    await pool.end();
  }
}

// Never print the error object: a failed write carries the query parameters, i.e. the password hash.
main().catch(error => { logSafeError("Reset della seconda password non riuscito", error); process.exit(1); });
