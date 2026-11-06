import "dotenv/config";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, passwordMeetsPolicy } from "@/lib/password-policy";
import { logSafeError } from "@/lib/safe-log";
import { buildResetSql } from "./staff-password-sql";

// Resets the dashboard password of one staff account (the dashboards have no self-service reset; this is how an admin
// who forgot the password gets back in).
//   npx tsx scripts/reset-staff-password.ts <username> [new-password]
// Without a password a random one that satisfies the password policy is generated and printed once.
// With DATABASE_URL available (Hostinger terminal, or a local .env) the account is updated directly; otherwise the
// script prints the SQL to paste into the Supabase SQL editor: the hash is computed locally, so no DB access is needed.
// Either way the account is reactivated and its open sessions are closed. must_change_password is left alone: whoever
// resets their own password already knows it.
async function main() {
  const [username, given] = process.argv.slice(2);
  if (!username) {
    console.error("Uso: npx tsx scripts/reset-staff-password.ts <username> [nuova-password]");
    process.exit(1);
  }
  const user = username.trim().toLowerCase();

  if (given !== undefined && !passwordMeetsPolicy(given)) {
    console.error(`La password deve avere da ${PASSWORD_MIN_LENGTH} a ${PASSWORD_MAX_LENGTH} caratteri, con maiuscola, minuscola, numero e carattere speciale.`);
    process.exit(1);
  }

  // "@/db" refuses to load without DATABASE_URL, but computing the hash needs customer-auth and the generator lives in
  // staff-users, which both import it. The pool is lazy, so a placeholder is enough when only the SQL is printed:
  // nothing ever connects to it.
  const hasDatabase = Boolean(process.env.DATABASE_URL);
  if (!hasDatabase) process.env.DATABASE_URL = "postgres://unused:unused@127.0.0.1:1/unused";
  const { hashPassword } = await import("@/lib/customer-auth");
  const { generatePassword } = await import("@/lib/staff-users");
  const password = given ?? generatePassword();
  const passwordHash = await hashPassword(password);
  const shown = given !== undefined ? "" : `\nPassword temporanea: ${password}`;

  if (!hasDatabase) {
    for (const statement of buildResetSql(user, passwordHash)) console.log(statement);
    console.log(`\nEsegui le due righe SQL qui sopra insieme nell'editor SQL di Supabase.${shown}`);
    return;
  }

  const { eq } = await import("drizzle-orm");
  const { db, pool } = await import("@/db");
  const { staffSessions, staffUsers } = await import("@/db/schema");
  try {
    const updated = await db.transaction(async tx => {
      const rows = await tx.update(staffUsers).set({ passwordHash, active: true }).where(eq(staffUsers.username, user))
        .returning({ id: staffUsers.id, username: staffUsers.username, role: staffUsers.role });
      if (rows.length) await tx.delete(staffSessions).where(eq(staffSessions.userId, rows[0].id));
      return rows;
    });
    if (!updated.length) {
      const all = await db.select({ username: staffUsers.username }).from(staffUsers);
      console.error(`Nessun utente "${username}". Utenti esistenti: ${all.map(u => u.username).join(", ") || "(nessuno)"}`);
      process.exitCode = 1;
    } else {
      console.log(`Password di ${updated[0].username} (${updated[0].role}) reimpostata; le sessioni aperte sono state chiuse.${shown}`);
    }
  } finally {
    await pool.end();
  }
}

// Never print the error object: a failed write carries the query parameters, i.e. the password hash.
main().catch(error => { logSafeError("Reset della password non riuscito", error); process.exit(1); });
