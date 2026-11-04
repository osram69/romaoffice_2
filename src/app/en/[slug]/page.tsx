import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteFlags, pageSeo } from "@/lib/site-flags";
import { PageView } from "@/components/PageView";
import { BASE_URL, pages, resolvePath, reverseRouteMap } from "@/lib/site";
import { getPaymentSettings, pricingPageDescription } from "@/lib/payment-settings";
type Props={params:Promise<{slug:string}>;searchParams:Promise<{service?:string}>};
export function generateStaticParams(){return Object.keys(pages).filter(k=>k.startsWith("en/")).map(k=>({slug:k.slice(3)}))}
export async function generateMetadata({params}:Props):Promise<Metadata>{const{slug}=await params;const{key}=resolvePath(["en",slug]);const p=pages[key];const seo=pageSeo(key,p,await getSiteFlags());const description=p.kind==="pricing"?pricingPageDescription(await getPaymentSettings(),"en"):seo.description;const canonical=`/${key}`;const itKey=reverseRouteMap[key]||"404.html";const it=itKey==="index.html"?"/":`/${itKey}`;return{title:`${seo.title} | Roma Office Sharing`,description,robots:p.noIndex||key.endsWith("404.html")?{index:false,follow:false}:undefined,keywords:["Legal Address Rome","Registered Office Rome","Business Mailing Address Rome","Virtual Office Rome","Furnished Offices Rome"],alternates:{canonical,languages:{"it-IT":it,"en-GB":canonical,"x-default":it}},openGraph:{title:seo.title,description,url:`${BASE_URL}${canonical}`,siteName:"Roma Office Sharing",locale:"en_GB",type:"website",images:[{url:"/images/office-hero-og.jpg",width:1200,height:630}]},twitter:{card:"summary_large_image",title:seo.title,description,images:["/images/office-hero-og.jpg"]}}}
export default async function EnglishPage({params,searchParams}:Props){const{slug}=await params;const{key}=resolvePath(["en",slug]);if(key==="en/404.html")notFound();const query=await searchParams;return <PageView pageKey={key} lang="en" initialService={query.service==="postal"?"postal":"legal_unit"}/>}
