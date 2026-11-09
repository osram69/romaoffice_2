// Section title rules, kept free of database imports so they can be tested without a database.

export const SECTION_TITLE_MAX = 100;

const TITLE_MESSAGE = `Il titolo deve avere da 1 a ${SECTION_TITLE_MAX} caratteri.`;

/** Trims the title and checks its length (1 to 100 characters). */
export function normalizeSectionTitle(raw: string): { ok: true; title: string } | { ok: false; message: string } {
  if (typeof raw !== "string") return { ok: false, message: TITLE_MESSAGE };
  const title = raw.trim();
  // The spread counts code points, like PostgreSQL varchar(100) does, so an accepted title always fits the column.
  const length = [...title].length;
  if (length < 1 || length > SECTION_TITLE_MAX) return { ok: false, message: TITLE_MESSAGE };
  return { ok: true, title };
}
