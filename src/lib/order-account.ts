import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { domClients, type orders } from "@/db/schema";
import { hashPassword } from "./customer-auth";
import { emptyContract } from "./contract-data";
import { saveContractDraft } from "./contract-draft";
import type { OrderSnapshot } from "./order-access";
import type { RequestData } from "./request";

type OrderRow = typeof orders.$inferSelect;
export type CustomerAccount = { email: string; password: string | null; phone: string; alreadyHadAccess: boolean };

const GROUPS = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!#$%&*+-=?@"];
/** 14 characters, always satisfying the Area Clienti password policy; look-alike characters (0/O, 1/l/I) left out. */
export function generatePassword(): string {
  const all = GROUPS.join("");
  const chars = GROUPS.map(g => g[randomInt(g.length)]);
  while (chars.length < 14) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) { const j = randomInt(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join("");
}

function addMonths(isoDate: string, months: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() < day) d.setUTCDate(0); // 31 Jan + 1 month → end of February
  return d.toISOString().slice(0, 10);
}

/**
 * Online legal-address orders get their Area Clienti access straight away: a domiciliazione record is created
 * ("In Attivazione", ready for staff to move to "Attiva" once payment is checked) with the login email, a
 * temporary password the customer must change, the dates/fee of the order and a contract draft prefilled with
 * what they already typed — so they can complete and sign the contract online. Idempotent: if the confirmation
 * email is retried before the customer ever received it, the same record gets a fresh password.
 */
export async function provisionCustomerAccount(order: OrderRow, data: RequestData, snapshot: OrderSnapshot): Promise<CustomerAccount | null> {
  if (snapshot.product.code !== "legal_unit") return null;
  const email = data.email.trim().toLowerCase();
  const [existing] = await db.select().from(domClients).where(eq(domClients.areaClientiEmail, email)).limit(1);
  const mine = existing && existing.ragioneSociale === data.companyName.trim() && existing.mustChangePassword;
  if (existing && !mine) return { email, password: null, phone: data.phone, alreadyHadAccess: true };

  const password = generatePassword();
  const passwordHash = await hashPassword(password);
  if (existing) {
    await db.update(domClients).set({ areaClientiPasswordHash: passwordHash, mustChangePassword: true }).where(eq(domClients.id, existing.id));
    return { email, password, phone: data.phone, alreadyHadAccess: false };
  }

  const inizio = data.startDate;
  const [client] = await db.insert(domClients).values({
    ragioneSociale: data.companyName.trim(), emailPosta: email, amministratore: data.representativeName, personaRif: data.representativeName,
    telefono: data.phone, inizioDom: inizio, scadenzaDom: addMonths(inizio, data.months), prezzoRinnovo: Math.round(snapshot.quote.serviceNetCents / 100),
    stato: 0, tipologia: 0, areaClientiEmail: email, areaClientiPasswordHash: passwordHash, mustChangePassword: true,
    note: `Creata automaticamente dall'ordine online ${order.publicId}`,
  }).returning();

  const digits = (v: string) => v.replace(/\D/g, "");
  await saveContractDraft(client, {
    ...emptyContract(),
    societa: client.ragioneSociale, denominazioneForma: client.ragioneSociale, sedeVia: data.companyAddress, cfRegImp: (data.companyTaxCode || "").toUpperCase(),
    piva: digits(data.companyVat), cfSocieta: (data.companyTaxCode || data.companyVat || "").toUpperCase(), pivaSocieta: digits(data.companyVat),
    repQualifica: data.representativeRole, repNome: data.representativeName, repCf: data.representativeTaxCode.toUpperCase(), repEmail: email,
    telUrgenze: data.phone, emailScansioni: email,
  });
  return { email, password, phone: data.phone, alreadyHadAccess: false };
}
