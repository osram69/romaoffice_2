"use client";
import { FeedbackForm } from "./FeedbackForm";

export function ActionFormButton({ id, action, className, label, confirmText, successText, children }: {
  id: number; action: (formData: FormData) => void | Promise<unknown>; className: string; label: string; confirmText?: string; successText?: string; children: React.ReactNode;
}) {
  return (
    <FeedbackForm action={action} confirmText={confirmText} successText={successText ?? `${label}: fatto`}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className={className} aria-label={label} title={label}>{children}</button>
    </FeedbackForm>
  );
}
