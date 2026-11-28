# Richiesta di domiciliazione online con SMS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modulo online completo (tutti i campi del PDF, flag società già costituita) con cellulare verificato via SMS come firma, nel popup esistente e in una pagina con link unico da mettere nell'offerta.

**Architecture:** Nuova tabella `domiciliation_requests` (bozza → `submitted`), tre rotte sotto `/api/manual-request` (bozza, invio OTP, verifica+conferma) che riusano `limit`, `otpDigest`, `sendLoginSms`, `protectMutation` di `customer-auth.ts`. `ManualRequestModal` diventa a due passi; la stessa UI è usata da `/richiesta-domiciliazione`.

**Tech Stack:** Next.js 16 (leggere `node_modules/next/dist/docs/` prima di toccare route/pagine, vedi AGENTS.md), Drizzle + Postgres (Supabase, migrazioni SQL a mano), Zod 4, test con `npx tsx --test tests/<file>.test.ts`.

**Spec:** `docs/superpowers/specs/2026-11-28-richiesta-domiciliazione-online-design.md`

## Global Constraints

- Testi UI e email in italiano e inglese (`lang: "it" | "en"`), come il resto del sito.
- Telefono in formato `^\+[1-9]\d{7,14}$` dopo `normalizePhone` (`src/lib/request.ts`).
- Codice SMS: 6 cifre, valido 10 minuti, max 3 invii, max 5 tentativi, 60 s tra un invio e l'altro (stessi valori di `/api/send-otp`).
- Contratti: 3, 6, 12, 24, 36, 48 mesi; `smart3x24`/`smart6x24` solo se società NON ancora costituita e `product.smartXxActive`; postale solo 6 o 12 mesi e solo società già esistente.
- Se "già costituita": sede, città, CAP, prov, CF società, P.IVA, Reg. Imprese obbligatori, più PEC o SDI.
- Nessun pagamento. Honeypot `website` come oggi. Consenso privacy obbligatorio.
- Migrazione: file SQL `drizzle/0031_domiciliation_requests.sql` con `IF NOT EXISTS`, da eseguire su Supabase PRIMA del deploy (come le precedenti).

## Review Focus

- Codice SMS riusato per un'altra richiesta o dopo la verifica → rifiutato.
- Cellulare cambiato dopo l'invio del codice → il codice non vale (la verifica confronta il telefono salvato).
- Richiesta già `submitted` reinviata/riverificata → 409, nessuna seconda email.
- Società costituenda con 3+24 e poi flag "costituita" attivato → smart rifiutato dal server.
- Email non partita ma richiesta salvata → il cliente vede errore chiaro e può riprovare senza reinserire il codice valido (stato `verified` non perso).

---

### Task 1: Tabella e migrazione

**Files:**
- Create: `drizzle/0031_domiciliation_requests.sql`
- Modify: `src/db/schema.ts` (dopo `otpVerifications`)

**Interfaces:**
- Produces: `domiciliationRequests` (drizzle table) con colonne: `id serial`, `publicId varchar(64) unique`, `tokenHash text`, `service text`, `lang varchar(2)`, `email text`, `phone text`, `formData jsonb`, `status text` (`"draft"|"verified"|"submitted"`, default `draft`), `codeHash text null`, `sends int default 0`, `attempts int default 0`, `sentAt/expiresAt/verifiedAt/submittedAt timestamptz null`, `createdAt/updatedAt timestamptz default now`.

- [ ] **Step 1:** Scrivere il file SQL `CREATE TABLE IF NOT EXISTS "domiciliation_requests"` con le colonne sopra e commento in italiano in testa (stile `0030`).
- [ ] **Step 2:** Aggiungere la tabella a `schema.ts` con gli stessi nomi snake_case.
- [ ] **Step 3:** `npm run typecheck` → nessun errore.
- [ ] **Step 4:** Commit `feat: tabella domiciliation_requests`.

### Task 2: Schema di validazione e email di conferma

**Files:**
- Modify: `src/lib/manual-request.ts` (riscrittura di `manualRequestSchema`, `buildManualRequestEmail`)
- Test: `tests/manual-request.test.ts`

**Interfaces:**
- Produces: `manualRequestSchema` (Zod) con campi: `service`, `lang`, `companyName`, `legalForm: "srl_spa_snc"|"ditta_individuale"|"associazione"|"altro"`, `companyExists: boolean`, `companyAddress, companyCity, companyCap, companyProvince, companyTaxCode, companyVat, companyRegister, companyEmail, companyPec, companySdi` (obbligatori solo se `companyExists`), `representativeName, birthPlace, birthDate (YYYY-MM-DD), residenceAddress, residenceCity, residenceCap, residenceProvince, representativeTaxCode (isValidTaxCode), email, representativePhone (normalizePhone)`, `months` (numero o `smart3x24|smart6x24`), `startDate` (non nel passato), `notes`, `consent: true`, `website` max 0.
- Produces: `type ManualRequestInput`; `buildManualRequestEmail(input, product, verifiedAt: Date): MailPayload` (cliente `to`, admin `bcc`, riepilogo di tutti i campi + "Cellulare verificato via SMS il <data ora Europe/Rome>").

- [ ] **Step 1:** Test: `accepts a complete constituted company`, `rejects constituted company without PEC and SDI`, `rejects smart3x24 when company exists`, `rejects postal when company does not exist`, `rejects phone without international prefix`, `rejects past start date`, `skips address fields when company is being formed`.
- [ ] **Step 2:** Run `DATABASE_URL=postgres://x:x@127.0.0.1:1/x npx tsx --test tests/manual-request.test.ts` → FAIL.
- [ ] **Step 3:** Implementare lo schema con `superRefine` (regole nei Global Constraints; PEC/SDI con le stesse regex di `request.ts`).
- [ ] **Step 4:** Test per `buildManualRequestEmail`: contiene la ragione sociale, il telefono, "SMS" e la data di verifica; implementare.
- [ ] **Step 5:** Run test → PASS; `npm run typecheck`.
- [ ] **Step 6:** Commit `feat: schema completo e email del modulo di richiesta`.

