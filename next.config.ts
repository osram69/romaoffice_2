import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: [{ key: "X-Content-Type-Options", value: "nosniff" }, { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }] },
      { source: "/area-clienti.html", headers: [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "X-Frame-Options", value: "DENY" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/en/customer-area.html", headers: [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "X-Frame-Options", value: "DENY" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};
export default nextConfig;
