CREATE TABLE IF NOT EXISTS "dom_customer_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dom_client_id" integer NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"sends" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "dom_customer_challenges_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dom_customer_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dom_client_id" integer NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dom_customer_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "dom_clients" ADD COLUMN IF NOT EXISTS "area_clienti_email" text;
--> statement-breakpoint
ALTER TABLE "dom_clients" ADD COLUMN IF NOT EXISTS "area_clienti_password_hash" text;
--> statement-breakpoint
ALTER TABLE "dom_clients" ADD COLUMN IF NOT EXISTS "must_change_password" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dom_customer_challenges" ADD CONSTRAINT "dom_customer_challenges_dom_client_id_dom_clients_id_fk" FOREIGN KEY ("dom_client_id") REFERENCES "public"."dom_clients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dom_customer_sessions" ADD CONSTRAINT "dom_customer_sessions_dom_client_id_dom_clients_id_fk" FOREIGN KEY ("dom_client_id") REFERENCES "public"."dom_clients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
