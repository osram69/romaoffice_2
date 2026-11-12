-- Included mail openings per month: from 10 to 5, for every service. The site reads this value
-- (offer terms on the Tariffe page, quote PDF, request emails); it stays editable per service in
-- Gestione Tariffe ("Aperture incluse/mese"). The contract PDF templates and the contract wizard
-- text were updated to 5 in the code.
ALTER TABLE "service_catalog" ALTER COLUMN "included_openings" SET DEFAULT 5;
UPDATE "service_catalog" SET "included_openings" = 5;
