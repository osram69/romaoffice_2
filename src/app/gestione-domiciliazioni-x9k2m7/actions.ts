"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { domClients, domCustomerChallenges, domCustomerSessions, domMailScans, domRinnovoPrezzi, siteConfig } from "@/db/schema";
import { STAFF_SESSION_COOKIE, getStaffUser } from "@/lib/staff-auth";
import { readMailScanDecrypted, removeEncrypted, removeMailScanEncrypted, saveEncrypted, type DocType, DOC_TYPES } from "@/lib/dom-archive";
import { PRESENZA_FILE_BITS, cleanText } from "@/lib/dom-status";
import { buildScadenzaEmailHtml, contractMonths, defaultScontoApplicabile, scadenzaDefaultMonths, scadenzaEmailSubject, scadenzaOfferMonths } from "@/lib/dom-scadenza-email";
import { sendDomMail, type DomMailAccount } from "@/lib/mailer";
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

export type MailScanSummary = { id: number; createdAt: string; scannedBy: string | null };

export type ScannerConfig = {
  host: string | null; port: number | null; https: boolean;
  color: "color" | "gray"; source: "platen" | "feeder" | "feederDuplex"; resolution: number;
};

// Read-only for any staff role (operatore included, since scanning is part of day-to-day mail
// handling) — only admins can change it, in Configurazione Web (see updateScannerConfigAction).
export async function getScannerConfigAction(): Promise<ScannerConfig> {
  "use server";
  await requireStaff();
  const [row] = await db.select().from(siteConfig).where(eq(siteConfig.id, 1)).limit(1);
  return {
    host: row?.scannerHost ?? null,
    port: row?.scannerPort ?? null,
    https: row?.scannerHttps ?? false,
    color: row?.scannerColorDefault === "color" ? "color" : "gray",
    source: row?.scannerSourceDefault === "feeder" || row?.scannerSourceDefault === "feederDuplex" ? row.scannerSourceDefault : "platen",
    resolution: row?.scannerResolutionDefault ?? 200,
  };
}

export async function listMailScansAction(domClientId: number): Promise<{ success: boolean; message?: string; scans?: MailScanSummary[] }> {
  "use server";
  await requireStaff();
  const rows = await db.select().from(domMailScans).where(eq(domMailScans.domClientId, domClientId)).orderBy(desc(domMailScans.createdAt));
  return { success: true, scans: rows.map(r => ({ id: r.id, createdAt: r.createdAt.toISOString(), scannedBy: r.scannedByUsername })) };
}

// The "Allega" button's scan panel used to persist the scanned PDF through a Server Action
// (attachMailScanAction, removed) — passing the merged PDF as a base64 string argument tripped a
// React Flight "Maximum array nesting exceeded" guard on multi-page scans (the string chunking
// the RSC protocol does internally scales with length, not byte size). It's now POST /api/dom-
// mail-scans (see that route), a plain HTTP body upload that never goes through RSC serialization.

export async function removeMailScanAction(scanId: number, domClientId: number): Promise<{ success: boolean; message?: string }> {
  "use server";
  await requireStaff();
  await db.delete(domMailScans).where(and(eq(domMailScans.id, scanId), eq(domMailScans.domClientId, domClientId)));
  await removeMailScanEncrypted(scanId);
  revalidatePath(BASE_PATH);
  return { success: true };
}

// "Invia" (ordinary email) and "PEC" notify the client that mail arrived, with the scan attached.
// "Aperta" is for when staff opened the letter and read its content to the client over the phone —
// still an email (so there's a written record), but says so instead of just "see attached".
// Subject/greeting/recipients/disclaimers below are ported verbatim from the legacy tool's
// ajax_send_mail.php (case "PEC" / "Aperta" / "Invia"/default) — same wording, same fixed
// "posta@romaofficesharing.it" internal address, same disclaimer paragraphs in IT and EN.
export type MailScanChannel = "ordinaria" | "pec" | "aperta";

