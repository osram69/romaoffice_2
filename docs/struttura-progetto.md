# Struttura del progetto — Roma Office Sharing

Documento di orientamento in italiano. Riassume come è organizzato il repository `romaoffice_2` prima di iniziare a modificarlo. Per i dettagli operativi già documentati (deploy, prezzi, area clienti) non li ripeto qui: rimando ai file in `docs/` e al `README.md`, indicati in fondo.

## 1. Panoramica tecnica

- **Sito bilingue** (italiano primario, inglese secondario) per Roma Office Sharing, marchio di Cube Engineering s.r.l.
- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript, styling con Tailwind CSS 4.
- **Database**: PostgreSQL, accesso tramite Drizzle ORM (`drizzle-orm` + `drizzle-kit`).
- **Integrazioni esterne**: Stripe, PayPal, SumUp (pagamenti); Twilio (SMS OTP); Nodemailer/SMTP (email transazionali); `pdf-lib` (generazione PDF); Playwright (test end-to-end).
- **Hosting previsto**: Hostinger (Node.js hosting o VPS), con alternativa statica + backend PHP descritta nel README.

## 2. Albero delle cartelle

```text
romaoffice_2/
├─ src/
│  ├─ app/                     Routing Next.js (App Router)
│  │  ├─ [slug]/page.tsx        Pagine italiane dinamiche (es. /tariffe.html)
│  │  ├─ en/[slug]/page.tsx     Pagine inglesi dinamiche (es. /en/pricing.html)
│  │  ├─ en/page.tsx            Home inglese
│  │  ├─ page.tsx               Home italiana
│  │  ├─ layout.tsx             Layout radice (metadata, font, wrapper globale)
│  │  ├─ robots.ts / sitemap.ts SEO tecnico generato dinamicamente
│  │  ├─ globals.css / features.css / commerce.css   Stili globali
│  │  └─ api/                   Route handler (endpoint server, vedi §4)
│  ├─ components/               Componenti React (vedi §3)
│  ├─ db/
│  │  ├─ schema.ts              Schema Drizzle (tabelle, enum) — fonte di verità dei dati
│  │  └─ index.ts                Connessione/istanza del client DB
│  ├─ lib/                      Logica di dominio, non React (vedi §5)
│  └─ proxy.ts                  Middleware Next: inietta l'header x-pathname per il rendering lato server
├─ public/                      Asset statici (immagini, logo, gallery, PDF del modulo)
├─ docs/                        Documentazione tecnica di dettaglio (in inglese)
├─ examples/                    Esempi per il deploy alternativo (Node standalone, PHP, schema SQL)
├─ scripts/                     Script CLI di amministrazione (seed catalogo, gestione clienti)
├─ tests/                       Test automatici (Node test runner + Playwright)
├─ README.md                    Guida principale: setup, deploy, env, checklist pre-lancio
└─ package.json / tsconfig / drizzle.config.json / next.config.ts / eslint.config.mjs   Configurazione strumenti
```

## 3. Componenti (`src/components`)

| Componente | Ruolo |
|---|---|
| `SiteChrome.tsx` | Header, footer, menu di navigazione, switch lingua IT/EN |
| `PageView.tsx` | Wrapper generico di una pagina di contenuto (hero, sezioni, SEO) |
| `Interactive.tsx` | Elementi interattivi condivisi (form, validazioni lato client, cookie banner) |
| `AddressServices.tsx` | Testi/schede dei servizi di domiciliazione |
| `PricingOffers.tsx` | Tabelle tariffe (sede legale, postale) con i pulsanti di attivazione/offerta |
| `StandardOfferModal.tsx` | Popup "richiedi offerta standard" (invio email con modulo allegato) |
| `ManualRequestModal.tsx` | Popup "compila il modulo online": richiesta leggera senza OTP/pagamento, invia una sola email (nessun salvataggio su DB) |
| `ActivationFlow.tsx` | Flusso multi-step di attivazione (dati, OTP, pagamento, firma) |
| `OfferTerms.tsx` | Testo condizioni da accettare per l'acquisto (es. postale) |
| `CustomerArea.tsx` | Portale clienti: login, OTP, elenco contratti, download |
| `Gallery.tsx` | Galleria immagini con lightbox accessibile |
| `BrandWords.tsx` | Rendering del logo testuale "ROMA OFFICESHARING" con i due colori del brand |

## 4. API (`src/app/api/*/route.ts`)

| Endpoint | Scopo |
|---|---|
| `POST /api/contact` | Form di contatto generico |
| `POST /api/domiciliation-request` | Crea una richiesta di attivazione (ordine `pending`), ricalcola il prezzo lato server |
| `POST /api/domiciliation-request/finalize` | Conferma la richiesta dopo OTP verificato, genera PDF, invia email |
| `POST /api/send-otp` / `POST /api/verify-otp` | Invio e verifica del codice SMS per l'attivazione |
| `POST /api/save-signature` | Salva la firma grafometrica e genera il PDF con i metadati dell'ordine |
| `POST /api/order` | Gestione ordine (dettagli/aggiornamento) |
| `POST /api/create-payment-session` | Crea la sessione di pagamento presso il provider scelto |
| `POST /api/verify-payment` | Conferma lo stato di pagamento interrogando il provider (mai fidarsi del solo redirect) |
| `POST /api/webhook/{stripe,paypal,esign}` | Webhook dei provider di pagamento/firma elettronica |
| `POST /api/standard-offer` | Popup "offerta standard": invia email con listino e modulo PDF allegato |
| `POST /api/manual-request` | Popup "compila il modulo online": invia email con i dati del richiedente, nessun salvataggio su DB |
| `POST /api/customer/login,verify,resend,password,logout` + `GET /api/customer/me,contract` | Autenticazione e area clienti (vedi `docs/customer-area.md`) |
| `GET /api/health` | Health check per il monitoraggio/deploy |

