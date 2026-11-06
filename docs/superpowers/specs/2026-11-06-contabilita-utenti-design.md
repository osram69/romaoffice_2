# Contabilità cifrata e gestione utenti: specifica

Data: 2026-11-06. Stato: **in attesa di approvazione** (nessun codice scritto).

Due funzioni nella stessa consegna, perché condividono ruoli, login e migrazione SQL:

1. **Area Contabilità**: l'admin carica file (XML, PDF…) cifrati AES-256, organizzati in sezioni per trimestre; il commercialista può solo scaricarli.
2. **Utenti e password**: l'admin crea e gestisce gli account di operatori e commercialista.

## 1. Obiettivi e vincoli

- Area Contabilità dentro la dashboard, accessibile solo all'admin e protetta da una **seconda password** oltre al login.
- Caricamento semplice: "Scegli file", sulla stessa riga nome e dimensione in MB, pulsante Carica con icona floppy.
- Sezioni (es. "Documenti Contabilità 3° Trim") create e gestite dall'admin dalle impostazioni.
- Il commercialista ha una pagina minimale, solo download, senza impostazioni; il file viene decifrato dal server e salvato sul suo PC.
- Gli operatori della segreteria non vedono Contabilità, Tariffe e Offerte, Configurazione Web, Utenti **né Ordini Online**.
- Nessuna nuova variabile d'ambiente, nessuna nuova dipendenza npm.
- Il repository è pubblico: nessun segreto o dato reale nel codice.

Fuori ambito: mail di notifica al commercialista, cancellazione di account (solo disattivazione), creazione di admin da interfaccia (si fa con `scripts/reset-staff-password.ts` o SQL), versioni dei file, anteprima dei file.

## 2. Ruoli e permessi

| Area | admin | operatore | commercialista |
|---|---|---|---|
| Domiciliazioni (pagine, azioni, API `dom-*`) | sì | sì | **no** |
| Ordini Online | sì | **no** (cambia) | no |
| Tariffe e Offerte, Configurazione Web | sì | no (già oggi) | no |
| Contabilità (carica, impostazioni) | sì, con seconda password | no | no |
| Utenti e password | sì | no | no |
| Pagina download commercialista | no | no | sì |
| Cambia la mia password | sì | sì | sì |

- Nuovo valore `commercialista` nell'enum `staff_role`.
- **Punto critico**: oggi le guardie `requireStaff` e quelle delle route `api/dom-documents`, `api/dom-mail-scans`, `api/dom-print` accettano *qualsiasi* utente con sessione valida. Con il nuovo ruolo diventerebbero un buco. Vanno tutte cambiate in "admin oppure operatore". Ogni modifica ha un test di rifiuto per il commercialista.
- Ordini Online diventa admin-only: pagina (redirect alle Domiciliazioni), link nel menu e `requireStaff` delle azioni in `gestione-ordini-x9k2m7/actions.ts`.
- Il login manda: admin → Domiciliazioni (o la pagina di gestione che stava aprendo; la home di ripiego è Tariffe), operatore → Domiciliazioni (come oggi), commercialista → pagina download. Un commercialista che apre a mano un altro indirizzo viene rimandato alla sua pagina. Sulle API: 401 con codice `locked` su upload ed eliminazione quando lo sblocco Contabilità è assente o scaduto o manca la sessione (anche sui download per un admin senza sblocco); 401 `unauthorized` senza sessione sui download della Contabilità e sulle route `dom-*`; 403 con codice `forbidden` per un utente autenticato senza il ruolo giusto (commercialista sulle API `dom-*`, operatore o commercialista su upload ed eliminazione file, operatore sui download).

## 3. Utenti e password

Pagina `/gestione-utenti-x9k2m7` (solo admin), voce "Utenti e password" nel menu sotto Configurazione.

