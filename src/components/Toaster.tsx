"use client";
import { useSyncExternalStore } from "react";

// One small notification area for the whole backend (mounted once, in GestioneSidebar). A server action
// submitted from a plain <form action> saves and re-renders without telling the operator anything, which
// is indistinguishable from "nothing happened" — so every save/delete/send now reports its outcome here.
type Kind = "success" | "error" | "info";
type Item = { id: number; kind: Kind; text: string };

let items: Item[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const snapshot = () => items;
const serverSnapshot = (): Item[] => [];

export function dismissToast(id: number) { items = items.filter(i => i.id !== id); emit(); }

export function toast(text: string, kind: Kind = "success") {
  const id = nextId++;
  items = [...items.slice(-3), { id, kind, text }];
  emit();
  const timer = setTimeout(() => dismissToast(id), kind === "error" ? 8000 : 3500);
  (timer as unknown as { unref?: () => void }).unref?.(); // so a Node test run never waits for it
}

const COLORS: Record<Kind, { bg: string; border: string; fg: string; icon: string }> = {
  success: { bg: "#e9f7ef", border: "#28a745", fg: "#14532d", icon: "✓" },
  error: { bg: "#fdecea", border: "#dc3545", fg: "#7f1d1d", icon: "!" },
  info: { bg: "#e8f1fb", border: "#2f6fb5", fg: "#173a63", icon: "i" },
};

export function ToastHost() {
  const list = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  if (!list.length) return null;
  return (
    <div style={{ position: "fixed", right: 20, bottom: 20, zIndex: 10000, display: "flex", flexDirection: "column", gap: 8, maxWidth: "min(420px, calc(100vw - 40px))" }}>
      {list.map(item => {
        const c = COLORS[item.kind];
        return (
          <div key={item.id} role={item.kind === "error" ? "alert" : "status"} aria-live={item.kind === "error" ? "assertive" : "polite"}
            style={{ display: "flex", alignItems: "flex-start", gap: 10, background: c.bg, color: c.fg, border: `1px solid ${c.border}`, borderLeft: `5px solid ${c.border}`, borderRadius: 6, padding: "10px 12px", fontSize: 13, lineHeight: 1.4, boxShadow: "0 4px 14px rgba(0,0,0,.18)" }}>
            <b aria-hidden="true" style={{ flex: "0 0 auto" }}>{c.icon}</b>
            <span style={{ flex: "1 1 auto" }}>{item.text}</span>
            <button type="button" onClick={() => dismissToast(item.id)} aria-label="Chiudi avviso" style={{ flex: "0 0 auto", background: "none", border: 0, color: "inherit", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
          </div>
        );
      })}
    </div>
  );
}

// What a server action may answer: nothing (it worked), { ok, message } (this backend's new convention) or
// { success, message } (the older domiciliazioni actions). A thrown error means it did not work.
const GENERIC_ERROR = "Operazione non riuscita. Riprova; se il problema continua controlla i dati inseriti o la connessione.";

export function readActionResult(result: unknown): { ok: boolean; message?: string } {
  if (result && typeof result === "object") {
    const r = result as { ok?: unknown; success?: unknown; message?: unknown };
    const flag = typeof r.ok === "boolean" ? r.ok : typeof r.success === "boolean" ? r.success : true;
    return { ok: flag, message: typeof r.message === "string" ? r.message : undefined };
  }
  return { ok: true };
}

/** Runs a server action, tells the operator the outcome, and returns whether it worked. */
export async function runWithFeedback(task: () => Promise<unknown>, successText: string): Promise<boolean> {
  try {
    const { ok, message } = readActionResult(await task());
    if (ok) toast(message || successText, "success");
    else toast(message || GENERIC_ERROR, "error");
    return ok;
  } catch (error) {
    // A redirect (session expired) is handled by Next itself; anything else is a failed save.
    if (error && typeof error === "object" && "digest" in error && String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")) throw error;
    toast(GENERIC_ERROR, "error");
    return false;
  }
}
