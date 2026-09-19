"use server";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customers, customerContracts, customerSessions, customerChallenges, customerPasswordTokens, customerAudit } from "@/db/schema";
import { STAFF_SESSION_COOKIE, getStaffUser } from "@/lib/staff-auth";
import { inviteCustomer } from "@/lib/customer-invitations";
import { storeCustomerContract } from "@/lib/customer-documents";

const BASE_PATH = "/gestione-clienti-x9k2m7";
const PHONE_RE = /^\+[1-9]\d{7,14}$/;

async function requireAdmin() {
  const store = await cookies();
  const user = await getStaffUser(store.get(STAFF_SESSION_COOKIE)?.value);
  if (!user) redirect(`/gestione-tariffe-x9k2m7/login?next=${BASE_PATH}`);
  if (user.role !== "admin") redirect("/gestione-domiciliazioni-x9k2m7");
  return user;
}

// Plain (non-JS) <form action={...}> requires a void-returning action — feedback travels via a
// redirect to ?error=... or ?ok=..., read back by the page as a banner.
function fail(message: string): never { redirect(`${BASE_PATH}?error=${encodeURIComponent(message)}`); }
function done(message = "ok"): never { revalidatePath(BASE_PATH); redirect(`${BASE_PATH}?ok=${encodeURIComponent(message)}`); }

// Mirrors scripts/customer-admin.ts's "invite" command: create-or-reuse the customers row, then
// email a one-hour single-use link the customer uses to set their own password.
export async function inviteCustomerAction(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim() || null;
  const lang = formData.get("lang") === "en" ? "en" : "it";
  if (!/^\S+@\S+\.\S+$/.test(email)) fail("Email non valida");
  if (name.length < 2) fail("Nome mancante");
  if (!PHONE_RE.test(phone)) fail("Telefono non valido: usa il formato internazionale, es. +393331234567");

  await db.insert(customers).values({ email, name, phone, companyName: company, locale: lang }).onConflictDoNothing({ target: customers.email });
  const [customer] = await db.select().from(customers).where(eq(customers.email, email)).limit(1);
  if (!customer) fail("Errore nella creazione dell'account");
  if (!customer.active) fail("Esiste già un account con questa email, ma è disattivato. Riattivalo prima di reinvitare.");
  if (customer.phone !== phone) fail("Esiste già un account con questa email ma un telefono diverso. Aggiorna il telefono dalla riga del cliente prima di reinvitare.");

  const sent = await inviteCustomer(customer, lang);
  if (!sent) fail("Account creato, ma l'invio dell'email non è riuscito. Controlla la configurazione SMTP.");
  done("Cliente invitato");
}

export async function resendInviteAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const [customer] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  if (!customer) fail("Cliente non trovato");
  const sent = await inviteCustomer(customer, customer.locale === "en" ? "en" : "it");
  if (!sent) fail("Invio non riuscito. Controlla la configurazione SMTP.");
  done("Invito reinviato");
}

export async function updatePhoneAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const phone = String(formData.get("phone") ?? "").trim();
  if (!PHONE_RE.test(phone)) fail("Telefono non valido: usa il formato internazionale, es. +393331234567");
  await db.update(customers).set({ phone }).where(eq(customers.id, id));
  await db.delete(customerSessions).where(eq(customerSessions.customerId, id));
  await db.delete(customerChallenges).where(eq(customerChallenges.customerId, id));
  await db.insert(customerAudit).values({ customerId: id, event: "phone.changed_by_staff" });
  done("Telefono aggiornato");
}

// Toggles access on/off. Disabling also revokes any live session, pending SMS challenge, and
// unused password-setup link, mirroring the CLI's "disable" command.
export async function toggleActiveAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  await db.update(customers).set({ active }).where(eq(customers.id, id));
  if (!active) {
    await db.delete(customerSessions).where(eq(customerSessions.customerId, id));
    await db.delete(customerChallenges).where(eq(customerChallenges.customerId, id));
    await db.delete(customerPasswordTokens).where(eq(customerPasswordTokens.customerId, id));
  }
  await db.insert(customerAudit).values({ customerId: id, event: active ? "access.enabled_by_staff" : "access.disabled_by_staff" });
  done(active ? "Accesso riattivato" : "Accesso disattivato");
}

export async function uploadContractAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const titleEn = String(formData.get("titleEn") ?? "").trim() || title;
  const reference = String(formData.get("reference") ?? "").trim() || `ROS-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const file = formData.get("file");
  if (!title) fail("Titolo mancante");
  if (!(file instanceof File) || file.size === 0) fail("Seleziona un file PDF");
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const storageKey = await storeCustomerContract(buffer);
    const [document] = await db.insert(customerContracts).values({ customerId: id, title, titleEn, reference, storageKey, sizeBytes: buffer.length }).returning({ id: customerContracts.id });
    await db.insert(customerAudit).values({ customerId: id, documentId: document.id, event: "contract.published" });
  } catch (error) {
    fail(error instanceof Error ? error.message : "Errore durante il caricamento");
  }
  done("Contratto caricato");
}
