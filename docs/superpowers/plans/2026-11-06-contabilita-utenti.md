# Contabilità cifrata e gestione utenti: piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** area Contabilità cifrata AES-256-GCM (admin carica, commercialista scarica) e sezione "Utenti e password" per gli account staff, con ruolo `commercialista` e Ordini Online riservato agli admin.

**Architecture:** librerie pure e piccole (`contab-crypto`, `zip-store`, `contab-files`, `contab-storage`, `staff-users`, `contab-auth`, `contab-data`) testate a parte; le pagine e le route sono sottili e usano guardie centralizzate (`staff-guards.ts`). Il cambio password obbligato è fail-closed: `getStaffUser` nega l'accesso agli utenti con `must_change_password`, quindi tutte le guardie esistenti lo rispettano senza essere riscritte.

**Tech Stack:** Next.js 16 (App Router, leggere `node_modules/next/dist/docs/` prima di scrivere codice, come richiede `AGENTS.md`), React 19, Drizzle ORM + PostgreSQL (Supabase), `node:crypto`, `node:test` con `tsx`, lucide-react.

**Spec:** `docs/superpowers/specs/2026-11-06-contabilita-utenti-design.md`

## Global Constraints

- Nessuna nuova variabile d'ambiente e nessuna nuova dipendenza npm.
- Repository pubblico: nessun segreto, password o dato reale nel codice, nei test o nei commit.
- **Mai commit o push senza conferma esplicita dell'utente, ogni volta.** I passaggi "Commit" di questo piano significano: chiedere conferma, poi committare. Messaggi in inglese, chiusi da `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Ogni colonna o tabella nuova: ricordare all'utente di eseguire prima l'SQL su Supabase. L'`ALTER TYPE staff_role ADD VALUE 'commercialista'` va in una query separata, eseguita da sola.
- Cifratura: AES-256-GCM, chiave HKDF-SHA256 da `AES_MASTER_KEY` (salt `ros-contabilita-v1`, info `file-encryption`, 32 byte); file = `"ROSC1"` (5 byte) · IV 12 byte · testo cifrato · tag 16 byte; posizione `DOM_ARCHIVE_DIR/contabilita/<uuid>.enc`.
- File ammessi: `xml pdf p7m zip csv xls xlsx jpg jpeg png`, massimo **25 MB**, i PDF iniziano con `%PDF`; nome file massimo 150 caratteri senza percorsi né caratteri di controllo.
- Seconda password: sblocco a scorrimento **30 minuti**, cookie `ros_contab_unlock`, legato alla sessione staff; limiti `limit()`: 5 tentativi / 900 s per sblocco, 10 / 900 s per login staff per nome utente.
- Password: `passwordMeetsPolicy` esistente (12–128 caratteri, maiuscola, minuscola, numero, simbolo).
- Ruoli: admin e operatore operativi; il commercialista è rifiutato da Domiciliazioni, API `dom-*` e Ordini; Ordini Online solo admin; gli admin non si creano né si modificano da interfaccia.
- Tutte le pagine nuove `noindex`; risposte con file o dati sensibili `Cache-Control: private, no-store`.
- Test: `node:test` lanciati con `npx tsx --test <file>`. I test con database scrivono sul `DATABASE_URL` configurato (come `tests/customer-api.test.ts`): usare **un database di sviluppo, mai quello di produzione**, con la migrazione `0025` già applicata. I dati di test hanno prefisso `zz-test-` e sono rimossi in `after`.
- Le Server Action con `redirect()` non si testano a unità fuori da Next: sono coperte da `staff-guards` (testato), dalle route API (testate) e dalla prova manuale del task 15.

## Review Focus

1. Nome file ostile (`../../x.pdf`, vuoto, 400 caratteri, solo punti, unicode): deve diventare un nome sicuro, mai un percorso. Test nel task 4.
2. File da 0 byte: respinto con messaggio chiaro e senza lasciare file su disco né riga nel database. Test nel task 4 e nel task 12.
3. Due file con lo stesso nome nello stesso ZIP: nomi resi univoci (`a.pdf`, `a (2).pdf`). Test nel task 3.
4. Riga nel database ma file sparito dal disco (cancellato a mano): il download risponde 404 con messaggio, non 500. Test nel task 12.
5. Nome utente con maiuscole o spazi (`" Mario "`, `"MARIO"` quando esiste `mario`): normalizzato e trattato come duplicato. Test nel task 7.
6. Sblocco scaduto durante un caricamento: la route risponde 401 con un messaggio che la riga di upload mostra come "Sblocco scaduto, reinserisci la password". Test nel task 12, comportamento UI nel task 13.

---

## File Structure

Nuovi:

| File | Responsabilità |
|---|---|
| `drizzle/0025_contabilita_utenti.sql` | migrazione SQL manuale |
| `src/lib/contab-crypto.ts` | HKDF + AES-GCM, formato `ROSC1` |
| `src/lib/zip-store.ts` | ZIP senza compressione, nomi univoci |
| `src/lib/contab-files.ts` | politica di upload, nome sicuro, MIME, formato MB |
| `src/lib/contab-storage.ts` | lettura, scrittura atomica e rimozione dei file cifrati su disco |
| `src/lib/staff-guards.ts` | guardie per pagine e Server Action (`requireOperational`, `requireAdminUser`, `requireCommercialista`) |
| `src/lib/staff-users.ts` | gestione account staff |
| `src/lib/contab-auth.ts` | seconda password, sblocco, guardie Contabilità |
| `src/lib/contab-data.ts` | sezioni, file, download nel database |
| `scripts/reset-contab-password.ts` | reset della seconda password |
| `src/app/api/contabilita/files/route.ts`, `.../files/[id]/route.ts`, `.../sections/[id]/zip/route.ts` | upload, download, ZIP |
| `src/app/gestione-contabilita-x9k2m7/{layout.tsx,page.tsx,actions.ts,impostazioni/page.tsx}` | area admin |
| `src/app/gestione-utenti-x9k2m7/{layout.tsx,page.tsx,actions.ts}` | gestione utenti |
| `src/app/gestione-password-x9k2m7/{layout.tsx,page.tsx,actions.ts}` | cambio password per tutti i ruoli |
| `src/app/commercialista-x9k2m7/{layout.tsx,page.tsx,actions.ts}` | download del commercialista |
| `src/components/ContabUploadRow.tsx`, `ContabUnlockForm.tsx`, `UserAdminPanel.tsx`, `ChangePasswordForm.tsx` | componenti client |
| `tests/helpers/staff.ts`, `tests/contab-*.test.ts`, `tests/staff-*.test.ts`, `tests/zip-store.test.ts` | test |
| `docs/contabilita.md` | documentazione operativa |

