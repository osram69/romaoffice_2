# Analisi di mercato e proposta di struttura del sito

Analisi commissionata a settembre 2026 per capire perché le richieste di domiciliazione sono calate e come strutturare il nuovo sito (Next.js) per sostituire l'attuale Joomla 3 (romaofficesharing.it). Fonti: sito attuale, 10 siti concorrenti, blog ufficiarredati.it, contratti/moduli/offerte reali forniti da Roma Office Sharing.

> **Correzione rispetto alla prima versione di questa analisi**: avevo scritto che il sito Joomla attuale non mostra tariffe. È sbagliato — le tariffe ci sono, a [romaofficesharing.it/it/tariffe-domiciliazione-sede-legale-roma](https://www.romaofficesharing.it/it/tariffe-domiciliazione-sede-legale-roma), raggiungibili dal menu "Tariffe" dietro l'icona hamburger. Avevo controllato solo la home e il form di contatto senza aprire il menu. Il punto 2 qui sotto è stato riscritto con la diagnosi corretta.

## 1. Le tariffe sono il problema? No — sono già competitive

Il blog che hai indicato come riferimento (ufficiarredati.it) ha pubblicato a fine 2025 una survey su oltre 70 operatori di coworking/business center italiani sul costo medio annuo della sola **sede legale**:

| Città | Prezzo medio annuo | Fascia |
|---|---|---|
| **Roma** | **fino a 1.200 €** | Alta — tra le più costose della survey |
| Napoli | ~960 € | Medio-alta |
| Firenze | ~850 € | Media |
| Bologna/Padova | 700-800 € | Media |
| Milano | 600-720 € | Medio-bassa |
| Treviso | 420 € | Minima |

Le tue tariffe attuali per la Domiciliazione Sede Legale a 12 mesi sono **660 € di listino / 550 € in offerta** — meno della metà del prezzo medio di mercato a Roma, e più basse persino di Milano. Anche la Domiciliazione Postale (500-540 €/anno) è nella fascia bassa.

**Conclusione: il prezzo non è la causa del calo di richieste di settembre** — sei sotto media di mercato, e le tariffe sono comunque pubblicate sul sito attuale. Il problema è altrove: discoverability e completamento del percorso, non trasparenza del prezzo in sé (vedi punto 2).

## 2. Perché allora poche richieste? Tre problemi reali, diversi da quello che pensavo

Il sito attuale ha effettivamente una pagina tariffe completa (con listino, offerte e persino i contratti "Smart" per nuove attività). Controllando meglio, i problemi non sono di trasparenza ma di **percorso** e di **coerenza dei dati**:

1. **La pagina tariffe è raggiungibile solo dal menu hamburger**, non c'è un link "Tariffe" visibile in home senza aprire la navigazione — un dettaglio piccolo ma che su mobile (la maggioranza del traffico, verosimilmente) costa un tap in più rispetto alla concorrenza che mette il prezzo in home (domiciliazionesocieta.com lo mette perfino nel `<title>` della pagina).
2. **Dopo aver visto il prezzo, il percorso resta comunque manuale**: non c'è un modo per attivare, pagare o anche solo inviare i propri dati direttamente da quella pagina. Il form di contatto della home è generico (Nome, Email, Argomento, Messaggio) e non è collegato a un servizio specifico. Il vero flusso — form → email con listino e PDF → modulo compilato e rispedito → autorizzazione e contratto → pagamento — resta quello ricostruito dalle tue email, con più passaggi umani nel mezzo di quanti un concorrente come businesscenterroma.it o domiciliazionesocieta.com ne richieda (loro hanno anche un tasto "ATTIVA ONLINE").
3. **I prezzi mostrati non sono coincidenti tra le fonti.** Sulla pagina tariffe del sito Joomla oggi si legge: 6 mesi sede legale a 420€/offerta 342€, 12 mesi a 660€/offerta **495€** (già scontata del 10% "nuova attivazione" inclusa nel prezzo esposto). Il nuovo sito su cui lavoriamo (e le tue email reali di offerta più recenti, es. quella del 15/09/2026) mostrano invece 6 mesi a 480€/offerta 380€, 12 mesi a 660€/offerta **550€** (lo sconto 10% è mostrato *a parte*, come nota). Sono numeri diversi per lo stesso servizio, a seconda di quale pagina o quale canale il cliente controlla. Se un prospect confronta il sito con la mail che riceve, o se torna sul sito dopo aver ricevuto un preventivo, vede cifre che non tornano — un problema di fiducia indipendente dalla struttura del sito, da risolvere aggiornando/allineando i prezzi pubblicati prima ancora del lancio del nuovo sito.

**Cosa manca davvero, quindi, non è "mostrare i prezzi" (già fatto) ma:** portare il cliente dalla pagina prezzi a un'azione conclusa (attivazione online, modulo, o download) senza uscire dal sito, ed eliminare le discrepanze tra le fonti di prezzo. Il sito nuovo su cui lavoriamo risolve già il primo punto (attivazione online con OTP+pagamento, modulo leggero, download PDF, tutto raggiungibile dalla stessa pagina tariffe); il secondo è una questione organizzativa da chiudere prima del lancio, non di codice.

**Cosa non so, e che ti consiglio di controllare prima di investire ulteriormente in contenuti**: non ho accesso a Google Analytics/Search Console del sito attuale. Se il calo di settembre è in realtà un calo di *traffico* (non di conversione — cioè arrivano meno visitatori, non che arrivano ma non convertono), la causa potrebbe essere fuori dal sito stesso: una variazione nel posizionamento Google, nella scheda Google Business Profile, o un concorrente che ha aumentato la spesa pubblicitaria. Vale la pena controllare il traffico organico di agosto-settembre prima di attribuire tutto alla struttura del sito.

## 3. Cosa fanno i concorrenti — pattern osservati

| Sito | Approccio prezzo | Punti di forza da copiare | Punti deboli da evitare |
|---|---|---|---|
| **businesscenterroma.it** | Prezzo pieno in pagina, tabella a periodicità (mensile/trim./sem./annuale) | 3 CTA parallele chiarissime: "Compila modulo online", "Scarica modulo", "Contattaci telefono/email/WhatsApp"; sezione "leggere prima di richiedere" con tariffe limitate nel tempo | Testo denso, poco gerarchizzato |
| **domiciliazionesocieta.com** | Prezzo aggressivo in **titolo di pagina** ("A soli €19,90/mese") | Elenco puntato di cosa è incluso in linguaggio da beneficio, non da contratto; "NESSUN DEPOSITO CAUZIONALE" ripetuto come rassicurazione; CTA "ATTIVA ONLINE" | — |
| **Regus** | Prezzo nascosto, richiesta contatto | Bullet di beneficio outcome-oriented ("paghi solo per lo spazio che usi", "disponibile subito senza attese") | Nessuna trasparenza, tipico posizionamento enterprise costoso |
| **Executive Network** | Prezzo nascosto ("Richiedi preventivo") | Numeri di trust in home (233 postazioni attive, 87 uffici, 50 anni esperienza); una pagina dedicata per ogni sotto-servizio (postale/legale/professionale/unità locale) | Pagine di servizio lunghissime, molto SEO/didattiche, poco scremate — esattamente il rischio "pagina che il cliente non legge mai" che volevi evitare |
| **Pick Center** | Prezzo nascosto, form generico | Area personale cliente, virtual tour 3D come differenziatore esperienziale | Stesso limite del tuo vecchio sito: form generico senza prezzo |
| **Parco de' Medici** | Prezzo domiciliazione nascosto ("richiedi preventivo"), ma prenotazione uffici/sale **self-service via piattaforma** | Barra di numeri di fiducia in home, concreti e credibili (1.200 ore segretariato, 358 appuntamenti gestiti, 97% clienti soddisfatti, 30 anni esperienza, **"4 minuti per noleggiare un ufficio"**); un claim di velocità specifico è più efficace di "veloce ed efficiente" generico | Pagine di servizio lunghe e SEO-dense come Executive Network (probabilmente stessa agenzia/template) |
| **Day Office** | Prezzo **mensile** anche su contratti annuali ("€60/mese" invece di "€720/anno"), più un banner "Sede legale 2€ al giorno" | Framing psicologico del prezzo per unità più piccola (mese o giorno) invece che per l'intero periodo — stesso importo, percezione di convenienza molto più alta; nav dedicata "Promozioni" separata da "Tariffe" | — |
| **Cube Suite Coworking** | Prezzo unico e semplice: **€600/anno**, un solo pacchetto, nessuna scelta di durata | Estrema semplicità: una sola card, bullet brevi, nessuna tabella — utile se un giorno vuoi offrire un'opzione "senza pensieri" accanto alla tabella a 6 fasce | Non è un concorrente diretto sui prezzi (zona Roma Nord, posizionamento lifestyle/eventi, non centro città) |
| **Eur Trade Center** | Prezzo pieno con sconto ("€780 → €680/anno") | Buona separazione "SERVIZI INCLUSI" / "SERVIZI OPZIONALI" in due liste brevi | **Errore da non ripetere**: la pagina mostra ancora oggi (2026!) "Offerta periodo Covid per contratti stipulati entro Marzo 2021" — un'offerta scaduta da 5 anni lasciata online. È l'esempio perfetto di scarsità/urgenza fatta male: una scadenza dimenticata comunica "sito abbandonato", l'opposto dell'urgenza che dovrebbe creare |
| **Stay360** | Prezzo nascosto, form di preventivo con "Tipologia: Società da costituire / Società costituita" e durata (3 mesi / 1 anno) solo sulla pagina **legale** (non su quella postale) | Conferma che il toggle costituita/da-costituire è pratica standard di settore, ma **solo per la domiciliazione legale** — esattamente la distinzione che abbiamo appena corretto sul tuo sito; CTA "PAGA ONLINE" in navigazione anche senza prezzi pubblici | Pagina di atterraggio minimale ma senza alcun numero, tutto dietro al preventivo |

**Lettura aggiornata**: il cluster "trasparenza di prezzo + attivazione immediata" (businesscenterroma, domiciliazionesocieta, Day Office) resta il tuo riferimento principale — sei sotto la loro fascia di prezzo e hai già (o stai per avere) più automazione di loro. Il cluster "prezzo nascosto" (Regus, Executive, Parco de' Medici, Eur Trade Center, Pickcenter, Stay360) punta su fiducia/prestigio invece che su convenienza: non è la tua battaglia, dato che il tuo vantaggio reale è il prezzo. Vale però la pena rubare due tattiche da questo secondo gruppo anche restando nel primo: la **barra di numeri di fiducia** (Parco de' Medici) e il **framing del prezzo mensile/giornaliero** (Day Office) — nessuna delle due richiede di nascondere il prezzo, solo di presentarlo meglio.

## 4. Come strutturare i 3 servizi

Mantieni i 3 macro-servizi in navigazione (Uffici arredati / Domiciliazione / Segreteria Remota), ma dentro "Domiciliazione" la segmentazione va resa più precisa di quella attuale:

| Servizio | Cos'è (in una frase, per il cliente) | Requisito particolare |
|---|---|---|
| **Sede legale primaria** | Sposti/apri la sede legale della società qui | Nessuno — anche società da costituire |
| **Sede secondaria** | La società esiste già altrove, apri qui una sede secondaria formale | Società già esistente |
| **Unità locale** | Apri qui un punto operativo (es. per una gara d'appalto), non solo un indirizzo postale | **Richiede un pacchetto di ore di ufficio incluse** — altrimenti, come dici tu, "non ha senso": un'unità locale presuppone attività reale sul posto, non solo ricezione posta |
| **Domiciliazione postale/commerciale** | Solo recapito, biglietti da visita, non va in visura | Riservata a soggetto già esistente (persona o società) — **mai "in costituzione"** |

Oggi il catalogo tratta "Sede Legale / Unità Locale" come un prodotto unico con un'unica descrizione: va bene per sede legale primaria/secondaria, ma per l'unità locale manca il pacchetto ore ufficio che tu stesso consideri indispensabile. Propongo di trattarla come variante con un pacchetto ore incluso (es. "Unità Locale — include N ore/mese di ufficio attrezzato"), sfruttando l'add-on "ufficio temporaneo 25€+IVA/h" già presente nel tuo listino invece di inventarne uno nuovo.

**Occasione non sfruttata — Contratto Smart-Start**: nelle tue offerte via email esiste un contratto "Smart-Start 3+24" e "6+24" (poche decine di € al mese nei primi mesi, poi tariffa standard), riservato esplicitamente a **nuove partite IVA/società da costituire**. Non è da nessuna parte sul sito nuovo né sul vecchio. È probabilmente la tua leva di conversione più forte per il segmento "sto aprendo una nuova attività" (il più numeroso, a giudicare dai moduli che mi hai mandato) perché abbassa drasticamente la barriera d'ingresso iniziale. Lo aggiungerei come quarta card prezzo, visibile solo quando il cliente segnala che la società è da costituire.

## 5. Lunghezza pagine: cosa evitare, cosa tenere

Il tuo istinto è corretto: la pagina "Domiciliazione legale" di Executive Network è un esempio di cosa **non** fare — centinaia di parole di spiegazione giuridica generica prima di arrivare a un prezzo (che comunque non c'è). Nessun visitatore da mobile la legge tutta.

Pattern consigliato per ogni pagina servizio (~400-600 parole visibili, il resto in dettagli collassabili):

1. **Hero**: una frase che dice cosa ottieni + per chi è (es. "Sede legale a Roma in 24h, anche per società da costituire")
2. **3-4 bullet di beneficio** (non di feature): non "scansione corrispondenza in busta chiusa entro 24h" ma "non perdi mai una raccomandata, anche se sei all'estero"
3. **Tabella prezzi** (vedi punto 6) — sempre visibile, mai dietro un form
4. **Cosa è incluso / cosa NON è incluso** in due colonne brevi (hai già tutti i dati nei tuoi contratti: 10 aperture/mese incluse, niente targhe in facciata, niente domiciliazione INPS/INAIL, ecc.) — questo previene contestazioni post-vendita, non solo aiuta la conversione
5. **FAQ in `<details>` collassabili** per le domande ricorrenti (es. "cosa succede al rinnovo?", "posso disdire quando voglio?", "serve un deposito?") — il contenuto lungo esiste ma non appesantisce lo scroll
6. **CTA multiple** (le 3-4 che abbiamo già implementato: attiva online, modulo online, scarica PDF, chiama)

## 6. Come mostrare tariffa standard + offerta (e risolvere la domanda sul rinnovo)

Il meccanismo "listino barrato + offerta" che usi già (e che businesscenterroma/domiciliazionesocieta usano anch'essi) funziona bene per la percezione di convenienza — **tienilo**. Il problema che segnali tu stesso — "mi chiedono se al rinnovo torna la tariffa standard" — è un problema di **chiarezza contrattuale prima ancora che di sito**: ho controllato il tuo contratto reale (art. 9-10) e la mail di offerta (esempio: 12 mesi, attivazione 495€, "rinnovi successivi al costo di 550€"). Quindi la tua policy attuale è: **al rinnovo si applica il prezzo "offerta" pieno (non il listino, ma nemmeno lo sconto nuova attivazione)** — ma questo non è scritto da nessuna parte in modo esplicito e leggibile dal cliente prima che firmi.

Proposta concreta, da applicare sia nel contratto sia nella pagina tariffe:
- Una riga fissa sotto ogni tabella prezzi, sempre visibile (non in FAQ): *"Il canone di rinnovo resta [quello mostrato in tabella / quello di listino], salvo nuove promozioni comunicate prima della scadenza."* — nel tuo caso specifico sarebbe: "Al rinnovo si applica la tariffa mostrata in tabella (non lo sconto nuova attivazione, valido solo alla prima sottoscrizione)."
- Il componente `activation.summary` che abbiamo già nel sito (riepilogo prezzo nel flusso di attivazione) mostra già "Rinnovi successivi: X € + IVA" — va solo esteso anche alla pagina tariffe pubblica, non solo al checkout, così la domanda non arriva nemmeno via email.

**Framing del prezzo — un'idea a costo zero da Day Office**: loro mostrano la stessa cifra come "€60/mese" invece di "€720/anno" (e in un banner perfino "2€ al giorno" per la sola domiciliazione). È lo stesso importo, ma la percezione di convenienza è molto più alta perché il numero è più piccolo. Le tue tariffe, essendo già più basse delle loro, renderebbero questo effetto ancora più forte: "€45,80/mese" per la sede legale a 12 mesi in offerta (550€/12) comunica "economico" in modo più immediato di "550€ + IVA per 12 mesi", specialmente nella prima scansione della pagina fatta da mobile. Proposta minima: aggiungere una riga piccola sotto ogni prezzo di tabella con l'equivalente mensile, senza sostituire il prezzo per periodo (che resta necessario per chiarezza contrattuale).

## 7. Urgenza e scarsità, fatta bene (Cialdini) — senza bluffare

L'esempio di businesscenterroma.it che ti piace ("numero limitato di contratti superscontati") funziona perché è **specifico e verificabile**, non un countdown finto. Per il tuo sito propongo un meccanismo reale, non simulato:

- Un contatore "Offerta valida fino al 30/09 **o ai primi N contratti attivati**, quale condizione si verifica prima" — con N basato su un tetto che decidi tu (es. 10 contratti/mese allo sconto nuova attivazione).
- Tecnicamente: una riga in `service_catalog` tipo `offer_slots_remaining`, decrementata quando un ordine passa a `paid` con lo sconto nuova attivazione applicato; mostrata in pagina come "Restano 4 contratti a queste condizioni questo mese" quando il numero scende sotto una soglia (es. ≤5), per non sembrare artificiosa quando è ancora piena.
- Punto critico: se decidi questa strada, il numero deve essere **vero** — un contatore statico o finto, se scoperto (e nel B2B viene scoperto, i clienti si confrontano), danneggia la fiducia più di quanto l'urgenza l'abbia aumentata. Se non vuoi gestire questa logica lato server ora, l'alternativa più semplice e comunque efficace è mantenere solo la scadenza a data fissa (che hai già) scritta in modo più visibile ("mancano 14 giorni all'offerta" con calcolo automatico dei giorni, invece della sola data).
- **L'errore da non fare mai, con un esempio reale**: ho trovato sul sito di Eur Trade Center (concorrente romano) un'offerta "periodo Covid, per contratti stipulati entro Marzo 2021" ancora pubblicata oggi, nel 2026 — cinque anni dopo la scadenza. Qualunque meccanismo di urgenza tu scelga, va **automatizzato o messo in calendario per la rimozione**: una scadenza dimenticata online comunica esattamente il contrario dell'urgenza voluta, cioè "questo sito non viene aggiornato". Il campo `offerValidUntil` già presente nel catalogo del nuovo sito serve anche a questo: quando scade, il codice smette da solo di mostrare "offerta" e torna al listino (l'ho verificato, è già il comportamento attuale) — nessuna offerta scaduta può restare visibile per errore umano.

## 8. Correzione già applicata oggi

Nel modulo di attivazione (`ActivationFlow.tsx`) e nel modulo online (`ManualRequestModal.tsx`), il campo "l'azienda è già costituita / da costituire" compariva **anche per la domiciliazione postale**, dove — come hai segnalato — non ha senso: il modulo cartaceo reale che usi (`Modulo_Richiesta_DomiciliazionePostale.pdf`) non prevede mai l'opzione "in costituzione", perché la domiciliazione postale presuppone un soggetto (persona o società) già esistente. Corretto: per il servizio postale i campi anagrafici sono ora sempre richiesti, senza il checkbox fuorviante; resta invariato per la sede legale, dove "in costituzione" è invece un caso reale e frequente.

## 9. Stato di implementazione (aggiornato)

Tutte le voci sotto sono state implementate sul nuovo sito, **esclusa la scarsità/contatore** (voce 8, esclusa su tua richiesta):

1. ✅ **Prezzi allineati sul nuovo sito** con l'ultima offerta reale inviata via email (480/380 a 6 mesi, 660/550 a 12 mesi, ecc.) — il catalogo Supabase era già corretto, l'ho solo verificato. **Il sito Joomla resta disallineato** (mostra 420/342 e 495 già scontato): non ho accesso a quell'installazione per correggerlo, va aggiornato manualmente lato Joomla o quel sito va dismesso appena il nuovo va online, per evitare che un cliente veda due prezzi diversi nello stesso periodo.
2. ✅ **Nota di rinnovo** sotto ogni tabella prezzi: "Il canone di rinnovo resta quello mostrato in tabella (colonna Offerta): non si torna al listino barrato. Lo sconto nuove attivazioni si applica una sola volta, alla prima sottoscrizione." — stessa policy già ricostruita dal tuo contratto reale, ora esplicita anche nella pagina pubblica (prima era solo nel riepilogo del checkout).
3. ✅ **Prezzo equivalente mensile** sotto ogni cifra in tabella (es. "660,00 € + IVA ≈ 55,00 €/mese").
4. ✅ **Card Smart-Start** (3+24 e 6+24) sulla pagina tariffe, riservata a società da costituire. Nota tecnica: ha una struttura a due tranche che il motore di checkout automatico non gestisce (il calcolo prezzi attuale assume un canone unico per periodo), quindi è presentata come richiesta manuale (modulo online o telefono) e non come acquisto istantaneo — evita di introdurre un bug di fatturazione per risparmiare tempo di sviluppo ora.
5. ✅ **Cosa è incluso / servizi opzionali + FAQ collassabili**, per sede legale e postale — contenuto preso dai tuoi contratti reali (10 aperture/mese incluse, niente targhe esterne, niente sede INPS/INAIL per la legale; niente visura CCIAA per la postale, ecc.). Le FAQ includono anche la differenza tra sede legale primaria, sede secondaria e unità locale.
6. ✅ **Barra di numeri di fiducia** in home: anno di fondazione (2014), zero depositi cauzionali richiesti, 3 metodi di pagamento online. **Un numero resta segnaposto** ("aziende domiciliate ad oggi") perché non ho un dato reale da mostrare onestamente — dimmi la cifra vera (o toglilo) prima di andare online.
7. ✅ **Differenziazione Unità Locale**: aggiunto in catalogo il servizio opzionale "Affitto ufficio temporaneo attrezzato" (25€ + IVA/ora) per la sede legale, richiamato esplicitamente nella FAQ come ciò che rende un'unità locale realmente operativa, invece di un semplice recapito. Non è un prodotto separato a listino (avrebbe richiesto un nuovo codice servizio e una migrazione più invasiva): è un add-on collegato, coerente con come lo vendi già oggi.
8. ⏭️ Contatore scarsità — escluso come richiesto.

### Altre correzioni fatte in questo intervento

- **Google Analytics/Tag Manager trasferiti**: ho recuperato dal sito Joomla il container GTM (`GTM-K9GGQ2WV`) e il token di verifica Google Search Console, e li ho collegati al nuovo sito rispettando il consenso cookie già presente (si carica solo se accetti la categoria "Analitici", mai prima). Il vecchio ID Google Analytics (`UA-47165981-1`) è **Universal Analytics, dismesso da Google nel 2023-2024**: non l'ho riportato perché non funziona più. Se hai già una proprietà GA4, configurala dentro lo stesso contenitore GTM (nessuna modifica al codice necessaria); se non ce l'hai, te ne serve una prima del lancio o perderai le statistiche di traffico.
- **Coordinate mappa/indirizzo corrette**: la mappa e i dati strutturati (LocalBusiness JSON-LD, usato anche da Google per la scheda locale) puntavano a coordinate sbagliate di alcune centinaia di metri. Corrette con le coordinate reali di Via Venti Settembre 118.
- **Intestazione duplicata sulla pagina di attivazione**: "Attiva la domiciliazione" (titolo) e "Compila e attiva la domiciliazione" (sottotitolo) dicevano la stessa cosa due volte. Il sottotitolo ora è "I tuoi dati", coerente con gli step del modulo sotto.
- **Layout grafico**: ho fatto una verifica visiva della home e delle pagine tariffe/attivazione a più larghezze (mobile e desktop). L'impianto grafico esistente (Georgia per i titoli, palette verde scuro/crema/oro, card con icone) è già solido e coerente — il problema concreto che avevi segnalato era la ripetizione di titolo, ora risolta. Ho integrato i nuovi elementi (barra di fiducia, card Smart-Start, nota di rinnovo) nello stesso linguaggio visivo. Se hai in mente un cambiamento più profondo (nuove immagini, layout diverso delle card prezzo, altro), fammi vedere un riferimento o descrivimi cosa non ti convince: senza una direzione specifica rischio di introdurre modifiche a caso.

### Interpretazione dei dati Google Ads che hai condiviso

| Periodo | Impression | Click | CTR | Note |
|---|---|---|---|---|
| Da inizio anno (pausa ad agosto) | 233.094 | 6.119 | 2,6% | CPC medio 0,35 € |
| Giugno (mese pieno) | 47.684 | 1.440 | 3,0% | — |
| 1-16 settembre | 14.594 | 559 | 3,8% | Budget speso: 12 € |

Il CTR è in realtà leggermente **migliore** a settembre che a giugno (3,8% vs 3,0%) — la qualità degli annunci/parole chiave non è il problema. Il numero che salta all'occhio è il budget: **12 € in 16 giorni è enormemente inferiore al ritmo di spesa di giugno** (a un CPC medio di 0,35€, 559 click sarebbero dovuti costare circa 195€, non 12€) — la campagna, ripartita dopo la pausa di agosto, sta probabilmente giocando su un budget giornaliero troppo basso per spendere davvero, oppure buona parte di questi click/impression di settembre sono residui non a pagamento. In ogni caso: **la pausa di agosto e la ripartenza a budget quasi nullo a settembre spiegano da sole gran parte del calo di richieste**, indipendentemente da qualsiasi problema del sito. Non gestisco la tua campagna e non ho accesso al tuo account Ads, quindi non posso dirti con certezza cosa sta succedendo dentro Google Ads — ma prima di investire altro tempo sul sito, verificherei con chi gestisce la campagna perché il budget giornaliero risulti così basso rispetto a giugno.

## 10. Prossimo passo

Il sito è pronto per una revisione tua diretta su `localhost:3000` (o sull'ambiente che preferisci). Le cose che *devi* decidere tu prima del lancio:
- il numero reale per la barra di fiducia (punto 6);
- se/quando aggiornare o dismettere il sito Joomla per evitare i due listini in parallelo;
- se hai già una proprietà GA4 da collegare al contenitore GTM;
- un controllo con chi gestisce Google Ads sul budget giornaliero di settembre.
