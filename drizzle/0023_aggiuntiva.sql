-- Domiciliazione aggiuntiva (contract variant with the additional-domiciliation discount) and the active company it depends on.
ALTER TABLE "dom_clients" ADD COLUMN IF NOT EXISTS "aggiuntiva" boolean DEFAULT false NOT NULL;
ALTER TABLE "dom_clients" ADD COLUMN IF NOT EXISTS "capofila_id" integer REFERENCES "dom_clients"("id") ON DELETE SET NULL;
