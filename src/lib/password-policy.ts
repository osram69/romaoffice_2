export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_REQUIREMENTS: { key: string; label: { it: string; en: string }; test: (password: string) => boolean }[] = [
  { key: "length", label: { it: `Almeno ${PASSWORD_MIN_LENGTH} caratteri`, en: `At least ${PASSWORD_MIN_LENGTH} characters` }, test: pw => pw.length >= PASSWORD_MIN_LENGTH },
  { key: "upper", label: { it: "Una lettera maiuscola", en: "One uppercase letter" }, test: pw => /[A-Z]/.test(pw) },
  { key: "lower", label: { it: "Una lettera minuscola", en: "One lowercase letter" }, test: pw => /[a-z]/.test(pw) },
  { key: "digit", label: { it: "Un numero", en: "One digit" }, test: pw => /[0-9]/.test(pw) },
  { key: "special", label: { it: "Un carattere speciale", en: "One special character" }, test: pw => /[^A-Za-z0-9]/.test(pw) },
];

export function passwordMeetsPolicy(password: string) {
  return password.length <= PASSWORD_MAX_LENGTH && PASSWORD_REQUIREMENTS.every(r => r.test(password));
}
