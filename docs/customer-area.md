# Customer Area / Area Clienti

## What is implemented

- `/area-clienti.html` ↔ `/en/customer-area.html`: fully localized customer portal.
- Email/password followed by a six-digit SMS code sent **only to the mobile stored on the customer account**. The browser cannot change the destination.
- Passwords use scrypt (N=32768, r=8, p=1, random salt); OTPs are HMAC-hashed and expire after 5 minutes. Five failed code attempts invalidate access. Codes are single-use. Resends have a 60-second cooldown, with at most three sends per challenge; failed attempts do not reset on resend.
- Session tokens are cryptographically random, stored as SHA-256 hashes, and delivered in Secure / HttpOnly / SameSite=Strict cookies. Sessions expire after two hours. Logout and password changes revoke sessions.
- Login and recovery requests are rate-limited in PostgreSQL; updates are atomic. Generic errors avoid exposing whether an email belongs to a customer. Mutations reject cross-site origins.
- Password setup/recovery uses an emailed single-use token that expires after one hour. Setting a password **does not** bypass SMS sign-in.
- Contracts are AES-256-GCM encrypted outside `public/`. Every download checks the current session and customer ownership, records an audit event, and returns an attachment with `Cache-Control: private, no-store`.
- Other downloads and identity document uploads are **reserved UI sections only**. There is no public identity-document upload endpoint yet.
- There are no default accounts or fixed customer-login OTPs. If Twilio is unconfigured, sign-in fails closed with a localized explanation. The older activation-request SMS demo is separate and cannot authenticate a customer.

## Configuration

Set through your Node application's protected environment settings in hPanel. These values are server-only:

| Variable | Purpose |
|---|---|
| `AUTH_SECRET` | Random secret, at least 32 characters, for authentication HMACs and rate-limit identifiers. Generate using `openssl rand -hex 32`. |
| `CUSTOMER_DOCUMENT_KEY` | 32-byte encryption key expressed as 64 hex characters, generated independently. Keep a backed-up copy in a secrets manager. |
| `CUSTOMER_STORAGE_PATH` | Absolute or app-relative private directory; defaults to `private/customer-contracts`. Never set this under `public_html`, `public`, or another publicly served directory. |
| `TWILIO_ACCOUNT_SID` | Twilio account. |
| `TWILIO_API_KEY`, `TWILIO_API_KEY_SECRET` | Recommended production SMS authentication. |
| `TWILIO_AUTH_TOKEN` | Alternative to API key authentication. |
| `TWILIO_FROM` | SMS-capable sender in E.164 format, with the required destination permissions. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Transactional password-setup/recovery emails. |
| `NEXT_PUBLIC_SITE_URL` | Canonical HTTPS origin used for email links. |
| `TRUSTED_CLIENT_IP_HEADER` | Optional header set and overwritten by your trusted reverse proxy (for example `x-real-ip`). Do not trust client-supplied headers. Without this setting, the global IP limiter uses a shared bucket in addition to per-account limits. |

Development keys are generated in the ignored local `.env`, never exposed in responses or committed. Do not rotate `CUSTOMER_DOCUMENT_KEY` without decrypting/re-encrypting existing files; losing this key makes the files unrecoverable.

On Hostinger, deploy with the **Node.js application** option or a VPS. The protected portal is not available from a static HTML upload alone, and the old PHP snippets do not implement this authentication system. If your plan is PHP/static-only, host the Next.js backend on a Node host and review the same-origin/session-cookie architecture before splitting domains.

1. Apply tables with `npx drizzle-kit push` after the environment is bootstrapped.
2. Configure HTTPS, Twilio and SMTP. Use a real customer-controlled number only with consent. Twilio test credentials do not send SMS; use a controlled staging number for end-to-end delivery checks.
3. Set `CUSTOMER_STORAGE_PATH` on a persistent private volume, with directory permissions `700`. The app writes encrypted files with `600` permissions.
4. Back up the database, encrypted directory and encryption key separately. Test restoration.
5. Schedule `npx tsx scripts/customer-admin.ts cleanup` daily. This removes expired sessions, OTP challenges, reset links and rate-limit counters, and audit events older than 90 days.

