"use client";
import { Check } from "lucide-react";
import { PASSWORD_REQUIREMENTS } from "@/lib/password-policy";

export function PasswordRequirementsList({ password, lang }: { password: string; lang: "it" | "en" }) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: "6px 0 0", display: "flex", flexDirection: "column", gap: 3 }}>
      {PASSWORD_REQUIREMENTS.map(r => {
        const ok = r.test(password);
        return (
          <li key={r.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: ok ? "#1a7f37" : "#777" }}>
            <Check size={13} style={{ opacity: ok ? 1 : 0.25 }} />
            {r.label[lang]}
          </li>
        );
      })}
    </ul>
  );
}