const MAIL_SCAN_INTERNAL_ADDRESS = "posta@romaofficesharing.it";

// Shared by all three channels (legacy: identical in every case's $mail->Body).
const DISCLAIMER_PRIVACY_HTML = `<br><p style="font-size:11px;"><b>Avviso di Riservatezza</b> - Questo documento è riservato esclusivamente al destinatario. Tutte le informazioni ivi contenute, compresi eventuali allegati, sono soggette a riservatezza a termini del vigente D.Lgs. 196/2003 in materia di privacy e del Regolamento europeo 679/2016 - GDPR - e quindi ne è proibita l'utilizzazione ulteriore non autorizzata. Se avete ricevuto per errore questo messaggio, Vi preghiamo di informare immediatamente il mittente e cancellare l'e-mail. Grazie.</p>
<p style="font-size:11px;"><b>Confidentiality Notice</b> - This document is intended exclusively for the recipient. All information contained herein, including any attachments, is subject to confidentiality under the current Legislative Decree 196/2003 on privacy and the European Regulation 679/2016 - GDPR - and therefore any unauthorized further use is prohibited. If you have received this message in error, please immediately inform the sender and delete the email. Thank you.</p>`;

// "Invia" and "PEC" share this exact disclaimer wording (legacy: same $mail->Body block in both
// the "PEC" and default/"Invia" cases); "Aperta" has its own wording below.
const DISCLAIMER_GENERIC_HTML = `<br><p style="font-size:11px;"><b>Esclusione di responsabilità</b> - Il documento allegato alla presente si riferisce alla scansione della corrispondenza arrivata presso la nostra sede. La presente scansione è fornita <strong>esclusivamente a scopo informativo</strong>. Non garantiamo l'accuratezza o la completezza delle informazioni fornite, poiché potrebbero verificarsi errori o omissioni. Pertanto, la scansione non esonera la società domiciliataria in oggetto o il professionista, dall'obbligo di provvedere urgentemente al ritiro dell'atto in originale. Si consiglia di verificare il contenuto originale della corrispondenza.</p>
<p style="font-size:11px;"><b>Disclaimer</b> - The document attached hereto refers to the scanned correspondence received at our office. This scan is provided <strong>for informational purposes only</strong>. We do not guarantee the accuracy or completeness of the information supplied, as errors or omissions may occur. Therefore, the scan does not release the domiciliary company in question or the professional from the obligation to promptly collect the original document. You are advised to verify the original contents of the correspondence.</p>${DISCLAIMER_PRIVACY_HTML}`;

const DISCLAIMER_APERTA_HTML = `<br><p style="font-size:11px;"><b>Esclusione di responsabilità</b> - Il documento allegato alla presente si riferisce alla scansione del contenuto della corrispondenza arrivata presso la nostra sede, di cui la società domiciliataria in oggetto ha espressamente richiesto l'apertura. La presente scansione è fornita <strong>esclusivamente a scopo informativo</strong>. Non garantiamo l'accuratezza o la completezza delle informazioni fornite, poiché potrebbero verificarsi errori o omissioni. Pertanto, la scansione non esonera la società domiciliataria in oggetto, dall'obbligo di provvedere urgentemente al ritiro dell'atto in originale. Si consiglia di verificare il contenuto originale della corrispondenza.</p>
<p style="font-size:11px;"><b>Disclaimer</b> - The attached document refers to the scan of the content of the correspondence received at our office, which the company specified in the email subject, has explicitly requested to open. This scan is provided <strong>exclusively for informational purposes</strong>. We do not guarantee the accuracy or completeness of the information provided, as errors or omissions may occur. Therefore, the scan does not exempt the company specified in the email subject from the obligation to promptly retrieve the document. It is advised to verify the original content of the correspondence.</p>${DISCLAIMER_PRIVACY_HTML}`;

