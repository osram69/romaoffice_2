-- Optional extra discount for customers who complete the self-service online activation flow
-- (as opposed to a manually-processed request). Disabled by default, so publishing this column
-- never changes any live price until an admin turns it on in Configurazione Web.
ALTER TABLE "site_config" ADD COLUMN IF NOT EXISTS "online_discount_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "site_config" ADD COLUMN IF NOT EXISTS "online_discount_bps" integer NOT NULL DEFAULT 1000;
