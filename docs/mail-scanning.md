# Scansione posta (eSCL) — dashboard domiciliazioni

Sostituisce il vecchio bridge Python `pyscanner` (TWAIN/WIA, con driver specifico per lo scanner) con [eSCL](https://mopria.org/spec-download) (AirScan/Mopria Scan), il protocollo HTTP che la maggior parte delle multifunzione di rete moderne parla nativamente, senza driver.

## Perché la scansione parte dal browser, non dal server

Il sito gira su Hostinger; lo scanner è sulla rete locale dell'ufficio. Il server Hostinger non ha (e non deve avere) accesso a quella rete. Per questo la scansione è guidata dal **browser dell'operatore**, che è fisicamente sulla stessa LAN dello scanner:

1. Il browser chiama un piccolo bridge locale (`scripts/escl-bridge.ts`), in ascolto solo su `127.0.0.1` sul PC dell'operatore.
2. Il bridge (lato Node, non lato browser: nessun limite CORS/mixed-content) chiama in HTTP puro l'indirizzo IP dello scanner con la libreria `src/lib/escl-scanner.ts`.
3. Il bridge restituisce al browser sia il PDF della scansione (base64) sia le singole pagine (per le miniature — vedi sotto); solo quando l'operatore conferma, il browser carica il PDF unito sul sito tramite una server action, che lo salva cifrato.

Il server Hostinger riceve quindi solo il PDF finale — non parla mai direttamente con lo scanner.

### Avviare il bridge

Sul PC dell'ufficio (stessa rete dello scanner), con Node.js installato e le dipendenze del progetto (`npm install` una tantum):

```bash
npx tsx scripts/escl-bridge.ts
```

Resta in ascolto su `http://127.0.0.1:17866` (porta configurabile passandola come argomento). Verifica che uno scanner risponda con:

```bash
curl "http://<IP_SCANNER>/eSCL/ScannerCapabilities"
```

Se risponde con un XML, lo scanner supporta eSCL ed è pronto all'uso.

## Configurazione (Configurazione Web, solo admin)

Indirizzo IP/porta/HTTPS dello scanner e le impostazioni proposte di default (colore, sorgente, risoluzione) si configurano **una sola volta per tutto l'ufficio** in `/gestione-configurazione-x9k2m7` → sezione "Scanner posta (eSCL)" — non per singolo operatore/browser, dato che è un unico scanner fisico condiviso. Sono salvate in `site_config` (`scanner_host`, `scanner_port`, `scanner_https`, `scanner_color_default`, `scanner_source_default`, `scanner_resolution_default`).

Nel pannello "Allega" (accessibile ad admin e operatore), colore/sorgente/risoluzione restano comunque modificabili per la singola scansione — quelli configurati sono solo il punto di partenza.

## Il pannello "Allega": miniature e scansioni multiple

Rifà, nell'aspetto e nel comportamento, il pannello del vecchio tool (sfondo scuro con header brandizzato, pannello impostazioni a sinistra, anteprima a destra):

- Ogni pressione di **Scansiona documento** aggiunge pagine (dal piano: una; dal caricatore: tutte quelle acquisite in quel passaggio) a quelle già presenti — utile per comporre un unico documento da più passaggi (es. fronte da piano, retro da ADF). Ogni scansione viene subito scomposta in singoli PDF di una pagina ciascuno (`splitPdfPages`, con `pdf-lib`), così le operazioni sotto lavorano sempre sulla pagina, non sul blocco scansionato.
- Ogni pagina viene mostrata come **miniatura reale** (non un'icona generica): il bridge restituisce anche le singole pagine così come le manda lo scanner — quasi sempre JPEG anche quando si richiede PDF, comportamento comune alla maggior parte delle multifunzione eSCL — mostrate direttamente come `<img>`. Se una pagina arrivasse eccezionalmente già come PDF, la miniatura mostra un'icona generica al suo posto (il PDF resta comunque incluso nel documento finale).
- **Clic su una miniatura** la ingrandisce in una lightbox (per verificare che sia leggibile) — se eccezionalmente non c'è anteprima (pagina arrivata come PDF), il clic apre invece quella singola pagina in una nuova scheda.
- **Icona cestino** su ogni miniatura elimina quella pagina singolarmente; **trascinamento** (drag & drop) tra le miniature ne cambia l'ordine; **Svuota tutto** azzera tutte le pagine (con conferma).
- **Conferma upload** unisce tutte le pagine, nell'ordine mostrato, in un unico PDF (client-side, con `pdf-lib`) e lo allega alla società — da quel momento sostituisce l'eventuale scansione già in sospeso.
- Se la società ha già una scansione in sospeso da prima, il pannello lo segnala in alto con un link per aprirla e un pulsante per rimuoverla, senza dover per forza scansionare di nuovo.
- Il nome della società compare **grande, in un riquadro arancione al centro dell'header** — deliberatamente più evidente del logo/nome del sito, per evitare che l'operatore scansioni per sbaglio la posta sulla società sbagliata.

> **Il bridge locale è un processo a parte, sul PC dell'ufficio: un `git push` su questo repository non lo aggiorna né lo riavvia.** Se dopo un aggiornamento le miniature smettono di comparire, il pannello lo segnala esplicitamente ("Scansione aggiunta, ma senza anteprima...") — significa che va aggiornato il codice sul PC (`git pull`) e riavviato `npx tsx scripts/escl-bridge.ts`.

## Storage: due archivi diversi, non uno

Le scansioni di posta **non** vengono salvate nello stesso archivio dei documenti contrattuali (contratto/modulo/allegato1/doc amministratore/adeguata verifica/revoca — gestiti da `src/lib/dom-archive.ts` con chiave fissa per tipo, in `DOM_ARCHIVE_DIR`). Sono due esigenze diverse:

- **`DOM_ARCHIVE_DIR`** — archivio permanente, con backup, dei documenti contrattuali. Deve restare un percorso assoluto esplicito (mai un URL) sul filesystem del server.
- **Scansioni di posta** — file di lavoro con una vita più breve (in attesa di essere inviati/segnati come gestiti), salvati in una cartella separata: **di default la cartella temporanea del sistema operativo** (`os.tmpdir()/dom-mail-scans` — su Hostinger tipicamente `/tmp/dom-mail-scans`), **senza bisogno di configurare nulla**. `DOM_MAIL_SCANS_DIR` esiste solo per chi preferisce esplicitamente un percorso persistente diverso dal tmp di sistema (stesse regole di `DOM_ARCHIVE_DIR`: percorso assoluto, mai un URL).

Entrambi gli archivi usano la stessa cifratura AES-256-CTR (`saveEncrypted`/`saveMailScanEncrypted` in `dom-archive.ts`), solo in cartelle diverse. Una società ha **al massimo una scansione in sospeso alla volta**: se la scansione è sbagliata, si ripreme Allega e la nuova sostituisce quella salvata (stesso comportamento del vecchio `scansione.pdf` fisso in `tmp/`, ma per società invece che unico file globale — così due operatori possono scansionare due società diverse in contemporanea senza sovrascriversi a vicenda).

## Allega / Invia / PEC / Aperta: chi è attivo quando

Ricalca esattamente il flusso del vecchio tool:

1. Per una società senza scansioni in sospeso, solo **Allega** è cliccabile — Invia/PEC/Aperta sono disabilitati ("dimmed").
2. Fatta una scansione, Invia/PEC/Aperta si attivano per quella riga.
3. Se la scansione è sbagliata, si ripreme Allega: il nuovo file sostituisce quello già in sospeso (Invia/PEC/Aperta restano attivi, ora sull'ultima scansione).
4. Premendo **Invia** (email ordinaria), **PEC** (via PEC — richiede un indirizzo PEC in anagrafica, altrimenti segnala errore) o **Aperta** (staff ha già letto il contenuto al cliente per telefono: invia comunque un'email, ma con testo che lo dice esplicitamente invece di "in allegato trova la scansione"), l'email parte **subito, senza alcuna conferma o anteprima** — a differenza delle email di scadenza, qui oggetto/testo/informativa sono fissi (portati dal vecchio tool), non c'è niente da personalizzare o rivedere caso per caso.
5. Inviata con successo l'email (con la scansione allegata), il file viene **eliminato dal server** e Invia/PEC/Aperta tornano disabilitati per quella società — nessuno storico separato: il messaggio inviato (visibile nella cartella "Inviati" della relativa casella email) è la traccia che resta.
6. Esito dell'invio (in corso / riuscito / fallito, con il motivo) compare in una riga sotto quella della società — stesso posto e stile del vecchio `statusMsg` — invece che in un popup: "Invio..." mentre parte, poi il messaggio (verde) o l'errore (rosso).

### Testi email: identici al vecchio tool

Oggetto, testo di apertura, mittenti/CC/BCC e informativa (esclusione di responsabilità + riservatezza, IT ed EN) in `sendMailScanAction`/`mailScanDraftContent` (`src/app/gestione-domiciliazioni-x9k2m7/actions.ts`) sono portati **parola per parola** da `ajax_send_mail.php` (casi `"PEC"`, `"Aperta"`, `"Invia"`/default):

- **Destinatari**: il primo indirizzo di `email_posta` è sempre il destinatario principale (gli altri in CC). PEC aggiunge anche `email_pec` come destinatario e mette in CC l'indirizzo fisso `posta@romaofficesharing.it`; Invia/Aperta mettono invece quello stesso indirizzo in CCN (BCC).
- **Oggetto**: PEC e Invia includono un codice `[ID#####]` casuale a 5 cifre (come `rand(0,99999)` lato PHP); Aperta no.
- **Testo di apertura** e **informativa legale** (in fondo all'email, entrambi fissi, non modificabili — vedi sopra): stessa formulazione IT/EN del vecchio tool, con la sola differenza che l'informativa di Aperta ha un paragrafo iniziale diverso (menziona esplicitamente che l'apertura è stata richiesta dalla società).
- **Mittente**: `src/lib/mailer.ts` (`accountEnv`) ora mostra sempre un nome visualizzato — "Roma Office Sharing" di default, sovrascrivibile per singolo account con `ORDINARIA_SMTP_FROM_NAME` / `PEC_SMTP_FROM_NAME` — invece del solo indirizzo nudo (che in molti client di posta appariva come il solo "posta", la parte prima della @). Vale per tutte le email inviate tramite questi due account, non solo per la scansione posta.

Non è stato portato il pre-processing PDF del vecchio tool (`trimPdfBottom`, un ritaglio di 0,6&nbsp;cm in basso per eliminare una filigrana del software di scansione precedente, Asprise) — con eSCL non serve, non essendoci quella filigrana.

Lo stato attivo/disabilitato è calcolato lato server a ogni caricamento della pagina (`pendingScanIds` in `page.tsx`) e aggiornato otticamente nel browser dopo ogni Allega/Invia/PEC/Aperta/Rimuovi, senza bisogno di ricaricare.
