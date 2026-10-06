import type { Metadata } from "next";
import { PageView } from "@/components/PageView";
import { BASE_URL, routeMap } from "@/lib/site";

export const metadata: Metadata = {
  title: "Domiciliazione Sede Legale e Uffici Arredati a Roma | Roma Office Sharing",
  description: "Domiciliazione sede legale e postale, uffici arredati e segreteria a Roma, a due passi da Termini. Dal 2014 al fianco delle imprese: tariffe online e attivazione digitale.",
  keywords: ["Domiciliazione Sede Legale Roma", "Sede Legale Roma", "Domiciliazione Postale Roma", "Ufficio Virtuale Roma", "Uffici Arredati Roma"],
  alternates: { canonical: "/", languages: { "it-IT": "/", "en-GB": `/${routeMap["index.html"]}`, "x-default": "/" } },
  openGraph: { title: "Domiciliazione Sede Legale e Uffici Arredati a Roma", description: "Sede legale, domiciliazione postale e uffici arredati a due passi da Roma Termini.", url: BASE_URL, siteName: "Roma Office Sharing", locale: "it_IT", type: "website", images: [{url:"/images/office-hero-og.jpg",width:1200,height:630}] },
  twitter: { card: "summary_large_image", title: "Domiciliazione Sede Legale e Uffici Arredati a Roma", description: "Sede legale, domiciliazione postale e uffici arredati a due passi da Roma Termini.", images: ["/images/office-hero-og.jpg"] },
};
export default function HomePage(){return <PageView pageKey="index.html" lang="it"/>}
