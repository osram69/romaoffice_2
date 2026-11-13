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