## Invite a customer (staff only)

Run from the project root using SSH/application terminal. This script uses Drizzle and is not exposed over HTTP.

```bash
npx tsx scripts/customer-admin.ts invite \
  --email customer@example.com \
  --name "Customer Name" \
  --phone +393331234567 \
  --company "Example Company" \
  --lang en
```

The phone must already have been checked by reception as belonging to that customer. The customer receives a personal setup link, chooses a password, then signs in with password + SMS. If SMTP delivery fails, the script reports it honestly; configure SMTP and rerun the invitation. It never prints a reset link or sends a plaintext password.

For a controlled development account only, you may provide `CUSTOMER_INITIAL_PASSWORD` via your secure shell environment before running the invite command. Use a unique 12–128 character password, remove the variable immediately afterwards, and never put it in a script, command history, README or repository. SMS verification is still mandatory.

## Publish a reviewed contract

Only publish an actual, reviewed contract—not the automatically generated request module. The customer's document ownership is an explicit foreign key; it is not inferred from an email supplied in an unauthenticated request.

```bash
npx tsx scripts/customer-admin.ts contract \
  --email customer@example.com \
  --file /secure/path/reviewed-contract.pdf \
  --title "Contratto di domiciliazione sede legale" \
  --title-en "Registered office address agreement" \
  --reference ROS-2026-001
```

Accepted files are PDFs up to 20 MB. Staff should scan files for malware before publication. The customer sees the localized title, reference, publication date, size and a working download button. An account with no published contracts gets a real empty state rather than a fabricated contract.

To update a mobile **after verifying the customer's identity through a trusted channel**:

```bash
npx tsx scripts/customer-admin.ts phone --email customer@example.com --phone +393339876543
npx tsx scripts/customer-admin.ts disable --email customer@example.com
```

Both operations revoke existing sessions and login challenges. No in-portal phone editing is allowed in this release.

## API

| Endpoint | Behavior |
|---|---|
| `POST /api/customer/login` | Verify email/password, send SMS, create a restricted challenge cookie. Does not create a full session. |
| `POST /api/customer/verify` | Verify challenge + code, atomically consume code and create a new session. |
| `POST /api/customer/resend` | Send a new code to the already registered mobile, with cooldown and send limits. |
| `POST /api/customer/password` | Request email reset link or consume a valid link to set a password. |
| `POST /api/customer/logout` | Revoke server session and clear authentication cookies. |
| `GET /api/customer/me` | Session-protected customer summary and contract list, without storage keys. |
| `GET /api/customer/contract?id=UUID` | Session- and ownership-protected PDF download. |

No API response returns passwords, codes, raw phone numbers, reset tokens, encryption keys or document storage paths.

## GDPR and future uploads

Account identity, registered phone, salted password hash and necessary authentication cookies support the contracted customer service. Login and download events contain customer/document identifiers, not raw OTPs. Security logs are automatically purged after 90 days by the scheduled cleanup. Confirm the lawful basis, account closure schedule and contract retention requirements with your privacy adviser. The existing Italian privacy sections have not been overwritten. A separate bilingual portal-specific appendix and authentication-cookie disclosure have been added; have these reviewed before launch.

Identity document upload remains disabled. Before enabling it, define the lawful purpose, limit document categories, implement type/size validation, malware scanning, encryption, per-customer authorization, retention/deletion rules and access logging. Do not send personal IDs through ordinary public upload links.

## Testing

`npx tsx --test tests/customer-api.test.ts` exercises the real API handlers with a mock SMS transport confined to the test process. It checks password rejection, mobile binding, OTP retries/replay/expiry, rate controls, session protection, document ownership, encrypted downloads and logout. It creates and removes only dedicated test records.

Browser tests use `npx playwright test`; install Chromium once with `npx playwright install chromium`. Run against the production preview after build/start. Real SMS delivery and Hostinger SMTP acceptance still need a staging test with your configured providers.
