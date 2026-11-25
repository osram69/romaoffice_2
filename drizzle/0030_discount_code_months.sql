-- Codici sconto: durate del contratto su cui il codice vale (Configurazione Web > Codici sconto).
-- months: elenco separato da virgole, es. '6,12'. NULL = tutte le durate (comportamento di prima).
-- Esegui questo script su Supabase PRIMA di pubblicare la versione del sito che legge la colonna.
ALTER TABLE "discount_codes" ADD COLUMN IF NOT EXISTS "months" varchar(40);
