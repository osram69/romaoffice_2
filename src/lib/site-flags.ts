import { db } from "@/db";
import { siteConfig } from "@/db/schema";
import type { PageDef } from "./site";

// Switches the owner flips from Configurazione Web to follow what is actually for rent.
export type SiteFlags = { roomsMonthly: boolean };

/** Never throws: if the column is not there yet (migration not run) the site simply behaves as "flag off". */
export async function getSiteFlags(): Promise<SiteFlags> {
  try {
    const [row] = await db.select({ roomsMonthly: siteConfig.roomsMonthlyEnabled }).from(siteConfig).limit(1);
    return { roomsMonthly: row?.roomsMonthly ?? false };
  } catch {
    return { roomsMonthly: false };
  }
}

/**
 * Title/description shown in search results. For the rooms page they change with the "affitto mensile" flag: when a
 * room is free to rent monthly the snippet leads with that offer, otherwise it only talks about hourly/day hire.
 */
export function pageSeo(key: string, page: PageDef, flags: SiteFlags): { title: string; description: string } {
  if (flags.roomsMonthly && key === "sale-corsi.html") return {
    title: "Affitto sala Roma da 750 €/mese e a ore",
    description: "Affitto sala a Roma vicino a Termini: da 750 € + IVA al mese (15 mq, 12 mesi) oppure a ore da 25 €, mezza giornata 70 € e giornata 100 € + IVA.",
  };
  if (flags.roomsMonthly && key === "en/course-rooms.html") return {
    title: "Meeting room rental Rome, from €750/month",
    description: "Rent a room in Rome near Termini: monthly from €750 + VAT (15 sqm, 12 months) or by the hour from €25, half day €70 and full day €100 + VAT.",
  };
  return { title: page.title, description: page.description };
}
