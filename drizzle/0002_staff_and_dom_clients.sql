DO $$ BEGIN
  CREATE TYPE "public"."staff_role" AS ENUM('admin', 'operatore');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dom_clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_id" integer,
	"ragione_sociale" text NOT NULL,
	"sede" integer DEFAULT 1,
	"email_posta" text DEFAULT '' NOT NULL,
	"email_pec" text,
	"testo_scadenza" text,
	"testo_proforma" text,
	"testo_sospensione" text,
	"amministratore" text,
	"telefono_amm" text,
	"persona_rif" text,
	"telefono" text,
	"telefono_urg" text,
	"inizio_dom" date,
	"scadenza_dom" date,
	"scadenza_pagamento" date,
	"contr_firmato" boolean,
	"controfirmato_inviato" boolean,
	"modulo_cont" boolean,
	"doc_amm_pres" boolean,
	"allegato1_pres" boolean,
	"visura_pres" boolean,
	"stato" integer,
	"note" text,
	"ind_sped_posta" text,
	"presenza_file" integer DEFAULT 0 NOT NULL,
	"tipologia" integer DEFAULT 0 NOT NULL,
	"raccoglitore" integer DEFAULT 0 NOT NULL,
	"prezzo_rinnovo" integer,
	"scadenza_inviata" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dom_clients_legacy_id_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "staff_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "staff_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(60) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "staff_role" DEFAULT 'operatore' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "staff_users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_sessions_user_id_staff_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."staff_users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
