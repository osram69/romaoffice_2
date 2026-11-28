# Richiesta di domiciliazione online con verifica SMS — design

## Perché
Le offerte partono con il modulo PDF in allegato, ma i clienti lo restituiscono spesso incompleto (di solito manca il cellulare, che è indispensabile). Il popup "Compila il modulo online" esiste già ma è incompleto e non verifica il telefono. Obiettivo: modulo online completo, con cellulare verificato via SMS che vale come firma dell'invio, e un link da mettere nell'offerta al posto dell'allegato.

## Obiettivi
- Tutti i campi del modulo "Richiesta domiciliazione sede legale" (con contratti Smart 3+24 e 6+24 solo per società da costituire), flag "società già costituita" come nell'acquisto.
- Verifica SMS prima della registrazione; data/ora e numero verificato salvati.
- Link unico per tutti i clienti nell'email dell'offerta.

## Non obiettivi
- Nessun pagamento, nessun link precompilato per cliente, nessuna modifica all'acquisto online.

## Approcci considerati
1. **Estendere il popup esistente** + nuova tabella e rotte dedicate, riuso della logica OTP (scelto: è ciò che ha chiesto l'utente, impatto minimo sull'acquisto).
2. Riusare `orders` e `/api/send-otp`: scartato, `orders` richiede importo, catalogo e checkout.
3. Pagina separata senza popup: scartato, l'utente vuole tenere il popup.

## Design
- Tabella `domiciliation_requests` (migrazione drizzle 0031): id, public_id, token hash (cookie), service, lang, form_data jsonb, phone, email, status (`pending`/`submitted`), OTP (hash, sends, attempts, sent_at, expires_at, verified_at), submitted_at.
- Rotte: `POST /api/manual-request` (valida, salva bozza `pending`, imposta cookie), `POST /api/manual-request/send-otp`, `POST /api/manual-request/verify` (verifica codice e conferma: status `submitted`, invio email cliente+admin). Rate limit e bypass debug come per l'acquisto.
- Schema Zod unico condiviso client/server (`manual-request.ts`): campi società (denominazione, forma giuridica, già costituita → sede, città, CAP, prov, CF, P.IVA, Reg.Imp., email, PEC/SDI), referente (nome, nato a/il, residenza, CF, email, cellulare), contratto, data inizio, consenso privacy.
- UI: `ManualRequestModal` a due passi (dati → codice SMS). Pagina `/richiesta-domiciliazione` (`?service=legal_unit|postal`) con lo stesso modulo aperto; il link va nel testo dell'offerta in `standard-offer.ts` al posto dell'allegato.
- Email di conferma: riepilogo completo con data/ora verifica SMS.

## Lasciato al costruttore
Testi di errore, stile dei campi, nome esatto delle colonne.
