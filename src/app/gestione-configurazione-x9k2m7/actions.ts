"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, notInArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { discountCodes, serviceCatalog, siteConfig } from "@/db/schema";
import { normalizeCode, validCodeFormat } from "@/lib/discount-code";
import { STAFF_SESSION_COOKIE, getStaffUser } from "@/lib/staff-auth";
import { encryptBytes } from "@/lib/dom-archive";

const BASE_PATH = "/gestione-configurazione-x9k2m7";

async function requireAdmin() {
  const store = await cookies();
  const user = await getStaffUser(store.get(STAFF_SESSION_COOKIE)?.value);
  if (!user) redirect(`/gestione-tariffe-x9k2m7/login?next=${BASE_PATH}`);
  if (user.role !== "admin") redirect("/gestione-domiciliazioni-x9k2m7");
}

export async function updateRoomsFlagAction(formData: FormData) {
  "use server";
  await requireAdmin();
  await db.update(siteConfig).set({ roomsMonthlyEnabled: formData.get("roomsMonthlyEnabled") === "on" }).where(eq(siteConfig.id, 1));
  revalidatePath(BASE_PATH);
  revalidatePath("/sale-corsi.html"); revalidatePath("/en/course-rooms.html");
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

export async function updateSmsBypassAction(formData: FormData) {
  "use server";
  await requireAdmin();
  await db.update(siteConfig).set({ smsBypassEnabled: formData.get("smsBypassEnabled") === "on" }).where(eq(siteConfig.id, 1));
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
  const cardProcessorRaw = String(formData.get("cardProcessor") ?? "none");
  await db.update(siteConfig).set({
    cardProcessor: ["none", "stripe", "sumup"].includes(cardProcessorRaw) ? cardProcessorRaw : "none",
    paypalEnabled: formData.get("paypalEnabled") === "on",
    bankTransferEnabled: formData.get("bankTransferEnabled") === "on",
  }).where(eq(siteConfig.id, 1));
  revalidatePath(BASE_PATH);
}

export async function updateProviderTestModesAction(formData: FormData) {
  "use server";
  await requireAdmin();
  await db.update(siteConfig).set({
    cardProcessorTestMode: formData.get("cardProcessorTestMode") === "on",
    paypalTestMode: formData.get("paypalTestMode") === "on",
  }).where(eq(siteConfig.id, 1));
  revalidatePath(BASE_PATH);
  revalidatePath("/attiva.html"); revalidatePath("/en/activate.html");
}

export async function updateRitiroTemplateAction(formData: FormData): Promise<{ success: boolean; message?: string }> {
  "use server";
  await requireAdmin();
  const html = String(formData.get("html") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").replace(/[\r\n]+/g, " ").trim();
  await db.update(siteConfig).set({ ritiroTestoTemplate: html || null, ritiroOggettoTemplate: subject || null }).where(eq(siteConfig.id, 1));
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

const dateOrNull = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().or(z.literal("").transform(() => null));
const discountCodesSchema = z.array(z.object({
  code: z.string().transform(normalizeCode).refine(validCodeFormat, "Il codice deve avere da 3 a 40 caratteri: lettere, numeri, trattino o underscore."),
  label: z.string().trim().max(100).default(""),
  // Below 100%: a free order could not go through the payment providers.
  percent: z.number().gt(0, "La percentuale deve essere maggiore di 0.").max(99, "La percentuale non può superare 99."),
  services: z.enum(["all", "legal_unit", "postal"]),
  validFrom: dateOrNull, validTo: dateOrNull,
  enabled: z.boolean(), promoBanner: z.boolean(),
  bannerIt: z.string().trim().max(240).default(""), bannerEn: z.string().trim().max(240).default(""),
})).max(50);

/** Replaces the whole list of discount codes with the one in the form (codes missing from it are deleted). */
export async function saveDiscountCodesAction(payload: string): Promise<{ success: boolean; message?: string }> {
  "use server";
  await requireAdmin();
  let raw: unknown; try { raw = JSON.parse(payload); } catch { return { success: false, message: "Dati non validi." }; }
  const parsed = discountCodesSchema.safeParse(raw);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message || "Dati non validi." };
  const rows = parsed.data;
  const codes = rows.map(r => r.code);
  if (new Set(codes).size !== codes.length) return { success: false, message: "Ci sono due codici uguali: ogni codice deve essere unico." };
  const bad = rows.find(r => r.validFrom && r.validTo && r.validFrom > r.validTo);
  if (bad) return { success: false, message: `Codice ${bad.code}: la data di fine è prima di quella di inizio.` };
  await db.transaction(async tx => {
    if (codes.length) await tx.delete(discountCodes).where(notInArray(discountCodes.code, codes)); else await tx.delete(discountCodes);
    for (const r of rows) {
      const values = { label: r.label, percentBps: Math.round(r.percent * 100), services: r.services, validFrom: r.validFrom, validTo: r.validTo, enabled: r.enabled, promoBanner: r.promoBanner, bannerIt: r.bannerIt || null, bannerEn: r.bannerEn || null };
      await tx.insert(discountCodes).values({ code: r.code, ...values }).onConflictDoUpdate({ target: discountCodes.code, set: values });
    }
  });
  revalidatePath(BASE_PATH);
  for (const path of ["/", "/attiva.html", "/tariffe.html", "/en", "/en/activate.html", "/en/pricing.html"]) revalidatePath(path);
  return { success: true };
}
