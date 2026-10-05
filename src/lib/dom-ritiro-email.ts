import type { InferSelectModel } from "drizzle-orm";
import type { domClients } from "@/db/schema";

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
