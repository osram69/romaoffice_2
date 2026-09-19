CREATE TABLE IF NOT EXISTS "dom_rinnovo_prezzi" (
	"mesi" integer PRIMARY KEY NOT NULL,
	"prezzo_pieno" integer,
	"prezzo_offerta" integer,
	"nota_mensile" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dom_clients" ADD COLUMN IF NOT EXISTS "primo_rinnovo" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
INSERT INTO "dom_rinnovo_prezzi" ("mesi", "prezzo_pieno", "prezzo_offerta", "nota_mensile") VALUES
	(6, NULL, NULL, NULL),
	(12, 660, 550, NULL),
	(24, 980, 860, NULL),
	(36, 1320, 1120, '31€/mese'),
	(48, 1420, 1250, '26€/mese')
ON CONFLICT ("mesi") DO NOTHING;
