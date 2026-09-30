-- Domiciliatario signature stamp for the contract-processing tool, stored encrypted in the
-- database (not a file — see the comment on siteConfig.firmaDomiciliatarioPng in schema.ts).
ALTER TABLE "site_config" ADD COLUMN IF NOT EXISTS "firma_domiciliatario_png" text;