function mailScanDisclaimerHtml(channel: MailScanChannel): string {
  return channel === "aperta" ? DISCLAIMER_APERTA_HTML : DISCLAIMER_GENERIC_HTML;
}
function mailScanPageTitle(channel: MailScanChannel): string {
  if (channel === "pec") return "Scansione Atto - Roma Office Sharing";
  if (channel === "aperta") return "Apertura corrispondenza - Roma Office Sharing";
  return "Scansione corrispondenza - Roma Office Sharing";
}
// Legacy: str_pad(rand(0,99999), 5, "0", STR_PAD_LEFT) — a random 5-digit reference the client can
// quote when replying (PEC only: "rispondere... lasciando inalterato il codice ID nell'oggetto").
function randomIdCode(): string {
  return String(Math.floor(Math.random() * 100000)).padStart(5, "0");
}
// Legacy: $ragioneSoc = str_ireplace(['(Solo Postale)', '*'], ['', ''], $ragioneSoc) before use in Subject.
function cleanRagioneSocialeForSubject(ragioneSociale: string): string {
  return ragioneSociale.replace(/\(Solo Postale\)/gi, "").replace(/\*/g, "").trim();
}

function mailScanDraftContent(channel: MailScanChannel, ragioneSociale: string): { subject: string; text: string } {
  const ragioneSoc = cleanRagioneSocialeForSubject(ragioneSociale);
  if (channel === "pec") {
    return {
      subject: `[ID${randomIdCode()}] Scansione Atto/Raccomandata ${ragioneSoc} - Roma Office Sharing`,
      text: "Buongiorno,\n\nsi allega alla presente l'Atto Giudiziario/Amministrativo/Raccomandata pervenuto a Vostro nome presso i nostri uffici.\n\nQualora si desideri ricevere la scansione del contenuto, rispondere direttamente alla presente, lasciando inalterato il codice ID contenuto nell'oggetto.\n\nCordiali saluti\nSegreteria Roma Office Sharing",
    };
  }
  if (channel === "aperta") {
    return {
      subject: `Apertura corrispondenza ${ragioneSoc} - Roma Office Sharing`,
      text: "Buongiorno,\n\nsi allega alla presente la scansione del contenuto della busta richiesta\n\nCordiali saluti\nSegreteria Roma Office Sharing",
    };
  }
  return {
    subject: `[ID${randomIdCode()}] Scansione corrispondenza ${ragioneSoc} - Roma Office Sharing`,
    text: "Buongiorno,\n\nsi allega alla presente la scansione della corrispondenza arrivata in sede a Vs nome.\n\nCordiali saluti\nSegreteria Roma Office Sharing",
  };
}

