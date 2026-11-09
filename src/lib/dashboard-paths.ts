// Dashboard areas (staff, accounting, accountant) render without the public site's header, footer,
// cookie banner and analytics: the root layout returns a bare <html><body> for these paths.
export const DASHBOARD_PATH_PREFIXES = [
  "/gestione-tariffe-x9k2m7",
  "/gestione-domiciliazioni-x9k2m7",
  "/gestione-ordini-x9k2m7",
  "/gestione-configurazione-x9k2m7",
  "/gestione-contabilita-x9k2m7",
  "/gestione-utenti-x9k2m7",
  "/gestione-password-x9k2m7",
  "/commercialista-x9k2m7",
] as const;

export function isDashboardPath(pathname: string): boolean {
  return DASHBOARD_PATH_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
