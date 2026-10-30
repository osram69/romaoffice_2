-- When the customer uploaded the administrator's identity document from the Area Clienti.
ALTER TABLE "dom_clients" ADD COLUMN IF NOT EXISTS "doc_amm_cliente_at" timestamp with time zone;
