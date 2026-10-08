-- When the "ritiro corrispondenza" reminder was last sent to each company, so the panel can warn
-- before the same company gets it twice within a few days. NULL = never sent (or sent before this
-- column existed; dom_clients.testo_ritiro being set still tells those apart).
ALTER TABLE "dom_clients" ADD COLUMN IF NOT EXISTS "ritiro_inviato_at" timestamp with time zone;
