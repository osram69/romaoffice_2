import "dotenv/config";
import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pool } from "@/db";
import { domClients, domCustomerSessions } from "@/db/schema";
import { digest, token, SESSION_COOKIE } from "@/lib/customer-auth";
import { saveEncrypted, removeEncrypted } from "@/lib/dom-archive";
import { PRESENZA_FILE_BITS } from "@/lib/dom-status";

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

test("authenticated dashboard downloads only its own domiciliazione contract and reserves future features", async ({ page, context, baseURL }) => {
  const [client] = await db.insert(domClients).values({ ragioneSociale: "Studio Rossi", areaClientiEmail: `qa-browser-${randomUUID()}@example.invalid`, telefono: "+393331234567", presenzaFile: PRESENZA_FILE_BITS.con }).returning();
  try {
    const bytes = Buffer.from("%PDF-1.4 QA CONTRACT - NOT A REAL CUSTOMER DOCUMENT");
    await saveEncrypted(client.id, "con", bytes);
    const session = token(); await db.insert(domCustomerSessions).values({ domClientId: client.id, tokenHash: digest(session), expiresAt: new Date(Date.now() + 600000) });
    await context.addCookies([{ name: SESSION_COOKIE, value: session, url: baseURL!, httpOnly: true, sameSite: "Strict" }]);
    await page.goto("/area-clienti.html");
    await expect(page.getByRole("heading", { name: "Bentornato, Studio Rossi." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Contratto di domiciliazione", exact: true })).toBeVisible();
    await expect(page.getByText("Caricamento non attivo", { exact: true })).toBeVisible();
    await page.screenshot({ path: "test-results/customer-dashboard.png", fullPage: true });
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Scarica contratto" }).click();
    const download = await downloadPromise; expect(download.suggestedFilename()).toBe("contratto-domiciliazione.pdf");
    await page.locator(".lang-switch").getByRole("link", { name: "English" }).click();
    await expect(page.getByRole("heading", { name: "Welcome back, Studio Rossi." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Registered office agreement", exact: true })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "test-results/customer-dashboard-mobile.png", fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Sign in to your Customer Area" })).toBeVisible();
  } finally {
    await removeEncrypted(client.id, "con").catch(() => {});
    await db.delete(domClients).where(eq(domClients.id, client.id));
  }
});
