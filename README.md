# Roma Office Sharing — bilingual website

Production-oriented bilingual website built with Next.js App Router, PostgreSQL and Drizzle ORM. Italian is primary; every requested page has a contextual English counterpart. The application includes responsive UI, contact capture, a consent manager, checkout integrations, OTP verification, signature capture, SEO metadata and Hostinger deployment guidance.

> No real credentials are committed. Prices, VAT treatment, company VAT/REA values, testimonials and legal wording must be approved before launch. The prompt referred to an “exact” Italian privacy text but did not include it; a complete nine-section draft and faithful English translation are present. Replace the Italian policy with counsel-approved source text if available.

## Ultimo aggiornamento: tariffe e offerta standard

Il tariffario ora presenta due offerte acquistabili, sede legale e postale/commerciale. Prezzi, IVA, sconti ed extra sono letti dal database; `scripts/seed-catalog.ts` inizializza i valori senza sovrascrivere quelli già presenti. La fonte prezzi non è più una costante in `pricing.ts`.

Vedere **`docs/pricing-and-standard-offers.md`** per la configurazione aggiornata, il popup email, l'allegato originale obbligatorio, i limiti degli asset ricevuti e l'acquisto postale con condizioni da accettare. Questo documento prevale sui riferimenti al precedente flusso dimostrativo riportati sotto. Il vecchio OTP dimostrativo `123456` non è più accettato per acquisti: configurare il provider SMS.

## Project tree

```text
src/
  app/
    [slug]/page.tsx             Italian .html routes
    en/[slug]/page.tsx          English .html routes
    api/
      contact/route.ts
      order/route.ts
      create-payment-session/route.ts
      domiciliation-request/route.ts
      domiciliation-request/finalize/route.ts
      verify-payment/route.ts
      send-otp/route.ts
      verify-otp/route.ts
      save-signature/route.ts
      webhook/{stripe,paypal,esign}/route.ts
      health/route.ts
    globals.css layout.tsx page.tsx robots.ts sitemap.ts
  components/
    Interactive.tsx PageView.tsx SiteChrome.tsx
  db/
    index.ts schema.ts
  lib/site.ts
  proxy.ts
public/
  images/office-hero.jpg logo-mark.svg
docs/route-map.md
examples/
  node/app.js php/api.php storage-schema.sql
README.md
```

See `docs/route-map.md` for the Italian → English route pairs and supplied-copy placement. The site now also includes Gallery (`/gallery.html` ↔ `/en/gallery.html`) and the SMS-protected Customer Area (`/area-clienti.html` ↔ `/en/customer-area.html`). See `docs/customer-area.md` for account invitations, SMS configuration, private contract publication and Hostinger deployment; see `docs/content-and-assets.md` for branding, image sources and the revised English terminology. All requested routes exist, including `/index.html` through the Italian dynamic route in addition to `/`.

## Local development

Requirements: Node.js 20+, npm and PostgreSQL.

1. Copy/create `.env` and set at least `DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB`.
2. Run `npm install`.
3. Apply schema: `npx drizzle-kit push`.
4. Start: `npm run dev`, then open `http://localhost:3000`.
5. Production check: `npx next typegen && npm exec tsc -- --noEmit && npm run build`.

