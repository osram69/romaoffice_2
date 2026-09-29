-- "Richiesta ritiro corrispondenza" email tab: a per-client draft/last-sent text (dom_clients,
-- alongside testo_scadenza/testo_proforma/testo_sospensione) plus an admin-editable base template
-- shared by every client (site_config, single row id=1) configurable in Configurazione Web.
ALTER TABLE "dom_clients" ADD COLUMN IF NOT EXISTS "testo_ritiro" text;
ALTER TABLE "site_config" ADD COLUMN IF NOT EXISTS "ritiro_testo_template" text;
