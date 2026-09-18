"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { staffLogoutAction } from "@/lib/staff-actions";
import type { StaffRole } from "@/lib/staff-auth";
import { BrandWords } from "./BrandWords";
import { DomForm } from "./DomForm";

export function GestioneSidebar({ role, active, username, tabs, newDomiciliazioneAction }: {
  role: StaffRole; active: "tariffe" | "domiciliazioni"; username: string;
  tabs: { stato: number; label: string; count: number }[];
  newDomiciliazioneAction?: (formData: FormData) => void;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open && !creating) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setCreating(false); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, creating]);

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
          {tabs.map(tab => (
            <li key={tab.stato}>
              <Link href={`/gestione-domiciliazioni-x9k2m7?stato=${tab.stato}`} onClick={() => setOpen(false)}>
                {tab.label} <span className="gestione-badge">{tab.count}</span>
              </Link>
            </li>
          ))}
          {newDomiciliazioneAction && (
            <li><button type="button" className="sidebar-link" onClick={() => { setCreating(true); setOpen(false); }}>Nuova domiciliazione</button></li>
          )}
          {role === "admin" && (
            <li className={active === "tariffe" ? "active" : ""} style={{ borderTop: "2px solid #444" }}>
              <Link href="/gestione-tariffe-x9k2m7" onClick={() => setOpen(false)}>Tariffe e Offerte</Link>
            </li>
          )}
          <li><form action={staffLogoutAction}><button type="submit" className="sidebar-link">Esci</button></form></li>
        </ul>
      </aside>

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
