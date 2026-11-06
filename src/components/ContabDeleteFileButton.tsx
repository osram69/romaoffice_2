"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteContabFileAction } from "@/app/gestione-contabilita-x9k2m7/actions";
import { CONTAB_GENERIC_FAILURE, CONTAB_LOCKED_MESSAGE } from "@/lib/contab-messages";

/** "Elimina" of one file, with a confirmation. Only the id and the display name reach this component. */
export function ContabDeleteFileButton({ fileId, name }: { fileId: number; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    if (!window.confirm(`Eliminare il file "${name}"?\nL'operazione non si può annullare.`)) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await deleteContabFileAction(fileId);
        if (result.ok) return;
        if (result.message === CONTAB_LOCKED_MESSAGE) {
          // The unlock expired: refreshing shows the password form again.
          router.refresh();
          return;
        }
        setError(result.message ?? CONTAB_GENERIC_FAILURE);
      } catch {
        setError(CONTAB_GENERIC_FAILURE);
      }
    });
  }

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <button type="button" className="gestione-btn gestione-btn-red" disabled={pending} onClick={remove} style={pending ? { opacity: 0.6, cursor: "wait" } : undefined}>
        <Trash2 size={14} /> {pending ? "Elimino..." : "Elimina"}
      </button>
      {error && <span role="alert" style={{ fontSize: 12, color: "#c0392b" }}>{error}</span>}
    </span>
  );
}
