-- Payments test mode: hides Stripe/PayPal/SumUp from the public checkout while staff keep testing
-- sandbox payments via a secret bypass token (bank transfer is unaffected, since it never touches
-- a payment gateway). orders.test_mode records which credential set a given checkout used, set once
-- at session creation, so a later toggle flip can't make verification/webhooks use the wrong keys.
ALTER TABLE "site_config" ADD COLUMN IF NOT EXISTS "payments_test_mode" boolean NOT NULL DEFAULT false;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "test_mode" boolean NOT NULL DEFAULT false;
