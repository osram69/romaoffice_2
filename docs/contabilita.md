# Contabilità cifrata e utenti dello staff

Questa guida descrive l'area **Contabilità** della dashboard e la gestione degli account dello staff ("Utenti e password"). La specifica completa è in `docs/superpowers/specs/2026-11-06-contabilita-utenti-design.md`.

## Cos'è

- **Contabilità** (`/gestione-contabilita-x9k2m7`): l'amministratore carica file (XML, PDF, ...) organizzati in sezioni (per esempio "Documenti Contabilità 3° Trim"). I file sono cifrati con AES-256-GCM sul disco del server. L'area è protetta da una **seconda password**, richiesta dopo il login e valida 30 minuti di inattività.
- **Pagina del commercialista** (`/commercialista-x9k2m7`): pagina minimale, solo download. Il server decifra il file e lo invia al browser; ogni download è registrato.
- **Utenti e password** (`/gestione-utenti-x9k2m7`): l'amministratore crea e gestisce gli account di operatori e commercialista.
- **Cambia password** (`/gestione-password-x9k2m7`): ogni utente dello staff cambia la propria password (voce nel menu, vicino a "Esci").

## Ruoli: chi vede cosa

| Area | admin | operatore | commercialista |
|---|---|---|---|
| Domiciliazioni (pagine, azioni, stampe, documenti) | sì | sì | no |
| Ordini Online | sì | no | no |
| Tariffe e Offerte, Configurazione Web | sì | no | no |
| Contabilità (carica, sezioni, impostazioni) | sì, con seconda password | no | no |
| Utenti e password | sì | no | no |
| Pagina download del commercialista | no | no | sì |
| Cambia la mia password | sì | sì | sì |

Dopo il login: l'admin va alle Domiciliazioni, l'operatore alle Domiciliazioni, il commercialista alla sua pagina. Chi apre a mano un indirizzo non consentito viene rimandato alla propria pagina.

## Creare un account (operatore o commercialista)

1. Accedi come admin e apri **Configurazione > Utenti e password**.
2. Inserisci il nome utente (minuscolo, 3-60 caratteri: lettere, numeri, punto, trattino, underscore) e scegli il ruolo `operatore` o `commercialista`. Il ruolo `admin` non si assegna da interfaccia.
3. Scrivi tu una password oppure lasciala **generare**: la password generata viene mostrata **una sola volta**, copiala e consegnala all'interessato.
4. Al primo accesso l'utente è obbligato a cambiare la password; finché non lo fa non può aprire nessun'altra pagina.

La password rispetta la policy: 12-128 caratteri con maiuscola, minuscola, numero e simbolo. Gli account non si cancellano: si **disattivano** (la disattivazione chiude subito le sessioni) e si possono riattivare. L'admin non può disattivare se stesso e deve restare almeno un admin attivo.

## Reimpostare una password

- **Operatore o commercialista**: da "Utenti e password", azione di reimpostazione sulla riga dell'utente (password scritta o generata, mostrata una volta). Le sue sessioni vengono chiuse e al prossimo accesso deve cambiarla.
- **Admin** (non reimpostabile da interfaccia): da terminale, `npx tsx scripts/reset-staff-password.ts <utente> [nuova-password]`. Senza password ne genera una e la stampa; con `DATABASE_URL` aggiorna il database, altrimenti stampa l'SQL da incollare nell'editor SQL di Supabase. Lo script aggiorna solo password e stato attivo, non chiude le sessioni già aperte né imposta il cambio obbligato.
- **Seconda password della Contabilità**: l'admin la cambia dalle impostazioni della Contabilità (chiede quella attuale). Se la dimentica: `npx tsx scripts/reset-contab-password.ts [nuova-password]`. Senza password ne genera una; con `DATABASE_URL` aggiorna il database, altrimenti stampa l'SQL per Supabase. In ogni caso tutti gli sblocchi attivi vengono chiusi. Consiglio: usa la modalità senza password (generata), perché una password passata come argomento resta nella cronologia della shell.

## Dove sono i file cifrati

- Cartella: `DOM_ARCHIVE_DIR/contabilita/` (un file `<uuid>.enc` per ogni file caricato). Nome originale, tipo e dimensione sono nel database.
- Il **backup** è lo stesso dell'archivio delle domiciliazioni: la cartella `contabilita` sta dentro `DOM_ARCHIVE_DIR`, quindi basta che il backup di quell'archivio la includa.
- La chiave di cifratura è derivata da `AES_MASTER_KEY` (HKDF-SHA256, distinta da quella usata per i PDF delle domiciliazioni). **Se `AES_MASTER_KEY` va persa o viene cambiata, i file della Contabilità non sono più leggibili**: conservala in un posto sicuro, fuori dal server, e non modificarla.
- Un backup dei soli file `.enc` senza `AES_MASTER_KEY` e senza il database (che contiene i nomi) non è utilizzabile.

## Limiti e memoria