Modificati: `src/db/schema.ts`, `src/lib/dom-archive.ts` (esporta `archiveRoot`), `src/lib/staff-auth.ts`, `src/lib/staff-actions.ts`, `src/app/gestione-tariffe-x9k2m7/login/page.tsx`, `src/app/gestione-domiciliazioni-x9k2m7/{page.tsx,actions.ts}`, `src/app/gestione-ordini-x9k2m7/{page.tsx,actions.ts}`, `src/app/api/{dom-documents,dom-mail-scans,dom-print}/route.ts`, `src/components/{GestioneNav.tsx,GestioneSidebar.tsx}`, `src/app/gestione.css`.

---

### Task 1: Schema e migrazione

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/0025_contabilita_utenti.sql`

**Interfaces:**
- Produces (esportati da `src/db/schema.ts`): `staffRole` con valore `"commercialista"`; `staffUsers.mustChangePassword` (`must_change_password`, boolean, default false); `contabSections` (`id`, `title`, `sortOrder`, `createdAt`); `contabFiles` (`id`, `sectionId`, `originalName`, `mime`, `sizeBytes` come `bigint({ mode: "number" })`, `storedName`, `uploadedBy`, `uploadedAt`); `contabDownloads` (`id`, `fileId` nullable, `fileName`, `username`, `downloadedAt`); `contabAccess` (`id`, `passwordHash`, `updatedAt`); `contabUnlocks` (`id`, `tokenHash`, `userId`, `sessionTokenHash`, `lastSeenAt`, `expiresAt`).

- [ ] **Step 1: Aggiornare `schema.ts`** con le definizioni sopra (stesso stile del file; `bigint` da `drizzle-orm/pg-core`; `contabAccess.id` è `integer` primary key con check `id = 1` nel solo SQL).
- [ ] **Step 2: Scrivere `0025_contabilita_utenti.sql`** con le tabelle e le colonne del punto 7 della spec, tutte con `IF NOT EXISTS`; `ALTER TYPE staff_role ADD VALUE IF NOT EXISTS 'commercialista'` come **prima** istruzione, preceduta da un commento che dice di eseguirla da sola e poi eseguire il resto in un'altra query.
- [ ] **Step 3: Verificare** con `npm run typecheck` (atteso: nessun errore). `StaffRole` in `staff-auth.ts` segue nel task 5.
- [ ] **Step 4: Commit** (dopo conferma): `Schema: contabilita tables, commercialista role, must_change_password`. Ricordare all'utente che l'SQL va eseguito su Supabase prima del deploy.

---

### Task 2: Cifratura dei file

**Files:**
- Create: `src/lib/contab-crypto.ts`
- Test: `tests/contab-crypto.test.ts`

**Interfaces:**
- Produces: `encryptContab(data: Buffer): Buffer` e `decryptContab(blob: Buffer): Buffer` (lancia `Error("Formato file non valido")` o `Error("File non integro")`).

- [ ] **Step 1: Scrivere i test** (impostare `process.env.AES_MASTER_KEY = "test-master-key"` in cima):
  - `roundtrip: decryptContab(encryptContab(x)).equals(x)` per buffer da 0 byte, 1 byte e 1 MB casuale;
  - `due cifrature dello stesso file differiscono` (IV diversi) e iniziano con `ROSC1`;
  - `lunghezza = 5 + 12 + data.length + 16`;
  - `un bit cambiato nel testo cifrato, nel tag o nell'IV fa lanciare decryptContab`;
  - `blob senza prefisso ROSC1 o più corto di 33 byte lancia "Formato file non valido"`;
  - `con AES_MASTER_KEY diversa la decifratura fallisce`.
- [ ] **Step 2: Eseguire** `npx tsx --test tests/contab-crypto.test.ts`, atteso FAIL (modulo mancante).
- [ ] **Step 3: Implementare** con `hkdfSync("sha256", master, "ros-contabilita-v1", "file-encryption", 32)` e `createCipheriv("aes-256-gcm", key, iv)`; la chiave si deriva a ogni chiamata (nessuna cache), perché i test cambiano la variabile.
- [ ] **Step 4: Eseguire il test**, atteso PASS.
- [ ] **Step 5: Commit** (dopo conferma): `Contabilita: AES-256-GCM file encryption`.

---

### Task 3: Scrittore ZIP

**Files:**
- Create: `src/lib/zip-store.ts`, `tests/helpers/zip-read.ts`
- Test: `tests/zip-store.test.ts`

**Interfaces:**
- Produces: `readZip(zip: Buffer): { name: string; data: Buffer; crc: number }[]` in `tests/helpers/zip-read.ts` (lettore minimo indipendente, riusato dal task 12); `buildZip(entries: { name: string; data: Buffer; date?: Date }[]): Buffer` (metodo "store", flag UTF-8 al bit 11, CRC32 calcolato in proprio) e `uniqueZipNames(names: string[]): string[]` (`a.pdf`, `a (2).pdf`, `a (3).pdf`; il confronto ignora le maiuscole).

