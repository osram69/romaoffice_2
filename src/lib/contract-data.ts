import { z } from "zod";
import { isValidTaxCode, normalizeTaxCode } from "./codice-fiscale";

// Data model of the online-fillable "Contratto di domiciliazione sede legale" (Rev. F): one flat
// shape that the wizard edits, the server stores (encrypted draft) and contract-pdf.ts prints onto
// the original contract PDF. All values are plain strings so a draft survives any edit/validation
// state; "" means "not filled in yet".

export type YesNo = "" | "y" | "n";

/** Identification block of Allegato 3: legal representative, executor and each beneficial owner. */
export type Person = {
  cognome: string; nome: string;
  resVia: string; resCap: string; resComune: string; resProv: string;
  cf: string;
  nascLuogo: string; nascProv: string; nascData: string; cittadinanza: string;
  docTipo: string; docNumero: string; docRilascio: string; docScadenza: string; docAutorita: string;
  docComune: string; docProvincia: string; docStato: string;
  pep: "" | "no" | "si"; pepMotivo: string;
  // "y" = ha subito procedimenti / è a conoscenza di indagini / è collegato / opera con Paesi a rischio / ha versato il 25% tramite intermediario
  procedimenti: YesNo; indagini: YesNo; collegato: YesNo; paesi: YesNo; quota: YesNo;
  motivoTitolare: string; // beneficial owners only: why the person is a beneficial owner
};

export type Delegato = { nome: string; cognome: string; documento: string; note: string };

export type TitolareMode = "" | "unico" | "insieme" | "altri" | "nessuno";

export type ContractData = {
  // Pagina 1 — parti
  societa: string; sedeVia: string; sedeCitta: string; sedeCap: string; sedeProv: string; capitale: string;
  cfRegImp: string; piva: string; pec: string; sdi: string;
  repQualifica: string; repNome: string; repNatoA: string; repNatoIl: string;
  repResVia: string; repResCitta: string; repResCap: string; repResProv: string; repCf: string; repEmail: string;
  // Condizioni (di sola lettura per il cliente: le imposta la reception)
  durataMesi: number; canoneEuro: number; dataInizio: string;
  // Allegato 1
  delegati: Delegato[]; telUrgenze: string; intestazione: string;
  inoltroNome: string; inoltroVia: string; inoltroComune: string; inoltroProv: string; inoltroCap: string;
  svcLineaTel: boolean; svcDenomPostale: boolean; denomPostaleTesto: string;
  svcApertura: boolean; svcArchivio: boolean; svcInoltro: boolean;
  emailScansioni: string;
  // Allegato 2
  a2Studio: string; a2DomFiscale1: string; a2DomFiscale2: string; a2Luogo1: string; a2Luogo2: string;
  a2Tel: string; a2Orario: string; a2Chiuso: string;
  // Allegato 3 — sezione A
  denominazioneForma: string; indirizzoSede: string; capSede: string; comuneSede: string; provSede: string;
  cfSocieta: string; pivaSocieta: string; rea: string; ateco: string; sae: string; rae: string;
  rappresentante: Person;
  hasEsecutore: boolean; esecutore: Person;
  // Allegato 3 — sezione B
  titolareMode: TitolareMode; titolareNessunoMotivo: string; titolari: Person[];
  // Consenso a procedere (non stampato): il cliente conferma di aver riletto i dati
  confermaDati: boolean;
};

export const MAX_DELEGATI = 3;
export const MAX_TITOLARI = 6;

export function emptyPerson(): Person {
  return {
    cognome: "", nome: "", resVia: "", resCap: "", resComune: "", resProv: "", cf: "",
    nascLuogo: "", nascProv: "", nascData: "", cittadinanza: "Italiana",
    docTipo: "", docNumero: "", docRilascio: "", docScadenza: "", docAutorita: "", docComune: "", docProvincia: "", docStato: "",
    pep: "", pepMotivo: "", procedimenti: "", indagini: "", collegato: "", paesi: "", quota: "", motivoTitolare: "",
  };
}

