import type { InferSelectModel } from "drizzle-orm";
import type { domClients } from "@/db/schema";
import { personalGreeting } from "./dom-scadenza-email";

type DomClient = InferSelectModel<typeof domClients>;

export const DEFAULT_RITIRO_SUBJECT_TEMPLATE = "Richiesta ritiro urgente corrispondenza in giacenza {ragioneSociale} - Roma Office Sharing";

export function ritiroEmailSubject(client: Pick<DomClient, "ragioneSociale">, template?: string | null): string {
  return (template?.trim() || DEFAULT_RITIRO_SUBJECT_TEMPLATE).replaceAll("{ragioneSociale}", client.ragioneSociale ?? "").replace(/[\r\n]+/g, " ").trim();
}

// Used whenever an admin hasn't set a custom template in Configurazione Web
// (site_config.ritiroTestoTemplate) — the exact wording the user asked for, since unlike the
// scadenza email this one has no per-client dynamic content (the company name only appears in
// the subject), it's meant to stay this generic across every client.
export const DEFAULT_RITIRO_EMAIL_HTML = `<p>Buongiorno,</p>
<p>la presente per comunicarVi che è in giacenza presso i nostri uffici una notevole quantità di posta.</p>
<p>Vi invitiamo a provvedere al ritiro quanto prima o a richiedere la spedizione da parte nostra comunicandoci l'indirizzo di spedizione.</p>
<p>Grazie<br>Segreteria Roma Office Sharing</p>`;

// Same wording addressed to one person ("Le"/"La" instead of "Vi"): used when the administrator or the reference
// person of the company is known, so the email can open with "Buongiorno Sig./Sig.ra <cognome>,".
const PERSONAL_RITIRO_EMAIL_BODY = `<p>la presente per comunicarLe che è in giacenza presso i nostri uffici una notevole quantità di posta.</p>
<p>La invitiamo a provvedere al ritiro quanto prima o a richiedere la spedizione da parte nostra comunicandoci l'indirizzo di spedizione.</p>
<p>Grazie<br>Segreteria Roma Office Sharing</p>`;

const plainText = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
const DEFAULT_PLAIN_TEXT = plainText(DEFAULT_RITIRO_EMAIL_HTML);

/** The draft of the pickup email. Without a custom template: the default text, personal (singular) when the
 * administrator / reference person is known and generic (plural) otherwise. A custom template (Configurazione Web)
 * keeps its own wording; when a person is known its opening "Buongiorno," becomes personal and "comunicarVi" /
 * "Vi invitiamo" become "comunicarLe" / "La invitiamo". */
export function buildRitiroEmailHtml(client: Pick<DomClient, "amministratore" | "personaRif">, customTemplate?: string | null): string {
  const greeting = personalGreeting(client);
  // the editor in Configurazione Web shows the default text, and saving it through the rich-text editor rewrites
  // the HTML (spaces, <br />, line breaks): a saved copy of the default text is still "the default"
  const trimmed = customTemplate?.trim();
  const custom = trimmed && plainText(trimmed) !== DEFAULT_PLAIN_TEXT ? trimmed : "";
  if (!greeting) return custom || DEFAULT_RITIRO_EMAIL_HTML;
  if (!custom) return `<p>${greeting}</p>
${PERSONAL_RITIRO_EMAIL_BODY}`;
  const opening = /^\s*<p>\s*Buongiorno\s*,?\s*<\/p>/i;
  const personal = opening.test(custom) ? custom.replace(opening, `<p>${greeting}</p>`) : custom;
  return personal.replace(/comunicarVi\b/g, "comunicarLe").replace(/\bVi invitiamo\b/g, "La invitiamo");
}