- [ ] **Step 1: Scrivere `readZip` e i test**: il lettore in `tests/helpers/zip-read.ts` percorre la directory centrale (EOCD → voci → header locali); il test, per ogni voce, verifica nome, dimensione e che `zlib.crc32(data)` coincida con il CRC dichiarato (Node 22.14 ha `zlib.crc32`; solo nel test, il codice non lo usa). Casi: tre file con contenuti diversi, nome con accenti e spazi (`Fattura è.xml`), zero file (ZIP vuoto valido, 22 byte), file da 0 byte. `uniqueZipNames(["a.pdf","a.pdf","A.PDF","b"])` restituisce `["a.pdf","a (2).pdf","A (3).PDF","b"]`.
- [ ] **Step 2: Eseguire** `npx tsx --test tests/zip-store.test.ts`, atteso FAIL.
- [ ] **Step 3: Implementare** con tabella CRC32 propria (non dipendere da `zlib.crc32`, la versione di Node in produzione può essere più vecchia) e data DOS ricavata da `entry.date ?? new Date()`.
- [ ] **Step 4: Eseguire il test**, atteso PASS; poi, a mano una volta, `tar -tf` su uno ZIP prodotto per confermare che un lettore esterno lo apre.
- [ ] **Step 5: Commit** (dopo conferma): `Contabilita: store-only ZIP writer`.

---

### Task 4: Politica di upload e archiviazione su disco

**Files:**
- Create: `src/lib/contab-files.ts`, `src/lib/contab-storage.ts`
- Modify: `src/lib/dom-archive.ts` (aggiungere `export function archiveRoot(): string` che restituisce `archiveDir()`, senza altro cambiamento)
- Test: `tests/contab-files.test.ts`, `tests/contab-storage.test.ts`

