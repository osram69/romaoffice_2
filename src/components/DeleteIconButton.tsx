"use client";
import { Trash2 } from "lucide-react";

export function DeleteIconButton({ id, action, label }: { id: number; action: (formData: FormData) => void; label: string }) {
  return (
    <form
      action={action}
      onSubmit={e => { if (!confirm(`Eliminare definitivamente "${label}"?`)) e.preventDefault(); }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="gestione-icon-btn delete" aria-label={`Elimina ${label}`} title="Elimina">
        <Trash2 size={14} />
      </button>
    </form>
  );
}