- Ogni file: massimo **25 MB**.
- Lo ZIP di una sezione è limitato a **200 MB** complessivi (decifrati); oltre, la pagina invita a scaricare i file singoli.
- Memoria: lo ZIP viene costruito in RAM. Una sezione alla dimensione massima richiede circa **2 volte** la sua dimensione di memoria (circa 400 MB per 200 MB) mentre si scarica. Se l'host ha poca RAM, tieni le sezioni piccole.

## Codici di stato delle API

- **401** con codice `locked`: manca la sessione oppure lo sblocco della Contabilità è assente o scaduto (la pagina chiede di nuovo la seconda password).
- **403** con codice `forbidden`: utente autenticato ma senza il ruolo giusto (per esempio operatore o commercialista che tenta upload o eliminazione, commercialista sulle API `dom-*`).

## Messa in produzione, in ordine

1. **SQL su Supabase**: esegui `drizzle/0025_contabilita_utenti.sql` in **due query separate**. Prima, da sola, l'istruzione `ALTER TYPE "staff_role" ADD VALUE IF NOT EXISTS 'commercialista';`. Poi, in una seconda query, tutto il resto del file. (PostgreSQL non permette di usare il nuovo valore dell'enum nella stessa transazione. Il file SQL è corretto e prevale su qualunque descrizione diversa; la specifica è stata allineata.) Va fatto **prima** del deploy: il codice nuovo legge colonne e tabelle nuove.
2. **Variabili d'ambiente** in produzione (nessuna nuova variabile è richiesta): `AUTH_SECRET` di almeno 32 caratteri (senza, login staff e limiti di tentativi falliscono in modo sicuro, cioè il login non funziona), `AES_MASTER_KEY` e `DOM_ARCHIVE_DIR` (percorso assoluto sul server, mai un URL). Verifica che esistano tutte e tre.
3. **Deploy**.
4. **Prima visita a Contabilità** come admin: la pagina propone di creare la seconda password. Dopo averla creata l'area si sblocca.
5. **Crea gli account** (operatori e commercialista) da "Utenti e password" e consegna le password generate.
6. **Limite di upload dell'host**: l'upload accetta file fino a 25 MB, ma un proxy o il pannello dell'hosting può avere un limite più basso. Prova a caricare un file vicino a 25 MB; se fallisce con un errore generico, alza il limite dell'host.

## Test automatici

I test che non toccano il database girano in locale:

```
DATABASE_URL=postgres://x:x@127.0.0.1:1/x npx tsx --test tests/contab-*.test.ts tests/zip-store.test.ts tests/safe-log.test.ts tests/staff-*.test.ts tests/commercialista-page.test.ts tests/next-config-headers.test.ts
```

(`DATABASE_URL` finto serve solo perché i moduli importano `@/db`; nulla si connette.)

I test che usano il database sono scritti ma vengono saltati senza `TEST_DB`. **Durante lo sviluppo non sono mai stati eseguiti** (non c'era un database). Per eseguirli, solo contro un database di **SVILUPPO**:

```
TEST_DB=1 DATABASE_URL=<database di sviluppo> npx tsx --test tests/<file>.test.ts
```

Creano righe con prefisso `zz-test-` e le rimuovono a fine test. **Non puntarli mai al database di produzione.** Hanno bisogno anche di `AES_MASTER_KEY`, `DOM_ARCHIVE_DIR` (cartella temporanea) e `AUTH_SECRET` nell'ambiente.

## Checklist di prova manuale dopo il deploy

- [ ] Login come **operatore**: nel menu c'è solo Domiciliazioni (più "Cambia password" e "Esci"); non compaiono Ordini Online, Tariffe e Offerte, Configurazione Web, Contabilità, Utenti e password.
- [ ] Da operatore, digitando a mano `/gestione-ordini-x9k2m7`, `/gestione-tariffe-x9k2m7`, `/gestione-configurazione-x9k2m7`, `/gestione-contabilita-x9k2m7`, `/gestione-utenti-x9k2m7`: ognuno rimanda alle Domiciliazioni.
- [ ] Login come **commercialista**: arriva solo su `/commercialista-x9k2m7`; aprendo `/gestione-domiciliazioni-x9k2m7` viene rimandato alla propria pagina.
- [ ] Primo login di un utente nuovo: viene obbligato a cambiare la password prima di vedere altro.
- [ ] Come admin: primo accesso a Contabilità, creazione della seconda password, creazione di una sezione dalle impostazioni.
- [ ] Carica un file XML e un PDF: sulla riga di upload compaiono nome e dimensione in MB.
- [ ] Come commercialista scarica il file singolo e lo ZIP della sezione e confronta il contenuto con gli originali (stessa dimensione, stesso contenuto).
- [ ] Lo sblocco della Contabilità scade dopo 30 minuti di inattività: la pagina richiede di nuovo la seconda password.
- [ ] Le pagine nuove rispondono con `Cache-Control: private, no-store` e `X-Robots-Tag: noindex, nofollow` (strumenti di sviluppo del browser, scheda Rete).
