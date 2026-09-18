import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { CookieConsent, Footer, Header } from "@/components/SiteChrome";
import { Analytics } from "@/components/Analytics";
import { alternateFor, BASE_URL, contact, resolvePath } from "@/lib/site";
import "./globals.css";
import "./features.css";
import "./commerce.css";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  icons: { icon: "/favicon.ico" },
  authors: [{ name: "Roma Office Sharing" }],
  verification: { google: "1KSz1OD8TUtNO7ibnTvCLGbimFD-JfUk3gR_GRUtLaU" },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const h = await headers();
  const pathname = h.get("x-pathname") || "/";
  if (pathname.startsWith("/gestione-tariffe-x9k2m7") || pathname.startsWith("/gestione-domiciliazioni-x9k2m7")) return <html lang="it"><body>{children}</body></html>;
  const parts = pathname.split("/").filter(Boolean);
  const { key, lang } = resolvePath(parts);
  const jsonLd = {
    "@context": "https://schema.org", "@type": "LocalBusiness", "@id": `${BASE_URL}/#business`,
    name: "ROMA OFFICE SHARING", alternateName: lang === "it" ? "Business Center Roma" : "Rome Business Centre",
    description: lang === "it" ? "Uffici arredati e servizi di domiciliazione nel centro di Roma." : "Furnished offices and registered office and mailing address services in central Rome.",
    url: `${BASE_URL}${pathname}`, telephone: contact.phoneHref, email: contact.email,
    image: `${BASE_URL}/images/office-hero.jpg`, logo: `${BASE_URL}/LogoFull_trasp.svg`, priceRange: "€€",
    address: { "@type": "PostalAddress", streetAddress: "Via Venti Settembre, 118 int.1", postalCode: "00187", addressLocality: "Roma", addressRegion: "RM", addressCountry: "IT" },
    geo: { "@type": "GeoCoordinates", latitude: 41.9037423, longitude: 12.4934357 },
    openingHoursSpecification: [{ "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday","Tuesday","Wednesday","Thursday","Friday"], opens: "08:30", closes: "18:00" }, { "@type": "OpeningHoursSpecification", dayOfWeek: "Saturday", opens: "08:30", closes: "13:00", description: lang === "it" ? "Su richiesta" : "On request" }],
  };
  return <html lang={lang}><body><Analytics /><Header lang={lang} alternate={alternateFor(key)} />{children}<Footer lang={lang}/><CookieConsent lang={lang}/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(jsonLd).replace(/</g,"\\u003c")}} /></body></html>;
}
