-- Monthly mail openings included in the service fee, shown in the offer terms on /tariffe.html
-- ("10 aperture/mese incluse"); editable per service in Gestione Tariffe instead of hardcoded.
ALTER TABLE "service_catalog" ADD COLUMN IF NOT EXISTS "included_openings" integer NOT NULL DEFAULT 10;
