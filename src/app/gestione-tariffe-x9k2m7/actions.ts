"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { serviceAddons, serviceCatalog, servicePrices } from "@/db/schema";
import { ADMIN_SESSION_COOKIE, checkAdminPassword, createAdminSessionCookie, verifyAdminSessionCookie } from "@/lib/admin-auth";
import type { ServiceCode } from "@/lib/pricing";

const BASE_PATH = "/gestione-tariffe-x9k2m7";

async function requireAdmin() {
  const store = await cookies();
  if (!verifyAdminSessionCookie(store.get(ADMIN_SESSION_COOKIE)?.value)) redirect(`${BASE_PATH}/login`);
}

function toCents(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").replace(",", ".").trim();
  const value = Math.round(parseFloat(raw) * 100);
  if (!Number.isFinite(value) || value < 0) throw new Error(`Valore non valido per ${key}`);
  return value;
}

export async function loginAction(_prevState: { error: boolean }, formData: FormData) {
  "use server";
  const password = String(formData.get("password") ?? "");
  if (!checkAdminPassword(password)) return { error: true };
  const session = createAdminSessionCookie();
  const store = await cookies();
  store.set(ADMIN_SESSION_COOKIE, session.value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: session.maxAge });
  redirect(BASE_PATH);
}

export async function logoutAction() {
  "use server";
  const store = await cookies();
  store.delete(ADMIN_SESSION_COOKIE);
  redirect(`${BASE_PATH}/login`);
}

export async function updateServiceAction(formData: FormData) {
  "use server";
  await requireAdmin();
  const code = String(formData.get("code") ?? "") as ServiceCode;
  const offerValidUntilRaw = String(formData.get("offerValidUntil") ?? "").trim();
  await db.update(serviceCatalog).set({
    additionalDiscountBps: Math.round(Number(formData.get("additionalDiscountBps")) * 100),
    newActivationDiscountBps: Math.round(Number(formData.get("newActivationDiscountBps")) * 100),
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
    active: formData.get("active") === "on",
  }).where(eq(servicePrices.id, id));
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
    newActivation: formData.get("newActivation") === "on", active: true,
  });
  revalidatePath(BASE_PATH);
}

export async function updateAddonAction(formData: FormData) {
  "use server";
  await requireAdmin();
  const code = String(formData.get("code") ?? "");
  await db.update(serviceAddons).set({
    titleIt: String(formData.get("titleIt") ?? "").trim(),
    titleEn: String(formData.get("titleEn") ?? "").trim(),
    priceCents: toCents(formData, "priceCents"),
    annualCents: toCents(formData, "annualCents"),
    maxQuantity: Math.max(1, Number(formData.get("maxQuantity")) || 1),
    selectable: formData.get("selectable") === "on",
    sortOrder: Number(formData.get("sortOrder")) || 0,
  }).where(eq(serviceAddons.code, code));
  revalidatePath(BASE_PATH);
}
