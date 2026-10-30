-- Online contract compilation from the Area Clienti: the customer's encrypted draft, plus when the
-- printed-and-signed copy was uploaded (so staff can see it in the scheda società).
CREATE TABLE IF NOT EXISTS "dom_contract_drafts" (
  "dom_client_id" integer PRIMARY KEY REFERENCES "dom_clients"("id") ON DELETE CASCADE,
  "data_enc" text NOT NULL,
  "completed_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "dom_clients" ADD COLUMN IF NOT EXISTS "contratto_cliente_at" timestamp with time zone;
