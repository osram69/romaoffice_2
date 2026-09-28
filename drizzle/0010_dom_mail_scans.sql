-- Incoming-mail scans attached via the "Allega" button (eSCL network-scanner bridge) on each
-- active domiciliazione. Multiple scans per client over time, unlike the fixed con/mod/all/doc/avc/rev
-- document slots on dom_clients — each scan is its own row, with the encrypted PDF on disk keyed
-- by this row's id (posta_<id>.pdf.enc, alongside the existing <legacy_id>_<type>.pdf.enc files).
CREATE TABLE IF NOT EXISTS "dom_mail_scans" (
  "id" serial PRIMARY KEY,
  "dom_client_id" integer NOT NULL REFERENCES "dom_clients"("id") ON DELETE CASCADE,
  "scanned_by_username" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "dom_mail_scans_dom_client_id_idx" ON "dom_mail_scans" ("dom_client_id");
