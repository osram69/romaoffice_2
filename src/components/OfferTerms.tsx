"use client";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowDown, Check, FileText, X } from "lucide-react";
import { offerTerms } from "@/lib/offer-terms";
import type { Lang, ProductOffer } from "@/lib/pricing";

export function OfferTermsBody({ product, lang }: { product: ProductOffer; lang: Lang }) {
  const t = offerTerms(product, lang);
  return <div className="offer-terms-copy"><h3>{t.heading}</h3><ul>{t.included.map(line => <li key={line}>{line}</li>)}</ul><h3>{t.extrasHeading}</h3>{t.extras.length > 0 && <ul>{t.extras.map(line => <li key={line}>{line}</li>)}</ul>}{t.paragraphs.map(line => <p key={line}>{line}</p>)}<h3>{t.paymentHeading}</h3><ul>{t.payment.map(line => <li key={line}>{line}</li>)}</ul>{t.deposit && <p className="no-deposit"><Check aria-hidden="true" />{t.deposit}</p>}</div>;
}
export function OfferTermsConsent({ product, lang, accepted, onAccept }: { product: ProductOffer; lang: Lang; accepted: boolean; onAccept: () => void }) {
  const it = lang === "it"; const id = useId(); const dialog = useRef<HTMLDialogElement>(null); const scroller = useRef<HTMLDivElement>(null); const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false); const [readToEnd, setReadToEnd] = useState(false); const [confirmed, setConfirmed] = useState(false);
  const checkEnd = () => { const el = scroller.current; if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 12) setReadToEnd(true); };
  const close = () => { dialog.current?.close(); setOpen(false); trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return; dialog.current?.showModal();
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    if (scroller.current) scroller.current.scrollTop = 0;
    const frame = requestAnimationFrame(checkEnd);
    return () => { cancelAnimationFrame(frame); document.body.style.overflow = prev; };
  }, [open]);
  return <div className={`terms-consent ${accepted ? "accepted" : ""}`}>
    <div><FileText aria-hidden="true" /><p><b>{it ? "Condizioni della domiciliazione postale" : "Business mailing address terms"}</b><span>{accepted ? (it ? "Lettura e accettazione confermate." : "Reading and acceptance confirmed.") : (it ? "Prima di proseguire, apri e leggi tutte le condizioni dell’offerta." : "Before continuing, open and read the complete offer terms.")}</span></p></div>
    <button type="button" ref={trigger} className="button secondary" onClick={() => { setReadToEnd(false); setConfirmed(false); setOpen(true); }}>{accepted ? (it ? "Rileggi condizioni" : "Read terms again") : (it ? "Leggi le condizioni obbligatorie" : "Read the required terms")}</button>
    <dialog ref={dialog} className="terms-dialog" aria-labelledby={id} onCancel={close}>
      <div className="modal-heading"><div><span className="eyebrow">{it ? "DOMICILIAZIONE POSTALE / COMMERCIALE" : "BUSINESS MAILING / COMMERCIAL ADDRESS"}</span><h2 id={id}>{it ? "Condizioni dell’offerta" : "Offer terms"}</h2></div><button type="button" className="modal-close" onClick={close} aria-label={it ? "Chiudi condizioni" : "Close terms"}><X /></button></div>
      <div className="terms-scroll" ref={scroller} onScroll={checkEnd} tabIndex={0} aria-label={it ? "Testo completo delle condizioni, scorri fino in fondo" : "Full terms, scroll to the end"}><OfferTermsBody product={product} lang={lang} /><p className="terms-end">{it ? "Fine delle condizioni dell’offerta" : "End of offer terms"}</p></div>
      <div className="terms-dialog-footer">{!readToEnd && <p role="status"><ArrowDown aria-hidden="true" />{it ? "Scorri il testo fino in fondo per abilitare l’accettazione." : "Scroll to the end to enable acceptance."}</p>}<label className="check-label"><input type="checkbox" disabled={!readToEnd} checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /><span>{it ? "Ho letto integralmente e accetto le condizioni dell’offerta di domiciliazione postale/commerciale, inclusi i costi dei servizi opzionali." : "I have read and accept the full business mailing/commercial address offer terms, including optional service charges."}</span></label><button className="button primary" disabled={!readToEnd || !confirmed} onClick={() => { onAccept(); close(); }}>{it ? "Conferma lettura e accettazione" : "Confirm reading and acceptance"}<Check /></button></div>
    </dialog>
  </div>;
}