### Task 3: Rotte API (bozza, invio codice, verifica e conferma)

**Files:**
- Modify: `src/app/api/manual-request/route.ts` (diventa la creazione/aggiornamento bozza)
- Create: `src/app/api/manual-request/send-otp/route.ts`, `src/app/api/manual-request/verify/route.ts`
- Create: `src/lib/manual-request-access.ts`

**Interfaces:**
- Consumes: `manualRequestSchema`, `buildManualRequestEmail` (Task 2), `domiciliationRequests` (Task 1), `protectMutation, limit, clientIp, token, digest, otpDigest, constantEqual, sendLoginSms, CustomerError, json`, `smsBypassEnabled`, `getOffer`, `tierFor`, `sendMail, smtpConfigured`.
- Produces: `POST /api/manual-request` → `{ requestId }` e cookie httpOnly `ros_request_access` (8 h); body = form + opzionale `requestId` per aggiornare la bozza. `POST .../send-otp {requestId}` → `{ ok, resendAfter: 60 }`. `POST .../verify {requestId, code}` → `{ ok: true, emailSent: boolean }`. `ownedRequest(req, requestId)` in `manual-request-access.ts` (verifica cookie con `digest`, errore 404/403 come `ownedOrder`).
- Regole: bozza non modificabile se `status = submitted` (409); la verifica salva `verifiedAt`, imposta `status=submitted`, invia la mail; se la mail fallisce lo stato resta `verified` e la verifica può essere ripetuta senza nuovo codice (`POST verify` con `code` omesso quando `status=verified` rinvia solo la mail). Bypass debug con `DEBUG_BYPASS_PHONE` come in `/api/send-otp`. Rate limit: IP 20/15 min, email 5/h, SMS per telefono 5/15 min.

- [ ] **Step 1:** Leggere `src/app/api/send-otp/route.ts` e `verify-otp/route.ts` e replicarne struttura e codici d'errore.
- [ ] **Step 2:** Implementare le tre rotte e `ownedRequest`.
- [ ] **Step 3:** `npm run typecheck && npm run lint`.
- [ ] **Step 4:** Commit `feat: API richiesta online con verifica SMS`.

### Task 4: Popup a due passi e pagina con link

**Files:**
- Modify: `src/components/ManualRequestModal.tsx`
- Create: `src/components/ManualRequestForm.tsx` (form + passo SMS, usato da popup e pagina)
- Create: `src/app/richiesta-domiciliazione/page.tsx`, `src/app/en/request-domiciliation/page.tsx`
- Modify: `src/app/sitemap.ts` solo se le altre pagine commerciali sono elencate; altrimenti niente.

**Interfaces:**
- Consumes: le tre rotte del Task 3.
- Produces: `<ManualRequestForm product lang onDone />`; la pagina legge `?service=legal_unit|postal` (default `legal_unit`) e carica il prodotto con `getOffer`.
- Comportamento: passo 1 campi del PDF (blocco società mostrato solo se flag "già costituita"; opzioni smart solo se non costituita; telefono con nota formato internazionale), passo 2 campo codice a 6 cifre, "Invia di nuovo" dopo 60 s, errori `limited/wait/invalid-or-expired-code` localizzati, schermata finale "Richiesta inviata".

- [ ] **Step 1:** Leggere la guida Next 16 in `node_modules/next/dist/docs/` per le pagine app-router e `generateMetadata`; copiare il pattern di una pagina esistente (`src/app/[slug]/page.tsx`).
- [ ] **Step 2:** Estrarre il form in `ManualRequestForm` aggiungendo i campi e il passo SMS; il popup lo incapsula.
- [ ] **Step 3:** Creare le due pagine (`noindex`).
- [ ] **Step 4:** `npm run typecheck && npm run lint && npm run build`.
- [ ] **Step 5:** Commit `feat: modulo online completo con SMS, popup e pagina`.

### Task 5: Link nell'offerta, documentazione, prova locale

**Files:**
- Modify: `src/lib/standard-offer.ts` (testo e allegato), `src/app/api/standard-offer/route.ts` se legge il PDF, `docs/struttura-progetto.md`
- Test: `tests/standard-offer.test.ts` (se esiste, altrimenti nuovo)

**Interfaces:**
- Consumes: URL pagina del Task 4: `${NEXT_PUBLIC_SITE_URL}/richiesta-domiciliazione?service=<code>` (IT) / `/en/request-domiciliation?service=<code>` (EN).

- [ ] **Step 1:** Test: l'email dell'offerta contiene il link e non ha più `attachments`.
- [ ] **Step 2:** Run → FAIL. Sostituire il paragrafo sull'allegato con il link e togliere l'allegato e `readOriginalRequestModule` dall'invio.
- [ ] **Step 3:** Run → PASS.
- [ ] **Step 4:** Aggiungere in `docs/struttura-progetto.md` la tabella e le rotte nuove e il passo di deploy (SQL su Supabase).
- [ ] **Step 5:** Prova locale: `npm run dev`, compilare il modulo con `DEBUG_BYPASS_PHONE` impostato, verificare riga `submitted` nel DB e email.
- [ ] **Step 6:** Commit `feat: link al modulo online nell'offerta standard`.
