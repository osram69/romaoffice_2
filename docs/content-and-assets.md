# Content, terminology and assets

## Service descriptions

The reference https://www.domiciliazionesocieta.com/ was reviewed for its explanatory structure: target users, address use, incoming mail, contract preparation and company registration. The new descriptions in `src/components/AddressServices.tsx` are original Roma Office Sharing copy, not verbatim competitor text. No competitor prices, address, years of operation, review counts or promises of automatic statutory registration are used.

The exact supplied Italian home paragraph and the previously supplied offer prices remain unchanged. Registered-office and postal-only services are explicitly distinguished; statutory filings and activity-specific suitability must be checked with the customer's adviser.

## English terminology

- **Sede legale / domiciliazione sede legale:** registered office address / registered office address service. This is more precise than the generic “legal address”; “Legal Address Rome” remains a secondary SEO phrase.
- **Domiciliazione postale:** business mailing address / mail-handling service. It must not be described as authorising company registration.
- **Domiciliazione professionale:** professional business address, with suitability subject to the professional body's requirements.
- **Domiciliazione unità locale:** local unit address. “Local unit” refers to the Italian administrative concept; it is not automatically a staffed branch office.
- **Domiciliazione ditta individuale:** business address for sole proprietors.

Terminology guidance: https://www.gov.uk/guidance/your-personal-information-on-the-public-record-at-companies-house (linguistic reference only; the site concerns Italian services and does not apply UK filing law to Italian companies).

Original English route names are retained for link compatibility. Metadata, navigation, headings, descriptions, form labels and generated PDF/email copy use the revised terminology.

## Branding

`public/images/roma-office-sharing-logo.png` is the original 580 × 100 transparent logo downloaded from https://www.romaofficesharing.it/images/LogoFull.png, matching the supplied logo design. It is rendered without distortion. `BrandWords.tsx` uses the requested grey `#7f7f7f` for ROMA and orange `#f97300` for OFFICESHARING.

The supplied CSS palette is in `src/app/globals.css`. CTA orange uses charcoal text for contrast. The original dark green, cream and gold remain in the layout, with extra styles in `src/app/features.css`.

## Gallery assets

Local WebP images were optimized from assets publicly used on the original Roma Office Sharing site:

| Local asset | Original source |
|---|---|
| `gallery/office.webp` | `https://www.romaofficesharing.it/images/ufficio-arredato.jpg` |
| `gallery/day-office.webp` | `https://www.romaofficesharing.it/images/ufficio-giornaliero.jpg` |
| `gallery/workspace.webp` | `https://www.romaofficesharing.it/images/uffici-arredati.jpg` |
| `gallery/meeting.webp` | `https://www.romaofficesharing.it/images/salacorsi.jpg` |

Confirm that the site owner still has permission to reuse the original photographs and that the depicted spaces reflect current availability. The pre-existing Pexels hero is retained; its credit is in README.md. Gallery images are local, responsive, captioned and open in an accessible native-dialog lightbox. The lightbox supports previous/next controls, arrow keys, Escape and restored focus.