- **Elenco**: nome utente, ruolo, stato, ultimo accesso.
- **Crea utente**: nome utente (minuscolo, 3–60 caratteri, lettere/numeri/punto/trattino/underscore, univoco), ruolo `operatore` o `commercialista`, password scritta dall'admin oppure **generata** e mostrata una sola volta. La password generata rispetta la policy. Il nuovo utente ha `must_change_password = true`.
- **Reimposta password**: stesso meccanismo; imposta `must_change_password = true` e chiude tutte le sue sessioni.
- **Disattiva / riattiva**: `active`; la disattivazione chiude subito le sessioni (e gli sblocchi Contabilità, se admin). Nessuna cancellazione.
- **Cambia la mia password** (tutti i ruoli): `/gestione-password-x9k2m7`, chiede password attuale e nuova (nuova diversa dall'attuale), azzera `must_change_password`, chiude le *altre* sessioni dell'utente e mantiene quella corrente.
- **Policy**: `passwordMeetsPolicy` esistente (12–128 caratteri, maiuscola, minuscola, numero, simbolo) con `PasswordRequirementsList` per i requisiti in tempo reale.
- **Cambio obbligato**: `getStaffUser` restituisce `null` per un utente con `must_change_password = true`, a meno che non sia chiamato con `allowMustChange: true` (usato solo dalla pagina e dall'azione di cambio password). Così tutte le guardie esistenti negano l'accesso (fail-closed) senza essere toccate una per una. Il login manda quell'utente alla pagina di cambio password; se tenta altri indirizzi torna al login.
- **Protezioni**: gli account `admin` non si possono disattivare né reimpostare dall'interfaccia (l'admin cambia la propria password solo da "Cambia password", oppure con gli script); il ruolo `admin` non è assegnabile da interfaccia.
- **Limite di tentativi**: login staff con `limit()` di `customer-auth.ts` (tabella `auth_limits` già esistente): massimo 10 tentativi ogni 15 minuti per nome utente. Superato il limite il login risponde con lo stesso messaggio di errore generico.

## 4. Area Contabilità (admin)

### 4.1 Seconda password e sblocco

- Tabella `contab_access` (una sola riga): `password_hash` (scrypt, `hashPassword`), `updated_at`.
- Primo accesso senza password impostata: la pagina propone di crearla (policy come sopra). Poi richiede la password a ogni nuova sessione di lavoro.
- Sblocco: tabella `contab_unlocks` (`token_hash` sha256 unico, `user_id`, `session_token_hash` della sessione staff, `last_seen_at`, `expires_at`). Il cookie `ros_contab_unlock` è httpOnly, `sameSite=strict`, `secure` in produzione. Validità a scorrimento: **30 minuti di inattività** (`expires_at` si sposta in avanti a ogni uso). Lo sblocco vale solo insieme alla sessione staff a cui è legato: logout, disattivazione o reset password lo invalidano.
- Dalle impostazioni l'admin cambia la seconda password (chiede quella attuale). Se la dimentica: script `scripts/reset-contab-password.ts` sul modello di `reset-staff-password.ts` (stampa l'SQL da incollare in Supabase, oppure aggiorna il database se `DATABASE_URL` è disponibile).
- Limite di tentativi: `limit("contab-unlock:<userId>", 5, 900)`.
- Tutte le azioni e le route di Contabilità verificano **ruolo admin + sblocco valido** lato server.

### 4.2 Pagina `/gestione-contabilita-x9k2m7`

