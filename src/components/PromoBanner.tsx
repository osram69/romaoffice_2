import Link from "next/link";
import { ArrowRight, BadgePercent } from "lucide-react";
import { getActivePromo } from "@/lib/discount-code-db";
import { promoHref } from "@/lib/discount-code";
import type { Lang } from "@/lib/pricing";

/** Strip advertising the running promotion code (home, pricing); renders nothing when no promotion is on. */
export async function PromoBanner({ lang }: { lang: Lang }) {
  const promo = await getActivePromo(lang);
  if (!promo) return null;
  return <div className="promo-strip" role="region" aria-label={lang === "it" ? "Promozione" : "Promotion"}>
    <div className="shell"><BadgePercent aria-hidden="true" /><span>{promo.text}</span><Link href={promoHref(promo, lang)}>{lang === "it" ? "ATTIVA ORA" : "ACTIVATE NOW"}<ArrowRight aria-hidden="true" /></Link></div>
  </div>;
}
