-- Stripe and SumUp collapse into a single "card_processor" column (none/stripe/sumup) instead of
-- two independent booleans, so only one can ever be the active card processor shown to customers
-- as "Carta di credito" -- structurally, not by admin discipline. PayPal stays independent.
-- card_processor_test_mode / paypal_test_mode: sandbox switches, not hidden from the public
-- checkout while on (staff's explicit choice) -- flagged instead by a "TEST" badge in the UI.
ALTER TABLE "site_config" ADD COLUMN IF NOT EXISTS "card_processor" varchar(10) NOT NULL DEFAULT 'stripe';
ALTER TABLE "site_config" ADD COLUMN IF NOT EXISTS "card_processor_test_mode" boolean NOT NULL DEFAULT false;
ALTER TABLE "site_config" ADD COLUMN IF NOT EXISTS "paypal_test_mode" boolean NOT NULL DEFAULT false;