export function emptyContract(): ContractData {
  return {
    societa: "", sedeVia: "", sedeCitta: "", sedeCap: "", sedeProv: "", capitale: "", cfRegImp: "", piva: "", pec: "", sdi: "",
    repQualifica: "", repNome: "", repNatoA: "", repNatoIl: "", repResVia: "", repResCitta: "", repResCap: "", repResProv: "", repCf: "", repEmail: "",
    durataMesi: 12, canoneEuro: 0, dataInizio: "",
    delegati: [{ nome: "", cognome: "", documento: "", note: "" }], telUrgenze: "", intestazione: "",
    inoltroNome: "", inoltroVia: "", inoltroComune: "", inoltroProv: "", inoltroCap: "",
    svcLineaTel: false, svcDenomPostale: false, denomPostaleTesto: "", svcApertura: false, svcArchivio: false, svcInoltro: false,
    emailScansioni: "",
    a2Studio: "", a2DomFiscale1: "", a2DomFiscale2: "", a2Luogo1: "", a2Luogo2: "", a2Tel: "", a2Orario: "", a2Chiuso: "",
    denominazioneForma: "", indirizzoSede: "", capSede: "", comuneSede: "", provSede: "", cfSocieta: "", pivaSocieta: "", rea: "", ateco: "", sae: "", rae: "",
    rappresentante: emptyPerson(), hasEsecutore: false, esecutore: emptyPerson(),
    titolareMode: "", titolareNessunoMotivo: "", titolari: [],
    confermaDati: false,
  };
}

/** Fills the Allegato 3 / rappresentante fields from the data already entered on page 1. */
export function derivedFromParties(d: ContractData): Partial<ContractData> {
  const [first, ...rest] = d.repNome.trim().split(/\s+/);
  return {
    denominazioneForma: d.societa, indirizzoSede: d.sedeVia, capSede: d.sedeCap, comuneSede: d.sedeCitta, provSede: d.sedeProv,
    cfSocieta: d.cfRegImp, pivaSocieta: d.piva,
    rappresentante: {
      ...d.rappresentante,
      nome: d.rappresentante.nome || first || "", cognome: d.rappresentante.cognome || rest.join(" "),
      resVia: d.rappresentante.resVia || d.repResVia, resCap: d.rappresentante.resCap || d.repResCap,
      resComune: d.rappresentante.resComune || d.repResCitta, resProv: d.rappresentante.resProv || d.repResProv,
      cf: d.rappresentante.cf || d.repCf, nascLuogo: d.rappresentante.nascLuogo || d.repNatoA,
      nascData: d.rappresentante.nascData || d.repNatoIl,
    },
  };
}

