import { eq } from "drizzle-orm";
import { db } from "@/db";
import { domClients } from "@/db/schema";
import { evaluateParent, type ParentCheck, type ParentClaim } from "./parent-company";

/** Checks the claim against the companies currently domiciled with us (stato 1 = attiva). */
export async function verifyParentCompany(claim: ParentClaim): Promise<ParentCheck> {
  const candidates = await db.select({
    id: domClients.id, ragioneSociale: domClients.ragioneSociale, amministratore: domClients.amministratore, personaRif: domClients.personaRif,
    emailPosta: domClients.emailPosta, emailPec: domClients.emailPec, areaClientiEmail: domClients.areaClientiEmail,
    telefono: domClients.telefono, telefonoAmm: domClients.telefonoAmm, telefonoUrg: domClients.telefonoUrg,
  }).from(domClients).where(eq(domClients.stato, 1));
  return evaluateParent(claim, candidates);
}
