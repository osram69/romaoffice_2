"use client";
import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

export type InstructionTab = "titolare" | "pep" | "paesi";

const TABS: { key: InstructionTab; label: string }[] = [
  { key: "titolare", label: "Titolare effettivo" },
  { key: "pep", label: "Persone politicamente esposte" },
  { key: "paesi", label: "Paesi ad alto rischio" },
];

/**
 * The two instruction pages that close the paper contract (“Informativa sugli obblighi di cui al
 * D.Lgs. 231/2007”), shown as a popup while the customer fills in the adeguata verifica (Allegato 3).
 * The wording follows the original pages 15–16 of the contract.
 */
export function ContractInstructions({ open, tab, onClose, onTab }: { open: boolean; tab: InstructionTab; onClose: () => void; onTab: (t: InstructionTab) => void }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) { d.showModal(); document.body.style.overflow = "hidden"; }
    if (!open && d.open) { d.close(); document.body.style.overflow = ""; }
    return () => { document.body.style.overflow = ""; };
  }, [open]);
  return (
    <dialog ref={dialog} className="standard-offer-dialog legal-modal cw-instructions" aria-labelledby={id} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === dialog.current) onClose(); }}>
      <div className="modal-heading"><h2 id={id}>Istruzioni per la compilazione — adeguata verifica</h2><button type="button" className="modal-close" onClick={onClose} aria-label="Chiudi"><X aria-hidden="true" /></button></div>
      <div className="cw-tabs" role="tablist">
        {TABS.map(t => <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? "active" : ""} onClick={() => onTab(t.key)}>{t.label}</button>)}
      </div>
      <div className="legal-modal-body cw-instructions-body" role="tabpanel">
        {tab === "titolare" && <>
          <h3>Titolare effettivo</h3>
          <p><small>art. 2, Allegato Tecnico al D.Lgs. 231/2007 (rif. art. 1, comma 2, lettera u), D.Lgs. 231/2007)</small></p>
          <p>Per titolare effettivo s’intende, in caso di società:</p>
          <ol>
            <li>la persona fisica o le persone fisiche che, in ultima istanza, possiedano o controllino un’entità giuridica, attraverso il possesso o il controllo diretto o indiretto di una percentuale sufficiente delle partecipazioni al capitale sociale o dei diritti di voto in seno a tale entità giuridica, anche tramite azioni al portatore, purché non si tratti di una società ammessa alla quotazione su un mercato regolamentato e sottoposta a obblighi di comunicazione conformi alla normativa comunitaria o a standard internazionali equivalenti; tale criterio si ritiene soddisfatto ove la percentuale corrisponda al 25 per cento più uno di partecipazione al capitale sociale;</li>
            <li>la persona fisica o le persone fisiche che esercitano in altro modo il controllo sulla direzione di un’entità giuridica.</li>
          </ol>
          <h3>Art. 1, comma 2, lettera u), D.Lgs. 231/2007</h3>
          <ol>
            <li>Il titolare effettivo di clienti diversi dalle persone fisiche coincide con la persona fisica o le persone fisiche cui, in ultima istanza, è attribuibile la proprietà diretta o indiretta dell’ente ovvero il relativo controllo.</li>
            <li>Nel caso in cui il cliente sia una società di capitali: a) costituisce indicazione di proprietà diretta la titolarità di una partecipazione superiore al 25 per cento del capitale del cliente, detenuta da una persona fisica; b) costituisce indicazione di proprietà indiretta la titolarità di una percentuale di partecipazioni superiore al 25 per cento del capitale del cliente, posseduto per il tramite di società controllate, società fiduciarie o per interposta persona.</li>
            <li>Nelle ipotesi in cui l’esame dell’assetto proprietario non consenta di individuare in maniera univoca la persona fisica o le persone fisiche cui è attribuibile la proprietà diretta o indiretta dell’ente, il titolare effettivo coincide con la persona fisica o le persone fisiche cui, in ultima istanza, è attribuibile il controllo del medesimo in forza: a) del controllo della maggioranza dei voti esercitabili in assemblea ordinaria; b) del controllo di voti sufficienti per esercitare un’influenza dominante in assemblea ordinaria; c) dell’esistenza di particolari vincoli contrattuali che consentano di esercitare un’influenza dominante.</li>
            <li>Qualora l’applicazione dei criteri di cui ai precedenti commi non consenta di individuare univocamente uno o più titolari effettivi, il titolare effettivo coincide con la persona fisica o le persone fisiche titolari di poteri di amministrazione o direzione della società.</li>
          </ol>
          <p className="cw-tip"><b>In pratica:</b> sono titolari effettivi i soci persone fisiche che possiedono, direttamente o tramite altre società, più del 25% del capitale. Se nessuno supera il 25%, lo è chi controlla la società (maggioranza dei voti, influenza dominante); in ultima istanza, chi la amministra.</p>
        </>}
        {tab === "pep" && <>
          <h3>Persone politicamente esposte (P.E.P.)</h3>
          <p><b>a) Ai sensi dell’art. 1, comma 2, lettera dd) del D.Lgs. 231/2007:</b> le persone fisiche che occupano o hanno cessato di occupare da meno di un anno importanti cariche pubbliche, nonché i loro familiari e coloro che con i predetti soggetti intrattengono notoriamente stretti legami, come di seguito elencate.</p>
          <p><b>1) Sono persone fisiche che occupano o hanno occupato importanti cariche pubbliche coloro che ricoprono o hanno ricoperto la carica di:</b></p>
          <ul>
            <li>1.1 Presidente della Repubblica, Presidente del Consiglio, Ministro, Vice-Ministro e Sottosegretario, Presidente di Regione, assessore regionale, Sindaco di capoluogo di provincia o città metropolitana, Sindaco di comune con popolazione non inferiore a 15.000 abitanti nonché cariche analoghe in Stati esteri;</li>
            <li>1.2 deputato, senatore, parlamentare europeo, consigliere regionale nonché cariche analoghe in Stati esteri;</li>
            <li>1.3 membro degli organi direttivi centrali di partiti politici;</li>
            <li>1.4 giudice della Corte Costituzionale, magistrato della Corte di Cassazione o della Corte dei conti, consigliere di Stato e altri componenti del Consiglio di Giustizia Amministrativa per la Regione siciliana nonché cariche analoghe in Stati esteri;</li>
            <li>1.5 membro degli organi direttivi delle banche centrali e delle autorità indipendenti;</li>
            <li>1.6 ambasciatore, incaricato d’affari ovvero cariche equivalenti in Stati esteri, ufficiale di grado apicale delle forze armate ovvero cariche analoghe in Stati esteri;</li>
            <li>1.7 componente degli organi di amministrazione, direzione o controllo delle imprese controllate, anche indirettamente, dallo Stato italiano o da uno Stato estero ovvero partecipate, in misura prevalente o totalitaria, dalle Regioni, da comuni capoluoghi di provincia e città metropolitane e da comuni con popolazione complessivamente non inferiore a 15.000 abitanti;</li>
            <li>1.8 direttore generale di ASL e di azienda ospedaliera, di azienda ospedaliera universitaria e degli altri enti del servizio sanitario nazionale;</li>
            <li>1.9 direttore, vicedirettore e membro dell’organo di gestione o soggetto svolgenti funzioni equivalenti in organizzazioni internazionali.</li>
          </ul>
          <p><b>2) Sono familiari di persone politicamente esposte:</b> i genitori, il coniuge o la persona legata in unione civile o convivenza di fatto o istituti assimilabili alla persona politicamente esposta, i figli e i loro coniugi nonché le persone legate ai figli in unione civile o convivenza di fatto o istituti assimilabili.</p>
          <p><b>3) Sono soggetti con i quali le persone politicamente esposte intrattengono notoriamente stretti legami:</b> 3.1 le persone fisiche legate alla persona politicamente esposta per via della titolarità effettiva congiunta di enti giuridici o di altro stretto rapporto di affari; 3.2 le persone fisiche che detengono solo formalmente il controllo totalitario di un’entità notoriamente costituita, di fatto, nell’interesse e a beneficio di una persona politicamente esposta.</p>
          <p><b>b) Ai sensi dell’art. 1 dell’Allegato Tecnico al D.Lgs. 231/2007:</b></p>
          <ol>
            <li>Per persone fisiche che occupano o hanno occupato importanti cariche pubbliche s’intendono: a) i capi di Stato, i capi di Governo, i Ministri e i Vice Ministri o Sottosegretari; b) i parlamentari; c) i membri delle corti supreme, delle corti costituzionali e di altri organi giudiziari di alto livello le cui decisioni non sono generalmente soggette a ulteriore appello, salvo in circostanze eccezionali; d) i membri delle Corti dei conti e dei consigli di amministrazione delle banche centrali; e) gli ambasciatori, gli incaricati d’affari e gli ufficiali di alto livello delle forze armate; f) i membri degli organi di amministrazione, direzione o vigilanza delle imprese possedute dallo Stato. In nessuna delle categorie sopra specificate rientrano i funzionari di livello medio o inferiore. Le categorie di cui alle lettere da a) a e) comprendono, laddove applicabili, le posizioni a livello europeo e internazionale.</li>
            <li>Per familiari diretti s’intendono: a) il coniuge; b) i figli e i loro coniugi; c) coloro che nell’ultimo quinquennio hanno convissuto con i soggetti di cui alle precedenti lettere; d) i genitori.</li>
            <li>Ai fini dell’individuazione dei soggetti con i quali le persone di cui al numero 1 intrattengono notoriamente stretti legami si fa riferimento a: a) qualsiasi persona fisica che ha notoriamente la titolarità effettiva congiunta di entità giuridiche o qualsiasi altra stretta relazione d’affari con una persona di cui al comma 1; b) qualsiasi persona fisica che sia unica titolare effettiva di entità giuridiche o soggetti giuridici notoriamente creati di fatto a beneficio della persona di cui al comma 1.</li>
          </ol>
          <p className="cw-tip"><b>In pratica:</b> rispondi “Sì” solo se la persona ricopre, o ha ricoperto nell’ultimo anno, una delle cariche elencate, oppure è un familiare o un collaboratore stretto di chi le ricopre. Un amministratore di una normale società privata non è una persona politicamente esposta.</p>
        </>}
        {tab === "paesi" && <>
          <h3>Paesi terzi ad alto rischio e black list fiscali (nota 1)</h3>
          <p>Serve per rispondere alle domande “opera con controparti situate in uno dei Paesi o territori elencati nella nota (1)” e “ha versato il 25% della quota avvalendosi di un intermediario situato in uno di tali Paesi”.</p>
          <p><b>Paesi terzi ad alto rischio individuati dalla Commissione Europea:</b> Afganistan, Bosnia Erzegovina, Guyana, Iran, Iraq, Laos, Repubblica popolare democratica di Corea, Siria, Uganda, Vanuatu, Yemen.</p>
          <p><b>Paesi presenti nelle black list fiscali:</b> Andorra, Bahamas, Barbados, Barbuda, Brunei, Gibuti (ex Afar e Issas), Grenada, Guatemala, Hong Kong, Isole Cook, Isole Marshall, Isole Vergini statunitensi, Kiribati (ex Isole Gilbert), Libano, Liberia, Macao, Maldive, Nauru, Niue, Nuova Caledonia, Oman, Polinesia francese, Saint Kitts, Nevis, Salomone, Samoa, Saint Lucia, Saint Vincent e Grenadine, Sant’Elena, Sark (Isole del Canale), Seychelles, Tonga, Tuvalu (ex Isole Ellice), Vanuatu.</p>
          <p className="cw-tip"><b>In pratica:</b> rispondi “non opera” / “non ha versato” se la società non ha clienti, fornitori o intermediari finanziari in nessuno di questi Paesi o territori.</p>
        </>}
      </div>
    </dialog>
  );
}
