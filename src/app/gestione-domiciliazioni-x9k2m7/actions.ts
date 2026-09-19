"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { domClients, domCustomerChallenges, domCustomerSessions, domRinnovoPrezzi } from "@/db/schema";
import { STAFF_SESSION_COOKIE, getStaffUser } from "@/lib/staff-auth";
import { removeEncrypted, saveEncrypted, type DocType, DOC_TYPES } from "@/lib/dom-archive";
import { PRESENZA_FILE_BITS, cleanText } from "@/lib/dom-status";
import { buildScadenzaEmailHtml, defaultScontoApplicabile, scadenzaEmailSubject } from "@/lib/dom-scadenza-email";
import { sendDomMail } from "@/lib/mailer";
import { hashPassword } from "@/lib/customer-auth";
import { passwordMeetsPolicy } from "@/lib/password-policy";

const BASE_PATH = "/gestione-domiciliazioni-x9k2m7";

async function requireStaff() {
  const store = await cookies();
  const user = await getStaffUser(store.get(STAFF_SESSION_COOKIE)?.value);
  if (!user) redirect(`/gestione-tariffe-x9k2m7/login?next=${BASE_PATH}`);
  return user;
}

function str(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}
function dateOrNull(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}
function fields(formData: FormData) {
  return {
    ragioneSociale: String(formData.get("ragioneSociale") ?? "").trim(),
    sede: Number(formData.get("sede")) || 0,
    emailPosta: String(formData.get("emailPosta") ?? "").trim(),
    emailPec: str(formData, "emailPec"),
    amministratore: str(formData, "amministratore"),
    telefonoAmm: str(formData, "telefonoAmm"),
    personaRif: str(formData, "personaRif"),
    telefono: str(formData, "telefono"),
    telefonoUrg: str(formData, "telefonoUrg"),
    inizioDom: dateOrNull(formData, "inizioDom"),
    scadenzaDom: dateOrNull(formData, "scadenzaDom"),
    scadenzaPagamento: dateOrNull(formData, "scadenzaPagamento"),
    contrFirmato: formData.get("contrFirmato") === "on",
    controfirmatoInviato: formData.get("controfirmatoInviato") === "on",
    moduloCont: formData.get("moduloCont") === "on",
    docAmmPres: formData.get("docAmmPres") === "on",
    allegato1Pres: formData.get("allegato1Pres") === "on",
    visuraPres: formData.get("visuraPres") === "on",
    stato: Number(formData.get("stato")),
    note: str(formData, "note"),
    indSpedPosta: str(formData, "indSpedPosta"),
    tipologia: Number(formData.get("tipologia")) || 0,
    raccoglitore: Number(formData.get("raccoglitore")) || 0,
    prezzoRinnovo: formData.get("prezzoRinnovo") ? Math.round(Number(formData.get("prezzoRinnovo"))) : null,
    areaClientiEmail: str(formData, "areaClientiEmail")?.toLowerCase() ?? null,
  };
}

export async function createDomiciliazioneAction(formData: FormData) {
  "use server";
  await requireStaff();
  await db.insert(domClients).values(fields(formData));
  revalidatePath(BASE_PATH);
}

export async function updateDomiciliazioneAction(formData: FormData) {
  "use server";
  await requireStaff();
  const id = Number(formData.get("id"));
  await db.update(domClients).set(fields(formData)).where(eq(domClients.id, id));
  revalidatePath(BASE_PATH);
}

// Permanent deletion is only allowed for records that were never activated (stato 0,
// "In Attivazione"). Everywhere else the record must be soft-"decaduta" instead — enforced
// here server-side, not just by hiding the button, since this is a real data-safety rule.
export async function deleteDomiciliazioneAction(formData: FormData) {
  "use server";
  await requireStaff();
  const id = Number(formData.get("id"));
  await db.delete(domClients).where(and(eq(domClients.id, id), eq(domClients.stato, 0)));
  revalidatePath(BASE_PATH);
}

export async function decadiDomiciliazioneAction(formData: FormData) {
  "use server";
  await requireStaff();
  const id = Number(formData.get("id"));
  await db.update(domClients).set({ stato: 2 }).where(eq(domClients.id, id));
  revalidatePath(BASE_PATH);
}

export async function ripristinaDomiciliazioneAction(formData: FormData) {
  "use server";
  await requireStaff();
  const id = Number(formData.get("id"));
  await db.update(domClients).set({ stato: 1 }).where(eq(domClients.id, id));
  revalidatePath(BASE_PATH);
}

export async function attivaDomiciliazioneAction(formData: FormData) {
  "use server";
  await requireStaff();
  const id = Number(formData.get("id"));
  await db.update(domClients).set({ stato: 1 }).where(eq(domClients.id, id));
  revalidatePath(BASE_PATH);
}

async function clientFileId(id: number) {
  const [row] = await db.select({ legacyId: domClients.legacyId, presenzaFile: domClients.presenzaFile }).from(domClients).where(eq(domClients.id, id)).limit(1);
  if (!row) throw new Error("Domiciliazione non trovata");
  return { fileId: row.legacyId ?? id, presenzaFile: row.presenzaFile };
}

