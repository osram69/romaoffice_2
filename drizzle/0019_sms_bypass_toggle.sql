-- On/off switch (Configurazione Web) for the SMS verification bypass: when on, the e-mail / phone
-- number named by the DEBUG_BYPASS_EMAIL / DEBUG_BYPASS_PHONE env vars skip the real SMS and accept
-- DEBUG_BYPASS_CODE (default 888888). Defaults to on to keep the behaviour that was env-only before.
ALTER TABLE "site_config" ADD COLUMN IF NOT EXISTS "sms_bypass_enabled" boolean NOT NULL DEFAULT true;
