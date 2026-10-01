-- Admin on/off switches for the legal_unit "sconto domiciliazioni aggiuntive" and "sconto nuove
-- attivazioni" wording/pricing, configurable in Configurazione Web. Postal never offers either
-- discount regardless of these columns (enforced in src/lib/pricing.ts).
ALTER TABLE "service_catalog" ADD COLUMN IF NOT EXISTS "additional_discount_enabled" boolean NOT NULL DEFAULT true;
ALTER TABLE "service_catalog" ADD COLUMN IF NOT EXISTS "new_activation_discount_enabled" boolean NOT NULL DEFAULT true;
