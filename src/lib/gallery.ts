import type { Lang } from "./site";
export type GalleryCategory = "all" | "offices" | "meetings";
export const galleryPhotos = [
  { id: "office", src: "/images/gallery/office.webp", category: "offices", title: { it: "Spazio per le tue idee", en: "Space for your ideas" }, subtitle: { it: "Uffici arredati", en: "Furnished offices" }, alt: { it: "Ufficio arredato presentato sul sito Roma Office Sharing", en: "Furnished office featured on the Roma Office Sharing website" } },
  { id: "meeting", src: "/images/gallery/meeting.webp", category: "meetings", title: { it: "Incontrarsi, confrontarsi, crescere", en: "Meet, collaborate, grow" }, subtitle: { it: "Sale corsi e riunioni", en: "Training and meeting rooms" }, alt: { it: "Sala attrezzata per corsi e riunioni di Roma Office Sharing", en: "Roma Office Sharing room equipped for training and meetings" } },
  { id: "day-office", src: "/images/gallery/day-office.webp", category: "offices", title: { it: "Il tuo ufficio, quando serve", en: "Your office, when you need it" }, subtitle: { it: "Ufficio giornaliero", en: "Day office" }, alt: { it: "Ambiente di lavoro proposto per il servizio di ufficio giornaliero", en: "Workspace featured for the day-office service" } },
  { id: "workspace", src: "/images/gallery/workspace.webp", category: "offices", title: { it: "Un ambiente professionale", en: "A professional setting" }, subtitle: { it: "Spazi di lavoro", en: "Workspaces" }, alt: { it: "Vista degli spazi ufficio dal sito Roma Office Sharing", en: "View of the office spaces featured on the Roma Office Sharing website" } },
] as const;
export const galleryLabels: Record<Lang, Record<GalleryCategory, string>> = {
  it: { all: "Tutti gli spazi", offices: "Uffici", meetings: "Sale corsi e riunioni" },
  en: { all: "All spaces", offices: "Offices", meetings: "Training & meeting rooms" },
};
