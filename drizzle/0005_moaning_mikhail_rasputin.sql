ALTER TABLE "service_catalog" ADD COLUMN IF NOT EXISTS "smart_3x24_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "service_catalog" ADD COLUMN IF NOT EXISTS "smart_6x24_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "service_prices" ADD COLUMN IF NOT EXISTS "additional_domiciliation" boolean DEFAULT true NOT NULL;
