import "dotenv/config";
import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { PDFDocument } from "pdf-lib";
import { eq } from "drizzle-orm";
import { db, pool } from "@/db";
import { customers, customerContracts, customerSessions, customerAudit } from "@/db/schema";
import { digest, token, SESSION_COOKIE } from "@/lib/customer-auth";
import { storeCustomerContract } from "@/lib/customer-documents";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("ros_cookie_consent", JSON.stringify({ necessary: true, analytics: false, marketing: false, savedAt: Date.now() })));
});
test.afterAll(async () => { await pool.end(); });

test("English labels, exact IT / EN switch, contextual navigation and logo", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await page.goto("/en/index.html");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator(".lang-switch a")).toHaveText(["IT", "EN"]);
  await expect(page.locator(".lang-switch a").last()).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".header-inner .brand-logo")).toHaveAttribute("src", "/LogoFull_trasp.svg");
  await expect(page.getByRole("heading", { name: "Offices and business addresses in the heart of Rome" })).toBeVisible();
  await page.screenshot({ path: "test-results/home-desktop.png" });
  await page.locator(".desktop-nav").getByRole("link", { name: "Gallery", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/gallery.html$/);
  await page.locator(".lang-switch").getByRole("link", { name: "Italiano" }).click();
  await expect(page).toHaveURL(/\/gallery.html$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "it");
  await expect(page.locator(".lang-switch a")).toHaveText(["IT", "EN"]);
  expect(errors).toEqual([]);
});

test("gallery filters, native lightbox, keyboard navigation and focus restoration", async ({ page }) => {
  await page.goto("/gallery.html");
  await expect(page.locator(".gallery-tile")).toHaveCount(4);
  await page.getByRole("button", { name: "Uffici", exact: true }).click();
  await expect(page.locator(".gallery-tile")).toHaveCount(3);
  const first = page.locator(".gallery-image").first(); await first.click();
  await expect(page.locator(".gallery-lightbox")).toBeVisible();
  await expect(page.locator("#lightbox-caption")).toContainText("Spazio per le tue idee");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#lightbox-caption")).toContainText("Il tuo ufficio, quando serve");
  await page.keyboard.press("Escape");
  await expect(page.locator(".gallery-lightbox")).not.toBeVisible();
  await expect(first).toBeFocused();
  await page.getByRole("button", { name: "Tutti gli spazi", exact: true }).click();
  await page.screenshot({ path: "test-results/gallery-desktop.png", fullPage: true });
});

test("customer login and mobile navigation remain accessible", async ({ page }) => {
  await page.goto("/en/customer-area.html");
  await expect(page.getByRole("heading", { name: "Sign in to your Customer Area" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await page.screenshot({ path: "test-results/customer-login-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Forgot your password?" }).click();
  await expect(page.getByRole("heading", { name: "Reset your password", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to sign-in" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/customer-login-mobile.png", fullPage: true });
  await expect(page.locator(".lang-switch")).toBeVisible();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(page.locator(".mobile-nav-dialog")).toBeVisible();
  await page.locator(".mobile-nav-dialog").getByRole("link", { name: "Gallery", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/gallery.html$/);
  await expect(page.locator(".mobile-nav-dialog")).not.toBeVisible();
  await page.screenshot({ path: "test-results/gallery-mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("authenticated dashboard downloads only its real contract and reserves future features", async ({ page, context, baseURL }) => {
  const [customer] = await db.insert(customers).values({ email: `qa-browser-${randomUUID()}@example.invalid`, name: "Giulia Rossi", companyName: "Studio Rossi", phone: "+393331234567" }).returning();
  let storageKey = "";
  try {
    const pdf = await PDFDocument.create(); pdf.addPage().drawText("QA CONTRACT - NOT A REAL CUSTOMER DOCUMENT"); const bytes = Buffer.from(await pdf.save());
    storageKey = await storeCustomerContract(bytes);
    await db.insert(customerContracts).values({ customerId: customer.id, title: "Contratto di domiciliazione sede legale", titleEn: "Registered office address agreement", reference: "QA-2026-001", storageKey, sizeBytes: bytes.length });
    const session = token(); await db.insert(customerSessions).values({ customerId: customer.id, tokenHash: digest(session), expiresAt: new Date(Date.now() + 600000) });
    await context.addCookies([{ name: SESSION_COOKIE, value: session, url: baseURL!, httpOnly: true, sameSite: "Strict" }]);
    await page.goto("/area-clienti.html");
    await expect(page.getByRole("heading", { name: "Bentornato, Giulia." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Contratto di domiciliazione sede legale", exact: true })).toBeVisible();
    await expect(page.getByText("Caricamento non attivo", { exact: true })).toBeVisible();
    await page.screenshot({ path: "test-results/customer-dashboard.png", fullPage: true });
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Scarica contratto" }).click();
    const download = await downloadPromise; expect(download.suggestedFilename()).toContain("QA-2026-001");
    await page.locator(".lang-switch").getByRole("link", { name: "English" }).click();
    await expect(page.getByRole("heading", { name: "Welcome back, Giulia." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Registered office address agreement", exact: true })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "test-results/customer-dashboard-mobile.png", fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Sign in to your Customer Area" })).toBeVisible();
  } finally {
    await db.delete(customerAudit).where(eq(customerAudit.customerId, customer.id));
    await db.delete(customers).where(eq(customers.id, customer.id));
    if (storageKey) await unlink(resolve(process.env.CUSTOMER_STORAGE_PATH || "private/customer-contracts", storageKey)).catch(() => {});
  }
});
