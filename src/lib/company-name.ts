import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { domClients } from "@/db/schema";

// Trailing legal-form words ignored when comparing names: "Rossi S.r.l." and "ROSSI SRL" (or just
// "Rossi") would be indistinguishable on an envelope, which is exactly the confusion to avoid.
const LEGAL_FORMS = new Set(["srl", "srls", "spa", "snc", "sas", "sapa", "ss", "scarl", "scrl", "scpa", "sca", "unipersonale", "ltd", "gmbh", "llc", "inc"]);

export function normalizeCompanyName(name: string): string {
  const base = name
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/&/g, " e ").replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
  // "s r l" typed with spaces -> "srl": join runs of single letters (same rule on both sides of the comparison)
  const tokens: string[] = [];
  let run = "";
  for (const token of base.split(" ").filter(Boolean)) {
    if (/^[a-z]$/.test(token)) { run += token; continue; }
    if (run) { tokens.push(run); run = ""; }
    tokens.push(token);
  }
  if (run) tokens.push(run);
  while (tokens.length > 1 && LEGAL_FORMS.has(tokens[tokens.length - 1])) tokens.pop();
  return tokens.join(" ");
}

/** True when a company with this name (ignoring case, accents, punctuation and legal form) is
 * already domiciled with us: in attivazione, attiva or sospesa. Decaduta/vuota ones don't count. */
export async function companyNameTaken(name: string): Promise<boolean> {
  const wanted = normalizeCompanyName(name);
  if (!wanted) return false;
  const rows = await db.select({ ragioneSociale: domClients.ragioneSociale }).from(domClients).where(inArray(domClients.stato, [0, 1, 3]));
  return rows.some(row => normalizeCompanyName(row.ragioneSociale) === wanted);
}
