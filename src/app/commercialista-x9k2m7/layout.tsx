import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../gestione.css";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// The page reads the staff session cookie and lists private documents: render it on every request, never from a cache.
export const dynamic = "force-dynamic";

export default function CommercialistaLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
