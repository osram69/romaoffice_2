-- Scanner (eSCL) settings for the "Allega" mail-scan panel, configured once for the whole office
-- in Configurazione Web instead of per-operator/browser (site_config is already the single-row
-- site-wide settings table, id always 1).
ALTER TABLE "site_config" ADD COLUMN IF NOT EXISTS "scanner_host" text;
ALTER TABLE "site_config" ADD COLUMN IF NOT EXISTS "scanner_port" integer;
ALTER TABLE "site_config" ADD COLUMN IF NOT EXISTS "scanner_https" boolean NOT NULL DEFAULT false;
ALTER TABLE "site_config" ADD COLUMN IF NOT EXISTS "scanner_color_default" varchar(10) NOT NULL DEFAULT 'gray';
ALTER TABLE "site_config" ADD COLUMN IF NOT EXISTS "scanner_source_default" varchar(20) NOT NULL DEFAULT 'platen';
ALTER TABLE "site_config" ADD COLUMN IF NOT EXISTS "scanner_resolution_default" integer NOT NULL DEFAULT 200;
