-- The per-row "Salva" in Gestione Tariffe used to reset service_addons.sort_order to 0 on every
-- save (the form had no sortOrder field), scrambling the row order. Restores the original order
-- from scripts/seed-catalog.ts; there is no UI to reorder, so these values are the intended ones.
UPDATE "service_addons" SET "sort_order" = 1 WHERE "code" IN ('legal_office_hours', 'virtual_secretary');
UPDATE "service_addons" SET "sort_order" = 2 WHERE "code" IN ('legal_secretary', 'extra_opening');
UPDATE "service_addons" SET "sort_order" = 3 WHERE "code" IN ('legal_extra_opening', 'archive');
UPDATE "service_addons" SET "sort_order" = 4 WHERE "code" IN ('legal_archive', 'personal_fax');
UPDATE "service_addons" SET "sort_order" = 5 WHERE "code" IN ('legal_forwarding', 'registered_mail');
UPDATE "service_addons" SET "sort_order" = 6 WHERE "code" = 'fax_send';
UPDATE "service_addons" SET "sort_order" = 7 WHERE "code" = 'mail_forwarding';
