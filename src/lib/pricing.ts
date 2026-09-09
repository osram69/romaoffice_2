export type Lang = "it" | "en";
export type ServiceCode = "legal_unit" | "postal";
export type DurationMonths = 3 | 6 | 12 | 24 | 36 | 48;
export type PaymentMethod = "stripe" | "paypal" | "sumup" | "bank_transfer" | "on_site";
export type PriceTier = { months: number; listCents: number; offerCents: number | null; newActivation: boolean };
export type Addon = { code: string; titleIt: string; titleEn: string; priceCents: number; annualCents: number; billing: string; maxQuantity: number; selectable: boolean };
export type SelectedAddon = { code: string; quantity: number };
export type ProductOffer = { code: ServiceCode; vatBps: number; additionalDiscountBps: number; newActivationDiscountBps: number; offerValidUntil: string | null; termsRevision: string; version: string; tiers: PriceTier[]; addons: Addon[] };
export type Catalog = Record<ServiceCode, ProductOffer>;
export type Quote = {
  service: ServiceCode; catalogVersion: string; months: number; listCents: number; baseCents: number; offerApplied: boolean;
  newActivationDiscountCents: number; additionalDomiciliationDiscountCents: number; serviceNetCents: number;
  addonLines: (SelectedAddon & { titleIt: string; titleEn: string; monthlyCents: number; annualCents: number; totalCents: number })[];
  addonsCents: number; netCents: number; vatBps: number; vatCents: number; totalCents: number; renewalBaseCents: number; newActivationEligible: boolean;
};
export const flag = (v: boolean | string | undefined) => v === true || v === "true";
export function offerActive(product: ProductOffer, now = new Date()) { return !product.offerValidUntil || now.getTime() <= new Date(product.offerValidUntil).getTime(); }
export function tierFor(product: ProductOffer, months: number) { return product.tiers.find(t => t.months === months); }
export function quote(product: ProductOffer, input: { months: number; newActivation?: boolean | string; additionalDomiciliation?: boolean | string; addons?: SelectedAddon[]; now?: Date }): Quote | null {
  const tier = tierFor(product, input.months); if (!tier) return null;
  const offerApplied = offerActive(product, input.now) && tier.offerCents !== null;
  const baseCents = offerApplied ? tier.offerCents! : tier.listCents;
  const newActivationEligible = product.code === "legal_unit" && offerApplied && tier.newActivation;
  const newActivationDiscountCents = newActivationEligible && flag(input.newActivation) ? Math.round(baseCents * product.newActivationDiscountBps / 10000) : 0;
  const additionalDomiciliationDiscountCents = flag(input.additionalDomiciliation) ? Math.round((baseCents - newActivationDiscountCents) * product.additionalDiscountBps / 10000) : 0;
  const serviceNetCents = baseCents - newActivationDiscountCents - additionalDomiciliationDiscountCents;
  const seen = new Set<string>(); const addonLines: Quote["addonLines"] = [];
  for (const selection of input.addons || []) {
    const addon = product.addons.find(a => a.code === selection.code && a.selectable);
    if (!addon || seen.has(addon.code) || !Number.isInteger(selection.quantity) || selection.quantity < 1 || selection.quantity > addon.maxQuantity) return null;
    seen.add(addon.code);
    addonLines.push({ ...selection, titleIt: addon.titleIt, titleEn: addon.titleEn, monthlyCents: addon.priceCents, annualCents: addon.annualCents, totalCents: selection.quantity * (addon.priceCents * tier.months + addon.annualCents * Math.ceil(tier.months / 12)) });
  }
  const addonsCents = addonLines.reduce((sum, line) => sum + line.totalCents, 0);
  const netCents = serviceNetCents + addonsCents; const vatCents = Math.round(netCents * product.vatBps / 10000);
  return { service: product.code, catalogVersion: product.version, months: tier.months, listCents: tier.listCents, baseCents, offerApplied, newActivationDiscountCents, additionalDomiciliationDiscountCents, serviceNetCents, addonLines, addonsCents, netCents, vatBps: product.vatBps, vatCents, totalCents: netCents + vatCents, renewalBaseCents: baseCents, newActivationEligible };
}
export function formatEur(cents: number, lang: Lang = "it") { return new Intl.NumberFormat(lang === "it" ? "it-IT" : "en-GB", { style: "currency", currency: "EUR" }).format(cents / 100); }
export function validity(product: ProductOffer, lang: Lang) {
  if (!product.offerValidUntil) return lang === "it" ? "Attuale offerta" : "Current offer";
  return `${lang === "it" ? "Offerte valide fino al" : "Offers valid until"} ${new Date(product.offerValidUntil).toLocaleDateString(lang === "it" ? "it-IT" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome" })}`;
}
export function activationHref(service: ServiceCode, lang: Lang) { return `${lang === "it" ? "/attiva.html" : "/en/activate.html"}?service=${service}`; }
export function bankTransfer(lang: Lang, service: ServiceCode = "legal_unit") {
  return {
    holder: process.env.BANK_HOLDER || "Cube Engineering s.r.l.",
    iban: process.env.BANK_IBAN || (lang === "it" ? "[IBAN da configurare]" : "[IBAN to be configured]"),
    bic: process.env.BANK_BIC || (lang === "it" ? "[BIC/SWIFT da configurare]" : "[BIC/SWIFT to be configured]"),
    bank: process.env.BANK_NAME || (lang === "it" ? "[Banca da configurare]" : "[Bank to be configured]"),
    reason: copyFor(service, lang).name,
  };
}
export const offerCopy = {
  it: { name: "Domiciliazione Sede Legale / Unità Locale", nameShort: "Sede Legale / Unità Locale", description: "Consente di eleggere o trasferire la sede legale (primaria o secondaria) della propria Azienda o Ditta Individuale e utilizzare lo stesso per ricevere posta e plichi che verranno poi consegnati al Legale Rappresentante o suo delegato.", duration: "Durata", rate: "Tariffa", offer: "Offerta", months: (m: number) => `${m} mesi` },
  en: { name: "Registered Office / Local Unit Address", nameShort: "Registered Office / Local Unit", description: "It allows you to establish or transfer the registered office (primary or secondary) of your company or sole proprietorship, and to use the same address to receive mail and parcels, which are then handed over to the legal representative or their delegate.", duration: "Duration", rate: "Standard rate", offer: "Offer", months: (m: number) => `${m} months` },
};
export function copyFor(service: ServiceCode, lang: Lang) {
  if (service === "legal_unit") return offerCopy[lang];
  return { ...offerCopy[lang], name: lang === "it" ? "Domiciliazione Postale / Commerciale" : "Business Mailing / Commercial Address", nameShort: lang === "it" ? "Domiciliazione Postale" : "Business Mailing Address", description: lang === "it" ? "Un recapito postale e commerciale a Roma per la tua attività, con ricezione della corrispondenza, scansione delle buste e servizi dedicati. Non comprende l’utilizzo dell’indirizzo come sede legale." : "A business mailing and commercial address in Rome, with receipt of correspondence, envelope scanning and dedicated services. It does not include use of the address as a registered office." };
}
