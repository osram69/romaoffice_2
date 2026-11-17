import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { domClients } from "@/db/schema";
import { normalizeCompanyName } from "./company-name-normalize";

export { normalizeCompanyName };


/** True when a company with this name (ignoring case, accents, punctuation and legal form) is
 * already domiciled with us: in attivazione, attiva or sospesa. Decaduta/vuota ones don't count. */
export async function companyNameTaken(name: string): Promise<boolean> {
  const wanted = normalizeCompanyName(name);
  if (!wanted) return false;
  const rows = await db.select({ ragioneSociale: domClients.ragioneSociale }).from(domClients).where(inArray(domClients.stato, [0, 1, 3]));
  return rows.some(row => normalizeCompanyName(row.ragioneSociale) === wanted);
}
