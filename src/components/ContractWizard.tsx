"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CircleHelp, Download, FileCheck2, FileText, Info, LoaderCircle, Plus, Trash2, Upload } from "lucide-react";
import { MAX_DELEGATI, MAX_TITOLARI, dayIso, derivedFromParties, emptyPerson, validateContract, type ContractData, type FieldErrors, type Person, type YesNo } from "@/lib/contract-data";
import { ContractInstructions, type InstructionTab } from "./ContractInstructions";

type Draft = { data: ContractData; conditionsReady: boolean; saved: boolean; completedAt: string | null; signedAt: string | null; adminDocAt: string | null };
type FieldOpts = { min?: string; max?: string; help?: ReactNode; type?: string; placeholder?: string; upper?: boolean; digits?: boolean; maxLength?: number; span?: 1 | 2 | 3; required?: boolean; list?: string[] };

// --- path helpers (answers are edited by "a.b.0.c" paths so one input component fits every field) -----
function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), obj);
}
function setPath<T>(obj: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split(".");
  const clone: unknown = Array.isArray(obj) ? [...obj] : { ...(obj as object) };
  (clone as Record<string, unknown>)[head] = rest.length ? setPath((obj as Record<string, unknown>)[head], rest.join("."), value) : value;
  return clone as T;
}

const STEPS = [
  { id: "intro", title: "Come funziona", match: () => false },
  { id: "societa", title: "La società", match: (k: string) => ["societa", "sedeVia", "sedeCitta", "sedeCap", "sedeProv", "capitale", "cfRegImp", "piva", "pec", "sdi"].includes(k) },
  { id: "rappresentante", title: "Il rappresentante", match: (k: string) => /^rep[A-Z]/.test(k) },
  { id: "allegato1", title: "Allegato 1 · Ritiro posta", match: (k: string) => k.startsWith("delegati") || ["telUrgenze", "intestazione", "denomPostaleTesto", "emailScansioni"].includes(k) || k.startsWith("inoltro") },
  { id: "allegato2", title: "Allegato 2 · Scritture contabili", match: (k: string) => k.startsWith("a2") },
  { id: "societaAV", title: "Allegato 3 · La società", match: (k: string) => ["denominazioneForma", "indirizzoSede", "capSede", "comuneSede", "provSede", "cfSocieta", "pivaSocieta", "rea", "ateco", "sae", "rae"].includes(k) },
  { id: "rapAV", title: "Allegato 3 · Legale rappresentante", match: (k: string) => k.startsWith("rappresentante.") },
  { id: "esecutore", title: "Allegato 3 · Esecutore", match: (k: string) => k.startsWith("esecutore.") },
  { id: "titolare", title: "Allegato 3 · Titolare effettivo", match: (k: string) => k.startsWith("titolar") },
  { id: "riepilogo", title: "Riepilogo e PDF", match: (k: string) => k === "confermaDati" },
] as const;
const AV_FIRST_STEP = 5; // first step of the adeguata verifica (Allegato 3)

type Uploaded = { name: string | null; at: string };
const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** One "choose file → see its name → CARICA" row; a green check marks a file that was uploaded correctly. */
function UploadRow({ title, hint, accept, pickLabel, file, done, busy, canUpload, flag, onPick, onUpload }: {
  title: string; hint: ReactNode; accept: string; pickLabel: string; file: File | null; done: Uploaded | null; busy: boolean; canUpload: boolean;
  flag?: ReactNode; onPick: (f: File | null) => void; onUpload: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="cw-up">
      <h4>{title}</h4>
      <p>{hint}</p>
      <div className="cw-up-row">
        <div className="cw-up-left">
          <input ref={input} type="file" accept={accept} hidden onChange={e => { onPick(e.target.files?.[0] ?? null); e.target.value = ""; }} />
          <button type="button" className="button" disabled={busy} onClick={() => input.current?.click()}><Upload aria-hidden="true" />{pickLabel}</button>
          <div className="cw-up-file" aria-live="polite">
            {file ? <><FileText aria-hidden="true" /><b>{file.name}</b><small>{fmtSize(file.size)} · pronto per il caricamento</small></>
              : done ? <><span className="cw-up-ok" role="img" aria-label="Caricato correttamente"><Check aria-hidden="true" /></span><b>{done.name ?? "File caricato"}</b><small>caricato il {new Date(done.at).toLocaleDateString("it-IT")}</small></>
              : <small>Nessun file selezionato</small>}
          </div>
          {flag}
        </div>
        <button type="button" className="button primary cw-up-go" disabled={!canUpload || busy} onClick={onUpload}>{busy ? <LoaderCircle className="spin" aria-hidden="true" /> : null}CARICA</button>
      </div>
    </div>
  );
}

/** Reminder shown right before the contract PDF is downloaded. */
function ReadConfirmDialog({ open, aggiuntiva, onCancel, onConfirm }: { open: boolean; aggiuntiva: boolean; onCancel: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="standard-offer-dialog cw-confirm" aria-labelledby="cw-confirm-title" onCancel={e => { e.preventDefault(); onCancel(); }}>
      <h3 id="cw-confirm-title"><AlertTriangle aria-hidden="true" /> Leggi attentamente il contratto</h3>
      <p>Stai per scaricare il <b>contratto completo</b>. Prima di stamparlo e firmarlo ti chiediamo di <b>leggere con attenzione tutte le clausole</b>, compresi gli allegati e l’informativa sulla privacy.</p>
      <p>In particolare le clausole <b>{aggiuntiva ? "3, 4.1, 4.9, 4.11, 4.13, 4.14, 7, 8, 10, 11, 14, 16, 18, 19 e 20" : "3, 4.1, 4.9, 4.11, 4.13, 4.14, 7, 8, 10, 11, 16, 18, 19 e 20"}</b> vanno approvate specificamente con una seconda firma (art. 1341 c.c., pagina 6). Con la tua firma dichiari di averne compreso e accettato l’intero contenuto.</p>
      <div className="cw-confirm-actions">
        <button type="button" className="button" onClick={onCancel}>Annulla</button>
        <button type="button" className="button primary" onClick={onConfirm}><Download aria-hidden="true" />Ho capito, scarica il PDF</button>
      </div>
    </dialog>
  );
}

