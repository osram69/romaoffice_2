-- Codici sconto per l'acquisto online della domiciliazione (Configurazione Web > Codici sconto).
-- Lo sconto e' una percentuale applicata dopo gli altri sconti, solo sul primo periodo.
-- services: 'all' | 'legal_unit' | 'postal'. valid_from / valid_to sono inclusivi (giorno di Roma), NULL = nessun limite.
-- promo_banner: se attivo, il codice viene pubblicizzato con un banner sul sito (home, tariffe, attivazione).
CREATE TABLE IF NOT EXISTS "discount_codes" (
  "id" serial PRIMARY KEY,
  "code" varchar(40) NOT NULL,
  "label" text NOT NULL DEFAULT '',
  "percent_bps" integer NOT NULL,
  "services" varchar(12) NOT NULL DEFAULT 'all',
  "valid_from" date,
  "valid_to" date,
  "enabled" boolean NOT NULL DEFAULT true,
  "promo_banner" boolean NOT NULL DEFAULT false,
  "banner_it" text,
  "banner_en" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "discount_codes_code_uq" ON "discount_codes" ("code");

-- Promozione Black Week 2026, gia' pronta ma SPENTA: in Configurazione Web > Codici sconto imposta la percentuale
-- (qui 10% e' solo un segnaposto) e spunta "Attivo" per metterla online.
INSERT INTO "discount_codes" ("code", "label", "percent_bps", "services", "valid_from", "valid_to", "enabled", "promo_banner", "banner_it", "banner_en")
VALUES ('BLACKWEEK', 'Black Week 2026', 1000, 'all', '2026-11-23', '2026-11-30', false, true,
  'BLACK WEEK: sconto extra con il codice BLACKWEEK, valido fino al 30 novembre.',
  'BLACK WEEK: extra discount with code BLACKWEEK, valid until 30 November.')
ON CONFLICT ("code") DO NOTHING;
