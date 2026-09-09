# Bilingual route and content map

| Italian URL / title | English URL / title |
|---|---|
| `/` and `/index.html` — Uffici e domiciliazione nel cuore di Roma | `/en/index.html` — Offices and domiciliation in the heart of Rome |
| `/uffici-arredati.html` — Uffici arredati a Roma | `/en/offices-furnished.html` — Furnished offices in Rome |
| `/ufficio-giornaliero.html` — Ufficio giornaliero | `/en/day-office.html` — Day office |
| `/ufficio-temporaneo.html` — Ufficio temporaneo | `/en/temporary-office.html` — Temporary office |
| `/sale-corsi.html` — Sale corsi e riunioni | `/en/course-rooms.html` — Training and meeting rooms |
| `/servizi-domiciliazione.html` — Servizi di domiciliazione | `/en/domiliation-services.html` — Domiciliation services |
| `/domiciliazione-postale.html` — Domiciliazione Postale Roma | `/en/postal-domiliation.html` — Postal Domiciliation Rome |
| `/domiciliazione-sede-legale.html` — Domiciliazione Sede Legale Roma | `/en/legal-headquarters-domiliation.html` — Registered Office Rome |
| `/domiciliazione-professionale.html` — Domiciliazione professionale | `/en/professional-domiliation.html` — Professional domiciliation |
| `/domiciliazione-ditta-individuale.html` — Domiciliazione ditta individuale | `/en/sole-proprietorship-domiliation.html` — Sole proprietorship domiciliation |
| `/domiciliazione-unita-locale.html` — Domiciliazione unità locale | `/en/local-unit-domiliation.html` — Local unit domiciliation |
| `/segreteria-virtuale.html` — Segreteria virtuale | `/en/virtual-secretary.html` — Virtual secretary |
| `/tariffe.html` — Tariffe e offerte (price/offer list only) | `/en/pricing.html` — Pricing and offers |
| `/attiva.html` — Attiva la domiciliazione (request form + payment) | `/en/activate.html` — Activate your domiciliation (request form + payment) |
| `/contatti.html` — Parliamo del tuo prossimo ufficio | `/en/contact.html` — Let’s discuss your next office |
| `/dove-siamo.html` — Nel cuore di Roma | `/en/where-we-are.html` — In the heart of Rome |
| `/chi-siamo.html` — Lo spazio dove le imprese crescono | `/en/about.html` — The place where businesses grow |
| `/privacy.html` — Informativa Privacy | `/en/privacy.html` — Privacy Notice |
| `/cookie-policy.html` — Cookie Policy | `/en/cookie-policy.html` — Cookie Policy |
| `/dicono-di-noi.html` — Dicono di noi | `/en/testimonials.html` — What clients say |
| `/404.html` — Pagina non trovata | `/en/404.html` — Page not found |

## Supplied content placement

| Supplied content | Italian placement | English translation placement |
|---|---|---|
| Business Center short description | Home hero (`index.html`) | Home hero (`/en/index.html`) |
| Uffici arredati / Sede Legale / Postale / Uffici Virtuali | Home service cards and service pages | Home service cards and corresponding English service pages |
| ATTIVA ORA and telephone CTA | All heroes/service CTAs | ACTIVATE NOW / Call now equivalents |
| Address, phone, fax, email and hours | Footer and contact/location pages | Same facts with translated labels |
| “part of client growth since 2014” | About page lead | Faithful translation on English About page |
| Privacy revocation contacts | Footer and Privacy/Cookie pages | Same contacts on English legal pages |
| “Domiciliazione Sede Legale / Unità Locale” offer description | Tariffe page (`FeaturedOffer`) and PDF module | Pricing page (`FeaturedOffer`) and PDF module |
| Price table 3/6/12/24/36/48 months with offer rates | Tariffe page offer table (`src/lib/pricing.ts`) | Pricing page offer table |
| Offer validity “fino al 30 Settembre 2026” | Tariffe page `offer-validity` line | Pricing page `offer-validity` line |
| New-activation 10% discount note and 12-month example | Tariffe page `offer-notes` (footnote/example) | Pricing page `offer-notes` |
| 10% additional-domiciliation discount | Tariffe page `offer-notes` and activation form checkbox | Pricing page `offer-notes` and activation form checkbox |
| Request form labels (company, representative, duration, start date, phone) | `/attiva.html` step 1 fieldsets | `/en/activate.html` step 1 fieldsets |
| SMS OTP code field and resend | `/attiva.html` step 2 | `/en/activate.html` step 2 |
| Payment choice (PayPal, Stripe, SumUp, bank transfer) | `/attiva.html` step 3 | `/en/activate.html` step 3 |

The prompt did not include the referenced verbatim Italian sections 1–9. The current Italian privacy notice is a complete nine-section implementation drafted from the requirements, and the English page is its faithful translation. Before launch, legal counsel should replace it with any separate authoritative source text if one exists.

## Gallery and Customer Area

| Italian | English | Indexing |
|---|---|---|
| `/gallery.html` — Dentro Roma Office Sharing | `/en/gallery.html` — Inside Roma Office Sharing | Public; included in sitemap |
| `/area-clienti.html` — Area Clienti | `/en/customer-area.html` — Customer Area | `noindex, nofollow`; excluded from sitemap |

The IT / EN control always preserves the counterpart, including the gallery and customer dashboard. Active sessions are shared between the two language paths. The original English `.html` slugs containing `domiliation` remain supported to preserve existing links; visible English now uses “registered office address”, “business mailing address”, “professional business address” and “local unit address”. “Legal address” is included as a secondary SEO phrase rather than used for mailing-only services.

## Tariffario aggiornato

Le pagine tariffe IT/EN espongono due riquadri: sede legale e postale/commerciale. Entrambi includono attivazione e popup offerta standard. Il servizio viene passato tramite ?service=legal_unit o ?service=postal; il cambio lingua conserva la selezione. Le tariffe sono lette da PostgreSQL. Vedere docs/pricing-and-standard-offers.md per condizioni, Allegato 1 e requisiti del PDF originale.
