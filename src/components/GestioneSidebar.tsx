"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { staffLogoutAction } from "@/lib/staff-actions";
import type { StaffRole } from "@/lib/staff-auth";
import { BrandWords } from "./BrandWords";
import { DomForm } from "./DomForm";

export function GestioneSidebar({ role, active, username, tabs, newDomiciliazioneAction }: {
  role: StaffRole; active: "tariffe" | "domiciliazioni" | "configurazione" | "ordini"; username: string;
  tabs: { stato: number; label: string; count: number }[];
  newDomiciliazioneAction?: (formData: FormData) => void;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [printingRaccoglitori, setPrintingRaccoglitori] = useState(false);
  const [raccoglitoreValue, setRaccoglitoreValue] = useState("0");

  useEffect(() => {
    if (!open && !creating && !printingRaccoglitori) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setCreating(false); setPrintingRaccoglitori(false); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, creating, printingRaccoglitori]);

  return (
    <>
      <button type="button" className="gestione-sidebar-toggle" aria-label={open ? "Chiudi menu" : "Apri menu"} aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      {open && <div className="gestione-sidebar-overlay" onClick={() => setOpen(false)} />}
      <aside className={`gestione-sidebar${open ? " active" : ""}`}>
        <div className="sidebar-header"><BrandWords /></div>
        <div className="sidebar-user">{username} · {role === "admin" ? "amministratore" : "operatore"}</div>
        <ul>
          <li className={active === "domiciliazioni" ? "active" : ""}>
            <Link href="/gestione-domiciliazioni-x9k2m7" onClick={() => setOpen(false)}>Domiciliazioni</Link>
          </li>
          <li className={active === "ordini" ? "active" : ""}>
            <Link href="/gestione-ordini-x9k2m7" onClick={() => setOpen(false)}>Ordini Online</Link>
          </li>
          {tabs.map(tab => (
            <li key={tab.stato} className="sidebar-sub">
              <Link href={`/gestione-domiciliazioni-x9k2m7?stato=${tab.stato}`} onClick={() => setOpen(false)}>
                {tab.label} <span className="gestione-badge">{tab.count}</span>
              </Link>
            </li>
          ))}
          {newDomiciliazioneAction && (
            <>
              <li className="sidebar-sub"><a className="sidebar-link" href="/api/dom-print?kind=lista" target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>Stampa Lista</a></li>
              <li className="sidebar-sub"><button type="button" className="sidebar-link" onClick={() => { setPrintingRaccoglitori(true); setOpen(false); }}>Stampa raccoglitori</button></li>
              <li className="sidebar-sub"><button type="button" className="sidebar-link" onClick={() => { setCreating(true); setOpen(false); }}>Nuova domiciliazione</button></li>
            </>
          )}
          {role === "admin" && (
            <>
              <li className="sidebar-section" style={{ borderTop: "2px solid #444" }}>Configurazione</li>
              <li className={`sidebar-sub${active === "tariffe" ? " active" : ""}`}>
                <Link href="/gestione-tariffe-x9k2m7" onClick={() => setOpen(false)}>Tariffe e Offerte</Link>
              </li>
              <li className={`sidebar-sub${active === "configurazione" ? " active" : ""}`}>
                <Link href="/gestione-configurazione-x9k2m7" onClick={() => setOpen(false)}>Configurazione Web</Link>
              </li>
            </>
          )}
          <li><form action={staffLogoutAction}><button type="submit" className="sidebar-link">Esci</button></form></li>
        </ul>
      </aside>

      {printingRaccoglitori && (
        <div className="gestione-modal-overlay" onClick={() => setPrintingRaccoglitori(false)}>
          <div className="gestione-modal-box" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="gestione-modal-header">
              <h2>Stampa raccoglitori</h2>
              <button type="button" className="gestione-modal-close" aria-label="Chiudi" onClick={() => setPrintingRaccoglitori(false)}>×</button>
            </div>
            <div className="gestione-modal-body">
              <div className="gestione-field">
                <label>Numero raccoglitore (0 = elenco completo di tutti i raccoglitori)</label>
                <input type="number" min={0} value={raccoglitoreValue} onChange={e => setRaccoglitoreValue(e.target.value)} />
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <a className="gestione-btn gestione-btn-blue" href={`/api/dom-print?kind=raccoglitori&raccoglitore=${Number(raccoglitoreValue) || 0}`} target="_blank" rel="noopener noreferrer" onClick={() => setPrintingRaccoglitori(false)}>Stampa</a>
                <button type="button" className="gestione-btn gestione-btn-outline" onClick={() => setPrintingRaccoglitori(false)}>Chiudi</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {creating && newDomiciliazioneAction && (
        <div className="gestione-modal-overlay" onClick={() => setCreating(false)}>
          <div className="gestione-modal-box" onClick={e => e.stopPropagation()}>
            <div className="gestione-modal-header">
              <h2>Nuova Domiciliazione</h2>
              <button type="button" className="gestione-modal-close" aria-label="Chiudi" onClick={() => setCreating(false)}>×</button>
            </div>
            <div className="gestione-modal-body">
              <DomForm action={newDomiciliazioneAction} onClose={() => setCreating(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
