import { db } from "@/db";
import { domClients } from "@/db/schema";

/** Finds the domiciliazione record (if any) whose email_posta list — the same address(es) scans
 * are sent to — contains this exact address. email_posta can hold several addresses separated by
 * ";", so this can't be a plain equality match. The table is small (~550 rows), so a single fetch
 * + in-memory check is simpler and safer than a fragile SQL LIKE against a delimited field. */
export async function findDomClientByEmail(email: string) {
  const target = email.trim().toLowerCase();
  if (!target) return null;
  const rows = await db.select().from(domClients);
  for (const row of rows) {
    const addresses = (row.emailPosta || "").split(";").map(a => a.trim().toLowerCase());
    if (addresses.includes(target)) return row;
  }
  return null;
}