function HelpTip({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <span className="cw-help" ref={ref}>
      <button type="button" className="cw-help-btn" aria-label="Mostra aiuto" aria-expanded={open} onClick={() => { const r = ref.current?.getBoundingClientRect(); setAlignRight(!!r && r.left + 320 > window.innerWidth); setOpen(o => !o); }}><CircleHelp aria-hidden="true" /></button>
      {open && <span className="cw-help-pop" role="note" style={alignRight ? { left: "auto", right: "-.5rem" } : undefined}>{children}</span>}
    </span>
  );
}

function Banner({ tone = "info", children }: { tone?: "info" | "warn" | "ok"; children: ReactNode }) {
  return <div className={`cw-banner ${tone}`}>{tone === "warn" ? <AlertTriangle aria-hidden="true" /> : tone === "ok" ? <Check aria-hidden="true" /> : <Info aria-hidden="true" />}<div>{children}</div></div>;
}

export function ContractWizard({ onSessionExpired: onExpired }: { onSessionExpired: () => void }) {
  // Held in a ref so a parent re-render never re-runs the load/autosave effects below.
  const expiredRef = useRef(onExpired);
  useEffect(() => { expiredRef.current = onExpired; });
  const onSessionExpired = useCallback(() => expiredRef.current(), []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [data, setData] = useState<ContractData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [step, setStep] = useState(0);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [attempted, setAttempted] = useState<Set<number>>(new Set());
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [instr, setInstr] = useState<{ open: boolean; tab: InstructionTab }>({ open: false, tab: "titolare" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [signedDone, setSignedDone] = useState<Uploaded | null>(null);
  const [adminDone, setAdminDone] = useState<Uploaded | null>(null);
  const [signedFile, setSignedFile] = useState<File | null>(null);
  const [adminFile, setAdminFile] = useState<File | null>(null);
  const [readFlag, setReadFlag] = useState(false);
  const [uploading, setUploading] = useState<"signed" | "admin" | null>(null);
  const [readOpen, setReadOpen] = useState(false);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const dirty = useRef(false);
  const instrSeen = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/customer/contract/draft", { cache: "no-store" });
        if (r.status === 401) { onSessionExpired(); return; }
        if (!r.ok) throw new Error();
        const d: Draft = await r.json();
        setDraft(d); setData(d.data); setSignedDone(d.signedAt ? { name: null, at: d.signedAt } : null); setAdminDone(d.adminDocAt ? { name: null, at: d.adminDocAt } : null); setCompletedAt(d.completedAt);
      } catch { setLoadError("Non riusciamo a caricare il modulo. Riprova tra poco."); }
    })();
  }, [onSessionExpired]);

  // Autosave (debounced): the customer can leave and come back to the same draft.
  useEffect(() => {
    if (!data || !dirty.current) return;
    setSaveState("saving");
    const t = setTimeout(async () => {
      try {
        const r = await fetch("/api/customer/contract/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data }) });
        if (r.status === 401) { onSessionExpired(); return; }
        if (!r.ok) throw new Error();
        dirty.current = false; setSaveState("saved"); setSavedAt(new Date()); setCompletedAt(null);
      } catch { setSaveState("error"); }
    }, 1200);
    return () => clearTimeout(t);
  }, [data, onSessionExpired]);

  const errors: FieldErrors = useMemo(() => (data ? validateContract(data) : {}), [data]);
  const stepErrors = useCallback((i: number) => Object.keys(errors).filter(k => STEPS[i].match(k)), [errors]);

  const update = useCallback((path: string, value: unknown) => {
    dirty.current = true;
    setData(prev => (prev ? setPath(prev, path, value) : prev));
  }, []);
  const patch = useCallback((p: Partial<ContractData>) => { dirty.current = true; setData(prev => (prev ? { ...prev, ...p } : prev)); }, []);

  function go(next: number) {
    if (!data) return;
    if (next >= AV_FIRST_STEP && step < AV_FIRST_STEP) {
      patch(derivedFromParties(data)); // carries company/representative answers into Allegato 3
      if (!instrSeen.current) { instrSeen.current = true; setInstr({ open: true, tab: "titolare" }); }
    }
    setStep(next);
    setMessage(null);
    requestAnimationFrame(() => root.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }
  function next() {
    const bad = stepErrors(step);
    if (bad.length) { setAttempted(a => new Set(a).add(step)); setMessage({ tone: "warn", text: `Completa i campi evidenziati (${bad.length}) per proseguire.` }); return; }
    go(Math.min(step + 1, STEPS.length - 1));
  }

  const showErr = (path: string) => (attempted.has(step) || touched.has(path)) ? errors[path] : undefined;

  // --- field renderers ---------------------------------------------------------------------------
  function F(path: string, label: string, o: FieldOpts = {}) {
    const raw = getPath(data, path);
    const value = typeof raw === "string" ? raw : "";
    const err = showErr(path);
    const id = `cw-${path.replace(/\./g, "-")}`;
    return (
      <div className={`cw-field span${o.span ?? 1}${err ? " has-error" : ""}`} key={path}>
        <label htmlFor={id}>{label}{o.required !== false && <abbr title="Obbligatorio">*</abbr>}{o.help && <HelpTip>{o.help}</HelpTip>}</label>
        <input id={id} type={o.type ?? "text"} value={value} placeholder={o.placeholder} maxLength={o.maxLength ?? 120} min={o.min} max={o.max} list={o.list ? `${id}-list` : undefined}
          autoComplete="off" aria-invalid={!!err} aria-describedby={err ? `${id}-err` : undefined}
          onChange={e => { let v = e.target.value; if (o.upper) v = v.toUpperCase(); if (o.digits) v = v.replace(/\D/g, ""); update(path, v); }}
          onBlur={() => setTouched(t => new Set(t).add(path))} />
        {o.list && <datalist id={`${id}-list`}>{o.list.map(x => <option key={x} value={x} />)}</datalist>}
        {err && <p className="cw-err" id={`${id}-err`} role="alert">{err}</p>}
      </div>
    );
  }
  function Check1(path: string, label: ReactNode, help?: ReactNode) {
    const checked = Boolean(getPath(data, path));
    return (
      <label className="cw-check" key={path}>
        <input type="checkbox" checked={checked} onChange={e => update(path, e.target.checked)} />
        <span>{label}</span>{help && <HelpTip>{help}</HelpTip>}
      </label>
    );
  }
  function Radios<V extends string>(path: string, options: { value: V; label: ReactNode }[], legend: ReactNode, help?: ReactNode) {
    const current = getPath(data, path) as string;
    const err = showErr(path);
    return (
      <fieldset className={`cw-radios${err ? " has-error" : ""}`} key={path}>
        <legend>{legend}{help}</legend>
        <div className="cw-radio-row">
          {options.map(op => (
            <label key={op.value} className={current === op.value ? "on" : ""}>
              <input type="radio" name={path} checked={current === op.value} onChange={() => update(path, op.value)} onBlur={() => setTouched(t => new Set(t).add(path))} />
              <span>{op.label}</span>
            </label>
          ))}
        </div>
        {err && <p className="cw-err" role="alert">{err}</p>}
      </fieldset>
    );
  }
  const openInstr = (tab: InstructionTab) => <button type="button" className="cw-linkbtn" onClick={() => setInstr({ open: true, tab })}><Info aria-hidden="true" /> Leggi le istruzioni</button>;

  function declaration(prefix: string, key: "procedimenti" | "indagini" | "collegato" | "paesi" | "quota", yes: string, no: string, text: string, tab?: InstructionTab) {
    return Radios<YesNo>(`${prefix}.${key}`, [{ value: "y", label: yes }, { value: "n", label: no }], <>{text}{tab && <> {openInstr(tab)}</>}</>);
  }

  function personForm(prefix: string, who: "rappresentante" | "esecutore" | "titolare") {
    const declCount = who === "esecutore" ? 3 : 5;
    return (
      <div className="cw-grid">
        {F(`${prefix}.cognome`, "Cognome")}{F(`${prefix}.nome`, "Nome")}
        {F(`${prefix}.resVia`, "Indirizzo di residenza", { span: 2, placeholder: "Via/Piazza e numero civico" })}
        {F(`${prefix}.resCap`, "CAP", { digits: true, maxLength: 5 })}{F(`${prefix}.resComune`, "Comune di residenza", { span: 2 })}
        {F(`${prefix}.resProv`, "Provincia", { upper: true, maxLength: 2, placeholder: "RM" })}
        {F(`${prefix}.cf`, "Codice fiscale", { upper: true, maxLength: 16, help: "16 caratteri, come riportato sulla tessera sanitaria. Viene controllato automaticamente." })}
        {F(`${prefix}.nascLuogo`, "Luogo di nascita", { span: 2 })}
        {F(`${prefix}.nascProv`, "Prov. di nascita", { upper: true, maxLength: 2, placeholder: "RM", help: "Sigla della provincia. Se sei nato all’estero scrivi EE." })}
        {F(`${prefix}.nascData`, "Data di nascita", { type: "date", max: dayIso(-1), min: "1900-01-01" })}{F(`${prefix}.cittadinanza`, "Cittadinanza")}
        {F(`${prefix}.docTipo`, "Tipo documento di identificazione", { span: 2, list: ["Carta d’identità", "Passaporto", "Patente di guida"], help: "Documento in corso di validità. Ne dovrai allegare una fotocopia insieme al contratto firmato." })}
        {F(`${prefix}.docNumero`, "N° documento", { upper: true, maxLength: 22, help: "Il numero stampato sul documento, senza spazi (max 22 caratteri)." })}
        {F(`${prefix}.docRilascio`, "Data di rilascio", { type: "date", max: dayIso(-1), help: "Deve essere antecedente a oggi." })}{F(`${prefix}.docScadenza`, "Data di scadenza", { type: "date", min: dayIso(1), help: "Deve essere successiva a oggi: il documento deve essere in corso di validità." })}
        {F(`${prefix}.docAutorita`, "Autorità emittente", { span: 3, placeholder: "es. Comune di Roma, Questura di Roma, Motorizzazione" })}
        {F(`${prefix}.docComune`, "Comune dell’autorità", { span: 2, required: false, help: "Compila comune e provincia per le autorità italiane, oppure solo lo stato per le autorità straniere." })}
        {F(`${prefix}.docProvincia`, "Provincia", { upper: true, maxLength: 2, required: false })}
        {F(`${prefix}.docStato`, "Stato (solo autorità estere)", { span: 3, required: false })}
        {who === "titolare" && F(`${prefix}.motivoTitolare`, "Motivo per cui risulta titolare effettivo", { span: 3, placeholder: "es. Socio con il 60% del capitale sociale", help: <>Ad esempio: detiene più del 25% del capitale, controlla la maggioranza dei voti, amministra la società. {openInstr("titolare")}</> })}
        <div className="cw-field span3">
          {Radios<"no" | "si">(`${prefix}.pep`, [{ value: "no", label: "No" }, { value: "si", label: "Sì" }], <>È una Persona Politicamente Esposta (P.E.P.)? {openInstr("pep")}</>)}
          {getPath(data, `${prefix}.pep`) === "si" && <div className="cw-grid inner">{F(`${prefix}.pepMotivo`, "In quanto…", { span: 3, placeholder: "Carica ricoperta o legami con la persona titolare della carica" })}</div>}
        </div>
        <div className="cw-field span3 cw-declarations">
          <h4>Dichiara inoltre {who === "esecutore" ? "che l’esecutore" : who === "titolare" ? "che il titolare effettivo" : "di"}</h4>
          {declaration(prefix, "procedimenti", who === "rappresentante" ? "di avere" : "ha", who === "rappresentante" ? "di non avere" : "non ha", "subito procedimenti per reati legati al riciclaggio o al finanziamento del terrorismo")}
          {declaration(prefix, "indagini", who === "rappresentante" ? "di essere" : "è", who === "rappresentante" ? "di non essere" : "non è", "a conoscenza di indagini in corso a proprio carico per reati legati al riciclaggio o al finanziamento del terrorismo")}
          {declaration(prefix, "collegato", who === "rappresentante" ? "di essere" : "è", who === "rappresentante" ? "di non essere" : "non è", "collegato, direttamente o indirettamente, o di operare per conto di soggetti sottoposti a procedimenti penali o a misure di prevenzione patrimoniale o ad altri provvedimenti di sequestro, ovvero con persone politicamente esposte o con soggetti censiti nelle liste pubbliche delle persone o degli enti coinvolti nel finanziamento del terrorismo", "pep")}
          {declCount > 3 && declaration(prefix, "paesi", who === "rappresentante" ? "di operare" : "opera", who === "rappresentante" ? "di non operare" : "non opera", "con controparti situate in uno dei Paesi o territori elencati nella nota (1) dell’Allegato", "paesi")}
          {declCount > 3 && declaration(prefix, "quota", who === "rappresentante" ? "di avere" : "ha", who === "rappresentante" ? "di non avere" : "non ha", "versato il 25% della propria quota di partecipazione al capitale sociale avvalendosi di un intermediario situato in uno dei Paesi o territori elencati nella nota (1) dell’Allegato", "paesi")}
        </div>
      </div>
    );
  }

  // --- generate / upload ---------------------------------------------------------------------------
  async function generate() {
    if (!data) return;
    const bad = Object.keys(errors);
    if (bad.length) { setAttempted(new Set(STEPS.map((_, i) => i))); setMessage({ tone: "warn", text: bad.length === 1 && bad[0] === "confermaDati" ? "Spunta la dichiarazione di correttezza dei dati per poter scaricare il contratto." : `Mancano ${bad.length} ${bad.length === 1 ? "campo" : "campi"}: trovi l’elenco qui sotto.` }); return; }
    setBusy(true); setMessage(null);
    try {
      await flushSave();
      const tpl = await fetch("/api/customer/contract/template", { cache: "no-store" });
      if (tpl.status === 401) { onSessionExpired(); return; }
      if (!tpl.ok) throw new Error();
      const { buildContractPdf } = await import("@/lib/contract-pdf");
      const bytes = await buildContractPdf(await tpl.arrayBuffer(), data);
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
      const a = document.createElement("a"); a.href = url; a.download = `contratto-domiciliazione-${data.societa.replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase()}.pdf`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      await fetch("/api/customer/contract/completed", { method: "POST" });
      setCompletedAt(new Date().toISOString());
      setMessage({ tone: "ok", text: "Il PDF è stato scaricato. Stampalo, firmalo in ogni punto indicato e ricaricalo qui sotto." });
    } catch { setMessage({ tone: "warn", text: "Non siamo riusciti a generare il PDF. Riprova tra poco." }); }
    finally { setBusy(false); }
  }
  async function flushSave() {
    if (!data || !dirty.current) return;
    const r = await fetch("/api/customer/contract/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data }) });
    if (!r.ok) throw new Error();
    dirty.current = false; setSavedAt(new Date()); setSaveState("saved");
  }
  function pickFile(kind: "signed" | "admin", file: File | null) {
    if (!file) return;
    const name = file.name.toLowerCase();
    const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
    const isImage = /^image\/(jpeg|png)$/.test(file.type) || /\.(jpe?g|png)$/.test(name);
    if (kind === "signed" && !isPdf) { setMessage({ tone: "warn", text: "Il contratto firmato va caricato in formato PDF (puoi scansionarlo con il telefono)." }); return; }
    if (kind === "admin" && !isPdf && !isImage) { setMessage({ tone: "warn", text: "Il documento va caricato in PDF oppure come foto (JPG o PNG)." }); return; }
    const max = kind === "signed" ? 20 : 10;
    if (file.size > max * 1024 * 1024) { setMessage({ tone: "warn", text: `Il file supera i ${max} MB: riduci la risoluzione della scansione.` }); return; }
    setMessage(null);
    if (kind === "signed") { setSignedFile(file); setReadFlag(false); } else setAdminFile(file);
  }
  async function upload(kind: "signed" | "admin") {
    const file = kind === "signed" ? signedFile : adminFile;
    if (!file) return;
    setUploading(kind); setMessage(null);
    try {
      const form = new FormData(); form.set("file", file);
      const r = await fetch(kind === "signed" ? "/api/customer/contract/signed" : "/api/customer/contract/admin-doc", { method: "POST", body: form });
      if (r.status === 401) { onSessionExpired(); return; }
      if (!r.ok) throw new Error();
      const done = { name: file.name, at: new Date().toISOString() };
      if (kind === "signed") { setSignedDone(done); setSignedFile(null); setReadFlag(false); } else { setAdminDone(done); setAdminFile(null); }
      setMessage({ tone: "ok", text: kind === "signed" ? "Contratto ricevuto. La reception lo controllerà, aggiungerà la firma del domiciliatario e lo pubblicherà qui nell’area clienti." : "Documento dell’amministratore ricevuto." });
    } catch { setMessage({ tone: "warn", text: "Caricamento non riuscito. Controlla che il file sia valido e riprova." }); }
    finally { setUploading(null); }
  }
  function requestDownload() {
    if (Object.keys(errors).length) { void generate(); return; } // shows what is still missing
    setReadOpen(true);
  }

  // --- render ----------------------------------------------------------------------------------------
  if (loadError) return <Banner tone="warn">{loadError}</Banner>;
  if (!draft || !data) return <div className="customer-loading" role="status"><LoaderCircle className="spin" />Caricamento del modulo…</div>;
  if (!draft.conditionsReady) return <Banner tone="info"><b>Il contratto online non è ancora disponibile.</b> La reception deve prima completare le condizioni della tua domiciliazione (durata, decorrenza e canone). Ti contatteremo appena è pronto.</Banner>;

  const fmtEur = (n: number) => n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const dmy = (iso: string) => iso.split("-").reverse().join("/");
  const pct = Math.round((step / (STEPS.length - 1)) * 100);

  let body: ReactNode = null;
  switch (STEPS[step].id) {
    case "intro":
      body = <>
        <p className="cw-lead">Compila online il <b>Contratto di domiciliazione sede legale{data.aggiuntiva ? " (domiciliazione aggiuntiva)" : ""}</b> completo di allegati e adeguata verifica antiriciclaggio. Il sistema controlla i campi obbligatori e prepara il PDF già compilato.</p>
        <ol className="cw-phases">
          <li><b>Compila</b> i dati in 8 brevi passaggi. Le risposte si salvano da sole: puoi interrompere e riprendere quando vuoi.</li>
          <li><b>Scarica</b> il PDF compilato, <b>stampalo</b> e <b>firmalo</b> nei punti indicati (allega la fotocopia dei documenti d’identità).</li>
          <li><b>Ricaricalo</b> qui, in PDF.</li>
          <li>La reception aggiunge la sua firma e <b>pubblica il contratto completo</b> in quest’area.</li>
        </ol>
        <div className="cw-summary">
          <h4>Condizioni del servizio (fissate dalla reception)</h4>
          <dl><div><dt>Durata</dt><dd>{data.durataMesi} mesi</dd></div><div><dt>Decorrenza</dt><dd>{dmy(data.dataInizio)}</dd></div><div><dt>Canone al prossimo rinnovo</dt><dd>€ {fmtEur(data.canoneEuro)} + IVA</dd></div></dl>
        </div>
        <Banner>In ogni campo trovi il simbolo <b>?</b> in un cerchio: cliccalo per leggere spiegazioni ed esempi. Per le sezioni sull’antiriciclaggio ci sono anche le istruzioni complete.</Banner>
        {draft.saved && <Banner tone="ok">Hai già una bozza salvata: riprendi da dove avevi lasciato.</Banner>}
      </>;
      break;
    case "societa":
      body = <div className="cw-grid">
        {F("societa", "Ragione sociale", { span: 3, help: "Denominazione completa con forma giuridica, come risulta dalla visura camerale (es. ACME Servizi S.r.l.)." })}
        {F("sedeVia", "Sede legale: via e numero", { span: 2, help: "Indirizzo della sede legale attuale della società (non quello di Via Venti Settembre)." })}
        {F("sedeCap", "CAP", { digits: true, maxLength: 5 })}{F("sedeCitta", "Città", { span: 2 })}{F("sedeProv", "Provincia", { upper: true, maxLength: 2, placeholder: "RM" })}
        {F("capitale", "Capitale sociale (€)", { placeholder: "10.000,00", help: "Capitale sociale sottoscritto, come da visura camerale." })}
        {F("cfRegImp", "Codice fiscale e Reg. Imprese", { upper: true, maxLength: 16, help: "Il codice fiscale della società (di norma coincide con la partita IVA e con il numero di iscrizione al Registro Imprese)." })}
        {F("piva", "Partita IVA", { digits: true, maxLength: 11, help: "11 cifre. Viene verificato il codice di controllo." })}
        {F("pec", "Email PEC", { type: "email", span: 2, help: "La PEC della società iscritta al Registro Imprese: è l’indirizzo a cui inviamo le comunicazioni legali." })}
        {F("sdi", "Codice SDI", { upper: true, maxLength: 7, placeholder: "0000000", help: "Codice destinatario per la fatturazione elettronica (7 caratteri). Se ricevi le fatture sulla PEC scrivi 0000000." })}
      </div>;
      break;
    case "rappresentante":
      body = <div className="cw-grid">
        {F("repQualifica", "In qualità di", { span: 2, list: ["Amministratore unico", "Presidente del CdA", "Amministratore delegato", "Liquidatore", "Legale rappresentante"], help: "La carica con cui firmi per la società (Presidente, Amministratore unico, Liquidatore…)." })}
        {F("repNome", "Nome e cognome", { span: 3, help: "Del legale rappresentante munito dei necessari poteri." })}
        {F("repNatoA", "Nato a", { span: 2 })}{F("repNatoIl", "Nato il", { type: "date", max: dayIso(-1), min: "1900-01-01" })}
        {F("repResVia", "Residente in via", { span: 2 })}{F("repResCap", "CAP", { digits: true, maxLength: 5 })}
        {F("repResCitta", "Città", { span: 2 })}{F("repResProv", "Provincia", { upper: true, maxLength: 2, placeholder: "RM" })}
        {F("repCf", "Codice fiscale", { upper: true, maxLength: 16 })}{F("repEmail", "Email", { type: "email", span: 2 })}
      </div>;
      break;
    case "allegato1":
      body = <>
        <h4 className="cw-sub">Persone delegate al ritiro di atti e corrispondenza <HelpTip>Chi può presentarsi in reception a ritirare la posta per conto della società. Fino a {MAX_DELEGATI} persone, con un documento di identità.</HelpTip></h4>
        {data.delegati.map((_, i) => (
          <div className="cw-delegato" key={i}>
            <div className="cw-grid">
              {F(`delegati.${i}.nome`, "Nome", { required: false })}{F(`delegati.${i}.cognome`, "Cognome", { required: false })}
              {F(`delegati.${i}.documento`, "N. documento e tipo", { required: false, placeholder: "CI AY1234567" })}{F(`delegati.${i}.note`, "Note / n. telefonico", { required: false, span: 3 })}
            </div>
            {errors[`delegati.${i}`] && (attempted.has(step) || touched.has(`delegati.${i}.nome`)) && <p className="cw-err" role="alert">{errors[`delegati.${i}`]}</p>}
            {data.delegati.length > 1 && <button type="button" className="cw-linkbtn danger" onClick={() => update("delegati", data.delegati.filter((_, j) => j !== i))}><Trash2 aria-hidden="true" /> Rimuovi</button>}
          </div>
        ))}
        {data.delegati.length < MAX_DELEGATI && <button type="button" className="cw-linkbtn" onClick={() => update("delegati", [...data.delegati, { nome: "", cognome: "", documento: "", note: "" }])}><Plus aria-hidden="true" /> Aggiungi una persona</button>}
        <div className="cw-grid cw-gap">
          {F("telUrgenze", "Telefono per comunicazioni urgenti", { type: "tel", help: "Numero (meglio un cellulare) su cui contattarti in caso di atti urgenti o verifiche." })}
          {F("intestazione", "Intestazione della corrispondenza", { span: 2, help: "Come devono essere intestate le buste: ragione sociale ed eventuale acronimo (es. “ACME Servizi S.r.l. – ACME”)." })}
        </div>
        <h4 className="cw-sub">Indirizzo cui inoltrare la corrispondenza in giacenza <small>(facoltativo)</small> <HelpTip>Se non ritiri la posta, la inoltriamo a questo indirizzo con spese a tuo carico. Lascia vuoto se non serve.</HelpTip></h4>
        <div className="cw-grid">
          {F("inoltroNome", "Nome e cognome o ragione sociale", { span: 3, required: false })}
          {F("inoltroVia", "Via/Piazza", { span: 3, required: false })}
          {F("inoltroComune", "Comune", { span: 2, required: false })}{F("inoltroProv", "Prov.", { upper: true, maxLength: 2, required: false })}{F("inoltroCap", "CAP", { digits: true, maxLength: 5, required: false })}
        </div>
        <h4 className="cw-sub">Servizi accessori <small>(facoltativi)</small></h4>
        <div className="cw-checks">
          {Check1("svcLineaTel", <><b>Linea telefonica dedicata</b> con risposta a nome della società — 40 €/mese + IVA</>, "Include solo la risposta telefonica con invio via email dei riferimenti di chi ha chiamato.")}
          {Check1("svcDenomPostale", <><b>Denominazione postale aggiuntiva</b> — 10 €/mese + IVA</>, "Una denominazione alternativa (ad esempio il nome dell’amministratore) con cui ricevere posta. Massimo 2.")}
          {data.svcDenomPostale && <div className="cw-grid inner">{F("denomPostaleTesto", "Denominazione aggiuntiva", { span: 3 })}</div>}
          {Check1("svcApertura", <><b>Apertura corrispondenza</b> oltre le 10 mensili incluse — 1,50 € l’una + IVA (a consuntivo)</>)}
          {Check1("svcArchivio", <><b>Servizio archivio documentazione</b> (max 5 faldoni) — 8 €/mese per faldone + IVA (a consuntivo)</>)}
          {Check1("svcInoltro", <><b>Inoltro pacchi e corrispondenza</b> tramite corriere — costo di spedizione + 10 € di gestione + IVA (a consuntivo)</>)}
        </div>
        <div className="cw-grid cw-gap">
          {F("emailScansioni", "Email per le scansioni della posta (NON PEC)", { type: "email", span: 3, help: "Qui riceverai, entro 24 ore lavorative, la scansione delle buste chiuse. Usa un indirizzo di posta ordinaria, non una PEC." })}
        </div>
      </>;
      break;
    case "allegato2":
      body = <>
        <Banner>Dichiarazione ai sensi dell’art. 52, 10° comma, D.P.R. 633/1972: indica dove sono <b>tenute le scritture contabili</b> della società (di norma lo studio del commercialista).</Banner>
        <div className="cw-grid">
          {F("a2Studio", "Presso lo studio (intestazione)", { span: 3, help: "Denominazione dello studio o della società che tiene la contabilità." })}
          {F("a2DomFiscale1", "Domicilio fiscale dello studio", { span: 3, placeholder: "Via, numero civico, CAP, città" })}
          {F("a2DomFiscale2", "Domicilio fiscale (seconda riga)", { span: 3, required: false })}
          {F("a2Luogo1", "Luogo attività (se diverso dal domicilio fiscale)", { span: 3, required: false })}
          {F("a2Luogo2", "Luogo attività (seconda riga)", { span: 3, required: false })}
          {F("a2Tel", "Contatti telefonici", { span: 3 })}
          {F("a2Orario", "Orario di lavoro", { span: 2, placeholder: "9-13 / 15-18" })}{F("a2Chiuso", "Giorno di chiusura", { required: false, placeholder: "sabato e domenica" })}
        </div>
      </>;
      break;
    case "societaAV":
      body = <>
        <Banner>Dichiarazione antiriciclaggio (D.Lgs. 231/2007). Qui sotto la <b>sezione A: dati identificativi della società</b>. Abbiamo già ricopiato i dati inseriti prima: controllali. {openInstr("titolare")}</Banner>
        <div className="cw-grid">
          {F("denominazioneForma", "Denominazione/ragione sociale e forma giuridica", { span: 3 })}
          {F("indirizzoSede", "Indirizzo sede legale", { span: 3 })}
          {F("capSede", "CAP", { digits: true, maxLength: 5 })}{F("comuneSede", "Comune", { span: 2 })}{F("provSede", "Provincia", { upper: true, maxLength: 2 })}
          {F("cfSocieta", "Codice fiscale", { upper: true, maxLength: 16 })}{F("pivaSocieta", "Partita IVA", { digits: true, maxLength: 11 })}
          {F("rea", "R.E.A. (solo numero)", { digits: true, maxLength: 7, help: "Numero REA riportato in visura camerale, senza la sigla della provincia (es. RM-1406493 → 1406493)." })}
          {F("ateco", "Codice ATECO 2007", { maxLength: 12, placeholder: "82.11.02", help: "Codice dell’attività prevalente, riportato in visura (es. 82.11.02). Si può inserire con i punti." })}
          {F("sae", "SAE", { digits: true, maxLength: 6, required: false, help: "Settore di attività economica (codice Banca d’Italia). Facoltativo se non lo conosci: lo trovi nei documenti bancari." })}
          {F("rae", "RAE", { digits: true, maxLength: 5, required: false, help: "Ramo di attività economica (codice Banca d’Italia). Facoltativo." })}
        </div>
      </>;
      break;
    case "rapAV":
      body = <>
        <Banner>Dati del <b>legale rappresentante</b> che firma la dichiarazione. Ricorda di allegare al contratto una fotocopia del documento di identità in corso di validità e del codice fiscale.</Banner>
        {personForm("rappresentante", "rappresentante")}
      </>;
      break;
    case "esecutore":
      body = <>
        <Banner>L’<b>esecutore</b> è un eventuale delegato che opera in nome e per conto della società (ad esempio un procuratore). Se agisce solo il legale rappresentante, scegli “No”.</Banner>
        <fieldset className="cw-radios">
          <legend>Esiste un esecutore delegato?</legend>
          <div className="cw-radio-row">
            <label className={!data.hasEsecutore ? "on" : ""}><input type="radio" name="hasEsecutore" checked={!data.hasEsecutore} onChange={() => update("hasEsecutore", false)} /><span>No, non c’è un esecutore</span></label>
            <label className={data.hasEsecutore ? "on" : ""}><input type="radio" name="hasEsecutore" checked={data.hasEsecutore} onChange={() => update("hasEsecutore", true)} /><span>Sì, c’è un esecutore</span></label>
          </div>
        </fieldset>
        {data.hasEsecutore && personForm("esecutore", "esecutore")}
      </>;
      break;
    case "titolare":
      body = <>
        <Banner>Sezione B: <b>titolare effettivo</b> della società. {openInstr("titolare")}</Banner>
        {Radios<"unico" | "insieme" | "altri" | "nessuno">("titolareMode", [
          { value: "unico", label: "Sono l’unico titolare effettivo dell’impresa/società" },
          { value: "insieme", label: "Sono titolare effettivo unitamente ad altri soggetti (da indicare)" },
          { value: "altri", label: "Non sono il titolare effettivo: lo sono i soggetti da indicare" },
          { value: "nessuno", label: "Non esiste un titolare effettivo (motivazione obbligatoria)" },
        ], "Seleziona una delle alternative", <HelpTip>Titolare effettivo: la persona fisica che possiede o controlla la società (oltre il 25% del capitale o dei voti). Se nessun socio supera il 25%, chi la controlla o la amministra.</HelpTip>)}
        {data.titolareMode === "nessuno" && <div className="cw-grid">{F("titolareNessunoMotivo", "Motivazione", { span: 3, help: "Spiega perché non è individuabile alcun titolare effettivo (es. società a partecipazione pubblica)." })}</div>}
        {(data.titolareMode === "insieme" || data.titolareMode === "altri") && <>
          {data.titolari.map((_, i) => (
            <fieldset className="cw-person" key={i}>
              <legend>Titolare effettivo {i + 1}</legend>
              {personForm(`titolari.${i}`, "titolare")}
              <button type="button" className="cw-linkbtn danger" onClick={() => update("titolari", data.titolari.filter((_, j) => j !== i))}><Trash2 aria-hidden="true" /> Rimuovi questo titolare effettivo</button>
            </fieldset>
          ))}
          {errors.titolari && attempted.has(step) && <p className="cw-err" role="alert">{errors.titolari}</p>}
          {data.titolari.length < MAX_TITOLARI && <button type="button" className="cw-linkbtn" onClick={() => update("titolari", [...data.titolari, emptyPerson()])}><Plus aria-hidden="true" /> Aggiungi un titolare effettivo</button>}
        </>}
        <p className="cw-note">Sezione C — Il rapporto è relativo a forniture di beni, servizi, prestazioni professionali: <b>Domiciliazione Sede Legale</b> (già indicato nel contratto).</p>
      </>;
      break;
    case "riepilogo": {
      const all = Object.keys(errors).filter(k => k !== "confermaDati");
      const groups = STEPS.map((s, i) => ({ i, title: s.title, keys: all.filter(k => s.match(k)) })).filter(g => g.keys.length);
      body = <>
        <div className="cw-summary">
          <h4>Riepilogo</h4>
          <dl>
            <div><dt>Società</dt><dd>{data.societa}</dd></div><div><dt>Legale rappresentante</dt><dd>{data.repNome}</dd></div>
            <div><dt>Durata e decorrenza</dt><dd>{data.durataMesi} mesi dal {dmy(data.dataInizio)}</dd></div><div><dt>Canone al prossimo rinnovo</dt><dd>€ {fmtEur(data.canoneEuro)} + IVA</dd></div>
            <div><dt>Titolari effettivi</dt><dd>{data.titolareMode === "unico" ? "Il rappresentante" : data.titolareMode === "nessuno" ? "Nessuno" : data.titolari.length || "—"}</dd></div>
          </dl>
        </div>
        {groups.length > 0 ? <Banner tone="warn"><b>Mancano ancora {all.length} campi:</b>
          <ul className="cw-missing">{groups.map(g => <li key={g.i}><button type="button" className="cw-linkbtn" onClick={() => { setAttempted(a => new Set(a).add(g.i)); go(g.i); }}>{g.title}</button> — {g.keys.length} da completare</li>)}</ul></Banner>
          : <Banner tone="ok">Tutti i campi obbligatori sono compilati.</Banner>}
        <label className={`cw-check${errors.confermaDati && attempted.has(step) ? " has-error" : ""}`}>
          <input type="checkbox" checked={data.confermaDati} onChange={e => update("confermaDati", e.target.checked)} />
          <span>Dichiaro che i dati inseriti sono corretti e veritieri. So che nel documento stampato dovrò apporre le firme.</span>
        </label>
        {errors.confermaDati && attempted.has(step) && <p className="cw-err" role="alert">{errors.confermaDati}</p>}
        <div className="cw-actions">
          <button type="button" className="button primary" disabled={busy} onClick={requestDownload}>{busy ? <LoaderCircle className="spin" /> : <Download aria-hidden="true" />}Scarica il contratto compilato (PDF)</button>
        </div>
        {completedAt && <Banner tone="ok">PDF generato il {new Date(completedAt).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}. Se modifichi un dato dovrai scaricarlo di nuovo.</Banner>}
        <div className="cw-upload">
          <UploadRow
            title="Hai firmato il contratto?"
            hint="Stampa il PDF, firmalo nei punti indicati (pagine 6, 7, 8, 9 e 14: luogo e data, timbro e firma) e caricalo qui in PDF (anche una scansione con il telefono)."
            accept="application/pdf" pickLabel="Seleziona il contratto firmato" file={signedFile} done={signedDone} busy={uploading === "signed"}
            canUpload={!!signedFile && readFlag && uploading === null} onPick={f => pickFile("signed", f)} onUpload={() => void upload("signed")}
            flag={signedFile ? <label className="cw-check cw-up-flag"><input type="checkbox" checked={readFlag} onChange={e => setReadFlag(e.target.checked)} /><span>Dichiaro di aver letto integralmente il contratto.</span></label> : null}
          />
          {signedDone && <Banner tone="ok">Contratto firmato ricevuto il {new Date(signedDone.at).toLocaleDateString("it-IT")}. Dopo la firma del domiciliatario lo troverai completo in “Il mio contratto”.</Banner>}
          <UploadRow
            title="Documento dell’amministratore"
            hint="Carica la copia del documento di identità in corso di validità (e il codice fiscale) dell’amministratore: PDF oppure foto JPG/PNG."
            accept="application/pdf,image/jpeg,image/png" pickLabel="Seleziona il documento" file={adminFile} done={adminDone} busy={uploading === "admin"}
            canUpload={!!adminFile && uploading === null} onPick={f => pickFile("admin", f)} onUpload={() => void upload("admin")}
          />
        </div>
      </>;
      break;
    }
  }

  return (
    <div className="cw" ref={root}>
      <ol className="cw-steps" aria-label="Passaggi">
        {STEPS.map((s, i) => {
          const bad = i > 0 && i < step && stepErrors(i).length > 0;
          return <li key={s.id} className={i === step ? "current" : i < step ? (bad ? "todo" : "done") : ""}><button type="button" onClick={() => { if (i <= step || stepErrors(step).length === 0) go(i); }} aria-current={i === step ? "step" : undefined}><span>{i < step && !bad ? <Check aria-hidden="true" /> : i + 1}</span><em>{s.title}</em></button></li>;
        })}
      </ol>
      <div className="cw-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div>
      <div className="cw-head"><h4>{STEPS[step].title}</h4><span className={`cw-save ${saveState}`} role="status">{saveState === "saving" ? "Salvataggio…" : saveState === "error" ? "Salvataggio non riuscito" : savedAt ? `Bozza salvata alle ${savedAt.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}` : "Bozza"}</span></div>
      {message && <Banner tone={message.tone}>{message.text}</Banner>}
      <div className="cw-body">{body}</div>
      <div className="cw-nav">
        <button type="button" className="button" disabled={step === 0} onClick={() => go(step - 1)}><ArrowLeft aria-hidden="true" />Indietro</button>
        {step < STEPS.length - 1 && <button type="button" className="button primary" onClick={next}>{step === 0 ? "Inizia" : "Avanti"}<ArrowRight aria-hidden="true" /></button>}
        {step === STEPS.length - 1 && <span className="cw-ok"><FileCheck2 aria-hidden="true" /></span>}
      </div>
      <ReadConfirmDialog open={readOpen} aggiuntiva={data.aggiuntiva} onCancel={() => setReadOpen(false)} onConfirm={() => { setReadOpen(false); void generate(); }} />
      <ContractInstructions open={instr.open} tab={instr.tab} onClose={() => setInstr(i => ({ ...i, open: false }))} onTab={tab => setInstr({ open: true, tab })} />
    </div>
  );
}