### Environment variables

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
NEXT_PUBLIC_SITE_URL=https://www.romaofficesharing.it
STRIPE_SECRET=sk_test_REPLACE
STRIPE_WEBHOOK_SECRET=whsec_REPLACE
NEXT_PUBLIC_STRIPE_PUBLISHABLE=pk_test_REPLACE
PAYPAL_CLIENT_ID=REPLACE
PAYPAL_SECRET=REPLACE
PAYPAL_WEBHOOK_ID=REPLACE
PAYPAL_API_URL=https://api-m.sandbox.paypal.com
SUMUP_API_KEY=sup_REPLACE
SUMUP_MERCHANT_CODE=MC_REPLACE
BANK_HOLDER=Cube Engineering s.r.l.
BANK_IBAN=IT00X0000000000000000000000
BANK_BIC=REPLACE
BANK_NAME=REPLACE
ADMIN_EMAIL=info@romaofficesharing.it
MAIL_FROM=no-reply@romaofficesharing.it
OTP_SECRET=GENERATE_A_LONG_RANDOM_SECRET
TWILIO_ACCOUNT_SID=REPLACE
TWILIO_AUTH_TOKEN=REPLACE
TWILIO_FROM=+39_REPLACE
ESIGN_PROVIDER_KEY=REPLACE
ESIGN_WEBHOOK_SECRET=REPLACE
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=REPLACE
SMTP_PASS=REPLACE
GOOGLE_MAPS_API_KEY=OPTIONAL_REPLACE
```

Generate `OTP_SECRET` with `openssl rand -hex 32`. Never prefix server secrets with `NEXT_PUBLIC_`. Rotate any accidentally exposed secret immediately.

## Hostinger deployment

### Option A — Hostinger Node.js hosting (recommended)

Confirm the plan exposes **Websites → Manage → Advanced → Node.js**; availability varies by plan and region.

1. In hPanel, create the website and point the domain’s nameservers/A records as shown under **Domains**.
2. Upload the repository by Git integration when available, or with File Manager/SFTP. Keep application source outside `public_html` if hPanel’s Node manager provides an application root.
3. Select Node 20 or later. Set build command `npm ci && npm run build`, start command `npm run start`, and application port from Hostinger’s injected `PORT`.
4. Add all environment variables in the Node application’s **Environment variables** screen. Do not upload `.env` to `public_html`.
5. Create a PostgreSQL database if the plan supports it, or use a managed PostgreSQL provider. Copy its SSL-enabled URL into `DATABASE_URL`. Run `npx drizzle-kit push` once from Hostinger SSH/application terminal.
6. Configure the domain to proxy to the Node application, restart it, and check `/api/health`.
7. In **Security → SSL**, enable the included Lifetime SSL/AutoSSL, force HTTPS, and verify renewal. Do not enable payment webhooks until HTTPS is valid.
8. Add Stripe, PayPal and e-sign webhook URLs shown below; use production keys only after sandbox acceptance.

### Option B — static frontend in `public_html`, PHP API

Use this where the plan cannot run Node. Next server routes require Node, so deploy a static export or a separately generated static frontend and use `examples/php/api.php` for `/api/*`.

1. Configure `output: 'export'` only after replacing server APIs and request-based language detection with static equivalents. Build locally and upload the contents of `out/` (not the folder itself) into `public_html/`; English assets/routes remain under `public_html/en/`.
2. Place the PHP router outside publicly browsable asset folders where possible. Use `.htaccess` to route `/api/*` to it. Install Composer dependencies listed in the PHP example.
3. Store secrets in hPanel’s PHP environment facility or a configuration file above `public_html`; deny web access to that file. Never hard-code secrets in JavaScript/PHP committed to Git.
4. Import `examples/storage-schema.sql` into PostgreSQL. If only MySQL is available, adapt enum/JSON syntax and PDO DSN.
5. PHP webhook bodies must be read from `php://input` before JSON transformation. Keep Stripe/PayPal/e-sign signature verification mandatory.

### Upload with File Manager or SFTP

- hPanel: **Files → File Manager → public_html → Upload**.
- SFTP template: host `sftp://YOUR_HOST`, port `65002` (or value shown in hPanel), username `YOUR_USERNAME`, password/key `YOUR_SECRET`, remote directory `/public_html`.
- FTP fallback: host `ftp.YOUR_DOMAIN`, port `21`, explicit TLS enabled. Prefer SFTP and never save passwords in this repository.
- Ensure directories are `755`, files `644`; secrets must not be world-readable.

### DNS, email and cron

Point `@` and `www` according to hPanel’s target IP, wait for DNS propagation, issue SSL, then force a single canonical HTTPS host. For email, use Hostinger SMTP (`smtp.hostinger.com`, port 465 TLS or 587 STARTTLS) or SendGrid/Mailgun. Authenticate SPF, DKIM and DMARC. Send order confirmations from the backend with an expiring signed URL to the PDF, never a public object URL. Schedule a daily job to expire OTPs and enforce retention deletion.

## Payments and webhook testing

- **SumUp:** create an API key in the SumUp dashboard and set `SUMUP_API_KEY` plus `SUMUP_MERCHANT_CODE`. SumUp Hosted Checkout returns `hosted_checkout_url`; confirm the result through `GET /v0.1/checkouts/{checkout_reference}` (implemented in `/api/verify-payment`). SumUp does not sign webhooks with an HMAC secret, so verify every payment by polling the API before fulfilment.
- **Stripe:** use test keys and test card `4242 4242 4242 4242`. Run `stripe listen --forward-to localhost:3000/api/webhook/stripe`; copy the CLI `whsec_…` value. Test successful, declined and cancelled flows. The handler uses the raw body and `constructEvent`; never parse/serialize first.
- **PayPal:** create buyer/seller accounts in the PayPal Developer Sandbox, configure sandbox credentials and register `/api/webhook/paypal`. Use the Webhooks Simulator, but also complete a real sandbox capture. The handler calls `verify-webhook-signature` with transmission headers and webhook ID.
- Expose local callbacks only for testing: `ngrok http 3000`; update temporary webhook URLs and remove them afterwards.
- Checkout must use server-calculated catalog prices. Current figures are demonstrative and explicitly labelled “insert real prices here.” Confirm whether VAT applies before publishing.
- Stripe Checkout and PayPal host sensitive card entry, reducing PCI scope. Complete the applicable SAQ and never log card/payment credentials.

Webhook endpoints:

```text
POST /api/webhook/stripe
POST /api/webhook/paypal
POST /api/webhook/esign
POST /api/verify-payment
POST /api/domiciliation-request
POST /api/domiciliation-request/finalize
```

Use idempotency/event-ID storage in production to reject duplicate delivery. Reconcile paid status against provider amount, currency, order ID and expected product before fulfilment.

## Order, OTP and signing flow

### Tariffe (price list) and activation pages

`/tariffe.html` and `/en/pricing.html` are pure offer/list pages: no purchase happens there. Every offer links to the activation page (`/attiva.html`, `/en/activate.html`), which the home page also exposes through the **ATTIVA SUBITO / ACTIVATE NOW** button.

The purchasable offer is **Domiciliazione Sede Legale / Unità Locale** with durations of 3, 6, 12, 24, 36 and 48 months, promotional rates valid until 30 September 2026, a one-off 10% new-activation discount on the 6- and 12-month tiers, and a 10% discount for additional domiciliations with the same referent/administrator. All amounts are exclusive of 22% VAT, which is added in the price breakdown before charging. Prices live in PostgreSQL (`service_catalog`, `service_prices`, `service_addons`). `src/lib/pricing.ts` calculates totals from database-provided data; edit the database catalogue, not frontend constants. See `docs/pricing-and-standard-offers.md`.

### Activation flow (request → SMS OTP → email → payment)

1. The customer fills the request form: company data (only if the company already exists), mandatory legal representative/administrator data, contract duration (3/6/12/24/36/48 months), contract start date and a valid phone number, plus the mandatory GDPR consent.
2. `POST /api/domiciliation-request` validates the data with Zod, recomputes the price server-side and stores a `pending` order.
3. `POST /api/send-otp` sends a 10-minute code to the declared mobile (Twilio when configured; `123456` only without credentials for local demonstration). `POST /api/verify-otp` compares an HMAC of the code in constant time and limits attempts. Submission is blocked until the code is verified.
4. `POST /api/domiciliation-request/finalize` checks that the OTP was verified, marks the order `filled`, generates the request PDF and emails it to the administration address; the customer also receives an email.
5. Payment method is chosen by the customer:
   - **PayPal / Stripe / SumUp**: the endpoint creates the provider session and returns the hosted-payment URL (Stripe Checkout, PayPal Orders approve link, SumUp Hosted Checkout). Amounts are always recalculated server-side.
   - **Bank transfer**: the customer email contains all payment data (holder, IBAN, BIC, bank, payment reason, amount) with the request form attached as a PDF, and the PDF is also offered as an in-page download.
6. `POST /api/verify-payment` is called when the customer returns from Stripe, PayPal or SumUp and confirms the authoritative status through the provider API before an order is marked `paid`. Never treat the browser redirect as proof of payment.
7. Optional signature: the signature pad posts to `POST /api/save-signature` and returns a PDF with order metadata. For full legal validity prefer a qualified e-signature provider (DocuSign, Adobe Acrobat Sign, Yousign, SignRequest); process the verified callback on `/api/webhook/esign` and store only the provider envelope/document key.

Before accepting real orders, add authentication to a `/order/[token]` area, bind all OTP/signature operations to a paid database record, add IP/device audit metadata under a documented lawful basis, and virus-scan uploaded documents.

## Storage, retention and GDPR

Recommended private structure in S3-compatible storage:

```text
orders/{year}/{order-id}/application.json
orders/{year}/{order-id}/signature.png
orders/{year}/{order-id}/signed-contract.pdf
orders/{year}/{order-id}/audit.json
```

Keep the bucket private, enable server-side encryption, object versioning and access logs, and grant the app least-privilege access. Hostinger-protected storage is acceptable only if files are outside `public_html` and downloads pass through an authorised, expiring endpoint.

Suggested schedule (confirm with counsel): contact leads 24 months; contracts/accounting records 10 years; OTP/audit records 12 months where justified; uncompleted orders 30–90 days; cookie choice 6 months. Encrypt at rest and in transit, record administrative access, test restores, maintain processor agreements and Standard Contractual Clauses where needed, and implement export/deletion request procedures. Suppress deletion only where a documented legal retention obligation applies.

Consent can be changed via **Cookie settings** in every footer. Privacy and footer provide revocation contact `cubeng@pec.it` and `+39 06 21116268`. Necessary cookies remain active; analytics/marketing scripts must only load after the matching `cookieConsentChanged` permission. Do not add Google Maps/analytics directly without consent gating; the current map uses an OpenStreetMap embed.

## Email and SMS

Use Hostinger SMTP, SendGrid or Mailgun with Nodemailer in Node or PHPMailer in PHP. Queue transactional delivery and record provider message IDs, not full message content. Twilio is implemented through its REST API; MessageBird, Vonage or an Italian provider can replace it. Rate-limit by IP, phone and order; use CAPTCHA after suspicious retries. Twilio test credentials do not deliver real SMS—use test magic numbers to validate API errors, and a controlled real number only in a documented staging test.

## Deployment alternatives

- **Vercel frontend/API + managed PostgreSQL/object storage:** easiest Next deployment and preview workflow; recurring provider dependency and EU data-location review required.
- **Hostinger static frontend + Railway/Render/DigitalOcean backend:** compatible with basic hosting; requires CORS configuration, two deployments and careful cookie/domain settings.
- **Single Hostinger VPS:** maximum control and standard Node/PostgreSQL support; you own patching, firewall, backups, process supervision and monitoring.

When splitting frontend/backend, set a strict allowed origin, use HTTPS, CSRF protection for cookie-authenticated operations, and expose the API base through a non-secret public config value.

## Accessibility, SEO and performance

The site includes semantic landmarks/headings, a skip link, visible focus, keyboard mobile menu, live validation status, explicit labels, reduced-motion handling, sufficient color contrast, local optimized imagery, responsive image generation, lazy map loading, unique localized metadata, canonical/hreflang, localized LocalBusiness JSON-LD, `sitemap.xml` and `robots.txt`.

Image: Pexels photo 8082224 by Max Vakhtbovych, downloaded in compressed form. Verify the Pexels licence/attribution policy at launch.

## Pre-launch QA checklist

- [ ] Replace demonstrative prices, VAT/REA placeholder and testimonial placeholders; secure written copy/legal approval.
- [ ] Run axe/WAVE plus keyboard-only and screen-reader checks; test 200% zoom and mobile landscape.
- [ ] Validate every IT↔EN switch, canonical/hreflang, sitemap, JSON-LD and 404 response behavior.
- [ ] Run Lighthouse on representative pages; verify responsive images, caching and no third-party script before consent.
- [ ] Test required consent, honeypot, rate limits, email failures and contact persistence without logging personal data.
- [ ] Complete Stripe/PayPal sandbox success, cancel, decline, duplicate and forged-webhook tests; reconcile amount/currency.
- [ ] Test OTP expiry/resend/attempt lockout, touch signature, PDF integrity, secure link expiry and deletion workflow.
- [ ] Verify HTTPS/HSTS, backups/restores, secret rotation, dependency scanning, SPF/DKIM/DMARC and production monitoring.