**Interfaces:**
- Consumes: `encryptContab`, `decryptContab` (task 2); `archiveRoot()`.
- Produces in `contab-files.ts`: `CONTAB_MAX_BYTES = 25 * 1024 * 1024`; `CONTAB_EXTENSIONS: readonly string[]`; `sanitizeFileName(name: string): string`; `contabMimeFor(name: string): string`; `validateContabUpload(name: string, data: Buffer): { ok: true; name: string; mime: string } | { ok: false; message: string }`; `formatMb(bytes: number): string` (es. `"0,42 MB"`, due decimali, virgola).
- Produces in `contab-storage.ts`: `saveContabFile(storedName: string, data: Buffer): Promise<void>` (cifra, scrive in `DOM_ARCHIVE_DIR/contabilita/<storedName>.enc` tramite file temporaneo e rinomina); `readContabFile(storedName: string): Promise<Buffer>` (decifra; lancia `Error("File non trovato")` se manca); `removeContabFile(storedName: string): Promise<void>` (ignora l'assenza); `newStoredName(): string` (UUID v4). Rifiuta `storedName` che non sia un UUID.

- [ ] **Step 1: Scrivere i test di `contab-files`**: `sanitizeFileName("../../etc/passwd.pdf")` → `passwd.pdf`; `"a\\b\\c.xml"` → `c.xml`; `"nul\u0000x\u0007.pdf"` senza caratteri di controllo; 400 caratteri → massimo 150 mantenendo l'estensione; `""` o `"..."` → `documento`; unicode (`Fattura è n°1.xml`) conservato; `validateContabUpload("a.exe", …)` → `ok:false`; 0 byte → `ok:false` con messaggio "vuoto"; 25 MB + 1 → `ok:false`; `.pdf` che non inizia con `%PDF` → `ok:false`; `.XML` maiuscolo accettato con mime `application/xml`; `formatMb(440000)` → `"0,42 MB"`.
- [ ] **Step 2: Scrivere i test di `contab-storage`** con `DOM_ARCHIVE_DIR` su una cartella temporanea (`fs.mkdtemp` in `os.tmpdir()`): save→read restituisce lo stesso buffer; il file su disco non contiene il testo in chiaro; `readContabFile` di un nome inesistente lancia "File non trovato"; `removeContabFile` due volte non lancia; nome non UUID (`../x`) lancia; non restano file `.tmp` dopo la scrittura.
- [ ] **Step 3: Eseguire** `npx tsx --test tests/contab-files.test.ts tests/contab-storage.test.ts`, atteso FAIL.
- [ ] **Step 4: Implementare** i due moduli e l'export `archiveRoot`. MIME: xml `application/xml`, pdf `application/pdf`, p7m `application/pkcs7-mime`, zip `application/zip`, csv `text/csv`, xls `application/vnd.ms-excel`, xlsx `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, jpg/jpeg `image/jpeg`, png `image/png`.
- [ ] **Step 5: Eseguire i test**, atteso PASS.
- [ ] **Step 6: Commit** (dopo conferma): `Contabilita: upload policy and encrypted disk storage`.

---

### Task 5: Nucleo di autenticazione staff, guardie e login per ruolo

**Files:**
- Modify: `src/lib/staff-auth.ts`, `src/lib/staff-actions.ts`, `src/app/gestione-tariffe-x9k2m7/login/page.tsx` (solo se serve per mostrare l'errore di limite)
- Create: `src/lib/staff-guards.ts`, `tests/helpers/staff.ts`
- Test: `tests/staff-auth.test.ts`

**Interfaces:**
- Produces in `staff-auth.ts`: `StaffRole = "admin" | "operatore" | "commercialista"`; `StaffUser = { id: string; username: string; role: StaffRole; mustChangePassword: boolean }`; `getStaffUser(sessionCookie: string | undefined, opts?: { allowMustChange?: boolean }): Promise<StaffUser | null>` (null se `must_change_password` e non `allowMustChange`); `login()` invariata nella firma ma il valore restituito include `mustChangePassword`; `isOperational(role: StaffRole): boolean` (admin o operatore); `roleHome(role: StaffRole): string` (admin `/gestione-tariffe-x9k2m7`, operatore `/gestione-domiciliazioni-x9k2m7`, commercialista `/commercialista-x9k2m7`); `postLoginPath(user: StaffUser, next: string): string` (mustChange → `/gestione-password-x9k2m7`; commercialista → sempre `roleHome`; admin può andare a un `next` che inizia per uno dei prefissi `/gestione-` esistenti più `/gestione-contabilita-x9k2m7` e `/gestione-utenti-x9k2m7`; operatore solo a `next` che inizia per `/gestione-domiciliazioni-x9k2m7`; altrimenti `roleHome`; conservare il comportamento già presente per i casi esistenti); `revokeStaffSessions(userId: string, exceptRawToken?: string): Promise<void>` (cancella le sessioni e, nella stessa chiamata, le righe di `contab_unlocks` dell'utente non legate alla sessione eccettuata); `destroySession` cancella anche gli sblocchi legati a quella sessione.
- Produces in `staff-guards.ts`: `requireOperational(basePath: string): Promise<StaffUser>` (senza utente → redirect al login con `next`; commercialista → redirect a `roleHome`); `requireAdminUser(basePath: string): Promise<StaffUser>` (non admin → redirect a `roleHome`); `requireCommercialista(): Promise<StaffUser>` (altri ruoli → redirect a `roleHome`; nessun utente → login). Usano `cookies()` di Next.
- Produces in `tests/helpers/staff.ts`: `createTestStaff(role: StaffRole, opts?: { mustChange?: boolean; active?: boolean }): Promise<{ id: string; username: string; password: string; cookie: string; cleanup(): Promise<void> }>` (username `zz-test-<uuid8>`, hash reale con `hashPassword`, sessione creata con `createSession`, cleanup che cancella utente e sessioni); `staffRequest(url: string, cookie?: string, init?: RequestInit): NextRequest`.
- Login: `staffLoginAction` applica `limit("staff-login:" + username.toLowerCase(), 10, 900)` e, se superato, risponde `{ error: true }` come per una password errata; dopo il login redirige a `postLoginPath`.

- [ ] **Step 1: Scrivere i test** (`tests/staff-auth.test.ts`, con `createTestStaff`): `getStaffUser` restituisce l'utente con `mustChangePassword`; con `mustChange:true` restituisce `null`, e l'utente con `allowMustChange:true`; utente disattivato → null; `isOperational` vero per admin e operatore, falso per commercialista; `roleHome` per i tre ruoli; `postLoginPath`: commercialista con `next="/gestione-ordini-x9k2m7"` → `/commercialista-x9k2m7`, mustChange → `/gestione-password-x9k2m7`, operatore con `next="/gestione-tariffe-x9k2m7"` → `/gestione-domiciliazioni-x9k2m7`, admin con `next="/gestione-contabilita-x9k2m7"` → quel `next`, `next="https://evil.example"` → `roleHome`; `revokeStaffSessions` toglie tutte le sessioni, e con `exceptRawToken` conserva quella; 11° tentativo di login sullo stesso utente in 15 minuti rifiutato (test su una funzione `staffLoginAllowed(username): Promise<boolean>` esportata da `staff-auth.ts` che incapsula il `limit`).
- [ ] **Step 2: Eseguire** `npx tsx --test tests/staff-auth.test.ts`, atteso FAIL.
- [ ] **Step 3: Implementare** le modifiche a `staff-auth.ts` (la query di `getStaffUser` seleziona `mustChangePassword`; `login` aggiorna `lastLoginAt` come oggi) e `staff-guards.ts`; aggiornare `staffLoginAction` per usare `staffLoginAllowed` e `postLoginPath`.
- [ ] **Step 4: Eseguire il test**, atteso PASS; `npm run typecheck` pulito.
- [ ] **Step 5: Commit** (dopo conferma): `Staff auth: commercialista role, forced password change, role-based login`.

---

### Task 6: Irrigidire le guardie esistenti e nascondere Ordini agli operatori

**Files:**
- Modify: `src/app/gestione-domiciliazioni-x9k2m7/actions.ts` (sostituire la `requireStaff` locale con `requireOperational(BASE_PATH)`), `src/app/gestione-domiciliazioni-x9k2m7/page.tsx`, `src/app/gestione-ordini-x9k2m7/actions.ts` (`requireAdminUser`), `src/app/gestione-ordini-x9k2m7/page.tsx`, `src/app/api/dom-documents/route.ts`, `src/app/api/dom-mail-scans/route.ts`, `src/app/api/dom-print/route.ts`
- Test: `tests/staff-guards-api.test.ts`

**Interfaces:**
- Consumes: `requireOperational`, `requireAdminUser`, `isOperational`, `getStaffUser` (task 5), `createTestStaff`, `staffRequest`.
- Produces: le tre route API rispondono **403** `{ error: "forbidden" }` (o `{ success: false, message: "forbidden" }` dove già in quel formato) a un utente autenticato non operativo, 401 senza utente come oggi. Pagina Ordini: un non-admin viene rimandato alle Domiciliazioni; pagina Domiciliazioni: un commercialista viene rimandato a `/commercialista-x9k2m7`. Nelle azioni di Ordini il controllo `user.role !== "admin"` già presente diventa ridondante e si elimina.

- [ ] **Step 1: Scrivere i test** (`tests/staff-guards-api.test.ts`): per ognuna delle tre route (GET e, dove esiste, POST) con cookie di commercialista → 403; senza cookie → 401; con cookie operatore → non 401/403 (la risposta può essere 400 per parametri mancanti: il test controlla solo che non sia un rifiuto di autorizzazione). Chiamare gli handler esportati con `staffRequest`.
- [ ] **Step 2: Eseguire** `npx tsx --test tests/staff-guards-api.test.ts`, atteso FAIL (commercialista oggi passa).
- [ ] **Step 3: Implementare** i controlli nelle tre route (dopo `getStaffUser`: `if (!isOperational(user.role)) return 403`), nelle azioni e nelle pagine come descritto sopra.
- [ ] **Step 4: Eseguire il test**, atteso PASS; `npm run typecheck` pulito; cercare con Grep eventuali altre chiamate a `getStaffUser` non coperte (`src/app/gestione-tariffe…` e `…configurazione…` negano già i non-admin: lasciarle).
- [ ] **Step 5: Commit** (dopo conferma): `Dashboard: reject commercialista from operational areas; Ordini Online admin-only`.

---

### Task 7: Libreria di gestione utenti

**Files:**
- Create: `src/lib/staff-users.ts`
- Test: `tests/staff-users.test.ts`

**Interfaces:**
- Consumes: `hashPassword`, `verifyPassword` (`customer-auth.ts`), `passwordMeetsPolicy`, `revokeStaffSessions`, `createTestStaff`.
- Produces: `normalizeUsername(raw: string): string` (trim + minuscolo); `validateUsername(raw: string): string | null` (messaggio d'errore o null: 3–60 caratteri di `[a-z0-9._-]`); `generatePassword(): string` (16 caratteri da `randomInt`, sempre conforme alla policy); `listStaffUsers(): Promise<{ id: string; username: string; role: StaffRole; active: boolean; mustChangePassword: boolean; lastLoginAt: Date | null }[]>` ordinati per nome; `createStaffUser(input: { username: string; role: "operatore" | "commercialista"; password: string }): Promise<{ ok: true; id: string } | { ok: false; message: string }>` (`must_change_password = true`); `resetStaffPassword(targetId: string, newPassword: string): Promise<{ ok: true } | { ok: false; message: string }>` (solo bersagli non admin; imposta `must_change_password = true`; `revokeStaffSessions`); `setStaffActive(actorId: string, targetId: string, active: boolean): Promise<{ ok: true } | { ok: false; message: string }>` (rifiuta se `actorId === targetId` o se il bersaglio è admin; se disattiva, `revokeStaffSessions`); `changeOwnPassword(userId: string, currentRawSession: string, current: string, next: string): Promise<{ ok: true } | { ok: false; message: string }>` (verifica la password attuale, `next` conforme e diversa, azzera `must_change_password`, `revokeStaffSessions(userId, currentRawSession)`).

- [ ] **Step 1: Scrivere i test**: `normalizeUsername("  Mario ")` → `mario`; `validateUsername` rifiuta `"ab"`, `"mario rossi"`, `"mario@x"`, accetta `"mario.rossi-2"`; `generatePassword()` conforme alla policy su 200 esecuzioni e mai uguale a una precedente; `createStaffUser` con password debole → `ok:false`; con `" ZZ-Test-X "` crea `zz-test-x`, e una seconda creazione con `"zz-test-x"` o `"ZZ-TEST-X"` → `ok:false` "già esistente" (Review Focus 5); `role: "admin"` passato a forza (cast) → `ok:false`; il nuovo utente ha `mustChangePassword` vero; `resetStaffPassword` su un admin → `ok:false`, su un operatore cambia hash, imposta mustChange e chiude le sessioni; `setStaffActive` su se stesso → `ok:false`, su un admin → `ok:false`, disattivando un operatore le sue sessioni spariscono e `getStaffUser` non lo trova; `changeOwnPassword` con password attuale errata → `ok:false`, con nuova uguale all'attuale → `ok:false`, con successo azzera mustChange e conserva solo la sessione corrente.
- [ ] **Step 2: Eseguire** `npx tsx --test tests/staff-users.test.ts`, atteso FAIL.
- [ ] **Step 3: Implementare** il modulo; gli errori di unicità si ottengono controllando prima l'esistenza dell'utente normalizzato e gestendo comunque il vincolo unico del database.
- [ ] **Step 4: Eseguire il test**, atteso PASS.
- [ ] **Step 5: Commit** (dopo conferma): `Staff users: create, reset, disable and change-own-password library`.

---

### Task 8: Pagina "Cambia la mia password" (tutti i ruoli)

**Files:**
- Create: `src/app/gestione-password-x9k2m7/{layout.tsx,page.tsx,actions.ts}`, `src/components/ChangePasswordForm.tsx`

**Interfaces:**
- Consumes: `getStaffUser(cookie, { allowMustChange: true })`, `changeOwnPassword`, `roleHome`, `PasswordRequirementsList`, `passwordMeetsPolicy`.
- Produces: `changePasswordAction(prev: { error?: string; done?: boolean }, formData: FormData): Promise<{ error?: string; done?: boolean }>` (campi `current`, `next`, `confirm`); a successo redirige a `roleHome(user.role)`.

- [ ] **Step 1: Layout** come gli altri (`noindex`, importa `../gestione.css`).
- [ ] **Step 2: Pagina**: legge la sessione con `allowMustChange: true`; senza utente → login; se `mustChangePassword` mostra un avviso "Devi scegliere una nuova password per continuare". Usa `GestioneShell` solo per admin e operatore; per il commercialista una pagina nuda con il solo logo, il form e "Esci" (nessun menu).
- [ ] **Step 3: Componente** `ChangePasswordForm` (client, `useActionState`) con tre campi, `PasswordRequirementsList` per la nuova password (lingua `it`), pulsante disabilitato finché la nuova non è conforme e uguale alla conferma.
- [ ] **Step 4: Azione**: valida, chiama `changeOwnPassword` con il cookie di sessione corrente, mostra i messaggi di errore in italiano.
- [ ] **Step 5: Verificare** `npm run typecheck`, `npm run lint` sui file nuovi; la prova nel browser è nel task 15.
- [ ] **Step 6: Commit** (dopo conferma): `Dashboard: change-own-password page for all roles`.

---

### Task 9: Pagina "Utenti e password" (admin)

**Files:**
- Create: `src/app/gestione-utenti-x9k2m7/{layout.tsx,page.tsx,actions.ts}`, `src/components/UserAdminPanel.tsx`

**Interfaces:**
- Consumes: `requireAdminUser`, `listStaffUsers`, `createStaffUser`, `resetStaffPassword`, `setStaffActive`, `generatePassword`.
- Produces: azioni server `createUserAction`, `resetUserPasswordAction`, `toggleUserActiveAction`, tutte con `requireAdminUser(BASE_PATH)` come prima istruzione e tutte che restituiscono `{ ok: boolean; message?: string; generatedPassword?: string }`. `generatedPassword` compare solo quando l'admin ha scelto "Genera" e viene mostrata una volta.

- [ ] **Step 1: Pagina** in `GestioneShell` (`active` aggiunto in task 15): tabella (nome, ruolo, stato, ultimo accesso), azioni per riga solo sugli utenti non admin; gli admin compaiono ma senza pulsanti.
- [ ] **Step 2: Pannello client** (`UserAdminPanel`): modulo "Nuovo utente" (nome utente, ruolo `operatore`/`commercialista`, password con requisiti in tempo reale, pulsante "Genera"); per riga "Reimposta password" (stesso meccanismo) e "Disattiva/Riattiva"; la password generata appare in un riquadro con pulsante "Copia" e l'avviso "Non verrà mostrata di nuovo".
- [ ] **Step 3: Azioni** come da interfaccia; `revalidatePath(BASE_PATH)` dopo ogni modifica.
- [ ] **Step 4: Verificare** `npm run typecheck` e `npm run lint` sui file nuovi.
- [ ] **Step 5: Commit** (dopo conferma): `Dashboard: Users and passwords admin page`.

---

### Task 10: Seconda password e sblocco di Contabilità

**Files:**
- Create: `src/lib/contab-auth.ts`, `scripts/reset-contab-password.ts`
- Test: `tests/contab-auth.test.ts`

**Interfaces:**
- Consumes: `hashPassword`, `verifyPassword`, `digest`, `token` (`staff-auth.ts`), `limit` (`customer-auth.ts`), `passwordMeetsPolicy`, `STAFF_SESSION_COOKIE`, `getStaffUser`, `createTestStaff`.
- Produces: `CONTAB_UNLOCK_COOKIE = "ros_contab_unlock"`; `CONTAB_UNLOCK_SECONDS = 1800`; `hasContabPassword(): Promise<boolean>`; `setInitialContabPassword(password: string): Promise<{ ok: true } | { ok: false; message: string }>` (rifiuta se già impostata o debole); `changeContabPassword(current: string, next: string): Promise<{ ok: true } | { ok: false; message: string }>`; `unlockContab(user: StaffUser, sessionRaw: string, password: string): Promise<{ ok: true; unlockRaw: string } | { ok: false; message: string }>` (applica `limit("contab-unlock:" + user.id, 5, 900)`; il limite superato dà `ok:false` "Troppi tentativi, riprova tra qualche minuto"); `checkContabAccess(sessionRaw: string | undefined, unlockRaw: string | undefined): Promise<StaffUser | null>` (restituisce l'utente solo se admin, sessione valida, sblocco valido e legato a quella sessione; sposta `expires_at` e `last_seen_at` in avanti di 30 minuti); `contabAccessFromRequest(req: NextRequest): Promise<StaffUser | null>` e `contabAccessFromCookies(): Promise<StaffUser | null>` (leggono i due cookie e chiamano `checkContabAccess`).

- [ ] **Step 1: Scrivere i test**: nessuna password → `hasContabPassword` falso; `setInitialContabPassword` debole → `ok:false`, valida → ok, seconda chiamata → `ok:false`; `unlockContab` con password errata → `ok:false`; corretta → `unlockRaw` e `checkContabAccess` restituisce l'admin; sblocco di un admin su una sessione diversa → `null`; **scadenza**: riscrivere `expires_at` a un istante passato → `null`; **scorrimento**: dopo un controllo riuscito `expires_at` è di nuovo ~30 minuti avanti; un operatore (anche con sblocco forzato nel database) → `null`; `revokeStaffSessions` e `destroySession` invalidano lo sblocco; 6ª password errata in 15 minuti → messaggio di troppi tentativi; `changeContabPassword` con attuale errata → `ok:false`.
- [ ] **Step 2: Eseguire** `npx tsx --test tests/contab-auth.test.ts`, atteso FAIL. Il test salva e ripristina la riga di `contab_access` esistente per non lasciare tracce.
- [ ] **Step 3: Implementare** `contab-auth.ts` (riga unica `contab_access.id = 1`, upsert).
- [ ] **Step 4: Scrivere `scripts/reset-contab-password.ts`** sul modello di `reset-staff-password.ts`: `npx tsx scripts/reset-contab-password.ts [nuova-password]`; genera una password se omessa; stampa l'SQL `INSERT … ON CONFLICT (id) DO UPDATE` se manca `DATABASE_URL`, altrimenti aggiorna il database; azzera anche `contab_unlocks`.
- [ ] **Step 5: Eseguire il test**, atteso PASS.
- [ ] **Step 6: Commit** (dopo conferma): `Contabilita: second password, unlock sessions and reset script`.

---

### Task 11: Dati di Contabilità (sezioni, file, download)

**Files:**
- Create: `src/lib/contab-data.ts`
- Test: `tests/contab-data.test.ts`

**Interfaces:**
- Consumes: tabelle `contabSections`, `contabFiles`, `contabDownloads` (task 1).
- Produces: `type ContabFileRow = { id: number; sectionId: number; originalName: string; mime: string; sizeBytes: number; storedName: string; uploadedBy: string; uploadedAt: Date; lastDownloadAt: Date | null }`; `type ContabSectionRow = { id: number; title: string; sortOrder: number; files: ContabFileRow[] }`; `listSectionsWithFiles(): Promise<ContabSectionRow[]>` (sezioni per `sort_order` decrescente, file per data decrescente); `createSection(title: string): Promise<{ ok: true; id: number } | { ok: false; message: string }>` (titolo 1–100 caratteri dopo il trim; `sort_order = max + 1`); `renameSection(id: number, title: string)` stessa forma; `moveSection(id: number, direction: "up" | "down"): Promise<void>` (scambia `sort_order` con la vicina; "su" = verso la cima); `deleteSectionIfEmpty(id: number): Promise<{ ok: true } | { ok: false; message: string }>`; `addFile(input: { sectionId: number; originalName: string; mime: string; sizeBytes: number; storedName: string; uploadedBy: string }): Promise<number>`; `getFile(id: number): Promise<ContabFileRow | null>`; `deleteFileRow(id: number): Promise<ContabFileRow | null>` (restituisce la riga cancellata per rimuovere il file su disco); `recordDownload(file: { id: number; originalName: string }, username: string): Promise<void>`.

- [ ] **Step 1: Scrivere i test** (database di sviluppo, sezioni con titolo `zz-test-…`): la nuova sezione è la prima dell'elenco; due sezioni, `moveSection(id, "down")` le scambia; `moveSection` sulla prima verso l'alto non fa nulla e non lancia; titolo vuoto o di 101 caratteri → `ok:false`; `deleteSectionIfEmpty` con un file dentro → `ok:false` con messaggio che chiede di eliminare prima i file, vuota → ok; `recordDownload` valorizza `lastDownloadAt` in `listSectionsWithFiles`; `deleteFileRow` restituisce la riga e mantiene la riga di `contab_downloads` con `file_id` nullo e `file_name` conservato.
- [ ] **Step 2: Eseguire** `npx tsx --test tests/contab-data.test.ts`, atteso FAIL.
- [ ] **Step 3: Implementare** il modulo; lo scambio di `sort_order` in una transazione (`db.transaction`).
- [ ] **Step 4: Eseguire il test**, atteso PASS.
- [ ] **Step 5: Commit** (dopo conferma): `Contabilita: sections, files and download log data layer`.

---

### Task 12: Route API di Contabilità

**Files:**
- Create: `src/app/api/contabilita/files/route.ts`, `src/app/api/contabilita/files/[id]/route.ts`, `src/app/api/contabilita/sections/[id]/zip/route.ts`
- Test: `tests/contab-api.test.ts`

**Interfaces:**
- Consumes: `contabAccessFromRequest`, `getStaffUser`, `validateContabUpload`, `CONTAB_MAX_BYTES`, `saveContabFile`, `readContabFile`, `removeContabFile`, `newStoredName`, `addFile`, `getFile`, `deleteFileRow`, `recordDownload`, `buildZip`, `uniqueZipNames`, `createTestStaff`, `staffRequest`.
- Produces:
  - `POST /api/contabilita/files?sectionId=<n>&name=<encodeURIComponent(nome)>` (corpo grezzo): richiede admin sbloccato (altrimenti **401** `{ success:false, code:"locked", message:"Sblocco scaduto, reinserisci la password" }`); rifiuta `Content-Length` oltre 25 MB con **413**; valida con `validateContabUpload`; sezione inesistente → 404; salva su disco e poi nel database (se il database fallisce rimuove il file); risponde `{ success:true, file:{ id, originalName, sizeBytes, uploadedAt } }`.
  - `GET /api/contabilita/files/[id]`: ammesso l'admin sbloccato **oppure** un commercialista con sessione valida; altri → 401/403; file senza riga → 404; riga ma file su disco assente → **404** `{ error:"Il file non è più disponibile" }`; risposta con `Content-Type` da `mime`, `Content-Disposition: attachment; filename="<ascii>"; filename*=UTF-8''<percent>`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`; registra il download solo se l'utente è il commercialista. `DELETE` sulla stessa route: solo admin sbloccato; rimuove riga e file.
  - `GET /api/contabilita/sections/[id]/zip`: stessi permessi di download; ZIP `<titolo-sezione>.zip` con nomi univoci; oltre 200 MB complessivi → 413 con messaggio; registra un download per ogni file se l'utente è il commercialista; sezione senza file → 404.

- [ ] **Step 1: Scrivere i test** (cartella temporanea come `DOM_ARCHIVE_DIR`): upload senza sblocco → 401 con `code:"locked"`; con sblocco, PDF valido → 200 e il file su disco è cifrato; 0 byte → 400 e nessun file né riga; estensione `.exe` → 400; `Content-Length` 26 MB → 413; sezione inesistente → 404; nome `../../x.pdf` → salvato come `x.pdf`; download da commercialista → 200, contenuto identico all'originale, riga in `contab_downloads`; download da operatore → 403; download senza sessione → 401; **file sparito dal disco** → 404 con il messaggio previsto, non 500 (Review Focus 4); `DELETE` da commercialista → 403; ZIP con due file omonimi contiene `a.pdf` e `a (2).pdf` (verificare con `readZip` di `tests/helpers/zip-read.ts`, task 3).
- [ ] **Step 2: Eseguire** `npx tsx --test tests/contab-api.test.ts`, atteso FAIL.
- [ ] **Step 3: Implementare** le tre route (leggere la documentazione di Next 16 sui Route Handler dinamici `[id]` con `params: Promise<…>`); l'upload legge `await req.arrayBuffer()` come `api/dom-mail-scans/route.ts`.
- [ ] **Step 4: Eseguire il test**, atteso PASS.
- [ ] **Step 5: Commit** (dopo conferma): `Contabilita: upload, download and ZIP API routes`.

---

### Task 13: Area admin di Contabilità e impostazioni

**Files:**
- Create: `src/app/gestione-contabilita-x9k2m7/{layout.tsx,page.tsx,actions.ts,impostazioni/page.tsx}`, `src/components/ContabUploadRow.tsx`, `src/components/ContabUnlockForm.tsx`

**Interfaces:**
- Consumes: `requireAdminUser`, `contabAccessFromCookies`, `unlockContab`, `setInitialContabPassword`, `changeContabPassword`, `hasContabPassword`, funzioni di `contab-data.ts`, `formatMb`, `CONTAB_EXTENSIONS`, `CONTAB_MAX_BYTES`, `CONTAB_UNLOCK_COOKIE`.
- Produces: azioni `unlockContabAction(prev, formData)` (imposta il cookie `ros_contab_unlock`: httpOnly, `sameSite=strict`, `secure` in produzione, `maxAge` 1800, `path=/`), `setInitialContabPasswordAction`, `createSectionAction`, `renameSectionAction`, `moveSectionAction`, `deleteSectionAction`, `changeContabPasswordAction`, `deleteContabFileAction(fileId: number)`; ognuna chiama prima `requireAdminUser(BASE_PATH)` e, tranne sblocco e impostazione iniziale, `contabAccessFromCookies()` (se nullo restituisce `{ ok:false, message:"Sblocco scaduto, reinserisci la password" }`).

- [ ] **Step 1: Pagina** `page.tsx`: `requireAdminUser`; se `!hasContabPassword()` mostra il modulo "Crea la password di Contabilità"; se non sbloccata mostra `ContabUnlockForm`; altrimenti elenca le sezioni (`listSectionsWithFiles`) con titolo, riga di caricamento e tabella dei file (nome, dimensione `formatMb`, data, ultimo download del commercialista, Scarica come link a `/api/contabilita/files/[id]`, Elimina con `confirm`).
- [ ] **Step 2: `ContabUploadRow`** (client): input file nascosto dietro "Scegli file"; scelto il file mostra sulla stessa riga `nome — 0,42 MB` e il pulsante **💾 Carica** (`Save` di lucide); il caricamento usa `XMLHttpRequest` verso `/api/contabilita/files?sectionId=…&name=…` per avere l'avanzamento (percentuale sul pulsante); controlli client prima dell'invio (estensione e 25 MB, con gli stessi messaggi del server); a `401` con `code:"locked"` mostra "Sblocco scaduto, reinserisci la password" con un pulsante che ricarica la pagina (Review Focus 6); a successo azzera la riga e chiama `router.refresh()`.
- [ ] **Step 3: `impostazioni/page.tsx`**: elenco sezioni con rinomina, su/giù, elimina (disabilitato con spiegazione se contiene file), modulo "Nuova sezione", modulo "Cambia password di Contabilità", link a "Utenti e password". Stessa protezione: admin + sblocco.
- [ ] **Step 4: Azioni** come da interfaccia, con `revalidatePath` dopo ogni modifica.
- [ ] **Step 5: Verificare** `npm run typecheck` e `npm run lint` sui file nuovi.
- [ ] **Step 6: Commit** (dopo conferma): `Contabilita: admin page, upload row and settings`.

---

### Task 14: Pagina del commercialista

**Files:**
- Create: `src/app/commercialista-x9k2m7/{layout.tsx,page.tsx,actions.ts}`

**Interfaces:**
- Consumes: `requireCommercialista`, `listSectionsWithFiles`, `formatMb`, `staffLogoutAction`.
- Produces: pagina senza menu e senza `GestioneShell`: intestazione sobria ("Documentazione contabile"), link "Cambia password" (a `/gestione-password-x9k2m7`) ed "Esci"; per ogni sezione titolo, tabella (nome, dimensione, data, **Scarica** → `/api/contabilita/files/[id]`) e **Scarica tutto (ZIP)** → `/api/contabilita/sections/[id]/zip`; messaggio "Nessun documento disponibile" se non ci sono sezioni o file.

- [ ] **Step 1: Layout** `noindex`, `Cache-Control` non memorizzabile tramite `export const dynamic = "force-dynamic"` e `metadata.robots`.
- [ ] **Step 2: Pagina** come da interfaccia: server component, nessun JavaScript client; tabella leggibile su mobile.
- [ ] **Step 3: Verificare** `npm run typecheck` e `npm run lint` sui file nuovi.
- [ ] **Step 4: Commit** (dopo conferma): `Contabilita: accountant download page`.

---

### Task 15: Menu, stile, documentazione e verifica finale

**Files:**
- Modify: `src/components/GestioneNav.tsx` (tipo `active`: aggiungere `"contabilita" | "utenti"`), `src/components/GestioneSidebar.tsx` (stesso tipo; nella sezione Configurazione, solo per admin, voci "Contabilità" e "Utenti e password"; il link "Ordini Online" solo per admin), `src/app/gestione.css`
- Create: `docs/contabilita.md`

- [ ] **Step 1: Menu**: aggiungere le voci come sopra e spostare "Ordini Online" dentro il blocco `role === "admin"`.
- [ ] **Step 2: CSS**: classi per la riga di caricamento (pulsante floppy, barra di avanzamento), tabelle file, pagina commercialista; riusare `.gestione-card`, `.gestione-btn*`, `.gestione-table`.
- [ ] **Step 3: Documentazione** `docs/contabilita.md` in italiano: cos'è, ruoli, come creare un utente, come reimpostare password (interfaccia e script `reset-staff-password.ts` / `reset-contab-password.ts`), posizione dei file cifrati e backup, ordine dell'SQL, verifiche post-deploy (limite di upload dell'host).
- [ ] **Step 4: Verifica automatica**: `npm run typecheck` e `npm run lint` (gli errori preesistenti noti in `SiteChrome.tsx`, `DomiciliazioniTable.tsx`, `CustomerArea.tsx`, `ActivationFlow.tsx` restano; nessun errore nuovo); poi tutti i test: `npx tsx --test tests/contab-*.test.ts tests/zip-store.test.ts tests/staff-*.test.ts` (atteso tutto PASS).
- [ ] **Step 5: Prova manuale** in locale con un database di sviluppo e la migrazione applicata, con `AES_MASTER_KEY` e `DOM_ARCHIVE_DIR` su una cartella temporanea: creare un admin e un operatore con `scripts/reset-staff-password.ts` o `createTestStaff`; verificare nel browser, con screenshot: (a) login operatore → non vede Ordini, Tariffe, Configurazione, Contabilità, Utenti, e gli indirizzi a mano lo rimandano alle Domiciliazioni; (b) login admin → crea un commercialista dalla pagina Utenti, con password generata mostrata una volta; (c) il commercialista al primo accesso è obbligato a cambiare password, poi vede solo la sua pagina; (d) l'admin crea la seconda password, sblocca, crea una sezione "Documenti Contabilità 3° Trim", carica un XML e un PDF, vede nome e MB sulla riga di upload; (e) il commercialista scarica il file e lo ZIP e il contenuto coincide con l'originale; (f) lo sblocco scade dopo 30 minuti (accorciare temporaneamente la durata via `expires_at` nel database) e la riga di upload mostra il messaggio.
- [ ] **Step 6: Riepilogo per l'utente** con l'ordine di messa in produzione: SQL `0025` su Supabase (ALTER TYPE da solo), verifica di `AES_MASTER_KEY` e `DOM_ARCHIVE_DIR`, deploy, creazione della seconda password, creazione degli account, limite di upload dell'host.
- [ ] **Step 7: Commit** (dopo conferma): `Dashboard: menu entries, styles and accounting docs`.