// --- validation helpers -------------------------------------------------------------------------

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isEmail = (v: string) => EMAIL.test(v.trim());
export const isCap = (v: string) => /^\d{5}$/.test(v.trim());
export const isProv = (v: string) => /^[A-Za-z]{2}$/.test(v.trim());
export const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`));
export function isPartitaIva(raw: string): boolean {
  const v = raw.replace(/\s/g, "");
  if (!/^\d{11}$/.test(v)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) { let n = Number(v[i]); if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; } sum += n; }
  return (10 - (sum % 10)) % 10 === Number(v[10]);
}
export const isCf = (v: string) => isValidTaxCode(v);
/** CF of a company can also be an 11-digit number. */
export const isCfSocieta = (v: string) => isPartitaIva(v) || isValidTaxCode(v);

export type FieldErrors = Record<string, string>;

const req = (errors: FieldErrors, key: string, value: string | undefined, label = "Campo obbligatorio") => {
  if (!value || !value.trim()) errors[key] = label;
};

function validatePerson(p: Person, prefix: string, errors: FieldErrors, opts: { titolare?: boolean; esecutore?: boolean }) {
  for (const k of ["cognome", "nome", "resVia", "resComune", "nascLuogo", "cittadinanza", "docTipo", "docAutorita"] as const) req(errors, `${prefix}.${k}`, p[k]);
  if (!isCap(p.resCap)) errors[`${prefix}.resCap`] = "CAP di 5 cifre";
  if (!isProv(p.resProv)) errors[`${prefix}.resProv`] = "Sigla di 2 lettere (es. RM)";
  if (!isCf(p.cf)) errors[`${prefix}.cf`] = "Codice fiscale non valido";
  if (p.nascProv.trim() && !isProv(p.nascProv)) errors[`${prefix}.nascProv`] = "Sigla di 2 lettere (EE se estero)";
  if (!p.nascProv.trim()) errors[`${prefix}.nascProv`] = "Sigla di 2 lettere (EE se estero)";
  if (!isDate(p.nascData)) errors[`${prefix}.nascData`] = "Data non valida";
  if (!/^[A-Za-z0-9 ./-]{4,22}$/.test(p.docNumero.trim())) errors[`${prefix}.docNumero`] = "Numero documento (max 22 caratteri)";
  if (!isDate(p.docRilascio)) errors[`${prefix}.docRilascio`] = "Data non valida";
  if (!isDate(p.docScadenza)) errors[`${prefix}.docScadenza`] = "Data non valida";
  else if (p.docScadenza < new Date().toISOString().slice(0, 10)) errors[`${prefix}.docScadenza`] = "Documento scaduto: serve un documento in corso di validità";
  if (!p.docComune.trim() && !p.docStato.trim()) { errors[`${prefix}.docComune`] = "Comune e provincia, oppure stato per le autorità estere"; errors[`${prefix}.docStato`] = "Stato (se autorità estera)"; }
  if (!p.pep) errors[`${prefix}.pep`] = "Seleziona una risposta";
  if (p.pep === "si") req(errors, `${prefix}.pepMotivo`, p.pepMotivo, "Specifica la carica o il legame");
  const decl: (keyof Person)[] = opts.esecutore ? ["procedimenti", "indagini", "collegato"] : ["procedimenti", "indagini", "collegato", "paesi", "quota"];
  for (const k of decl) if (!p[k]) errors[`${prefix}.${k}`] = "Seleziona una risposta";
  if (opts.titolare) req(errors, `${prefix}.motivoTitolare`, p.motivoTitolare);
}

/** Returns an error per field key (empty object = the contract can be generated). */
export function validateContract(d: ContractData): FieldErrors {
  const e: FieldErrors = {};
  // Pagina 1
  for (const k of ["societa", "sedeVia", "sedeCitta", "capitale", "repQualifica", "repNome", "repNatoA", "repResVia", "repResCitta"] as const) req(e, k, d[k]);
  if (!isCap(d.sedeCap)) e.sedeCap = "CAP di 5 cifre";
  if (!isProv(d.sedeProv)) e.sedeProv = "Sigla di 2 lettere (es. RM)";
  if (!isCfSocieta(normalizeTaxCode(d.cfRegImp))) e.cfRegImp = "Codice fiscale non valido";
  if (!isPartitaIva(d.piva)) e.piva = "Partita IVA non valida (11 cifre)";
  if (!isEmail(d.pec)) e.pec = "Indirizzo PEC non valido";
  if (!/^[A-Za-z0-9]{6,7}$/.test(d.sdi.trim())) e.sdi = "Codice SDI di 7 caratteri (0000000 se si usa la PEC)";
  if (!isDate(d.repNatoIl)) e.repNatoIl = "Data non valida";
  if (!isCap(d.repResCap)) e.repResCap = "CAP di 5 cifre";
  if (!isProv(d.repResProv)) e.repResProv = "Sigla di 2 lettere";
  if (!isCf(d.repCf)) e.repCf = "Codice fiscale non valido";
  if (!isEmail(d.repEmail)) e.repEmail = "Indirizzo email non valido";
  // Allegato 1
  const delegati = d.delegati.filter(x => x.nome.trim() || x.cognome.trim() || x.documento.trim() || x.note.trim());
  delegati.forEach((x, i) => { if (!x.nome.trim() || !x.cognome.trim() || !x.documento.trim()) e[`delegati.${i}`] = "Nome, cognome e documento sono obbligatori"; });
  if (!delegati.length) e["delegati.0"] = "Indica almeno una persona delegata al ritiro";
  req(e, "telUrgenze", d.telUrgenze);
  req(e, "intestazione", d.intestazione);
  if (d.svcDenomPostale) req(e, "denomPostaleTesto", d.denomPostaleTesto, "Indica la denominazione aggiuntiva");
  const forwarding = [d.inoltroNome, d.inoltroVia, d.inoltroComune, d.inoltroProv, d.inoltroCap].some(v => v.trim());
  if (forwarding) {
    req(e, "inoltroNome", d.inoltroNome); req(e, "inoltroVia", d.inoltroVia); req(e, "inoltroComune", d.inoltroComune);
    if (!isProv(d.inoltroProv)) e.inoltroProv = "Sigla di 2 lettere";
    if (!isCap(d.inoltroCap)) e.inoltroCap = "CAP di 5 cifre";
  }
  if (!isEmail(d.emailScansioni)) e.emailScansioni = "Indirizzo email (non PEC) per le scansioni";
  // Allegato 2
  for (const k of ["a2Studio", "a2DomFiscale1", "a2Tel", "a2Orario"] as const) req(e, k, d[k]);
  // Allegato 3 sezione A
  for (const k of ["denominazioneForma", "indirizzoSede", "comuneSede", "rea"] as const) req(e, k, d[k]);
  if (!isCap(d.capSede)) e.capSede = "CAP di 5 cifre";
  if (!isProv(d.provSede)) e.provSede = "Sigla di 2 lettere";
  if (!isCfSocieta(normalizeTaxCode(d.cfSocieta))) e.cfSocieta = "Codice fiscale non valido";
  if (!isPartitaIva(d.pivaSocieta)) e.pivaSocieta = "Partita IVA non valida (11 cifre)";
  if (!/^\d{1,7}$/.test(d.rea.trim())) e.rea = "Numero REA (solo cifre, max 7)";
  if (!/^[0-9.]{4,12}$/.test(d.ateco.trim())) e.ateco = "Codice ATECO 2007 (es. 82.11.02)";
  validatePerson(d.rappresentante, "rappresentante", e, {});
  if (d.hasEsecutore) validatePerson(d.esecutore, "esecutore", e, { esecutore: true });
  // Sezione B
  if (!d.titolareMode) e.titolareMode = "Seleziona una delle alternative";
  if (d.titolareMode === "nessuno") req(e, "titolareNessunoMotivo", d.titolareNessunoMotivo, "La motivazione è obbligatoria");
  if (d.titolareMode === "insieme" || d.titolareMode === "altri") {
    if (!d.titolari.length) e.titolari = "Inserisci almeno un titolare effettivo";
    d.titolari.forEach((p, i) => validatePerson(p, `titolari.${i}`, e, { titolare: true }));
  }
  if (!d.confermaDati) e.confermaDati = "Conferma di aver riletto i dati";
  return e;
}

// --- server-side shape check (drafts are stored encrypted; this only guards size/type) ---------

const str = z.string().max(400);
const yn = z.enum(["", "y", "n"]);
const personSchema = z.object({
  cognome: str, nome: str, resVia: str, resCap: str, resComune: str, resProv: str, cf: str, nascLuogo: str, nascProv: str, nascData: str, cittadinanza: str,
  docTipo: str, docNumero: str, docRilascio: str, docScadenza: str, docAutorita: str, docComune: str, docProvincia: str, docStato: str,
  pep: z.enum(["", "no", "si"]), pepMotivo: str, procedimenti: yn, indagini: yn, collegato: yn, paesi: yn, quota: yn, motivoTitolare: str,
});
export const contractDataSchema = z.object({
  societa: str, sedeVia: str, sedeCitta: str, sedeCap: str, sedeProv: str, capitale: str, cfRegImp: str, piva: str, pec: str, sdi: str,
  repQualifica: str, repNome: str, repNatoA: str, repNatoIl: str, repResVia: str, repResCitta: str, repResCap: str, repResProv: str, repCf: str, repEmail: str,
  durataMesi: z.number().int().min(1).max(120), canoneEuro: z.number().min(0).max(1_000_000), dataInizio: str,
  delegati: z.array(z.object({ nome: str, cognome: str, documento: str, note: str })).max(MAX_DELEGATI),
  telUrgenze: str, intestazione: str, inoltroNome: str, inoltroVia: str, inoltroComune: str, inoltroProv: str, inoltroCap: str,
  svcLineaTel: z.boolean(), svcDenomPostale: z.boolean(), denomPostaleTesto: str, svcApertura: z.boolean(), svcArchivio: z.boolean(), svcInoltro: z.boolean(),
  emailScansioni: str, a2Studio: str, a2DomFiscale1: str, a2DomFiscale2: str, a2Luogo1: str, a2Luogo2: str, a2Tel: str, a2Orario: str, a2Chiuso: str,
  denominazioneForma: str, indirizzoSede: str, capSede: str, comuneSede: str, provSede: str, cfSocieta: str, pivaSocieta: str, rea: str, ateco: str, sae: str, rae: str,
  rappresentante: personSchema, hasEsecutore: z.boolean(), esecutore: personSchema,
  titolareMode: z.enum(["", "unico", "insieme", "altri", "nessuno"]), titolareNessunoMotivo: str, titolari: z.array(personSchema).max(MAX_TITOLARI),
  confermaDati: z.boolean(),
});
