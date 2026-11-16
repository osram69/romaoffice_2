"use client";
import { type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { runWithFeedback } from "./Toaster";

// A drop-in replacement for `<form action={serverAction}>` in the backend that reports the outcome
// ("Salvato" / the error) instead of saving silently. Works with inputs and buttons placed elsewhere
// in the page through the `form="id"` attribute (the tariffe tables do that): FormData(form) and
// form.elements both include them.
export function FeedbackForm({ action, children, style, className, id, successText = "Salvato", confirmText, resetOnSuccess = false, onSuccess }: {
  action: (formData: FormData) => Promise<unknown> | unknown;
  children?: ReactNode; style?: CSSProperties; className?: string; id?: string;
  successText?: string; confirmText?: string; resetOnSuccess?: boolean; onSuccess?: () => void;
}) {
  const router = useRouter();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (form.dataset.busy === "1") return;
    if (confirmText && !confirm(confirmText)) return;
    form.dataset.busy = "1";
    const buttons = Array.from(form.elements).filter((el): el is HTMLButtonElement => el instanceof HTMLButtonElement && el.type === "submit" && !el.disabled);
    buttons.forEach(b => { b.disabled = true; });
    try {
      const ok = await runWithFeedback(async () => action(new FormData(form)), successText);
      if (ok) { if (resetOnSuccess) form.reset(); router.refresh(); onSuccess?.(); }
    } finally {
      buttons.forEach(b => { b.disabled = false; });
      delete form.dataset.busy;
    }
  }

  return <form id={id} className={className} style={style} onSubmit={handleSubmit}>{children}</form>;
}
