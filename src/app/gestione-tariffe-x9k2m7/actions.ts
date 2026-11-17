"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { domRinnovoPrezzi, serviceAddons, serviceCatalog, servicePrices } from "@/db/schema";
import { STAFF_SESSION_COOKIE, getStaffUser } from "@/lib/staff-auth";
import type { ServiceCode } from "@/lib/pricing";

const BASE_PATH = "/gestione-tariffe-x9k2m7";

async function requireAdmin() {
  const store = await cookies();
  const user = await getStaffUser(store.get(STAFF_SESSION_COOKIE)?.value);
  if (!user) redirect(`${BASE_PATH}/login?next=${BASE_PATH}`);
  if (user.role !== "admin") redirect("/gestione-domiciliazioni-x9k2m7");
}

// Every action here answers { ok, message }: a wrong value comes back as a readable message that the page
// shows to the operator (a thrown error would reach the browser as a generic, anonymised failure).
type ActionResult = { ok: boolean; message?: string };
class InputError extends Error {}

async function guarded(work: () => Promise<void>): Promise<ActionResult> {
  try {
    await work();
    revalidatePath(BASE_PATH);
    return { ok: true };
  } catch (error) {
    if (error instanceof InputError) return { ok: false, message: error.message };
    throw error;
  }
}

function toCents(formData: FormData, key: string, label: string) {
  const raw = String(formData.get(key) ?? "").replace(",", ".").trim();
  const value = Math.round(parseFloat(raw) * 100);
  if (!Number.isFinite(value) || value < 0) throw new InputError(`${label}: inserisci un importo valido (es. 550 oppure 550,00).`);
  return value;
}

function wholeEuros(raw: string, label: string): number | null {
  if (!raw) return null;
  const value = Number(raw.replace(",", "."));
  if (!Number.isFinite(value) || value < 0) throw new InputError(`${label}: inserisci un importo in euro valido.`);
  return Math.round(value);
}


export async function updateServiceAction(formData: FormData): Promise<ActionResult> {
  "use server";
  await requireAdmin();
  return guarded(async () => {
  const code = String(formData.get("code") ?? "") as ServiceCode;
  const offerValidUntilRaw = String(formData.get("offerValidUntil") ?? "").trim();
  // Postal's form (page.tsx) doesn't submit these fields at all — it has neither discount —
  // so only touch them when actually present, instead of zeroing them out on every postal save.
  // Each discount is switched on/off next to its percentage (an unchecked box sends nothing).
  const percentBps = (key: string, label: string) => {
    const value = Number(String(formData.get(key) ?? "").replace(",", "."));
    if (!Number.isFinite(value) || value < 0 || value > 100) throw new InputError(`${label}: inserisci una percentuale tra 0 e 100.`);
    return Math.round(value * 100);
  };
  const discountFields = formData.has("additionalDiscountBps")
    ? {
      additionalDiscountBps: percentBps("additionalDiscountBps", "Sconto domiciliazioni aggiuntive"),
      additionalDiscountEnabled: formData.get("additionalDiscountEnabled") === "on",
      newActivationDiscountBps: percentBps("newActivationDiscountBps", "Sconto nuove attivazioni"),
      newActivationDiscountEnabled: formData.get("newActivationDiscountEnabled") === "on",
    }
    : {};
  const openings = Number(formData.get("includedOpenings"));
  if (!Number.isInteger(openings) || openings < 0) throw new InputError("Aperture incluse/mese: inserisci un numero intero, 0 o più.");
  await db.update(serviceCatalog).set({
    ...discountFields,
    includedOpenings: openings,
    offerValidUntil: offerValidUntilRaw ? new Date(`${offerValidUntilRaw}T23:59:59+02:00`) : null,
    active: formData.get("active") === "on",
  }).where(eq(serviceCatalog.code, code));
  // The discounts show up on the public pricing/activation pages and in the renewal reminders.
  revalidatePath("/attiva.html"); revalidatePath("/en/activate.html"); revalidatePath("/tariffe.html"); revalidatePath("/en/pricing.html");
  });
}

export async function updatePriceAction(formData: FormData): Promise<ActionResult> {
  "use server";
  await requireAdmin();
  return guarded(async () => {
  const id = Number(formData.get("id"));
  const offerRaw = String(formData.get("offerCents") ?? "").trim();
  await db.update(servicePrices).set({
    listCents: toCents(formData, "listCents", "Listino"),
    offerCents: offerRaw ? toCents(formData, "offerCents", "Offerta") : null,
    newActivation: formData.get("newActivation") === "on",
    additionalDomiciliation: formData.get("additionalDomiciliation") === "on",
    active: formData.get("active") === "on",
  }).where(eq(servicePrices.id, id));
  });
}

