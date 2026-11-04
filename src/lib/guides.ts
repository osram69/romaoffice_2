import type { Lang } from "./site";
import { guidesIt } from "./guides-it";
import { guidesEn } from "./guides-en";

// Long-form landing pages ("guide") about one specific need: change of registered office, start-ups, foreign
// companies, virtual office. Content lives in guides-it.ts / guides-en.ts, keyed by the Italian page key; the
// layout is rendered by components/GuidePage.tsx. Prices are never written here: the page reads them from the
// catalog so they always match the pricing page.
export type GuideSection = {
  h: string;
  p?: string[];
  ul?: string[];
  ol?: string[];
  table?: { head: string[]; rows: string[][] };
  note?: string;
};
export type Guide = {
  eyebrow: string;
  h1: string;
  lead: string;
  facts: [string, string][];
  sections: GuideSection[];
  /** Index (0-based) of the section after which the live price table is shown. */
  priceAfter: number;
  faq: [string, string][];
  related: [string, string][];
};

/** Date shown on the guides and used as Article dateModified; keep in step with PAGE_UPDATED in sitemap.ts. */
export const GUIDE_UPDATED = "2026-11-04";

export const guideKeys = ["cambio-sede-legale-roma.html", "sede-legale-startup-srls-roma.html", "domiciliazione-societa-estere-roma.html", "sede-legale-virtuale-roma.html"] as const;

export function guideFor(itKey: string, lang: Lang): Guide | undefined {
  return (lang === "it" ? guidesIt : guidesEn)[itKey];
}
