"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { serviceCatalog, siteConfig } from "@/db/schema";
import { STAFF_SESSION_COOKIE, getStaffUser } from "@/lib/staff-auth";
import { encryptBytes } from "@/lib/dom-archive";

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

export async function updatePaymentsTestModeAction(formData: FormData) {
  "use server";
  await requireAdmin();
  await db.update(siteConfig).set({
    paymentsTestMode: formData.get("paymentsTestMode") === "on",
  }).where(eq(siteConfig.id, 1));
  revalidatePath(BASE_PATH);
  revalidatePath("/attiva.html"); revalidatePath("/en/activate.html");
}

export async function updateRitiroTemplateAction(formData: FormData): Promise<{ success: boolean; message?: string }> {
  "use server";
  await requireAdmin();
  const html = String(formData.get("html") ?? "").trim();
  await db.update(siteConfig).set({ ritiroTestoTemplate: html || null }).where(eq(siteConfig.id, 1));
  revalidatePath(BASE_PATH);
  revalidatePath("/gestione-domiciliazioni-x9k2m7");
  return { success: true };
}

export async function updateFirmaDomiciliatarioAction(formData: FormData): Promise<{ success: boolean; message?: string }> {
  "use server";
  await requireAdmin();
  const file = formData.get("firma");
  if (!(file instanceof File) || !file.size) return { success: false, message: "Nessun file selezionato" };
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return { success: false, message: "Il file deve essere un PNG" };
  await db.update(siteConfig).set({ firmaDomiciliatarioPng: encryptBytes(buffer) }).where(eq(siteConfig.id, 1));
  revalidatePath(BASE_PATH);
  return { success: true };
}

export async function removeFirmaDomiciliatarioAction(): Promise<{ success: boolean }> {
  "use server";
  await requireAdmin();
  await db.update(siteConfig).set({ firmaDomiciliatarioPng: null }).where(eq(siteConfig.id, 1));
  revalidatePath(BASE_PATH);
  return { success: true };
}

export async function updateScannerConfigAction(formData: FormData) {
  "use server";
  await requireAdmin();
  const port = String(formData.get("scannerPort") ?? "").trim();
  const resolution = Number(formData.get("scannerResolutionDefault"));
  await db.update(siteConfig).set({
    scannerHost: String(formData.get("scannerHost") ?? "").trim() || null,
    scannerPort: port ? Number(port) : null,
    scannerHttps: formData.get("scannerHttps") === "on",
    scannerColorDefault: formData.get("scannerColorDefault") === "color" ? "color" : "gray",
    scannerSourceDefault: ["platen", "feeder", "feederDuplex"].includes(String(formData.get("scannerSourceDefault"))) ? String(formData.get("scannerSourceDefault")) : "platen",
    scannerResolutionDefault: Number.isFinite(resolution) && resolution > 0 ? resolution : 200,
  }).where(eq(siteConfig.id, 1));
  revalidatePath(BASE_PATH);
  revalidatePath("/gestione-domiciliazioni-x9k2m7");
}
