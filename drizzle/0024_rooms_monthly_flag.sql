-- "Affitto mensile sala" switch (Configurazione Web): when on, the public rooms page also promotes the monthly rental.
ALTER TABLE "site_config" ADD COLUMN IF NOT EXISTS "rooms_monthly_enabled" boolean DEFAULT false NOT NULL;
