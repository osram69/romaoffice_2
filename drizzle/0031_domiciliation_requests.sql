-- Richieste di domiciliazione compilate online (popup / pagina /richiesta-domiciliazione) con verifica SMS del cellulare.
-- status: draft (dati salvati) -> verified (codice SMS corretto) -> submitted (email inviata).
-- Esegui questo script su Supabase PRIMA di pubblicare la versione del sito che usa la tabella.
CREATE TABLE IF NOT EXISTS "domiciliation_requests" (
  "id" serial PRIMARY KEY,
  "public_id" varchar(64) NOT NULL UNIQUE,
  "token_hash" text NOT NULL,
  "service" text NOT NULL,
  "lang" varchar(2) NOT NULL DEFAULT 'it',
  "email" text NOT NULL,
  "phone" text NOT NULL,
  "form_data" jsonb NOT NULL,
  "status" text NOT NULL DEFAULT 'draft',
  "code_hash" text,
  "sends" integer NOT NULL DEFAULT 0,
  "attempts" integer NOT NULL DEFAULT 0,
  "sent_at" timestamptz,
  "expires_at" timestamptz,
  "verified_at" timestamptz,
  "submitted_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
