"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Opens legal text (privacy notice, cookie policy) as an in-page popup instead of navigating
 * away — the standalone /privacy.html and /cookie-policy.html pages still exist for direct
 * links and SEO, but a link inside a form would otherwise take the visitor off the page they're
 * in the middle of filling in. The <dialog> is portaled to document.body: the trigger is often
 * inline text (inside a <p> or a form <label>), and a <dialog> full of block-level content
 * (headings, tables) can't legally sit inside those without breaking HTML nesting rules.
 */
export function LegalLinkModal({ label, title, className, children }: { label: string; title: string; className?: string; children: ReactNode }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const close = () => { dialog.current?.close(); setOpen(false); trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    dialog.current?.showModal();
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  return <>
    <button type="button" ref={trigger} className={`link-button ${className ?? ""}`} onClick={() => setOpen(true)}>{label}</button>
    {mounted && createPortal(
      <dialog ref={dialog} className="standard-offer-dialog legal-modal" aria-labelledby={id} onCancel={close}>
        <div className="modal-heading"><h2 id={id}>{title}</h2><button type="button" className="modal-close" onClick={close} aria-label="Chiudi"><X aria-hidden="true" /></button></div>
        <div className="legal-modal-body">{children}</div>
      </dialog>,
      document.body,
    )}
  </>;
}
