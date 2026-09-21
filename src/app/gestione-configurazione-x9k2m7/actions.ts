"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { serviceCatalog, siteConfig } from "@/db/schema";
import { STAFF_SESSION_COOKIE, getStaffUser } from "@/lib/staff-auth";

const BASE_PATH = "/gestione-configurazione-x9k2m7";

async function requireAdmin() {
  const store = await cookies();
  const user = await getStaffUser(store.get(STAFF_SESSION_COOKIE)?.value);
  if (!user) redirect(`/gestione-tariffe-x9k2m7/login?next=${BASE_PATH}`);
  if (user.role !== "admin") redirect("/gestione-domiciliazioni-x9k2m7");
}

export async function updateSmartFlagsAction(formData: FormData) {
  "use server";
  await requireAdmin();
  await db.update(serviceCatalog).set({
    smart3x24Active: formData.get("smart3x24Active") === "on",
    smart6x24Active: formData.get("smart6x24Active") === "on",
  }).where(eq(serviceCatalog.code, "legal_unit"));
  revalidatePath(BASE_PATH);
}

export async function updateOnlineDiscountAction(formData: FormData) {
  "use server";
  await requireAdmin();
  const bps = Math.round(Number(String(formData.get("onlineDiscountBps") ?? "0").replace(",", ".")) * 100);
  await db.update(siteConfig).set({
    onlineDiscountEnabled: formData.get("onlineDiscountEnabled") === "on",
    onlineDiscountBps: Number.isFinite(bps) && bps >= 0 ? bps : 0,
  }).where(eq(siteConfig.id, 1));
  revalidatePath(BASE_PATH);
  revalidatePath("/attiva.html"); revalidatePath("/en/activate.html"); revalidatePath("/tariffe.html"); revalidatePath("/en/pricing.html");
}

export async function updatePaymentSettingsAction(formData: FormData) {
  "use server";
  await requireAdmin();
  await db.update(siteConfig).set({
    stripeEnabled: formData.get("stripeEnabled") === "on",
    paypalEnabled: formData.get("paypalEnabled") === "on",
    sumupEnabled: formData.get("sumupEnabled") === "on",
    bankTransferEnabled: formData.get("bankTransferEnabled") === "on",
  }).where(eq(siteConfig.id, 1));
  revalidatePath(BASE_PATH);
}
