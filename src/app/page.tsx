import type { Metadata } from "next";
import { PageView } from "@/components/PageView";
import { BASE_URL, routeMap } from "@/lib/site";

export const metadata: Metadata = {
  title: "Roma Office Sharing | Uffici e domiciliazione Roma",
  description: "Business Center a due passi dalla Stazione Roma Termini: uffici arredati, sede legale, domiciliazione postale, sale e segreteria.",
  keywords: ["Domiciliazione Sede Legale Roma", "Sede Legale Roma", "Domiciliazione Postale Roma", "Ufficio Virtuale Roma", "Uffici Arredati Roma"],
  alternates: { canonical: "/", languages: { "it-IT": "/", "en-GB": `/${routeMap["index.html"]}`, "x-default": "/" } },
  openGraph: { title: "Roma Office Sharing", description: "Uffici e domiciliazione nel cuore di Roma.", url: BASE_URL, siteName: "Roma Office Sharing", locale: "it_IT", type: "website", images: [{url:"/images/office-hero.jpg",width:1200,height:627}] },
  twitter: { card: "summary_large_image", title: "Roma Office Sharing", description: "Uffici e domiciliazione nel cuore di Roma.", images: ["/images/office-hero.jpg"] },
};
export default function HomePage(){return <PageView pageKey="index.html" lang="it"/>}
