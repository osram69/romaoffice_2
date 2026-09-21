import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../gestione.css";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function OrdiniLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
