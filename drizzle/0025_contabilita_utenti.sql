-- Encrypted accounting area ("Contabilita") and staff-user management.
--
-- IMPORTANT: run the ALTER TYPE below ALONE, as its own query, and only then run everything that follows
-- in a separate query (PostgreSQL cannot use a newly added enum value in the same transaction).
ALTER TYPE "staff_role" ADD VALUE IF NOT EXISTS 'commercialista';

-- ---- Run everything below in a second, separate query ----

-- Accounts created or reset by an admin must pick their own password at first login.
ALTER TABLE "staff_users" ADD COLUMN IF NOT EXISTS "must_change_password" boolean NOT NULL DEFAULT false;

-- Sections of the accounting area (e.g. "Fatture 2026").
CREATE TABLE IF NOT EXISTS "contab_sections" (
  "id" serial PRIMARY KEY,
  "title" varchar(100) NOT NULL,
  "sort_order" integer NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Files in a section. The content lives AES-256-GCM encrypted on disk as <stored_name>.enc;
-- name, MIME type and size are kept here.
CREATE TABLE IF NOT EXISTS "contab_files" (
  "id" serial PRIMARY KEY,
  "section_id" integer NOT NULL REFERENCES "contab_sections"("id"),
  "original_name" text NOT NULL,
  "mime" text NOT NULL,
  "size_bytes" bigint NOT NULL,
  "stored_name" varchar(36) NOT NULL UNIQUE,
  "uploaded_by" varchar(60) NOT NULL,
  "uploaded_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "contab_files_section_id_idx" ON "contab_files" ("section_id");

-- Download log. file_id is nulled when a file is deleted; file_name keeps the history readable.
CREATE TABLE IF NOT EXISTS "contab_downloads" (
  "id" serial PRIMARY KEY,
  "file_id" integer REFERENCES "contab_files"("id") ON DELETE SET NULL,
  "file_name" text NOT NULL,
  "username" varchar(60) NOT NULL,
  "downloaded_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Single-row table: the second password that unlocks the area for admins.
CREATE TABLE IF NOT EXISTS "contab_access" (
  "id" integer PRIMARY KEY CHECK ("id" = 1),
  "password_hash" text NOT NULL,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Active unlocks, bound to the staff session they were created in; expire after inactivity.
CREATE TABLE IF NOT EXISTS "contab_unlocks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "token_hash" varchar(64) NOT NULL UNIQUE,
  "user_id" uuid NOT NULL REFERENCES "staff_users"("id") ON DELETE CASCADE,
  "session_token_hash" varchar(64) NOT NULL,
  "last_seen_at" timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at" timestamp with time zone NOT NULL
);
CREATE INDEX IF NOT EXISTS "contab_unlocks_user_id_idx" ON "contab_unlocks" ("user_id");
