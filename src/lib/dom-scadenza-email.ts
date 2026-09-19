import type { InferSelectModel } from "drizzle-orm";
import type { domClients, domRinnovoPrezzi } from "@/db/schema";

type DomClient = InferSelectModel<typeof domClients>;
type RinnovoPrezzo = InferSelectModel<typeof domRinnovoPrezzi>;

// Mirrors getCognome() in the legacy domiciliazioni.php: last word of amministratore if present,
// else last word of persona_rif — not necessarily a real surname, just what the field contains.
function cognomeDi(client: Pick<DomClient, "amministratore" | "personaRif">): string {
  const source = client.amministratore?.trim() || client.personaRif?.trim() || "";
  if (!source) return "";
  const parts = source.split(/\s+/);
  return parts[parts.length - 1];
}

function fmtDateIT(value: string | null): string {
  if (!value) return "";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

function fmtEuro(cents: number | null): string {
  if (cents === null || cents === undefined) return "";
  return cents.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const DURATA_PAROLA: Record<number, string> = { 6: "semestrale", 12: "annuo", 24: "biennale", 36: "triennale", 48: "quadriennale" };

/** Rounds the (inizio_dom -> scadenza_dom) span to the nearest whole month, used to pick wording
 * ("canone semestrale/annuo/...") and to decide which renewal offers count as upsells. */
export function contractMonths(client: Pick<DomClient, "inizioDom" | "scadenzaDom">): number | null {
  if (!client.inizioDom || !client.scadenzaDom) return null;
  const start = new Date(client.inizioDom);
  const end = new Date(client.scadenzaDom);
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  return Math.max(1, Math.round(months));
}

/** Only 6- and 12-month contracts ever carried the one-time "sconto attivazioni" 10% discount
 * (24/36/48-month contracts never had it); this is the automatic default for the checkbox staff
 * can still override per send, per the user's explicit correction to the earlier primoRinnovo
 * flag — a contract's own duration is more reliable than a hand-tracked "first renewal" flag. */
export function defaultScontoApplicabile(client: Pick<DomClient, "inizioDom" | "scadenzaDom">): boolean {
  const months = contractMonths(client);
  return months !== null && months >= 6 && months <= 12;
}

/** The "sconto attivazioni non più applicabile" disclaimer added on top of the legacy template.
 * `includeSconto` is an explicit, staff-controlled choice (seeded from defaultScontoApplicabile)
 * — never inferred silently inside the builder. Cites the exact activation year from inizio_dom
 * when known, falling back to no year if that date is missing. */
function scontoClause(client: Pick<DomClient, "inizioDom">, includeSconto: boolean): string {
  if (!includeSconto) return "";
  const year = client.inizioDom ? new Date(client.inizioDom).getFullYear() : null;
  return ` (lo sconto una-tantum attivazioni${year ? ` ${year}` : ""} non è più applicabile)`;
}

function offerteRows(prezzi: RinnovoPrezzo[], currentMonths: number | null): string {
  const rows = prezzi
    .filter(p => p.prezzoPieno !== null && p.prezzoOfferta !== null)
    .filter(p => currentMonths === null || p.mesi > currentMonths)
    .sort((a, b) => a.mesi - b.mesi);
  if (rows.length === 0) return "";
  return rows.map(p => {
    const nota = p.notaMensile ? `, ${p.notaMensile}` : "";
    return `<p>${p.mesi} mesi &nbsp;&nbsp;&nbsp;&nbsp; <s>€ ${fmtEuro(p.prezzoPieno)} + IVA</s> &nbsp;&nbsp;&nbsp;&nbsp; <strong>€ ${fmtEuro(p.prezzoOfferta)} + IVA</strong> &nbsp;&nbsp;&nbsp; (Attuale offerta${nota})</p>`;
  }).join("\n");
}

export function scadenzaEmailSubject(client: Pick<DomClient, "ragioneSociale">): string {
  return `Scadenza contratto domiciliazione sede legale ${client.ragioneSociale} - Roma Office Sharing`;
}

/** Builds the draft scadenza reminder email exactly in the shape of the legacy templateScadenza,
 * plus the (new) activation-discount disclaimer. This is meant to be shown to staff for review/
 * editing before sending — never sent unmodified — but is also a stable building block a future
 * automation (local agent / AI) can call directly with the same DomClient + pricing shape. */
export function buildScadenzaEmailHtml(client: DomClient, prezzi: RinnovoPrezzo[], includeSconto: boolean): string {
  const months = contractMonths(client);
  const durata = months ? DURATA_PAROLA[months] ?? `di ${months} mesi` : "";
  const prezzoRinnovo = client.prezzoRinnovo !== null ? String(client.prezzoRinnovo) : "[PREZZO]";

  return `<p>Buongiorno Sig. ${cognomeDi(client)},</p>
<p>con la presente volevamo informarLa che in data <strong>${fmtDateIT(client.scadenzaDom)}</strong>, scadrà il contratto di domiciliazione legale della società <strong>${client.ragioneSociale}</strong></p>
<p>Qualora desideri interrompere la domiciliazione, La preghiamo di inviarci richiesta scritta (raccomandata o PEC al nostro indirizzo <a href="mailto:cubeng@pec.it">cubeng@pec.it</a>) oppure di comunicarci l'intento al rinnovo rispondendo a questa email.</p>
<p>Per il rinnovo possiamo mantenere le stesse condizioni precedenti con canone${durata ? ` ${durata}` : ""} di ${prezzoRinnovo}&nbsp;€ + IVA${scontoClause(client, includeSconto)}</p>
<p><u>Nel caso di pagamento tardivo, non sarà possibile rinnovare alle stesse condizioni.</u></p>
<p>Abbiamo altresì attive le seguenti offerte:</p>
${offerteRows(prezzi, months)}
<p>Nel caso di conferma intento al rinnovo, provvederemo ad inviarle relativa fattura proforma per il pagamento, altrimenti La preghiamo di inviarci raccomandata/PEC con comunicazione di recesso.</p>
<p>Restiamo in attesa di un cortese riscontro</p>
<p>Cordiali saluti<br>Amministrazione Roma Office Sharing</p>`;
}
