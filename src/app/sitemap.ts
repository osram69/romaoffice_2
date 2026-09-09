import type { MetadataRoute } from "next";
import { BASE_URL, hrefFor, pages } from "@/lib/site";
export default function sitemap():MetadataRoute.Sitemap{return Object.keys(pages).filter(key=>!pages[key].noIndex&&!key.endsWith("404.html")).map(key=>({url:`${BASE_URL}${hrefFor(key)}`,lastModified:new Date("2025-01-15"),changeFrequency:key.includes("privacy")||key.includes("cookie")?"yearly":"monthly",priority:key.endsWith("index.html") ? 1 : (key.includes("contact") || key.includes("contatti") ? 0.8 : 0.7)}))}
