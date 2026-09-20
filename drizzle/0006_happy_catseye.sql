CREATE TABLE IF NOT EXISTS "site_config" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"stripe_enabled" boolean DEFAULT true NOT NULL,
	"paypal_enabled" boolean DEFAULT true NOT NULL,
	"sumup_enabled" boolean DEFAULT true NOT NULL,
	"bank_transfer_enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
INSERT INTO "site_config" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "service_prices" ALTER COLUMN "additional_domiciliation" SET DEFAULT true;
