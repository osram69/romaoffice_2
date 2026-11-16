"use client";
import { Trash2 } from "lucide-react";
import { FeedbackForm } from "./FeedbackForm";

export function DeleteIconButton({ id, action, label, field = "id", warning, successText = "Eliminato" }: { id: number | string; action: (formData: FormData) => void | Promise<unknown>; label: string; field?: string; warning?: string; successText?: string }) {
  return (
    <FeedbackForm action={action} successText={successText} confirmText={`Eliminare definitivamente "${label}"?${warning ? `\n\n${warning}` : ""}`}>
      <input type="hidden" name={field} value={id} />
      <button type="submit" className="gestione-icon-btn delete" aria-label={`Elimina ${label}`} title="Elimina">
        <Trash2 size={14} />
      </button>
    </FeedbackForm>
  );
}