## 5. Logica di dominio (`src/lib`)

| File | Contenuto |
|---|---|
| `site.ts` | Mappa delle rotte IT↔EN (`routeMap`), testi UI multilingua, dati di contatto, elenco servizi, definizione pagine (`PageDef`) |
| `pricing.ts` | Calcolo prezzi/sconti/IVA a partire dai dati del database (non più costanti hard-coded) |
| `catalog.ts` | Lettura del catalogo servizi/prezzi/addon da PostgreSQL |
| `standard-offer.ts` | Logica del popup offerta standard (validazione, allegato, invio) |
| `offer-terms.ts` | Generazione/versionamento del testo delle condizioni da accettare |
| `order-checkout.ts` | Orchestrazione del checkout (creazione sessione, riconciliazione) |
| `order-access.ts` | Controllo di accesso/token per gli ordini |
| `payments.ts` | Integrazione con Stripe/PayPal/SumUp |
| `pdf.ts` | Generazione dei PDF (riepilogo ordine, allegati) con `pdf-lib` |
| `mailer.ts` | Invio email transazionali via SMTP/Nodemailer |
| `request.ts` | Utility di validazione richieste (Zod) |
| `gallery.ts` | Dati/metadati delle immagini della gallery |
| `customer-auth.ts` | Login, sessioni, OTP e password dell'area clienti |
| `customer-documents.ts` | Cifratura/accesso ai contratti dei clienti |
| `customer-invitations.ts` | Logica di invito clienti usata da `scripts/customer-admin.ts` |

## 6. Dati (`src/db/schema.ts`)

Tabelle principali, tutte in PostgreSQL via Drizzle:

- **`contacts`** — messaggi dal form di contatto.
- **`orders`** — ordini di domiciliazione (stato `pending → paid/filled/signed/cancelled`, importo, provider, snapshot del preventivo accettato).
- **`otp_verifications`** — codici SMS per il flusso di attivazione.
- **`customers`, `customer_challenges`, `customer_sessions`, `customer_password_tokens`, `customer_contracts`, `customer_audit`** — area clienti (account, login a due fattori, sessioni, contratti cifrati, log di audit).
- **`auth_limits`** — rate limiting su login/OTP.
- **`service_catalog`, `service_prices`, `service_addons`** — listino ufficiale (IVA, sconti, scadenze offerte, prezzi per durata, servizi opzionali). È l'unica fonte dei prezzi mostrati e addebitati.
- **`standard_offer_requests`** — richieste del popup "offerta standard" (con hash dell'allegato per verifica).

## 7. Routing bilingue: come funziona

- Le pagine italiane passano dalla route dinamica `src/app/[slug]/page.tsx`; quelle inglesi da `src/app/en/[slug]/page.tsx`.
- `src/lib/site.ts` contiene `routeMap` (IT→EN) e `reverseRouteMap` (EN→IT): lo switch lingua nell'header usa questa mappa per restare sulla pagina corrispondente.
- `src/proxy.ts` è il middleware Next: inietta l'header `x-pathname` per il rendering server-side, escludendo `api`, asset e immagini.
- L'elenco completo delle coppie di rotte IT/EN è in [`docs/route-map.md`](route-map.md).

## 8. Script di amministrazione (`scripts/`)

- `seed-catalog.ts` — inizializza `service_catalog`/`service_prices`/`service_addons` in modo idempotente (non sovrascrive prezzi già modificati).
- `customer-admin.ts` — CLI per staff: invitare clienti, pubblicare contratti, cambiare numero di telefono, disabilitare account, pulizia periodica di sessioni/OTP scaduti. Dettagli in [`docs/customer-area.md`](customer-area.md).

## 9. Test

- `tests/*.test.ts` — test di integrazione con il Node test runner (`npx tsx --test ...`), es. `commerce-api.test.ts`, `customer-api.test.ts`, `test-smtp.ts`.
- `tests/*.spec.ts` — test end-to-end con Playwright (`commerce.spec.ts`, `website.spec.ts`).

## 10. Documentazione già esistente (da consultare prima di duplicare)

| File | Cosa spiega |
|---|---|
| [`README.md`](../README.md) | Setup locale, variabili d'ambiente, deploy su Hostinger, flusso di pagamento/OTP, checklist pre-lancio |
| [`docs/route-map.md`](route-map.md) | Tabella completa rotte IT↔EN e posizionamento dei contenuti forniti |
| [`docs/content-and-assets.md`](content-and-assets.md) | Terminologia inglese, branding, provenienza delle immagini |
| [`docs/customer-area.md`](customer-area.md) | Area clienti: sicurezza, configurazione, comandi CLI, API |
| [`docs/pricing-and-standard-offers.md`](pricing-and-standard-offers.md) | Tariffario da database, popup offerta standard, acquisto postale |

## 11. Punti aperti segnalati nella documentazione esistente

Prima di intervenire conviene sapere che il repo segnala esplicitamente:

- **Asset mancanti**: il logo `public/LogoFull_trasp.svg` è un placeholder (non l'SVG originale) e il modulo `public/Modulo_Richiesta_Domiciliazione_ns.pdf` non era presente — va sostituito con l'originale prima del lancio.
- **Prezzi, IVA, dati REA/VAT e testimonianze** sono dimostrativi e da confermare/approvare.
- **Testo privacy** italiano è una bozza completa in attesa di validazione legale.
- **OTP demo `123456`** funziona solo in locale senza Twilio configurato; non è utilizzabile per acquisti reali.

---

Questo documento descrive lo stato del repository al momento della clonazione (2026-09-16). Se il codice cambia, va aggiornato di conseguenza.
