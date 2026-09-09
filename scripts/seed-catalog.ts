import "dotenv/config";
import { db, pool } from "@/db";
import { serviceCatalog, servicePrices, serviceAddons } from "@/db/schema";

async function seed() {
  await db.transaction(async tx => {
    await tx.insert(serviceCatalog).values([
      { code: "legal_unit", vatBps: 2200, additionalDiscountBps: 1000, newActivationDiscountBps: 1000, offerValidUntil: new Date("2026-09-30T23:59:59+02:00"), termsRevision: "legal-2026-09-v1" },
      { code: "postal", vatBps: 2200, additionalDiscountBps: 1000, newActivationDiscountBps: 0, offerValidUntil: null, termsRevision: "postal-2026-09-v1" },
    ]).onConflictDoNothing();
    await tx.insert(servicePrices).values([
      { service: "legal_unit", months: 3, listCents: 21000, offerCents: null, newActivation: false },
      { service: "legal_unit", months: 6, listCents: 48000, offerCents: 38000, newActivation: true },
      { service: "legal_unit", months: 12, listCents: 66000, offerCents: 55000, newActivation: true },
      { service: "legal_unit", months: 24, listCents: 98000, offerCents: 88000, newActivation: false },
      { service: "legal_unit", months: 36, listCents: 142000, offerCents: 115000, newActivation: false },
      { service: "legal_unit", months: 48, listCents: 168000, offerCents: 130000, newActivation: false },
      { service: "postal", months: 6, listCents: 30000, offerCents: 28000, newActivation: false },
      { service: "postal", months: 12, listCents: 54000, offerCents: 50000, newActivation: false },
    ]).onConflictDoNothing();
    await tx.insert(serviceAddons).values([
      { code: "virtual_secretary", service: "postal", titleIt: "Segreteria Virtuale con numero dedicato", titleEn: "Virtual secretary with a dedicated number", priceCents: 4000, annualCents: 5000, billing: "monthly", selectable: true, sortOrder: 1 },
      { code: "extra_opening", service: "postal", titleIt: "Apertura corrispondenza extra", titleEn: "Additional mail opening", priceCents: 100, billing: "per_envelope", sortOrder: 2 },
      { code: "archive", service: "postal", titleIt: "Archivio documentazione", titleEn: "Document archive", priceCents: 600, billing: "monthly", maxQuantity: 5, selectable: true, sortOrder: 3 },
      { code: "personal_fax", service: "postal", titleIt: "Linea fax con numero personale", titleEn: "Fax line with a personal number", priceCents: 1500, billing: "monthly", selectable: true, sortOrder: 4 },
      { code: "registered_mail", service: "postal", titleIt: "Invio raccomandate", titleEn: "Sending registered letters", priceCents: 400, billing: "per_letter", sortOrder: 5 },
      { code: "fax_send", service: "postal", titleIt: "Invio fax", titleEn: "Sending faxes", priceCents: 200, billing: "per_fax", sortOrder: 6 },
      { code: "mail_forwarding", service: "postal", titleIt: "Inoltro corrispondenza", titleEn: "Mail forwarding", priceCents: 700, billing: "per_shipment", sortOrder: 7 },
    ]).onConflictDoNothing();
  });
  console.log("Catalog seeded: 8 durations, 2 services and 7 postal extras. Existing prices were NOT overwritten.");
}
seed().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
