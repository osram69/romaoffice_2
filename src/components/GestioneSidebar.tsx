"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { staffLogoutAction } from "@/lib/staff-actions";
import type { StaffRole } from "@/lib/staff-auth";
import { BrandWords } from "./BrandWords";

export function GestioneSidebar({ role, active, username, tabs }: {
  role: StaffRole; active: "tariffe" | "domiciliazioni"; username: string;
  tabs: { stato: number; label: string; count: number }[];
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

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
          {role === "admin" && (
            <li className={active === "tariffe" ? "active" : ""} style={{ borderTop: "2px solid #444" }}>
              <Link href="/gestione-tariffe-x9k2m7" onClick={() => setOpen(false)}>Tariffe e Offerte</Link>
            </li>
          )}
          <li><form action={staffLogoutAction}><button type="submit" className="sidebar-link">Esci</button></form></li>
        </ul>
      </aside>
    </>
  );
}