// Sends immediately (no staff-editable preview — subject/opening text/disclaimer are fixed, ported
// from the legacy tool) to the most recent not-yet-handled scan for this client, then deletes the
// scan — per team decision, a handled mail scan isn't kept as a permanent record like the contract
// documents are; the email sent (in each mailbox's own Sent folder) is the record.
//
// Recipients ported verbatim from ajax_send_mail.php: email_posta's first address is always the
// primary "to" (remaining email_posta addresses CC'd); PEC additionally "to"s email_pec and CCs the
// fixed internal address; Invia/Aperta additionally BCC the fixed internal address instead (legacy
// only skipped this BCC for a "generic" scan not tied to any client record — doesn't apply here).
export async function sendMailScanAction(domClientId: number, channel: MailScanChannel): Promise<{ success: boolean; message?: string }> {
  "use server";
  await requireStaff();

  const [client] = await db.select().from(domClients).where(eq(domClients.id, domClientId)).limit(1);
  if (!client) return { success: false, message: "Domiciliazione non trovata" };
  const [scan] = await db.select().from(domMailScans).where(eq(domMailScans.domClientId, domClientId)).orderBy(desc(domMailScans.createdAt)).limit(1);
  if (!scan) return { success: false, message: 'Nessuna scansione in attesa per questa società. Usa prima "Allega".' };

  const ordinarie = cleanText(client.emailPosta).split(";").map(s => s.trim()).filter(Boolean);
  const pec = cleanText(client.emailPec);
  if (!ordinarie.length) return { success: false, message: "Questa società non ha un indirizzo email ordinario configurato." };
  if (channel === "pec" && !pec) return { success: false, message: "Questa società non ha un indirizzo PEC configurato." };

  const account: DomMailAccount = channel === "pec" ? "pec" : "ordinaria";
  const to = channel === "pec" ? [ordinarie[0], pec].join(",") : ordinarie[0];
  const cc = channel === "pec" ? [...ordinarie.slice(1), MAIL_SCAN_INTERNAL_ADDRESS] : ordinarie.slice(1);
  const bcc = channel === "pec" ? undefined : MAIL_SCAN_INTERNAL_ADDRESS;

  let pdf: Buffer;
  try {
    pdf = await readMailScanDecrypted(scan.id);
  } catch {
    return { success: false, message: "Impossibile leggere il file della scansione (forse già gestita altrove)" };
  }

  const { subject, text } = mailScanDraftContent(channel, client.ragioneSociale);
  const bodyHtml = `<p>${text.trim().replace(/\n/g, "<br>\n")}</p>`;
  const html = `<html>\n<head>\n<title>${mailScanPageTitle(channel)}</title>\n</head>\n<body>\n${bodyHtml}\n${mailScanDisclaimerHtml(channel)}\n</body>\n</html>`;

  const result = await sendDomMail(account, {
    to, cc: cc.join(","), bcc, subject, html, text: html.replace(/<[^>]+>/g, " "),
    // Fixed name (legacy: PHPMailer's addAttachment() on the local tmp/scansione.pdf file) rather
    // than one derived per company — matches ajax_send_mail.php exactly.
    attachments: [{ filename: "scansione.pdf", content: pdf, contentType: "application/pdf" }],
  });
  if (!result.sent) return { success: false, message: `Invio non riuscito (${result.reason})` };

  await db.delete(domMailScans).where(eq(domMailScans.id, scan.id));
  await removeMailScanEncrypted(scan.id);
  revalidatePath(BASE_PATH);
  // Success wording ported from ajax_send_mail.php's $success_message per case, for the per-row
  // status message in the dashboard (see DomiciliazioniTable).
  const successPrefix = channel === "pec" ? "PEC inviata a " : channel === "aperta" ? "Apertura corrispondenza inviata a " : "Mail inviata a ";
  return { success: true, message: successPrefix + to };
}

// Draft the scadenza reminder for staff to review/edit before sending — never sent unmodified.
// Reuses a previously edited/sent draft (testoScadenza) unless `regenerate` asks for a fresh one;
// `includeSconto`, when given, overrides the automatic (contract-duration-based) default for the
// "sconto attivazioni non più applicabile" disclaimer while regenerating; same for `includeMonths`
// and which renewal-offer durations (6/12/24/36/48) get listed.
export async function getScadenzaDraftAction(id: number, regenerate = false, includeSconto?: boolean, includeMonths?: number[]): Promise<{ success: boolean; message?: string; subject?: string; html?: string; prezzoRinnovo?: number | null; scontoDefault?: boolean; availableMonths?: number[]; defaultMonths?: number[] }> {
  "use server";
  await requireStaff();
  const [client] = await db.select().from(domClients).where(eq(domClients.id, id)).limit(1);
  if (!client) return { success: false, message: "Domiciliazione non trovata" };
  const prezzi = await db.select().from(domRinnovoPrezzi);
  const scontoDefault = defaultScontoApplicabile(client);
  const defaultMonths = scadenzaDefaultMonths(prezzi, contractMonths(client));
  const stored = !regenerate ? client.testoScadenza?.trim() : "";
  return {
    success: true,
    subject: scadenzaEmailSubject(client),
    html: stored || buildScadenzaEmailHtml(client, prezzi, includeSconto ?? scontoDefault, includeMonths ?? defaultMonths),
    prezzoRinnovo: client.prezzoRinnovo,
    scontoDefault,
    availableMonths: scadenzaOfferMonths(prezzi),
    defaultMonths,
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
