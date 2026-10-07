import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  // Scanned contract/document PDFs routinely exceed Next's default 1MB Server Action body
  // limit — without this, uploadDomDocumentAction's request is rejected before it ever runs, and
  // (since the framework-level rejection isn't a normal {success:false} response) the client gets
  // a bare, undebuggable React error instead of a real message. The mail-scan upload used to need
  // headroom here too, until it turned out a large Server Action argument was tripping a separate
  // React Flight bug ("Maximum array nesting exceeded") — that upload now goes through a plain
  // Route Handler (POST /api/dom-mail-scans) instead, which isn't subject to this limit at all, so
  // 25MB (uploadDomDocumentAction's actual need) is enough again.
  experimental: { serverActions: { bodySizeLimit: "25mb" } },
  // Permanent redirect so the page's existing Search Console history/backlinks carry over to the
  // new URL instead of starting from zero (and so the old URL doesn't start 404ing).
  async redirects() {
    return [
      { source: "/domiciliazione-sede-legale.html", destination: "/domiciliazione-sede-legale-roma.html", permanent: true },
      { source: "/servizi-domiciliazione.html", destination: "/servizi-domiciliazione-sede-roma.html", permanent: true },
      // Old-site URLs (pre-relaunch) still known to Google/backlinks: map each to its closest page
      // instead of letting the catch-all send everything to the home page (soft-404 signal).
      { source: "/tariffe-domiciliazione-sede-legale-roma", destination: "/tariffe.html", permanent: true },
      { source: "/domiciliazione-sede-fiscale-e-legale", destination: "/domiciliazione-sede-legale-roma.html", permanent: true },
      { source: "/it/domiciliazione-sede-legale-in-roma", destination: "/domiciliazione-sede-legale-roma.html", permanent: true },
      { source: "/it/informazioni-domiciliazione-sede-societa-roma-oc", destination: "/domiciliazione-sede-legale-roma.html", permanent: true },
      { source: "/servizi-di-domiciliazione-sede-legale-a-roma/:slug*", destination: "/domiciliazione-sede-legale-roma.html", permanent: true },
      { source: "/it/servizi-di-domiciliazione-sede-legale-a-roma/:slug*", destination: "/domiciliazione-sede-legale-roma.html", permanent: true },
      { source: "/it/domiciliazione-sede-legale-ditta-individuale", destination: "/domiciliazione-ditta-individuale.html", permanent: true },
      { source: "/domiciliazione-sede-legale-professionale-:slug", destination: "/domiciliazione-professionale.html", permanent: true },
      { source: "/it/domiciliazione-sede-legale-professionale-:slug", destination: "/domiciliazione-professionale.html", permanent: true },
      { source: "/it/sede-virtuale-domiciliazione-sede-legale/:slug*", destination: "/segreteria-virtuale.html", permanent: true },
      { source: "/affitto-ufficio-temporaneo/affitto-sala-corsi-a-roma", destination: "/sale-corsi.html", permanent: true },
      { source: "/it/affitto-ufficio-temporaneo/affitto-sala-corsi-a-roma", destination: "/sale-corsi.html", permanent: true },
      { source: "/affitto-ufficio-temporaneo/affitto-ufficio-giornaliero-roma", destination: "/ufficio-giornaliero.html", permanent: true },
      { source: "/it/affitto-ufficio-temporaneo/affitto-ufficio-giornaliero-roma", destination: "/ufficio-giornaliero.html", permanent: true },
      { source: "/home.html", destination: "/", permanent: true },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: [{ key: "X-Content-Type-Options", value: "nosniff" }, { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }] },
      { source: "/area-clienti.html", headers: [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "X-Frame-Options", value: "DENY" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/en/customer-area.html", headers: [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "X-Frame-Options", value: "DENY" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};
export default nextConfig;
