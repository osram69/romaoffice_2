ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_method" varchar(20);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "access_token_hash" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "quote_data" jsonb;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "terms_version" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "terms_accepted_at" timestamp with time zone;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "terms_text" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "request_email_sent_at" timestamp with time zone;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "admin_email_sent_at" timestamp with time zone;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "checkout_url" text;

ALTER TABLE "otp_verifications" ADD COLUMN IF NOT EXISTS "sends" integer NOT NULL DEFAULT 1;
ALTER TABLE "otp_verifications" ADD COLUMN IF NOT EXISTS "sent_at" timestamp with time zone NOT NULL DEFAULT now();