- Sezioni in ordine (la più recente in cima), ognuna con titolo, elenco dei suoi file e la riga di caricamento.
- **Riga di caricamento**: input file nativo ("Scegli file"); scelto il file compare sulla stessa riga `nome — 0,42 MB` e il pulsante **💾 Carica** (icona `Save` di lucide). Durante l'upload il pulsante è disabilitato con indicatore di avanzamento; a fine caricamento il file entra nell'elenco. Errori (tipo non ammesso, oltre 25 MB, sblocco scaduto) mostrati sulla stessa riga.
- **Elenco file** per sezione: nome, dimensione, data di caricamento, ultimo download del commercialista (se c'è), pulsanti Scarica ed Elimina (con conferma).
- Messaggio se sezioni o file sono vuoti, con il rimando alle impostazioni.

### 4.3 Impostazioni `/gestione-contabilita-x9k2m7/impostazioni`

- **Nuova sezione**: titolo (1–100 caratteri). La nuova sezione finisce in cima.
- **Rinomina**, **sposta su/giù**, **elimina** (solo se vuota; altrimenti messaggio che spiega di eliminare prima i file).
- **Cambia seconda password**.
- Link a "Utenti e password" per gli accessi del commercialista.

## 5. Pagina del commercialista

`/commercialista-x9k2m7`: una sola schermata con intestazione sobria, link "Cambia password" ed "Esci". Elenco delle sezioni (stesso ordine) con i file; per ogni file nome, dimensione, data e pulsante **Scarica**; per ogni sezione **Scarica tutto (ZIP)**. Nessun caricamento, nessuna impostazione, nessun altro menu. Dopo l'accesso con il suo account non deve inserire altre password.

## 6. Cifratura e archiviazione

- **Algoritmo**: AES-256-GCM (cifra e autentica). Chiave derivata con HKDF-SHA256 da `AES_MASTER_KEY` (salt fisso `ros-contabilita-v1`, info `file-encryption`, 32 byte): chiave distinta da quella dei PDF delle domiciliazioni, nessuna nuova variabile.
- **Formato file**: `"ROSC1"` (5 byte) · IV casuale 12 byte · testo cifrato · tag 16 byte. Binario: il file cifrato pesa come l'originale. Un file manomesso o una chiave sbagliata fanno fallire la decifratura (tag), mai un file corrotto consegnato.
- **Posizione**: `DOM_ARCHIVE_DIR/contabilita/<uuid>.enc` (stesso backup dell'archivio domiciliazioni). Il nome su disco è casuale; nome originale, tipo e dimensione stanno nel database. Scrittura atomica (file temporaneo poi rinomina); se l'inserimento nel database fallisce il file viene rimosso.
- **Tipi ammessi** (per estensione, minuscola): `xml`, `pdf`, `p7m`, `zip`, `csv`, `xls`, `xlsx`, `jpg`, `jpeg`, `png`. Il tipo MIME è ricavato dall'estensione, non dal browser. I PDF devono iniziare con `%PDF`. **25 MB** per file, controllati su `Content-Length` e sui byte realmente ricevuti.
- **Nome file**: ripulito da percorsi e caratteri di controllo, massimo 150 caratteri; nel download `Content-Disposition: attachment` con `filename*` (UTF-8) e `X-Content-Type-Options: nosniff`.
- **Download**: la route legge il file, lo decifra in memoria, risponde con `Cache-Control: private, no-store`, e registra il download.
- **ZIP**: scrittore ZIP minimale interno (senza compressione, CRC32 calcolato in proprio), così nessuna dipendenza nuova. Costruito in memoria; lo ZIP di una sezione è limitato a 200 MB complessivi, oltre il quale il pulsante spiega di scaricare i file singoli.

## 7. Modello dati

Migrazione `drizzle/0025_contabilita_utenti.sql` (stile delle esistenti, `IF NOT EXISTS`, eseguita a mano su Supabase **prima** del deploy):

- `ALTER TYPE staff_role ADD VALUE IF NOT EXISTS 'commercialista'` — **da eseguire per prima e da sola, in una query separata**; tutte le altre istruzioni vanno eseguite dopo, in una seconda query (PostgreSQL non permette di usare il nuovo valore nella stessa transazione).
- `staff_users.must_change_password boolean NOT NULL DEFAULT false`.
- `contab_sections(id serial pk, title varchar(100) not null, sort_order integer not null, created_at timestamptz default now())`.
- `contab_files(id serial pk, section_id integer not null references contab_sections(id), original_name text not null, mime text not null, size_bytes bigint not null, stored_name varchar(36) not null unique, uploaded_by varchar(60) not null, uploaded_at timestamptz default now())`.
- `contab_downloads(id serial pk, file_id integer references contab_files(id) on delete set null, file_name text not null, username varchar(60) not null, downloaded_at timestamptz default now())`.
- `contab_access(id integer pk check (id = 1), password_hash text not null, updated_at timestamptz default now())`.
- `contab_unlocks(id uuid pk default gen_random_uuid(), token_hash varchar(64) unique not null, user_id uuid not null references staff_users(id) on delete cascade, session_token_hash varchar(64) not null, last_seen_at timestamptz default now(), expires_at timestamptz not null)`.
- Aggiornamento di `src/db/schema.ts` in parallelo.

## 8. Route e file nuovi

- Pagine: `gestione-contabilita-x9k2m7/{page,impostazioni/page,actions,layout}`, `gestione-utenti-x9k2m7/{page,actions,layout}`, `gestione-password-x9k2m7/{page,actions,layout}`, `commercialista-x9k2m7/{page,layout}` (tutte `noindex`; `Cache-Control: private, no-store` impostato in `next.config.ts`).
- API: `POST /api/contabilita/files` (upload, corpo grezzo come le scansioni della posta, non Server Action), `GET /api/contabilita/files/[id]`, `GET /api/contabilita/sections/[id]/zip`.
- Librerie: `src/lib/contab-crypto.ts` (HKDF + GCM, formato file), `src/lib/contab-storage.ts` (disco), `src/lib/contab-auth.ts` (seconda password e sblocco), `src/lib/zip-store.ts` (ZIP), `src/lib/staff-users.ts` (creazione, reset, disattivazione, cambio password).
- Modifiche: `staff-auth.ts` (`mustChangePassword`, `allowMustChange`, tipo ruolo), `staff-actions.ts` (redirect per ruolo, limite di tentativi, cambio obbligato), `GestioneSidebar.tsx` / `GestioneNav.tsx` (voci Contabilità e Utenti e password per admin, Ordini Online solo admin), le guardie elencate al punto 2, `features.css` o `gestione.css` per lo stile della nuova area.

## 9. Test

Con `node:test` e `tsx`, come `tests/customer-api.test.ts` (database reale di sviluppo, dati creati e rimossi dal test):

- Cifratura: roundtrip, file diversi → IV diversi, tag manomesso → errore, chiave sbagliata → errore, file vuoto e da 25 MB.
- Ruoli: commercialista rifiutato da tutte le guardie delle Domiciliazioni, delle API `dom-*` e di Ordini; operatore rifiutato da Ordini, Contabilità, Utenti; admin senza sblocco rifiutato da Contabilità.
- Sblocco: password errata, limite tentativi, scadenza dopo 30 minuti di inattività, invalidazione al logout.
- Utenti: creazione con password debole rifiutata, `must_change_password` fa negare ogni guardia finché non si cambia la password, reset e disattivazione chiudono le sessioni, l'admin non può disattivare se stesso né l'ultimo admin.
- Upload/download: tipo non ammesso, oltre 25 MB, nome file con percorso, download del commercialista registrato, download senza sessione 401.
- ZIP: lettura del risultato con un lettore ZIP indipendente.
- Prove manuali in locale con le tre utenze (come per le altre aree), controllo dei tipi (`npm run typecheck`) e lint sui file toccati.

## 10. Messa in produzione

1. Eseguire su Supabase la migrazione `0025`, rispettando l'ordine descritto al punto 7.
2. Verificare che in produzione esistano già `AES_MASTER_KEY` e `DOM_ARCHIVE_DIR` (le usano già le Domiciliazioni); non servono nuove variabili.
3. Deploy su Hostinger.
4. Al primo accesso a Contabilità l'admin imposta la seconda password; poi crea gli account da "Utenti e password".
5. Limiti dell'host da verificare dopo il deploy: dimensione massima della richiesta del proxy (upload fino a 25 MB).
