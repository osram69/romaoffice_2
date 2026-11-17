/**
 * First name and surname written the same way everywhere: all lowercase except the first letter of each
 * name part, so "MARIO ROSSI", "mario rossi" and "mArIo  rossi" all become "Mario Rossi". Parts are the
 * words separated by a space, a hyphen or an apostrophe ("D'ANGELO" -> "D'Angelo", "ANNA-MARIA" -> "Anna-Maria").
 * Idempotent, so it is safe to apply again to a name that was already formatted.
 */
export function formatPersonName(value: string): string {
  return value
    .trim().replace(/\s+/g, " ")
    .toLocaleLowerCase("it")
    .replace(/(^|[\s'’-])(\p{L})/gu, (_match, separator: string, letter: string) => separator + letter.toLocaleUpperCase("it"));
}

/** "Maria Grazia Rossi" -> first "Maria", last "Grazia Rossi": the first word is the first name, the rest the surname
 * (a single word is taken as the surname). Used where only a full name is available. */
export function splitPersonName(fullName: string): { firstName: string; lastName: string } {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { firstName: "", lastName: "" };
  if (words.length === 1) return { firstName: "", lastName: words[0] };
  return { firstName: words[0], lastName: words.slice(1).join(" ") };
}