export async function deletePriceAction(formData: FormData): Promise<ActionResult> {
  "use server";
  await requireAdmin();
  return guarded(async () => {
    const id = Number(formData.get("id"));
    await db.delete(servicePrices).where(eq(servicePrices.id, id));
  });
}

export async function addPriceAction(formData: FormData): Promise<ActionResult> {
  "use server";
  await requireAdmin();
  return guarded(async () => {
  const service = String(formData.get("service") ?? "") as ServiceCode;
  const months = Number(formData.get("months"));
  if (!Number.isInteger(months) || months < 1 || months > 120) throw new InputError("Mesi: inserisci un numero intero tra 1 e 120.");
  const [duplicate] = await db.select({ id: servicePrices.id }).from(servicePrices).where(and(eq(servicePrices.service, service), eq(servicePrices.months, months))).limit(1);
  if (duplicate) throw new InputError(`Esiste già una durata di ${months} mesi per questo servizio: modifica quella esistente.`);
  const offerRaw = String(formData.get("offerCents") ?? "").trim();
  await db.insert(servicePrices).values({
    service, months, listCents: toCents(formData, "listCents", "Listino"),
    offerCents: offerRaw ? toCents(formData, "offerCents", "Offerta") : null,
    newActivation: formData.get("newActivation") === "on",
    additionalDomiciliation: formData.get("additionalDomiciliation") === "on",
    active: true,
  });
  });
}

// Renewal pricing shown in scadenza emails — plain whole euros, same convention as
// dom_clients.prezzo_rinnovo, deliberately not the servicePrices cents convention above.
export async function updateRinnovoPrezzoAction(formData: FormData): Promise<ActionResult> {
  "use server";
  await requireAdmin();
  return guarded(async () => {
  const mesi = Number(formData.get("mesi"));
  const pienoRaw = String(formData.get("prezzoPieno") ?? "").trim();
  const offertaRaw = String(formData.get("prezzoOfferta") ?? "").trim();
  const nota = String(formData.get("notaMensile") ?? "").trim();
  await db.update(domRinnovoPrezzi).set({
    prezzoPieno: wholeEuros(pienoRaw, "Prezzo pieno"),
    prezzoOfferta: wholeEuros(offertaRaw, "Prezzo offerta"),
    notaMensile: nota || null,
    updatedAt: new Date(),
  }).where(eq(domRinnovoPrezzi.mesi, mesi));
  });
}

// One save for a whole service's extras table. Fields repeat under plain names in row order
// (`code` is the hidden anchor of each row); `selectable` is the exception — an unchecked box sends
// nothing, so each checked box submits its own code instead. Every row is parsed before anything is
// written, so one invalid price rejects the lot. sort_order is never written: it has no input.
export async function updateAddonsAction(formData: FormData): Promise<ActionResult> {
  "use server";
  await requireAdmin();
  return guarded(async () => {
  const codes = formData.getAll("code").map(String);
  const column = (name: string) => { const values = formData.getAll(name).map(String); if (values.length !== codes.length) throw new InputError("Dati non validi: ricarica la pagina e riprova."); return values; };
  const titleIt = column("titleIt"), titleEn = column("titleEn"), price = column("priceCents"), annual = column("annualCents"), maxQty = column("maxQuantity");
  const selectable = new Set(formData.getAll("selectable").map(String));
  const cents = (raw: string) => { const value = Math.round(parseFloat(raw.replace(",", ".").trim()) * 100); if (!Number.isFinite(value) || value < 0) throw new InputError("Servizi aggiuntivi: inserisci importi validi (es. 12 oppure 12,50)."); return value; };
  const rows = codes.map((code, i) => ({
    code,
    values: { titleIt: titleIt[i].trim(), titleEn: titleEn[i].trim(), priceCents: cents(price[i]), annualCents: cents(annual[i]), maxQuantity: Math.max(1, Number(maxQty[i]) || 1), selectable: selectable.has(code) },
  }));
  await db.transaction(async tx => {
    for (const { code, values } of rows) await tx.update(serviceAddons).set(values).where(eq(serviceAddons.code, code));
  });
  });
}
