"use client";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Expand, MapPin, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { galleryPhotos, galleryLabels, type GalleryCategory } from "@/lib/gallery";
import type { Lang } from "@/lib/site";

export function Gallery({ lang }: { lang: Lang }) {
  const it = lang === "it";
  const [category, setCategory] = useState<GalleryCategory>("all");
  const [selected, setSelected] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const lastTrigger = useRef<HTMLButtonElement | null>(null);
  const photos = galleryPhotos.filter(p => category === "all" || p.category === category);
  const active = selected === null ? null : photos[selected];
  const close = () => { dialog.current?.close(); setSelected(null); lastTrigger.current?.focus(); };
  const move = (direction: number) => setSelected(i => ((i ?? 0) + direction + photos.length) % photos.length);
  useEffect(() => {
    if (selected === null) return;
    const element = dialog.current;
    if (!element?.open) element?.showModal();
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [selected]);
  return <section className="section shell gallery-section">
    <div className="gallery-intro"><div><span className="eyebrow">{it ? "UNO SGUARDO DA VICINO" : "TAKE A CLOSER LOOK"}</span><h2>{it ? "Uno spazio da vivere,\nnon solo da lavorare." : "More than a workplace.\nA place to belong."}</h2></div><p>{it ? "Ambienti arredati e sale per incontrare clienti e collaboratori. Esplora gli spazi e prenota una visita: saremo felici di accoglierti." : "Furnished spaces and rooms to meet clients and colleagues. Explore our spaces, then book a visit—we look forward to welcoming you."}</p></div>
    <div className="gallery-toolbar"><div className="gallery-filters" role="group" aria-label={it ? "Filtra le fotografie" : "Filter photographs"}>{(["all", "offices", "meetings"] as GalleryCategory[]).map(key => <button key={key} className={category === key ? "selected" : ""} aria-pressed={category === key} onClick={() => setCategory(key)}>{galleryLabels[lang][key]}</button>)}</div><span className="gallery-count" role="status">{photos.length.toString().padStart(2, "0")} {it ? "fotografie" : "photographs"}</span></div>
    <div className="gallery-grid">{photos.map((photo, index) => <figure key={photo.id} className="gallery-tile"><button className="gallery-image" aria-label={`${it ? "Ingrandisci" : "Enlarge"}: ${photo.title[lang]}`} onClick={e => { lastTrigger.current = e.currentTarget; setSelected(index); }}><Image src={photo.src} alt={photo.alt[lang]} fill sizes="(max-width: 700px) 95vw, 46vw" priority={index === 0} /><span className="gallery-expand"><Expand aria-hidden="true" /></span><span className="gallery-index">0{index + 1}</span></button><figcaption><div><span>{photo.subtitle[lang]}</span><h3>{photo.title[lang]}</h3></div><ArrowRight aria-hidden="true" /></figcaption></figure>)}</div>
    <div className="gallery-visit"><MapPin /><div><h3>{it ? "Vieni a conoscerci di persona." : "Come and see for yourself."}</h3><p>Via Venti Settembre, 118 int.1 — Roma</p></div><Link className="button primary" href={it ? "/contatti.html" : "/en/contact.html"}>{it ? "Prenota una visita" : "Book a visit"}<ArrowRight /></Link></div>
    <dialog ref={dialog} className="gallery-lightbox" aria-labelledby="lightbox-caption" onCancel={close} onClick={e => { if (e.target === e.currentTarget) close(); }} onKeyDown={e => { if (e.key === "ArrowRight") { e.preventDefault(); move(1); } if (e.key === "ArrowLeft") { e.preventDefault(); move(-1); } }}>
      <button className="lightbox-close" autoFocus onClick={close} aria-label={it ? "Chiudi fotografia" : "Close photograph"}><X /></button>
      {active && <div className="lightbox-body"><div className="lightbox-image"><Image src={active.src} alt={active.alt[lang]} fill sizes="90vw" /></div><div className="lightbox-controls"><button onClick={() => move(-1)} aria-label={it ? "Fotografia precedente" : "Previous photograph"}><ArrowLeft /></button><div id="lightbox-caption"><b>{active.title[lang]}</b><span>{(selected ?? 0) + 1} / {photos.length} · {active.subtitle[lang]}</span></div><button onClick={() => move(1)} aria-label={it ? "Fotografia successiva" : "Next photograph"}><ArrowRight /></button></div></div>}
    </dialog>
  </section>;
}
export function GalleryPreview({ lang }: { lang: Lang }) {
  const it = lang === "it";
  return <section className="section shell gallery-preview"><div className="section-heading"><div><span className="eyebrow">GALLERY</span><h2>{it ? "Il tuo prossimo spazio,\nnel cuore di Roma." : "Your next workspace,\nin the heart of Rome."}</h2></div><Link className="arrow-link" href={it ? "/gallery.html" : "/en/gallery.html"}>{it ? "ESPLORA LA GALLERY" : "EXPLORE THE GALLERY"}<ArrowRight /></Link></div><div className="gallery-preview-grid">{galleryPhotos.slice(0, 3).map(photo => <Link href={it ? "/gallery.html" : "/en/gallery.html"} key={photo.id}><div><Image src={photo.src} alt={photo.alt[lang]} fill sizes="(max-width: 700px) 90vw, 30vw" /></div><span>{photo.subtitle[lang]}<ArrowRight /></span></Link>)}</div></section>;
}
