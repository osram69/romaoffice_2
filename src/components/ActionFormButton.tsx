"use client";

export function ActionFormButton({ id, action, className, label, confirmText, children }: {
  id: number; action: (formData: FormData) => void; className: string; label: string; confirmText?: string; children: React.ReactNode;
}) {
  return (
    <form action={action} onSubmit={e => { if (confirmText && !confirm(confirmText)) e.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className={className} aria-label={label} title={label}>{children}</button>
    </form>
  );
}
