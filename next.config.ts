import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  // Scanned contract/document PDFs routinely exceed Next's default 1MB Server Action body
  // limit — without this, uploadDomDocumentAction's request is rejected before it ever runs,
  // and (since the framework-level rejection isn't a normal {success:false} response) the
  // client call hangs instead of showing an error.
  experimental: { serverActions: { bodySizeLimit: "25mb" } },
  async headers() {
    return [
      { source: "/:path*", headers: [{ key: "X-Content-Type-Options", value: "nosniff" }, { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }] },
      { source: "/area-clienti.html", headers: [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "X-Frame-Options", value: "DENY" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/en/customer-area.html", headers: [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "X-Frame-Options", value: "DENY" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};
export default nextConfig;
