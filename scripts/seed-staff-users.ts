import "dotenv/config";
import { randomBytes } from "node:crypto";
import { db, pool } from "@/db";
import { staffUsers } from "@/db/schema";
import { hashPassword } from "@/lib/customer-auth";

const accounts: { username: string; role: "admin" | "operatore" }[] = [
  { username: "patrickserra", role: "admin" },
  { username: "segreteria", role: "operatore" },
  { username: "ammin", role: "operatore" },
];

function tempPassword() {
  return randomBytes(9).toString("base64").replace(/[+/=]/g, "").slice(0, 12);
}

async function main() {
  for (const account of accounts) {
    const password = tempPassword();
    const passwordHash = await hashPassword(password);
    await db.insert(staffUsers).values({ username: account.username, passwordHash, role: account.role })
      .onConflictDoNothing({ target: staffUsers.username });
    console.log(`${account.username} (${account.role}) — password temporanea: ${password}`);
  }
  console.log("\nQueste password sono valide solo se l'account non esisteva già (onConflictDoNothing). Comunicale allo staff e fai cambiare la password appena possibile.");
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
