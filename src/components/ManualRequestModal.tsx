"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ClipboardList, X } from "lucide-react";
import { copyFor, type Lang, type ProductOffer } from "@/lib/pricing";
import { ManualRequestForm } from "./ManualRequestForm";

export function ManualRequestModal({ product, lang, linkStyle }: { product: ProductOffer; lang: Lang; linkStyle?: boolean }) {
  const it = lang === "it"; const copy = copyFor(product.code, lang); const id = useId();
  const dialog = useRef<HTMLDialogElement>(null); const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false); const [mounted, setMounted] = useState(false); const [session, setSession] = useState(0);
  const close = () => { dialog.current?.close(); setOpen(false); trigger.current?.focus(); };
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!open) return; dialog.current?.showModal(); const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  return <>
    <button type="button" ref={trigger} className={linkStyle ? "text-button" : "button secondary manual-request-trigger"} onClick={() => { setSession(s => s + 1); setOpen(true); }}>{!linkStyle && <ClipboardList aria-hidden="true" />}{it ? "Compila il modulo online" : "Fill in the online form"}</button>
    {mounted && createPortal(
      <dialog ref={dialog} className="standard-offer-dialog" aria-labelledby={id} onCancel={close} onClose={() => setOpen(false)}>
        <div className="modal-heading"><div><span className="eyebrow">{copy.nameShort}</span><h2 id={id}>{it ? "Richiedi l’attivazione" : "Request activation"}</h2></div><button className="modal-close" onClick={close} aria-label={it ? "Chiudi modulo" : "Close form"}><X /></button></div>
        {open && <ManualRequestForm key={session} product={product} lang={lang} onDone={close} />}
      </dialog>,
      document.body,
    )}
  </>;
}
