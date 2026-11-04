import type { Guide } from "./guides";

const RELATED_COMMON: [string, string][] = [["Domiciliazione sede legale a Roma", "/domiciliazione-sede-legale-roma.html"], ["Tariffe e offerte", "/tariffe.html"], ["Tutti i servizi di domiciliazione", "/servizi-domiciliazione-sede-roma.html"]];

export const guidesIt: Record<string, Guide> = {
  "cambio-sede-legale-roma.html": {
    eyebrow: "GUIDA PRATICA",
    h1: "Cambio sede legale a Roma: come fare, passo per passo",
    lead: "Spostare la sede legale a Roma, o da un indirizzo all’altro della città, richiede una decisione dei soci o degli amministratori, una pratica al Registro Imprese e l’aggiornamento di banca, fatture e documenti. Ecco i passaggi in ordine, i termini di legge e gli errori da evitare.",
    facts: [
      ["Chi decide", "Assemblea dei soci o organo amministrativo, secondo lo statuto"],
      ["Termine per la pratica", "30 giorni dalla delibera, con Comunicazione Unica al Registro Imprese"],
      ["Il tuo nuovo indirizzo", "Via Venti Settembre 118, a pochi minuti da Roma Termini"],
      ["Contratto", "Da 3 a 48 mesi, con attivazione online"],
    ],
    sections: [
      {
        h: "Prima di tutto: cambi comune o solo indirizzo?",
        p: [
          "La prima domanda decide tutto il resto. Se la società ha già sede a Roma e si sposta soltanto da una via all’altra, molti statuti indicano solo il Comune: in questo caso la variazione dell’indirizzo non modifica lo statuto e di norma non richiede il notaio, perché è sufficiente la decisione dell’organo amministrativo, comunicata al Registro Imprese.",
          "Se invece la società ha sede in un altro Comune, oppure lo statuto riporta l’indirizzo completo, il trasferimento è una modifica dello statuto: serve l’assemblea straordinaria dei soci con verbale notarile. Per le ditte individuali non c’è nessuna delibera: il titolare comunica la variazione direttamente.",
        ],
        note: "Controlla sempre lo statuto con il tuo commercialista o con il notaio prima di decidere: è la clausola sulla sede a stabilire quale strada seguire.",
      },
      {
        h: "I passaggi in ordine",
        ol: [
          "Verifica lo statuto e individua chi deve deliberare il trasferimento (soci o amministratori).",
          "Richiedi la domiciliazione sede legale a Roma e firma il contratto. Aspetta la conferma scritta di attivazione prima di usare l’indirizzo in atti e comunicazioni ufficiali: usare un indirizzo senza contratto significa dichiarare una sede che non è davvero a disposizione della società.",
          "Redigi la delibera o la dichiarazione di variazione con l’indirizzo completo: Via Venti Settembre, 118 int. 1 - 00187 Roma.",
          "Presenta la pratica al Registro Imprese tramite Comunicazione Unica (ComUnica), con firma digitale, entro 30 giorni dalla delibera. Di norma la pratica la presenta il commercialista o il notaio. La Comunicazione Unica serve anche per informare Agenzia delle Entrate, INPS e INAIL, quindi non devi ripetere la comunicazione presso ciascun ente.",
          "Aggiorna banche, assicurazioni, fornitori, clienti, sito web, carta intestata, firma delle email e modelli di fattura con il nuovo indirizzo. Codice fiscale, partita IVA e PEC non cambiano.",
          "Chiudi in modo ordinato il rapporto con la sede precedente: concorda con il vecchio indirizzo la data fino alla quale la posta viene ancora raccolta e chi la ritira.",
        ],
      },
      {
        h: "Cosa serve per attivare la domiciliazione a Roma",
        p: ["Per attivare il servizio si compila la richiesta online, si verifica il numero di cellulare con un codice SMS e si completa il contratto. In genere servono:"],
        ul: [
          "documento di identità e codice fiscale del legale rappresentante;",
          "visura camerale aggiornata (o i dati della società se è in via di costituzione);",
          "la documentazione per l’adeguata verifica della clientela prevista dalla normativa antiriciclaggio;",
          "per le società già esistenti, almeno uno tra indirizzo PEC e codice SDI per le comunicazioni e la fatturazione;",
          "l’indicazione di dove sono conservate le scritture contabili (spesso lo studio del commercialista) e le eventuali deleghe per il ritiro della posta.",
        ],
        note: "La reception ti conferma l’elenco esatto per la tua pratica: i documenti possono variare in base al tipo di società e di attività.",
      },
      {
        h: "Quanto costa cambiare sede legale",
        p: [
          "Il costo ha tre componenti. La prima è il servizio di domiciliazione: nella tabella qui sotto trovi i prezzi aggiornati e vedi che, più lungo è il contratto, più scende il costo mensile. La seconda sono i diritti di segreteria e l’imposta di bollo della pratica al Registro Imprese, che dipendono dal tipo di società e dalla pratica. La terza è l’eventuale compenso del notaio (se serve un verbale notarile) e del professionista che segue la pratica: chiedi sempre un preventivo scritto.",
          "Per orientarti: una rilevazione di settore di fine 2025, condotta da Ufficiarredati.it su oltre 70 operatori di coworking e business center, indica canoni annui per la sola sede legale compresi tra circa 420 € e 1.200 €, con Roma tra le città più care. Diffida dei prezzi molto più bassi: una sede troppo economica può creare problemi con banche, fisco e clienti.",
        ],
      },
      {
        h: "Gli errori più comuni",
        ul: [
          "Indicare il nuovo indirizzo negli atti prima della conferma di attivazione.",
          "Dimenticare di comunicare il cambio entro i 30 giorni: la tardiva comunicazione può comportare sanzioni.",
          "Trasferire la sede ma lasciare i vecchi dati su fatture, contratti e sito: clienti e fornitori continuano a scrivere al vecchio indirizzo.",
          "Pensare di tenere libri contabili e documenti fiscali presso l’indirizzo del centro: la domiciliazione non è un archivio e il luogo di conservazione delle scritture contabili va indicato a parte.",
          "Non avvisare la banca: molti istituti richiedono i documenti aggiornati e il nuovo contratto di domiciliazione.",
        ],
      },
      {
        h: "Dopo il trasferimento: la posta e l’Area Clienti",
        p: [
          "Dal giorno di decorrenza la reception riceve e custodisce la corrispondenza della società, raccomandate e plichi compresi nei limiti delle deleghe conferite, e ti avvisa dell’arrivo di nuova posta. Il ritiro avviene durante gli orari della reception (lunedì-venerdì 8:30-19:00) da parte del legale rappresentante o di un delegato identificato; l’eventuale inoltro si concorda a parte.",
          "Nell’Area Clienti trovi il tuo contratto e i documenti collegati, sempre disponibili. Se ti serve anche un posto dove incontrare clienti o fornitori, puoi prenotare un ufficio giornaliero o una sala riunioni nello stesso palazzo.",
        ],
      },
    ],
    priceAfter: 3,
    faq: [
      ["Serve il notaio per cambiare sede legale a Roma?", "Dipende dallo statuto. Se la società ha già sede a Roma e lo statuto indica solo il Comune, la variazione dell’indirizzo è in genere una decisione dell’organo amministrativo, senza notaio. Se cambi Comune o lo statuto riporta l’indirizzo completo serve una modifica statutaria con verbale notarile. Verifica sempre con il tuo professionista."],
      ["Entro quanto devo comunicare il cambio di sede?", "La pratica va presentata al Registro Imprese entro 30 giorni dalla delibera o dalla decisione di trasferimento, tramite Comunicazione Unica."],
      ["Posso usare subito il nuovo indirizzo?", "Aspetta la conferma scritta di attivazione del servizio e la data di decorrenza concordata: solo da quel momento l’indirizzo è a disposizione della società e può essere indicato negli atti."],
      ["Cambiano partita IVA e codice fiscale?", "No. Codice fiscale e partita IVA restano gli stessi; cambia il domicilio fiscale, che per le società coincide con la sede legale. L’aggiornamento arriva all’Agenzia delle Entrate con la Comunicazione Unica, ma in fattura devi indicare la nuova sede."],
      ["Posso tenere i libri contabili presso il centro?", "No. L’indirizzo di domiciliazione non è un luogo di conservazione delle scritture contabili e dei documenti fiscali: nel contratto indichi dove vengono conservati, di solito presso il commercialista."],
      ["Vale anche per le ditte individuali?", "Sì, ma senza delibera: il titolare comunica la variazione dell’indirizzo con la Comunicazione Unica. Per questo caso vedi anche la pagina sulla domiciliazione per ditta individuale."],
    ],
    related: [...RELATED_COMMON, ["Sede legale per startup e S.r.l.s.", "/sede-legale-startup-srls-roma.html"], ["Domiciliazione ditta individuale", "/domiciliazione-ditta-individuale.html"]],
  },

  "sede-legale-startup-srls-roma.html": {
    eyebrow: "PER STARTUP E NUOVE SOCIETÀ",
    h1: "Sede legale per startup e S.r.l.s. a Roma",
    lead: "Costituire una start-up o una S.r.l.s. a Roma non richiede di affittare un ufficio: serve un indirizzo reale, un contratto e una posta presidiata. Ecco quando conviene la domiciliazione, come indicare l’indirizzo nell’atto costitutivo e come far crescere la sede insieme alla società.",
    facts: [
      ["Capitale S.r.l.s.", "Da 1 € a 9.999,99 €"],
      ["Sede legale", "Indicata nell’atto costitutivo: la scegli prima di costituire la società"],
      ["Contratto", "Da 3 a 48 mesi, con attivazione online"],
      ["Spazi quando servono", "Sale riunioni a ore e uffici anche per un solo giorno"],
    ],
    sections: [
      {
        h: "Perché una startup può partire senza un ufficio",
        p: [
          "Nei primi mesi una nuova società ha poche spese certe e molte incognite: il team lavora in remoto, gli incontri con clienti e investitori sono occasionali e il primo affitto sarebbe un costo fisso da sostenere prima ancora di avere ricavi. Con la domiciliazione la società ha un indirizzo di rappresentanza a Roma, vicino a Termini, e paga solo ciò che usa.",
          "Il contratto va da 3 a 48 mesi e, più è lungo, più scende il costo mensile. Quando serve uno spazio fisico lo prenoti separatamente: sale riunioni anche a ore (da 25 € l’ora + IVA), un ufficio giornaliero per una giornata di lavoro o un ufficio temporaneo per qualche mese. La sede cresce con la società senza cambiare indirizzo.",
        ],
      },
      {
        h: "Sede legale e S.r.l.s.: cosa devi sapere",
        p: [
          "La S.r.l. semplificata è una società a responsabilità limitata con capitale compreso tra 1 € e 9.999,99 € e uno statuto standard. Come per ogni società, nell’atto costitutivo va indicato il Comune della sede e, nella pratica al Registro Imprese, l’indirizzo completo. Il notaio e il commercialista possono chiedere di documentare che l’indirizzo è davvero a tua disposizione: il contratto di domiciliazione è il documento da esibire.",
          "Per questo l’ordine corretto è: richiedere la domiciliazione, attendere la conferma scritta di attivazione, comunicare l’indirizzo al notaio e solo dopo costituire la società. Per una nuova società i dati definitivi (denominazione, codice fiscale e numero di iscrizione) si comunicano dopo la costituzione.",
        ],
      },
      {
        h: "Startup innovativa: cosa cambia",
        p: [
          "Se vuoi iscrivere la società alla sezione speciale delle startup innovative, la sede principale degli affari e degli interessi deve essere in Italia, ma l’indirizzo da solo non basta: l’iscrizione dipende da altri requisiti, come l’oggetto sociale innovativo e i criteri su ricerca, team e proprietà intellettuale. Questi requisiti li valuti con il tuo commercialista; un indirizzo di domiciliazione a Roma è compatibile con la sede in Italia.",
        ],
        note: "Le norme su startup e PMI innovative cambiano nel tempo: verifica i requisiti aggiornati con la Camera di Commercio o con il tuo consulente.",
      },
      {
        h: "Domiciliazione, ufficio giornaliero o ufficio: cosa scegliere",
        table: {
          head: ["La tua situazione", "Soluzione più adatta"],
          rows: [
            ["Società appena costituita, senza dipendenti", "Domiciliazione sede legale"],
            ["Team in remoto, qualche incontro al mese", "Domiciliazione + sala riunioni a ore"],
            ["Presentazioni a clienti o investitori", "Sala riunioni attrezzata con schermo e videoconferenza"],
            ["Lavoro in presenza solo in alcune giornate", "Domiciliazione + ufficio giornaliero"],
            ["Primi collaboratori stabili in sede", "Ufficio temporaneo o ufficio arredato"],
          ],
        },
      },
      {
        h: "I passaggi, dalla richiesta alla costituzione",
        ol: [
          "Scegli la durata del contratto e invia la richiesta online: compili i dati, verifichi il cellulare con il codice SMS e completi il pagamento.",
          "Firma il contratto e fornisci i documenti richiesti: documento e codice fiscale del rappresentante e la documentazione per l’adeguata verifica della clientela.",
          "Aspetta la conferma scritta di attivazione e la data di decorrenza.",
          "Comunica l’indirizzo al notaio o al commercialista e costituisci la società.",
          "A società costituita, invia i dati definitivi e indica dove saranno conservate le scritture contabili.",
          "Inizia a ricevere la posta: la reception ti avvisa quando arriva nuova corrispondenza e la custodisce fino al ritiro.",
        ],
      },
      {
        h: "Prezzi troppo bassi: i rischi per una società nuova",
        p: [
          "Per una società appena nata la banca e il notaio guardano anche all’indirizzo. Gli indirizzi offerti a pochi euro al giorno, senza un operatore strutturato e senza reception, possono creare difficoltà nell’apertura del conto, nei controlli fiscali e nella credibilità verso i clienti. Una rilevazione di settore di fine 2025 (Ufficiarredati.it, oltre 70 operatori) segnala proprio che i prezzi molto bassi non sono riconducibili a operatori di coworking e business center. Conta di più la qualità del servizio che il risparmio di poche decine di euro.",
        ],
      },
    ],
    priceAfter: 2,
    faq: [
      ["Una S.r.l.s. può avere sede in un indirizzo di domiciliazione?", "Sì, purché l’indirizzo sia a disposizione della società con un contratto e l’attività sia compatibile con il servizio. La verifica dei requisiti della singola società spetta al notaio, al commercialista e al centro prima dell’attivazione."],
      ["Posso costituire la società prima di attivare la domiciliazione?", "Non conviene: l’indirizzo va indicato negli atti solo dopo la conferma scritta di attivazione, altrimenti la società dichiarerebbe una sede di cui non ha ancora la disponibilità."],
      ["Per una startup innovativa serve un ufficio?", "L’indirizzo da solo non decide l’iscrizione alla sezione speciale: la sede principale deve essere in Italia e occorrono i requisiti previsti dalla legge. Per le verifiche rivolgiti al commercialista o alla Camera di Commercio."],
      ["Quanto costa la sede legale per una startup?", "Il costo dipende dalla durata del contratto, da 3 a 48 mesi, ed è indicato nella tabella dei prezzi di questa pagina, sempre aggiornata. L’attivazione è online."],
      ["Potrò cambiare sede in futuro?", "Sì. Se la società cresce puoi aggiungere uffici o sale, oppure trasferire la sede con la procedura descritta nella guida al cambio di sede legale."],
      ["Posso ricevere anche la posta dei soci o dei collaboratori?", "Il servizio riguarda la corrispondenza della società e delle persone che hai indicato come delegati nel contratto: confronta con la reception per i casi particolari."],
    ],
    related: [...RELATED_COMMON, ["Cambio sede legale a Roma", "/cambio-sede-legale-roma.html"], ["Affitto sale riunioni a Roma", "/sale-corsi.html"], ["Ufficio giornaliero", "/ufficio-giornaliero.html"]],
  },

  "domiciliazione-societa-estere-roma.html": {
    eyebrow: "PER SOCIETÀ E SOCI STRANIERI",
    h1: "Sede legale a Roma per società estere e soci stranieri",
    lead: "Chi apre una società in Italia da un altro Paese ha bisogno di un indirizzo reale, di documenti in regola e di una posta presidiata. Ecco quali forme esistono, che cosa serve a un amministratore straniero e come funziona un indirizzo a Roma.",
    facts: [
      ["Due scenari", "Società italiana con soci o amministratori stranieri, oppure sede secondaria di una società estera"],
      ["Documenti tipici", "Documento e codice fiscale italiano, atti della società estera con apostille e traduzione se richiesti"],
      ["Sito", "Disponibile in italiano e in inglese"],
      ["Indirizzo", "Via Venti Settembre 118, Roma, vicino a Termini"],
    ],
    sections: [
      {
        h: "Due casi diversi: società italiana o sede secondaria",
        p: [
          "Il primo caso è una società italiana (per esempio una S.r.l.) i cui soci o amministratori sono stranieri. Dal punto di vista della sede non cambia nulla: la società ha una sede legale in Italia, indicata nell’atto costitutivo, come qualsiasi altra società.",
          "Il secondo caso è una società già costituita all’estero che vuole operare in Italia. Può aprire una sede secondaria, con un rappresentante stabile, iscritta al Registro Imprese, oppure svolgere l’attività in modo da configurare una stabile organizzazione ai fini fiscali. Sono forme diverse, con conseguenze diverse in materia societaria e fiscale: la scelta va fatta con un consulente. Non serve invece un indirizzo in Italia per il solo obbligo IVA di una società estera, che si assolve con altre modalità.",
        ],
        note: "Questa pagina è informativa e non sostituisce la consulenza di un professionista: requisiti e adempimenti variano con il Paese di origine e con l’attività.",
      },
      {
        h: "Cosa serve a un socio o amministratore straniero",
        ul: [
          "Un documento di identità o il passaporto valido.",
          "Il codice fiscale italiano, che si richiede all’Agenzia delle Entrate o, dall’estero, al consolato italiano.",
          "La firma digitale per sottoscrivere le pratiche telematiche del Registro Imprese, oppure l’assistenza di un notaio o di un commercialista che le presenta per tuo conto.",
          "Un indirizzo PEC della società: è obbligatorio per le società italiane e il canale con cui arrivano molte comunicazioni ufficiali.",
          "Un conto bancario per il capitale sociale e per l’operatività: le banche applicano controlli rafforzati quando i soci non risiedono in Italia.",
        ],
        note: "I requisiti dipendono da nazionalità e ruolo: notaio e commercialista confermano l’elenco per il tuo caso.",
      },
      {
        h: "Che cosa ottiene la società con un indirizzo a Roma",
        p: [
          "Con la domiciliazione sede legale la società ha un indirizzo reale nel centro di Roma, a pochi minuti da Termini e dalla Metro A, e una reception che riceve e custodisce la corrispondenza. Per chi vive all’estero conta soprattutto la certezza di ricevere atti, raccomandate e notifiche: la sede è il luogo dove la società deve poter essere raggiunta.",
          "La reception avvisa dell’arrivo di nuova posta e la consegna al legale rappresentante o a un delegato identificato, durante gli orari di apertura (lunedì-venerdì 8:30-19:00). Se non sei in Italia, indica nel contratto una persona di fiducia che possa ritirare la posta, oppure concorda in anticipo l’inoltro: modalità e costi vanno confermati prima, perché non sono inclusi nel canone.",
          "L’indirizzo non sostituisce un ufficio operativo né le autorizzazioni dell’attività. Se ti serve un posto dove incontrare clienti o lavorare quando sei a Roma, puoi prenotare una sala o un ufficio giornaliero nello stesso palazzo.",
        ],
      },
      {
        h: "Documenti per attivare il servizio",
        p: ["La reception conferma l’elenco per la tua pratica. In genere si richiedono:"],
        ul: [
          "passaporto o carta d’identità e codice fiscale italiano del legale rappresentante;",
          "per una società estera, il certificato di iscrizione al registro del Paese di origine e lo statuto, con apostille o legalizzazione e traduzione quando richieste;",
          "i dati per identificare il titolare effettivo, come previsto dalla normativa antiriciclaggio sull’adeguata verifica della clientela;",
          "almeno uno tra indirizzo PEC e codice SDI, per le società già esistenti;",
          "le deleghe per il ritiro della posta e l’indicazione di dove sono conservate le scritture contabili.",
        ],
      },
      {
        h: "I passaggi per partire da lontano",
        ol: [
          "Valuta con il tuo consulente la forma più adatta: società italiana o sede secondaria.",
          "Invia la richiesta di domiciliazione online. Se la verifica del cellulare con codice SMS o la compilazione online presentano problemi, puoi chiedere il modulo o un preventivo via email.",
          "Firma il contratto e carica i documenti: l’Area Clienti ti permette di consultare il contratto e i documenti collegati.",
          "Aspetta la conferma scritta di attivazione, poi comunica l’indirizzo al notaio o al professionista che costituisce la società o iscrive la sede secondaria.",
          "Indica chi ritira la posta in Italia o concorda l’inoltro.",
        ],
      },
    ],
    priceAfter: 3,
    faq: [
      ["Una società estera può usare un vostro indirizzo?", "Sì, come sede legale di una società italiana controllata da soci stranieri o come indirizzo della sede secondaria, previa verifica dei requisiti dell’attività e dei documenti. Per ogni caso la reception conferma la fattibilità prima dell’attivazione."],
      ["Serve una persona in Italia per ritirare la posta?", "È consigliabile. La posta viene consegnata al legale rappresentante o a un delegato identificato; se nessuno può ritirarla, l’inoltro si concorda a parte, con modalità e costi confermati in anticipo."],
      ["Posso attivare il servizio dall’estero?", "La richiesta si compila online, con verifica del cellulare via SMS. Se questo passaggio non fosse possibile nel tuo caso, contattaci: puoi richiedere il modulo o un preventivo via email."],
      ["In che lingua è il contratto?", "Il contratto è in italiano. Il sito e le informazioni sui servizi sono disponibili anche in inglese; per chiarimenti sulle clausole puoi contattarci."],
      ["Serve il codice fiscale italiano?", "Sì, per rappresentanti e soci di una società italiana. Si richiede all’Agenzia delle Entrate oppure, dall’estero, al consolato italiano."],
      ["La domiciliazione basta per aprire un’attività in Italia?", "No. L’indirizzo risolve la sede, ma restano le pratiche societarie, fiscali e le eventuali autorizzazioni, a cura del cliente e dei suoi consulenti."],
    ],
    related: [...RELATED_COMMON, ["Sede legale per startup e S.r.l.s.", "/sede-legale-startup-srls-roma.html"], ["Cambio sede legale a Roma", "/cambio-sede-legale-roma.html"]],
  },

  "sede-legale-virtuale-roma.html": {
    eyebrow: "SEDE LEGALE E PARTITA IVA",
    h1: "Sede legale virtuale a Roma: costi, limiti e partita IVA",
    lead: "Con “sede legale virtuale” si intende una domiciliazione: un indirizzo reale a Roma, con reception e gestione della posta, senza affittare un ufficio. Vediamo che cosa permette e che cosa no, come funziona per la partita IVA e quanto costa.",
    facts: [
      ["Cos’è", "Un indirizzo reale a Roma, usato come sede, con gestione della posta"],
      ["Reception", "Lunedì-venerdì 8:30-19:00"],
      ["Contratto", "Da 3 a 48 mesi, con attivazione online"],
      ["Prezzi", "Pubblici, nella tabella di questa pagina"],
    ],
    sections: [
      {
        h: "Sede legale virtuale: che cosa significa davvero",
        p: [
          "La legge non conosce una categoria chiamata “sede virtuale”: la società ha una sede legale, un luogo reale in Italia dove può essere raggiunta e dove riceve le comunicazioni. La domiciliazione mette a disposizione quel luogo come servizio: un indirizzo vero, nel centro di Roma, con una reception che riceve e custodisce la posta, senza che tu debba affittare e arredare un ufficio.",
          "Per questo la domiciliazione è diversa da un indirizzo senza contratto, che si chiama domiciliazione abusiva: se un indirizzo viene usato senza accordo con chi lo gestisce, la posta non viene ricevuta e la società rischia contestazioni. Il contratto, la conferma di attivazione e una reception presidiata fanno la differenza.",
        ],
      },
      {
        h: "Cosa puoi fare con l’indirizzo e cosa no",
        p: ["Con una sede legale in domiciliazione puoi:"],
        ul: [
          "indicare l’indirizzo come sede legale della società, nei limiti del contratto, su atti, documenti, sito web e corrispondenza;",
          "far ricevere e custodire la posta, anche raccomandate e plichi nei limiti delle deleghe conferite;",
          "prenotare una sala riunioni o un ufficio giornaliero per gli incontri;",
          "aggiungere una segreteria virtuale con numero dedicato.",
        ],
      },
      {
        h: "I limiti da conoscere",
        ul: [
          "L’indirizzo non è un archivio: libri contabili, scritture e documenti fiscali vanno conservati altrove, di solito presso il commercialista, e il luogo di conservazione va indicato a parte.",
          "Non è un ufficio operativo né un magazzino: attività che richiedono locali idonei, autorizzazioni o accesso del pubblico vanno verificate caso per caso.",
          "L’uso come domicilio professionale dipende dalle regole dell’Ordine o dell’albo di appartenenza.",
          "La posta si ritira durante gli orari di reception, dal rappresentante o da un delegato; l’inoltro si concorda a parte.",
        ],
      },
      {
        h: "Partita IVA con una sede legale virtuale",
        p: [
          "Per una società il domicilio fiscale coincide con la sede legale: se la sede è in domiciliazione a Roma, anche il domicilio fiscale è quell’indirizzo. La domiciliazione fiscale non è un servizio separato: è la conseguenza della sede legale.",
          "Per ditte individuali e professionisti il domicilio fiscale è di norma la residenza, mentre l’indirizzo di domiciliazione può essere indicato come sede o luogo di esercizio dell’attività, nella Comunicazione Unica per le imprese o nel modello AA9/12 per i lavoratori autonomi. Quando apri la partita IVA verifica con il commercialista se la tua attività può usare questo indirizzo.",
        ],
        note: "L’idoneità dell’indirizzo dipende dall’attività svolta: confrontati con il tuo consulente prima di indicarlo nelle pratiche.",
      },
      {
        h: "Quanto costa una sede legale a Roma",
        p: [
          "Nella tabella trovi i prezzi del servizio per ogni durata di contratto, sempre aggiornati e senza costi nascosti. Per un confronto, la rilevazione di settore di fine 2025 di Ufficiarredati.it su oltre 70 operatori indica canoni annui tra circa 420 € e 1.200 € per la sola sede legale, con Roma tra le città più care e Treviso, Pesaro e Como tra le più economiche.",
          "Il prezzo dipende dalla zona, dalla reputazione dell’operatore, dai servizi inclusi (gestione della posta, controlli, conformità) e dal numero di società domiciliate. Un canone molto più basso della media è un campanello d’allarme.",
        ],
      },
      {
        h: "Come scegliere un’offerta affidabile",
        ul: [
          "Contratto scritto e conferma di attivazione prima dell’uso dell’indirizzo.",
          "Operatore identificabile: ragione sociale, partita IVA, numero REA e sede reale.",
          "Reception presidiata con orari chiari e gestione trasparente della posta (ritiro, inoltro, costi).",
          "Prezzi pubblici e condizioni di rinnovo comprensibili.",
          "Un numero ragionevole di società domiciliate allo stesso indirizzo e la possibilità di prenotare spazi reali quando servono.",
        ],
      },
      {
        h: "Sede virtuale o ufficio: il confronto",
        table: {
          head: ["Soluzione", "Per chi", "Cosa include"],
          rows: [
            ["Domiciliazione sede legale", "Società e ditte che vogliono una sede ufficiale a Roma", "Indirizzo come sede legale, ricezione e custodia della posta"],
            ["Domiciliazione postale", "Chi vuole solo un recapito separato da casa", "Indirizzo di corrispondenza, senza spostare la sede"],
            ["Segreteria virtuale", "Chi vuole un numero telefonico professionale", "Numero dedicato, risposta a nome della società, inoltro dei messaggi"],
            ["Ufficio giornaliero o sala", "Chi ogni tanto deve incontrare clienti o lavorare", "Spazio prenotabile per ore o giorni, servizi inclusi"],
          ],
        },
      },
    ],
    priceAfter: 4,
    faq: [
      ["La sede legale virtuale è legale?", "Una società deve avere una sede in Italia e poter ricevere le comunicazioni. La domiciliazione con contratto e reception è una soluzione diffusa; l’idoneità per la tua attività va verificata con il consulente."],
      ["Posso aprire la partita IVA con questo indirizzo?", "Per una società il domicilio fiscale coincide con la sede legale. Per ditte individuali e professionisti l’indirizzo può essere indicato come sede o luogo di esercizio dell’attività, mentre il domicilio fiscale resta la residenza: verifica con il commercialista."],
      ["Che differenza c’è con la domiciliazione postale?", "La postale è solo un recapito per la corrispondenza e non consente di registrare la sede legale presso il centro. Per usare l’indirizzo come sede della società serve la domiciliazione sede legale."],
      ["Posso ricevere raccomandate e plichi?", "Sì, nei limiti delle deleghe conferite. Il ritiro avviene durante gli orari di reception da parte del rappresentante o di un delegato."],
      ["Posso avere anche un numero di telefono?", "Sì, con la segreteria virtuale: numero dedicato, risposta a nome della società e inoltro dei messaggi, a partire da 6 mesi."],
      ["Quanto dura il contratto?", "Da 3 a 48 mesi. Più lungo è il contratto, più scende il costo mensile."],
    ],
    related: [...RELATED_COMMON, ["Domiciliazione postale", "/domiciliazione-postale.html"], ["Segreteria virtuale", "/segreteria-virtuale.html"], ["Domiciliazione ditta individuale", "/domiciliazione-ditta-individuale.html"]],
  },
};
