-- First-period fee of online orders (6/12-month terms with the offer active), in cents ex VAT. The contract
-- wizard prints it in clause 9 next to the renewal fee ("prezzo_rinnovo"). NULL = the contract keeps the
-- single-fee wording. Existing rows stay NULL.
ALTER TABLE "dom_clients" ADD COLUMN IF NOT EXISTS "prezzo_primo_periodo_cents" integer;
