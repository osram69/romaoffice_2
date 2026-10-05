-- Admin-editable subject template for the "richiesta ritiro corrispondenza" email
-- ("{ragioneSociale}" is replaced per company). NULL = built-in default subject.
ALTER TABLE "site_config" ADD COLUMN IF NOT EXISTS "ritiro_oggetto_template" text;