// Files are stored encrypted (AES-256-CTR, same format as the legacy PHP tool) directly in the
// archivio_dmcl folder on disk — not in Postgres, these PDFs run into the gigabytes in total.
export async function uploadDomDocumentAction(id: number, docType: DocType, file: File): Promise<{ success: boolean; message?: string; presenzaFile?: number }> {
  "use server";
  await requireStaff();
  if (!DOC_TYPES.includes(docType)) return { success: false, message: "Tipo documento non valido" };
  try {
    const { fileId, presenzaFile } = await clientFileId(id);
    const buffer = Buffer.from(await file.arrayBuffer());
    await saveEncrypted(fileId, docType, buffer);
    const newPresenzaFile = presenzaFile | PRESENZA_FILE_BITS[docType];
    await db.update(domClients).set({ presenzaFile: newPresenzaFile }).where(eq(domClients.id, id));
    revalidatePath(BASE_PATH);
    return { success: true, presenzaFile: newPresenzaFile };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Errore durante il caricamento" };
  }
}

export async function removeDomDocumentAction(id: number, docType: DocType): Promise<{ success: boolean; message?: string; presenzaFile?: number }> {
  "use server";
  await requireStaff();
  if (!DOC_TYPES.includes(docType)) return { success: false, message: "Tipo documento non valido" };
  try {
    const { fileId, presenzaFile } = await clientFileId(id);
    await removeEncrypted(fileId, docType);
    const newPresenzaFile = presenzaFile & ~PRESENZA_FILE_BITS[docType];
    await db.update(domClients).set({ presenzaFile: newPresenzaFile }).where(eq(domClients.id, id));
    revalidatePath(BASE_PATH);
    return { success: true, presenzaFile: newPresenzaFile };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Errore durante la rimozione" };
  }
}

// Draft the scadenza reminder for staff to review/edit before sending — never sent unmodified.
// Reuses a previously edited/sent draft (testoScadenza) unless `regenerate` asks for a fresh one;
// `includeSconto`, when given, overrides the automatic (contract-duration-based) default for the
// "sconto attivazioni non più applicabile" disclaimer while regenerating.
export async function getScadenzaDraftAction(id: number, regenerate = false, includeSconto?: boolean): Promise<{ success: boolean; message?: string; subject?: string; html?: string; prezzoRinnovo?: number | null; scontoDefault?: boolean }> {
  "use server";
  await requireStaff();
  const [client] = await db.select().from(domClients).where(eq(domClients.id, id)).limit(1);
  if (!client) return { success: false, message: "Domiciliazione non trovata" };
  const prezzi = await db.select().from(domRinnovoPrezzi);
  const scontoDefault = defaultScontoApplicabile(client);
  const stored = !regenerate ? client.testoScadenza?.trim() : "";
  return {
    success: true,
    subject: scadenzaEmailSubject(client),
    html: stored || buildScadenzaEmailHtml(client, prezzi, includeSconto ?? scontoDefault),
    prezzoRinnovo: client.prezzoRinnovo,
    scontoDefault,
  };
}

// Mirrors ajax_invia_scadenza.php: PEC is used (with the ordinary addresses CC'd) whenever the
// client has one on file, otherwise the first ordinary address is the recipient and the rest are
// CC'd — always with a fixed internal CC so the office keeps a copy either way.
export async function inviaScadenzaAction(formData: FormData): Promise<{ success: boolean; message?: string }> {
  "use server";
  await requireStaff();
  const id = Number(formData.get("id"));
  const html = String(formData.get("html") ?? "");
  const prezzoRaw = formData.get("prezzoRinnovo");

  const [client] = await db.select().from(domClients).where(eq(domClients.id, id)).limit(1);
  if (!client) return { success: false, message: "Domiciliazione non trovata" };
  if (!html.trim()) return { success: false, message: "Testo email vuoto" };

  const pec = cleanText(client.emailPec);
  const ordinarie = cleanText(client.emailPosta).split(";").map(s => s.trim()).filter(Boolean);
  const usaPec = Boolean(pec);
  const to = usaPec ? pec : ordinarie[0];
  if (!to) return { success: false, message: "Nessun indirizzo email valido per questa società" };
  const ccList = usaPec ? [...ordinarie, "info@romaofficesharing.it"] : [...ordinarie.slice(1), "inviate@romaofficesharing.it"];

  const result = await sendDomMail(usaPec ? "pec" : "ordinaria", {
    to, cc: ccList.join(","), subject: scadenzaEmailSubject(client),
    text: html.replace(/<[^>]+>/g, " "), html,
  });
  if (!result.sent) return { success: false, message: `Invio non riuscito (${result.reason})` };

  const prezzoRinnovo = prezzoRaw !== null && prezzoRaw !== "" ? Math.round(Number(prezzoRaw)) : client.prezzoRinnovo;
  await db.update(domClients).set({ scadenzaInviata: true, prezzoRinnovo, testoScadenza: html }).where(eq(domClients.id, id));
  revalidatePath(BASE_PATH);
  return { success: true };
}

// Staff sets or resets the Area Clienti password directly (no email-link dance): used both for
// the very first password on a new client and later if the customer loses theirs. Either way the
// customer is forced to change it on next login, and any live session/pending SMS code is revoked.
export async function setAreaClientiPasswordAction(id: number, newPassword: string): Promise<{ success: boolean; message?: string }> {
  "use server";
  await requireStaff();
  if (!passwordMeetsPolicy(newPassword)) return { success: false, message: "La password deve avere almeno 12 caratteri e includere maiuscola, minuscola, numero e carattere speciale" };
  const passwordHash = await hashPassword(newPassword);
  await db.update(domClients).set({ areaClientiPasswordHash: passwordHash, mustChangePassword: true }).where(eq(domClients.id, id));
  await db.delete(domCustomerSessions).where(eq(domCustomerSessions.domClientId, id));
  await db.delete(domCustomerChallenges).where(eq(domCustomerChallenges.domClientId, id));
  revalidatePath(BASE_PATH);
  return { success: true };
}
