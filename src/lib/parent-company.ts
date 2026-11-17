import { normalizeCompanyName } from "./company-name-normalize";

// "Domiciliazione aggiuntiva" carries a discount only for someone who already has an active domiciliation with
// us. The buyer types the name of that "società capofila" (never picks it from a list, so the list of our clients
// is not exposed) and the referente; this module checks the claim against the active records. The registro
// imprese is public — anyone can read a company's address and administrator there — so name + referente alone
// prove little: what only a real client has is the contact data we hold (email, phone), which is checked too.

export type ParentCheck = {
  /** verified: name, referente and one of our contacts match. to-check: name and referente match, contacts do not
   * (could be a real client using another email, or someone who read the registro imprese): flagged for reception. */
  status: "verified" | "to-check" | "rejected";
  declaredName: string;
  declaredContact: string;
  capofilaId?: number;
  capofilaName?: string;
};

export type ParentCandidate = {
  id: number; ragioneSociale: string; amministratore: string | null; personaRif: string | null;
  emailPosta: string | null; emailPec: string | null; areaClientiEmail: string | null;
  telefono: string | null; telefonoAmm: string | null; telefonoUrg: string | null;
};

export type ParentClaim = { companyName: string; contactName: string; buyerEmail: string; buyerPhone: string };

const NAME_THRESHOLD = 0.85;

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** 0..1: how alike two company names are, ignoring case, accents, punctuation and legal form ("Rossi S.r.l." = "ROSSI"). */
export function companyNameScore(a: string, b: string): number {
  const na = normalizeCompanyName(a), nb = normalizeCompanyName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = na.split(" "), tb = nb.split(" ");
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  // one name is the other plus extra words ("Rossi Consulting" / "Rossi Consulting Group")
  if (short.length >= 2 && short.every(token => long.includes(token))) return 0.9;
  return 1 - levenshtein(na, nb) / Math.max(na.length, nb.length);
}

function personTokens(name: string): string[] {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[^a-z]+/).filter(token => token.length >= 2);
}

/** Same person written differently: "Mario Rossi" = "ROSSI Mario" = "Mario Giuseppe Rossi". Needs at least two words. */
export function samePerson(a: string, b: string): boolean {
  const ta = personTokens(a), tb = personTokens(b);
  if (ta.length < 2 || tb.length < 2) return false;
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  return short.every(token => long.includes(token));
}

const phoneKey = (value: string) => value.replace(/\D/g, "").slice(-9);
function phoneKeys(value: string | null): string[] {
  return (value ?? "").split(/[;,/]+/).map(part => phoneKey(part.replace(/[\s.()-]/g, ""))).filter(key => key.length >= 9);
}
function emailKeys(...values: (string | null)[]): string[] {
  return values.flatMap(value => (value ?? "").split(/[;,\s]+/)).map(v => v.trim().toLowerCase()).filter(Boolean);
}

export function contactMatches(candidate: ParentCandidate, claim: Pick<ParentClaim, "buyerEmail" | "buyerPhone">): boolean {
  const email = claim.buyerEmail.trim().toLowerCase();
  if (email && emailKeys(candidate.emailPosta, candidate.emailPec, candidate.areaClientiEmail).includes(email)) return true;
  const phone = phoneKey(claim.buyerPhone);
  return phone.length >= 9 && [candidate.telefono, candidate.telefonoAmm, candidate.telefonoUrg].some(value => phoneKeys(value).includes(phone));
}

/** Pure decision, given the active companies: see ParentCheck. */
export function evaluateParent(claim: ParentClaim, candidates: ParentCandidate[]): ParentCheck {
  const base = { declaredName: claim.companyName.trim(), declaredContact: claim.contactName.trim() };
  const matches = candidates
    .map(candidate => ({ candidate, score: companyNameScore(claim.companyName, candidate.ragioneSociale) }))
    .filter(m => m.score >= NAME_THRESHOLD)
    .filter(m => [m.candidate.amministratore, m.candidate.personaRif].some(person => person && samePerson(person, claim.contactName)))
    .sort((x, y) => Number(contactMatches(y.candidate, claim)) - Number(contactMatches(x.candidate, claim)) || y.score - x.score);
  const best = matches[0];
  if (!best) return { status: "rejected", ...base };
  return { status: contactMatches(best.candidate, claim) ? "verified" : "to-check", ...base, capofilaId: best.candidate.id, capofilaName: best.candidate.ragioneSociale };
}
