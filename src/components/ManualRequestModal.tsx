import Link from "next/link";
import { ClipboardList } from "lucide-react";
import type { Lang, ProductOffer } from "@/lib/pricing";

/** "Compila il modulo online": goes to the online request page (all the form's fields, mobile verified by SMS). */
export function ManualRequestModal({ product, lang, linkStyle }: { product: ProductOffer; lang: Lang; linkStyle?: boolean }) {
  const it = lang === "it";
  const href = `${it ? "/richiesta-domiciliazione.html" : "/en/domiciliation-request.html"}?service=${product.code}`;
  return <Link href={href} className={linkStyle ? "text-button" : "button secondary manual-request-trigger"}>{!linkStyle && <ClipboardList aria-hidden="true" />}{it ? "Compila il modulo online" : "Fill in the online form"}</Link>;
}
