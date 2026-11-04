import type { MetadataRoute } from "next";
import { BASE_URL, hrefFor, pages, reverseRouteMap } from "@/lib/site";

// Real last-modified dates per page (Google ignores <lastmod> when every URL carries the build date).
// Update the entry of a page whenever its content changes materially; pages not listed fall back to
// SITE_RELEASE, the date of the last site-wide release that did not touch their text.
const SITE_RELEASE = "2026-10-13";
const PAGE_UPDATED: Record<string, string> = {
  "index.html": "2026-11-04",
  "uffici-arredati.html": "2026-11-04",
  "ufficio-giornaliero.html": "2026-11-04",
  "ufficio-temporaneo.html": "2026-11-04",
  "sale-corsi.html": "2026-11-04",
  "segreteria-virtuale.html": "2026-11-04",
  "servizi-domiciliazione-sede-roma.html": "2026-11-04",
  "domiciliazione-postale.html": "2026-11-04",
  "domiciliazione-sede-legale-roma.html": "2026-11-04",
  "domiciliazione-professionale.html": "2026-11-04",
  "domiciliazione-ditta-individuale.html": "2026-11-04",
  "domiciliazione-unita-locale.html": "2026-11-04",
  "dove-siamo.html": "2026-10-19",
  "contatti.html": "2026-10-19",
  "chi-siamo.html": "2026-10-19",
  "dicono-di-noi.html": "2026-10-19",
  "tariffe.html": "2026-11-04",
};
const lastModified = (key: string) => new Date(PAGE_UPDATED[reverseRouteMap[key] || key] ?? SITE_RELEASE);

export default function sitemap(): MetadataRoute.Sitemap {
  return Object.keys(pages)
    .filter(key => !pages[key].noIndex && !key.endsWith("404.html"))
    .map(key => ({
      url: `${BASE_URL}${hrefFor(key)}`,
      lastModified: lastModified(key),
      changeFrequency: key.includes("privacy") || key.includes("cookie") ? "yearly" as const : "monthly" as const,
      priority: key.endsWith("index.html") ? 1 : (key.includes("contact") || key.includes("contatti") ? 0.8 : 0.7),
    }));
}
