import { eq } from "drizzle-orm";
import { db } from "@/db";
import { domClients, domContractDrafts } from "@/db/schema";
import { decryptBytes, encryptBytes } from "./dom-archive";
import { contractDataSchema, emptyContract, type ContractData } from "./contract-data";

type DomClient = typeof domClients.$inferSelect;

/**
 * Economic conditions printed on page 4 come from the domiciliazione record set up by reception
 * (start/end dates and the "prezzo rinnovo" used as the yearly fee) — the customer cannot edit them,
 * and a missing value blocks the online contract until reception fills it in.
 */
export function conditionsFrom(client: DomClient): { ready: boolean; durataMesi: number; canoneEuro: number; dataInizio: string } {
  const inizio = client.inizioDom || "";
  const fine = client.scadenzaDom || "";
  let mesi = 0;
  if (inizio && fine) {
    const a = new Date(`${inizio}T12:00:00Z`); const b = new Date(`${fine}T12:00:00Z`);
    mesi = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
    if (b.getUTCDate() - a.getUTCDate() > 15) mesi += 1;
  }
  const canoneEuro = client.prezzoRinnovo ?? 0;
  return { ready: Boolean(inizio && mesi >= 1 && mesi <= 120 && canoneEuro > 0), durataMesi: mesi, canoneEuro, dataInizio: inizio };
}

/** Starting values taken from what reception (or the online order) already knows about the company. */
function prefillFrom(client: DomClient): Partial<ContractData> {
  const rep = (client.amministratore || client.personaRif || "").trim();
  const email = (client.emailPosta || "").split(/[;,\s]+/).find(Boolean) || client.areaClientiEmail || "";
  return {
    societa: client.ragioneSociale, pec: client.emailPec || "", repNome: rep, repEmail: email,
    telUrgenze: client.telefonoUrg || client.telefono || "", emailScansioni: email, denominazioneForma: client.ragioneSociale,
  };
}

function applyConditions(data: ContractData, client: DomClient): ContractData {
  const c = conditionsFrom(client);
  return { ...data, durataMesi: c.durataMesi || data.durataMesi, canoneEuro: c.canoneEuro, dataInizio: c.dataInizio, aggiuntiva: Boolean(client.aggiuntiva) };
}

export async function loadContractDraft(client: DomClient) {
  const [row] = await db.select().from(domContractDrafts).where(eq(domContractDrafts.domClientId, client.id)).limit(1);
  let data = emptyContract();
  let saved = false;
  if (row) {
    try {
      const parsed = contractDataSchema.safeParse(JSON.parse(decryptBytes(row.dataEnc).toString("utf8")));
      if (parsed.success) { data = parsed.data as ContractData; saved = true; }
    } catch { /* unreadable draft: start over from the prefill */ }
  }
  if (!saved) data = { ...data, ...prefillFrom(client) };
  return {
    data: applyConditions(data, client), conditionsReady: conditionsFrom(client).ready, saved,
    completedAt: row?.completedAt ?? null, signedAt: client.contrattoClienteAt ?? null, adminDocAt: client.docAmmClienteAt ?? null,
  };
}

export async function saveContractDraft(client: DomClient, input: unknown) {
  const parsed = contractDataSchema.parse(input);
  const data = applyConditions(parsed as ContractData, client);
  const dataEnc = encryptBytes(Buffer.from(JSON.stringify(data), "utf8"));
  // Editing the answers after the PDF was generated invalidates that "completed" mark.
  await db.insert(domContractDrafts).values({ domClientId: client.id, dataEnc, completedAt: null })
    .onConflictDoUpdate({ target: domContractDrafts.domClientId, set: { dataEnc, completedAt: null, updatedAt: new Date() } });
}

export async function markContractCompleted(client: DomClient) {
  await db.update(domContractDrafts).set({ completedAt: new Date() }).where(eq(domContractDrafts.domClientId, client.id));
}
