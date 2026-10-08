import { db } from "@/db";
import { siteConfig } from "@/db/schema";

// Which identity bypasses the SMS is still decided by env vars (DEBUG_BYPASS_EMAIL / _PHONE — never
// in source); this is the admin on/off switch in Configurazione Web, so the real SMS path can be
// exercised from the owner's own phone without touching the server environment.
export async function smsBypassEnabled(): Promise<boolean> {
  const [row] = await db.select({ enabled: siteConfig.smsBypassEnabled }).from(siteConfig).limit(1);
  return row?.enabled ?? true;
}
