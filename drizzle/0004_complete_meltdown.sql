CREATE UNIQUE INDEX IF NOT EXISTS "dom_clients_area_clienti_email_unique" ON "dom_clients" USING btree ("area_clienti_email") WHERE "dom_clients"."area_clienti_email" is not null;
