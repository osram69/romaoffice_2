"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
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

function toCents(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").replace(",", ".").trim();
  const value = Math.round(parseFloat(raw) * 100);
  if (!Number.isFinite(value) || value < 0) throw new Error(`Valore non valido per ${key}`);
  return value;
}


export async function updateServiceAction(formData: FormData) {
  "use server";
  await requireAdmin();
  const code = String(formData.get("code") ?? "") as ServiceCode;
  const offerValidUntilRaw = String(formData.get("offerValidUntil") ?? "").trim();
  // Postal's form (page.tsx) doesn't submit these two fields at all — it has neither discount —
  // so only touch them when actually present, instead of zeroing them out on every postal save.
  const discountFields = formData.has("additionalDiscountBps")
    ? { additionalDiscountBps: Math.round(Number(formData.get("additionalDiscountBps")) * 100), newActivationDiscountBps: Math.round(Number(formData.get("newActivationDiscountBps")) * 100) }
    : {};
  await db.update(serviceCatalog).set({
    ...discountFields,
    offerValidUntil: offerValidUntilRaw ? new Date(`${offerValidUntilRaw}T23:59:59+02:00`) : null,
    active: formData.get("active") === "on",
  }).where(eq(serviceCatalog.code, code));
  revalidatePath(BASE_PATH);
}

export async function updatePriceAction(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = Number(formData.get("id"));
  const offerRaw = String(formData.get("offerCents") ?? "").trim();
  await db.update(servicePrices).set({
    listCents: toCents(formData, "listCents"),
    offerCents: offerRaw ? toCents(formData, "offerCents") : null,
    newActivation: formData.get("newActivation") === "on",
    additionalDomiciliation: formData.get("additionalDomiciliation") === "on",
    active: formData.get("active") === "on",
  }).where(eq(servicePrices.id, id));
  revalidatePath(BASE_PATH);
}

export async function deletePriceAction(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = Number(formData.get("id"));
  await db.delete(servicePrices).where(eq(servicePrices.id, id));
  revalidatePath(BASE_PATH);
}

export async function addPriceAction(formData: FormData) {
  "use server";
  await requireAdmin();
  const service = String(formData.get("service") ?? "") as ServiceCode;
  const months = Number(formData.get("months"));
  if (!months || months < 1) throw new Error("Durata non valida");
  const offerRaw = String(formData.get("offerCents") ?? "").trim();
  await db.insert(servicePrices).values({
    service, months, listCents: toCents(formData, "listCents"),
    offerCents: offerRaw ? toCents(formData, "offerCents") : null,
    newActivation: formData.get("newActivation") === "on",
    additionalDomiciliation: formData.get("additionalDomiciliation") === "on",
    active: true,
  });
  revalidatePath(BASE_PATH);
}

// Renewal pricing shown in scadenza emails — plain whole euros, same convention as
// dom_clients.prezzo_rinnovo, deliberately not the servicePrices cents convention above.
export async function updateRinnovoPrezzoAction(formData: FormData) {
  "use server";
  await requireAdmin();
  const mesi = Number(formData.get("mesi"));
  const pienoRaw = String(formData.get("prezzoPieno") ?? "").trim();
  const offertaRaw = String(formData.get("prezzoOfferta") ?? "").trim();
  const nota = String(formData.get("notaMensile") ?? "").trim();
  await db.update(domRinnovoPrezzi).set({
    prezzoPieno: pienoRaw ? Math.round(Number(pienoRaw)) : null,
    prezzoOfferta: offertaRaw ? Math.round(Number(offertaRaw)) : null,
    notaMensile: nota || null,
    updatedAt: new Date(),
  }).where(eq(domRinnovoPrezzi.mesi, mesi));
  revalidatePath(BASE_PATH);
}

// One save for a whole service's extras table: fields are named `<field>:<code>`. Every row is
// parsed before anything is written, so one invalid price rejects the lot instead of saving half.
// sort_order is deliberately never written — it has no input in the UI.
export async function updateAddonsAction(formData: FormData) {
  "use server";
  await requireAdmin();
  const rows = formData.getAll("code").map(String).map(code => ({
    code,
    values: {
      titleIt: String(formData.get(`titleIt:${code}`) ?? "").trim(),
      titleEn: String(formData.get(`titleEn:${code}`) ?? "").trim(),
      priceCents: toCents(formData, `priceCents:${code}`),
      annualCents: toCents(formData, `annualCents:${code}`),
      maxQuantity: Math.max(1, Number(formData.get(`maxQuantity:${code}`)) || 1),
      selectable: formData.get(`selectable:${code}`) === "on",
    },
  }));
  await db.transaction(async tx => {
    for (const { code, values } of rows) await tx.update(serviceAddons).set(values).where(eq(serviceAddons.code, code));
  });
  revalidatePath(BASE_PATH);
}
