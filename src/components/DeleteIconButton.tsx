"use client";
import { Trash2 } from "lucide-react";

export function DeleteIconButton({ id, action, label, field = "id", warning }: { id: number | string; action: (formData: FormData) => void; label: string; field?: string; warning?: string }) {
  return (
    <form
      action={action}
      onSubmit={e => { if (!confirm(`Eliminare definitivamente "${label}"?${warning ? `\n\n${warning}` : ""}`)) e.preventDefault(); }}
    >
      <input type="hidden" name={field} value={id} />
      <button type="submit" className="gestione-icon-btn delete" aria-label={`Elimina ${label}`} title="Elimina">
        <Trash2 size={14} />
      </button>
    </form>
  );
}
