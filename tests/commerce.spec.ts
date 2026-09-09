import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem("ros_cookie_consent", JSON.stringify({ necessary: true, analytics: false, marketing: false, savedAt: Date.now() }))); });

test("header graphic, text-only footer and two independent price offers", async ({ page }) => {
  await page.goto("/tariffe.html");
  await expect(page.locator(".header-inner .brand-logo")).toHaveAttribute("src", "/LogoFull_trasp.svg");
  await expect(page.locator(".header-inner .brand strong")).toHaveCount(0);
  await expect(page.locator(".footer-brand img, .footer-brand svg")).toHaveCount(0);
  await expect(page.locator(".footer-brand strong")).toHaveText(["ROMA", "OFFICESHARING"]);
  await expect(page.locator(".footer-brand strong").first()).toHaveCSS("color", "rgb(127, 127, 127)");
  await expect(page.locator(".footer-brand strong").last()).toHaveCSS("color", "rgb(249, 115, 0)");
  await expect(page.locator(".offer-card")).toHaveCount(2);
  await expect(page.locator("#offer-legal_unit tbody tr")).toHaveCount(6);
  await expect(page.locator("#offer-postal tbody tr")).toHaveCount(2);
  const postal = page.locator("#offer-postal");
  for (const text of ["300,00", "280,00", "540,00", "500,00"]) await expect(postal).toContainText(text);
  await expect(page.locator(".other-services-grid .service-card")).toHaveCount(3);
  await expect(page.locator(".other-services-grid")).not.toContainText("Domiciliazione Postale");
  await expect(page.locator("#offer-legal_unit").getByRole("button", { name: "Ricevi offerta standard" })).toBeVisible();
  await expect(postal.getByRole("button", { name: "Richiedi preventivo standard" })).toBeVisible();
  await page.screenshot({ path: "test-results/tariffe-two-offers.png", fullPage: true });
});

test("standard-offer popup validates fields and is keyboard dismissible", async ({ page }) => {
  await page.goto("/tariffe.html");
  const button = page.locator("#offer-legal_unit").getByRole("button", { name: "Ricevi offerta standard" }); await button.click();
  const dialog = page.locator(".standard-offer-dialog[open]"); await expect(dialog).toBeVisible();
  for (const label of [/^Nome/, /^Cognome/, /^Titolo/, /^Email/]) await expect(dialog.getByLabel(label)).toBeVisible();
  await dialog.getByRole("button", { name: "Continua", exact: true }).click(); await expect(dialog.getByRole("alert")).toContainText("Compila");
  await expect(dialog).toContainText("Modulo_Richiesta_Domiciliazione_ns.pdf");
  await page.screenshot({ path: "test-results/standard-offer-popup.png" });
  await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible(); await expect(button).toBeFocused();
});

test("postal activation preserves language context, blocks missing terms, and prices extras", async ({ page }) => {
  await page.goto("/tariffe.html"); await page.locator("#offer-postal").getByRole("link", { name: "Attiva subito", exact: true }).click();
  await expect(page).toHaveURL(/attiva.html\?service=postal/);
  await expect(page.locator(".activation")).toHaveAttribute("data-service", "postal");
  const duration = page.getByLabel(/^Durata del contratto/); await expect(duration.locator("option")).toHaveCount(2);
  await expect(page.getByLabel(/^Nuova attivazione/)).toHaveCount(0);
  await page.locator("#field-representativeName").fill("Mario Rossi"); await page.getByLabel(/^Email\*/).fill("qa-browser@example.invalid"); await page.getByLabel(/^Cellulare/).fill("+393331234567"); await page.getByLabel(/^Data di inizio/).fill(new Date(Date.now() + 86400000).toISOString().slice(0, 10)); await page.getByRole("checkbox", { name: /Acconsento al trattamento/ }).check();
  let requests = 0; page.on("request", r => { if (r.url().endsWith("/api/domiciliation-request")) requests++; });
  await page.getByRole("button", { name: "INVIA IL CODICE DI VERIFICA" }).click();
  await expect(page.locator("#err-terms")).toBeVisible(); expect(requests).toBe(0);
  await page.getByRole("button", { name: "Leggi le condizioni obbligatorie" }).click();
  const dialog = page.locator(".terms-dialog[open]");
  const accept = dialog.getByRole("checkbox"); await expect(accept).toBeDisabled();
  await expect(dialog).toContainText("10 aperture/mese incluse"); await expect(dialog).toContainText("40€/mese"); await expect(dialog).toContainText("NOTA: non è previsto deposito cauzionale");
  await dialog.locator(".terms-scroll").evaluate(el => { el.scrollTop = el.scrollHeight; el.dispatchEvent(new Event("scroll")); });
  await expect(accept).toBeEnabled(); await accept.check(); await dialog.getByRole("button", { name: "Conferma lettura e accettazione" }).click();
  await expect(page.locator(".terms-consent")).toContainText("Lettura e accettazione confermate");
  await page.getByRole("checkbox", { name: /Segreteria Virtuale con numero dedicato/ }).check();
  await expect(page.locator(".activation-summary .total")).toContainText("695,40");
  await page.locator(".lang-switch").getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL(/en\/activate.html\?service=postal/); await expect(page.locator(".activation")).toHaveAttribute("data-service", "postal");
  await expect(page.locator(".activation-summary h3")).toContainText("Business Mailing");
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: "test-results/postal-activation-mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
