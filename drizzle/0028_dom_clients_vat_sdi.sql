-- VAT number and SDI recipient code of each company, shown in the scheda and editable there (they save looking them
-- up in the contract when the customer is first entered in the invoicing program). Existing rows stay NULL.
ALTER TABLE "dom_clients" ADD COLUMN IF NOT EXISTS "partita_iva" text;
ALTER TABLE "dom_clients" ADD COLUMN IF NOT EXISTS "codice_sdi" text;
