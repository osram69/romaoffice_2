"use client";
import { useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { runWithFeedback } from "./Toaster";

// Wraps a plain Server Action so Configurazione Web's save buttons give visible feedback — a bare
// `<form action={serverAction}>` submits and revalidates silently, which (as found with the
// company edit form) looks exactly like a no-op even when the save went through.
export function ConfigForm({ action, children, style }: { action: (formData: FormData) => Promise<unknown>; children: ReactNode; style?: CSSProperties }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ text: string; color: string } | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setSaving(true);
    setStatus(null);
    try {
      const ok = await runWithFeedback(async () => action(formData), "Salvato");
      setStatus(ok ? { text: "Salvato", color: "green" } : { text: "Errore durante il salvataggio", color: "red" });
      if (ok) router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={style}>
      {children}
      <button type="submit" className="gestione-btn gestione-btn-blue" disabled={saving}>{saving ? "Salvataggio..." : "Salva"}</button>
      {status && <span style={{ fontSize: 12, color: status.color }}>{status.text}</span>}
    </form>
  );
}
