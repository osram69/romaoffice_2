// "Sig." / "Sig.ra" for the greeting of an email, guessed from the first name of the person (the field holds
// "Nome Cognome", the surname being the last word — see cognomeDi in dom-scadenza-email.ts). Names are ambiguous
// by nature, so the rule is conservative: only a first name that is clearly feminine gives "Sig.ra"; a missing
// name, a bare initial ("M. Rossi"), a unisex or unknown name all give the neutral "Sig.".

// Male names that end in "a": never feminine.
const MALE_ENDING_IN_A = new Set([
  "andrea", "luca", "nicola", "mattia", "elia", "tobia", "gianluca", "pierluca", "gianandrea", "battista", "giovanbattista", "gianbattista",
  "saba", "costa", "barnaba", "sila", "ezra", "noah", "jona", "luka", "nikola", "sava", "zaccaria", "geremia", "isaia", "uria", "sofonia",
  "mustafa", "moussa", "sasha", "misha", "borja", "abdalla",
]);

// Feminine names that do not end in "a".
const FEMALE_NOT_ENDING_IN_A = new Set([
  "beatrice", "agnese", "alice", "irene", "rachele", "carmen", "ester", "esther", "ines", "miriam", "noemi", "denise", "michelle", "mercedes", "ruth",
  "sarah", "elisabeth", "elisabet", "judith", "nicole", "anne", "marie", "rose", "jennifer", "karin", "sabine", "lucrezia", "annette", "isabel", "isabelle",
  "ingrid", "astrid", "edith", "mary", "iris", "helen", "ellen", "caroline", "heidi", "lily", "lilly", "betty", "kate", "claire", "zoe", "chloe", "nadine", "celine",
  "solange", "yvonne", "gwendolyn", "yasmin", "yasmine", "jasmine", "nour", "ilse", "inge", "silke", "birgit", "brigitte", "monique", "nathalie",
  "valerie", "sophie", "marion", "eleonore", "marlene", "doris", "liz", "meg", "beth", "gudrun", "kerstin", "ulrike", "renate",
]);

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** First name from "Nome Cognome" (also "Nome Secondo Cognome"); null when there is no usable one (only a surname, an initial). */
export function firstNameOf(fullName: string | null | undefined): string | null {
  const words = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return null; // a single word is a surname or a company: no first name to judge
  const first = words[0];
  const letters = normalize(first).replace(/[^a-z]/g, "");
  if (letters.length < 3 || first.endsWith(".")) return null; // initial ("M." / "Ma.")
  return letters;
}

/** "Sig.ra" when the first name is clearly feminine, otherwise "Sig.". */
export function titleFor(fullName: string | null | undefined): "Sig." | "Sig.ra" {
  const name = firstNameOf(fullName);
  if (!name) return "Sig.";
  if (MALE_ENDING_IN_A.has(name)) return "Sig.";
  if (FEMALE_NOT_ENDING_IN_A.has(name)) return "Sig.ra";
  return name.endsWith("a") ? "Sig.ra" : "Sig.";
}
