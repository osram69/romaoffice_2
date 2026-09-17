DO $$ BEGIN
  CREATE TYPE "public"."order_status" AS ENUM('pending', 'paid', 'filled', 'signed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_limits" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"lang" varchar(2) DEFAULT 'it' NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"consent" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" uuid,
	"event" varchar(60) NOT NULL,
	"document_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"sends" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "customer_challenges_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"title" text NOT NULL,
	"title_en" text NOT NULL,
	"reference" text NOT NULL,
	"storage_key" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_password_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	CONSTRAINT "customer_password_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"company_name" text,
	"phone" text NOT NULL,
	"password_hash" text,
	"locale" varchar(2) DEFAULT 'it' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "customers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" varchar(64) NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"service" text NOT NULL,
	"duration_months" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'eur' NOT NULL,
	"provider" varchar(16),
	"provider_reference" text,
	"payment_method" varchar(20),
	"access_token_hash" text,
	"quote_data" jsonb,
	"terms_version" text,
	"terms_accepted_at" timestamp with time zone,
	"terms_text" text,
	"request_email_sent_at" timestamp with time zone,
	"admin_email_sent_at" timestamp with time zone,
	"checkout_url" text,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"form_data" jsonb,
	"signature_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "otp_verifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_public_id" varchar(64) NOT NULL,
	"phone" text NOT NULL,
	"code_hash" text NOT NULL,
	"sends" integer DEFAULT 1 NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "service_addons" (
	"code" varchar(50) PRIMARY KEY NOT NULL,
	"service" varchar(30) NOT NULL,
	"title_it" text NOT NULL,
	"title_en" text NOT NULL,
	"price_cents" integer NOT NULL,
	"annual_cents" integer DEFAULT 0 NOT NULL,
	"billing" varchar(20) NOT NULL,
	"max_quantity" integer DEFAULT 1 NOT NULL,
	"selectable" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "service_catalog" (
	"code" varchar(30) PRIMARY KEY NOT NULL,
	"vat_bps" integer DEFAULT 2200 NOT NULL,
	"additional_discount_bps" integer DEFAULT 1000 NOT NULL,
	"new_activation_discount_bps" integer DEFAULT 0 NOT NULL,
	"offer_valid_until" timestamp with time zone,
	"terms_revision" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "service_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"service" varchar(30) NOT NULL,
	"months" integer NOT NULL,
	"list_cents" integer NOT NULL,
	"offer_cents" integer,
	"new_activation" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "standard_offer_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"service" varchar(30) NOT NULL,
	"title" varchar(4) NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"lang" varchar(2) NOT NULL,
	"status" varchar(20) DEFAULT 'sending' NOT NULL,
	"payload_hash" text NOT NULL,
	"attachment_hash" text,
	"catalog_snapshot" jsonb,
	"message_id" text,
	"error_code" text,
	"consent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "customer_audit" ADD CONSTRAINT "customer_audit_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "customer_challenges" ADD CONSTRAINT "customer_challenges_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "customer_contracts" ADD CONSTRAINT "customer_contracts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "customer_password_tokens" ADD CONSTRAINT "customer_password_tokens_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "customer_sessions" ADD CONSTRAINT "customer_sessions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "service_addons" ADD CONSTRAINT "service_addons_service_service_catalog_code_fk" FOREIGN KEY ("service") REFERENCES "public"."service_catalog"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "service_prices" ADD CONSTRAINT "service_prices_service_service_catalog_code_fk" FOREIGN KEY ("service") REFERENCES "public"."service_catalog"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "service_duration_unique" ON "service_prices" USING btree ("service","months");
