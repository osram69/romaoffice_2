# Tariffe: due servizi, attivazione o offerta standard

## Comportamento richiesto

1. **Domiciliazione Sede Legale / Unità Locale**: tabella 3, 6, 12, 24, 36, 48 mesi; pulsanti **Attiva subito** e **Ricevi offerta standard**.
2. **Domiciliazione Postale / Commerciale**, immediatamente sotto: tabella 6 e 12 mesi; pulsanti **Attiva subito** e **Richiedi preventivo standard**.
3. Altri servizi: solo Uffici arredati, Sale corsi e riunioni, Segreteria virtuale.

Tutto è disponibile anche in inglese. I collegamenti di attivazione usano `/attiva.html?service=legal_unit` e `/attiva.html?service=postal` (oppure `/en/activate.html`). Il selettore IT/EN conserva il servizio.

## Prezzi solo dal database

- `service_catalog`: IVA (basis point: 2200 = 22%), sconti, scadenza delle offerte e revisione delle condizioni.
- `service_prices`: servizio, durata, prezzo di listino, prezzo in offerta, idoneità allo sconto nuova attivazione.
- `service_addons`: prezzi dei servizi opzionali, canone mensile, eventuale canone annuo, quantità massima.
- `scripts/seed-catalog.ts`: inizializzazione idempotente. Usa `onConflictDoNothing`, quindi NON sovrascrive prezzi modificati successivamente.

Eseguire dopo il bootstrap dell'ambiente:

```bash
npx drizzle-kit push
npx tsx scripts/seed-catalog.ts
```

Valori postali iniziali: 6 mesi 300,00 € / offerta 280,00 €; 12 mesi 540,00 € / offerta 500,00 €. IVA 22% esclusa. Sconto aggiuntivo 10% per stesso referente/amministratore; nessuno sconto nuova attivazione per il servizio postale e nessuna scadenza promozionale inventata. Le offerte della sede legale conservano la scadenza 30 settembre 2026.

Il sito legge le tabelle ad ogni richiesta delle pagine interessate, senza listini numerici di fallback nel frontend. Non serve ricompilare per modificare i prezzi. Il server controlla la versione dell'intero catalogo/condizioni e rifiuta preventivi d'acquisto non più aggiornati. Gli importi accettati sono salvati in `orders.quote_data`: PDF, email e provider di pagamento usano lo stesso snapshot.

## Popup offerta standard

`POST /api/standard-offer` riceve titolo (Mr/Ms), nome, cognome, email, servizio, lingua, consenso e ID univoco della richiesta. Include honeypot, rate limiting, validazione lato server, escape HTML e prevenzione degli invii doppi.

L'email contiene il listino attuale e le condizioni del servizio, con copia nascosta all'amministrazione. Il messaggio di successo appare solo quando SMTP accetta il destinatario. Non viene effettuato alcun acquisto.

### Allegato originale: requisito non sostituibile

Il server legge esclusivamente:

`public/Modulo_Richiesta_Domiciliazione_ns.pdf`

Il buffer è allegato **as is**, con il nome originale, senza PDF-lib, timbri, campi compilati, traduzioni o ricostruzioni. Lo SHA-256 dell'allegato viene registrato in `standard_offer_requests.attachment_hash` per consentire la verifica. Il medesimo modulo richiesto è usato per entrambe le offerte, non essendo stato fornito un secondo file postale.

**Stato degli asset nel progetto ricevuto:** questo PDF non era presente in `public` e i tentativi di recuperarlo dal sito originale hanno restituito HTTP 403. Non è stato fabbricato un modulo sostitutivo. Collocare il documento autentico in quel percorso durante la pubblicazione. In sua assenza il popup comunica un errore e non dichiara l'offerta inviata.

Configurare `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` e `ADMIN_EMAIL` tramite hPanel/ambiente server. Nel sandbox corrente SMTP non è configurato. Nessun invio email reale è stato dichiarato o simulato nel codice di produzione.

## Acquisto postale

- Modulo dati, durata limitata a 6 o 12 mesi, decorrenza e cellulare internazionale.
- Condizioni integrali in una finestra accessibile, scorrimento fino al termine, checkbox di lettura/accettazione e conferma. La UI agevola la lettura; non può dimostrare che il testo sia stato cognitivamente letto. Il server registra dichiarazione, versione, testo e data dell'accettazione.
- Rifiuto lato server senza consenso o senza accettazione delle condizioni postali aggiornate.
- SMS legato alla pratica e al cellulare registrato. Richieste protette da cookie HttpOnly/SameSite=Lax (necessario per il ritorno dai provider), codice monouso di 10 minuti, limiti su tentativi e reinvii. Nessun codice fisso o accesso fittizio quando il provider SMS manca.
- Pagamento con Stripe, PayPal, SumUp, bonifico o, per il postale, contanti/Bancomat/carta in sede. Nessun deposito cauzionale. Un bonifico scelto non viene marcato come pagato automaticamente.
- La conferma genera il riepilogo PDF personalizzato e l'Allegato 1 con extra e condizioni accettate. **Questo è il PDF della procedura di acquisto; è separato dal PDF originale allegato all'offerta standard.**

Extra acquistabili in anticipo: segreteria virtuale 40 €/mese + 50 €/anno per il numero VoIP; archivio 6 €/mese/faldone (massimo 5); fax personale 15 €/mese. Il canone annuo VoIP è interamente dovuto anche su 6 mesi. Gli altri servizi sono presentati con le tariffe fornite ma restano a consumo: non sono addebitati preventivamente senza richiesta/quantità effettiva. Spedizione e costo della raccomandata restano esclusi. Gli sconti di domiciliazione si applicano al servizio base, non agli extra.

Gli importi degli extra sono presi dalle tabelle anche nel testo delle condizioni: una variazione nel database cambia la versione da accettare. L'accettazione online sostituisce la restituzione per email del modulo; l'effettiva attivazione resta soggetta a verifica e contratto.

## Logo e footer

L'header desktop e il menu mobile richiamano `/LogoFull_trasp.svg` come immagine, senza testo HTML sostitutivo. Il footer contiene solo `ROMA` (`#7f7f7f`) e `OFFICESHARING` (`#f97300`) affiancati, senza icone.

**Limite asset:** l'SVG originale citato non era presente nel progetto. Per evitare un'immagine rotta è stato creato un contenitore SVG trasparente che incorpora il logo PNG già disponibile, senza testo vettoriale ricostruito. Non è spacciato per l'SVG sorgente originale. Sostituire `public/LogoFull_trasp.svg` con l'asset autentico per usare esattamente quel file; non occorrono modifiche al codice.

## Verifiche prima della pubblicazione

- Inserire il vero SVG e il modulo PDF originale; confrontare hash PDF locale e allegato ricevuto.
- Configurare SMTP e Twilio; provare un invio e un SMS reali con destinatari autorizzati.
- Modificare temporaneamente un prezzo nel database di staging e verificare aggiornamento della tabella e blocco di una richiesta con versione precedente.
- Provare entrambe le durate postali, sconto aggiuntivo e somma degli extra/IVA.
- Verificare che senza accettazione postale o senza OTP gli endpoint di pagamento restituiscano errore.
- Verificare i ritorni da PayPal/Stripe/SumUp con servizio postale e importo/valuta corretti.
- Verificare bonifico e pagamento in sede come **in attesa**, non pagati.
