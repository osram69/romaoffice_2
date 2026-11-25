"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveDiscountCodesAction } from "@/app/gestione-configurazione-x9k2m7/actions";
import { runWithFeedback } from "./Toaster";
import { codeRunning, normalizeCode, type DiscountCodeRow, type DiscountScope } from "@/lib/discount-code";

type Draft = { code: string; label: string; percent: string; services: DiscountScope; validFrom: string; validTo: string; enabled: boolean; promoBanner: boolean; bannerIt: string; bannerEn: string };
const toDraft = (r: DiscountCodeRow): Draft => ({ code: r.code, label: r.label, percent: String(r.percentBps / 100), services: r.services, validFrom: r.validFrom ?? "", validTo: r.validTo ?? "", enabled: r.enabled, promoBanner: r.promoBanner, bannerIt: r.bannerIt ?? "", bannerEn: r.bannerEn ?? "" });
const EMPTY: Draft = { code: "", label: "", percent: "10", services: "all", validFrom: "", validTo: "", enabled: true, promoBanner: false, bannerIt: "", bannerEn: "" };
const check = { display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#232f3e" } as const;

function stateOf(d: Draft): { text: string; color: string } {
  const row: DiscountCodeRow = { code: d.code, label: d.label, percentBps: Math.round(Number(d.percent.replace(",", ".")) * 100) || 0, services: d.services, validFrom: d.validFrom || null, validTo: d.validTo || null, enabled: d.enabled, promoBanner: d.promoBanner, bannerIt: null, bannerEn: null };
  if (!d.enabled) return { text: "Spento", color: "#6c757d" };
  if (codeRunning(row)) return { text: "In corso ora", color: "#198754" };
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });
  return d.validFrom && today < d.validFrom ? { text: "Non ancora iniziato", color: "#b8860b" } : { text: "Scaduto", color: "#dc3545" };
}

export function DiscountCodesAdmin({ initial }: { initial: DiscountCodeRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Draft[]>(initial.map(toDraft));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; color: string } | null>(null);
  const patch = (i: number, p: Partial<Draft>) => { setRows(rows.map((r, idx) => idx === i ? { ...r, ...p } : r)); setMessage(null); };

  async function save() {
    const payload = rows.map(r => ({ code: normalizeCode(r.code), label: r.label, percent: Number(r.percent.replace(",", ".")), services: r.services, validFrom: r.validFrom, validTo: r.validTo, enabled: r.enabled, promoBanner: r.promoBanner, bannerIt: r.bannerIt, bannerEn: r.bannerEn }));
    if (payload.some(p => !p.code || !(p.percent > 0 && p.percent <= 99))) { setMessage({ text: "Ogni codice deve avere un nome e una percentuale tra 0 e 99.", color: "red" }); return; }
    setSaving(true); setMessage(null);
    try {
      let reason = "";
      const ok = await runWithFeedback(async () => { const r = await saveDiscountCodesAction(JSON.stringify(payload)); if (!r.success) reason = r.message ?? ""; return r; }, "Codici sconto salvati");
      setMessage(ok ? { text: "Salvato", color: "green" } : { text: reason || "Errore durante il salvataggio", color: "red" });
      if (ok) router.refresh();
    } finally { setSaving(false); }
  }

  return (
    <div>
      {rows.length === 0 && <p style={{ fontSize: 13, color: "#666" }}>Nessun codice sconto configurato.</p>}
      <div style={{ display: "grid", gap: 14 }}>
        {rows.map((r, i) => {
          const st = stateOf(r);
          return (
            <div key={i} style={{ border: "1px solid #dde1e6", borderRadius: 6, padding: 14, background: "#fafbfc" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
                <div className="gestione-field" style={{ width: 170 }}><label>Codice</label><input value={r.code} maxLength={40} style={{ textTransform: "uppercase" }} onChange={e => patch(i, { code: e.target.value.toUpperCase() })} /></div>
                <div className="gestione-field" style={{ width: 200 }}><label>Etichetta (interna)</label><input value={r.label} maxLength={100} onChange={e => patch(i, { label: e.target.value })} /></div>
                <div className="gestione-field" style={{ width: 90 }}><label>Sconto %</label><input type="number" min="0.01" max="99" step="0.01" value={r.percent} onChange={e => patch(i, { percent: e.target.value })} /></div>
                <div className="gestione-field" style={{ width: 190 }}>
                  <label>Valido per</label>
                  <select value={r.services} onChange={e => patch(i, { services: e.target.value as DiscountScope })}>
                    <option value="all">Sede legale e postale</option><option value="legal_unit">Solo sede legale</option><option value="postal">Solo domiciliazione postale</option>
                  </select>
                </div>
                <div className="gestione-field" style={{ width: 150 }}><label>Valido dal</label><input type="date" value={r.validFrom} onChange={e => patch(i, { validFrom: e.target.value })} /></div>
                <div className="gestione-field" style={{ width: 150 }}><label>Valido fino al (incluso)</label><input type="date" value={r.validTo} onChange={e => patch(i, { validTo: e.target.value })} /></div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center", marginTop: 10 }}>
                <label style={check}><input type="checkbox" checked={r.enabled} onChange={e => patch(i, { enabled: e.target.checked })} /> Attivo</label>
                <label style={check}><input type="checkbox" checked={r.promoBanner} onChange={e => patch(i, { promoBanner: e.target.checked })} /> Mostra come promozione (banner sul sito)</label>
                <span style={{ fontSize: 12, fontWeight: 700, color: st.color }}>● {st.text}</span>
                <button type="button" className="gestione-btn gestione-btn-red" style={{ marginLeft: "auto" }} onClick={() => { setRows(rows.filter((_, idx) => idx !== i)); setMessage(null); }}>Elimina</button>
              </div>
              {r.promoBanner && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 10 }}>
                  <div className="gestione-field" style={{ flex: "1 1 320px" }}><label>Testo del banner (italiano) — vuoto = testo automatico</label><input value={r.bannerIt} maxLength={240} onChange={e => patch(i, { bannerIt: e.target.value })} /></div>
                  <div className="gestione-field" style={{ flex: "1 1 320px" }}><label>Banner text (English) — empty = automatic text</label><input value={r.bannerEn} maxLength={240} onChange={e => patch(i, { bannerEn: e.target.value })} /></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginTop: 14 }}>
        <button type="button" className="gestione-btn gestione-btn-outline" disabled={rows.length >= 50} onClick={() => { setRows([...rows, { ...EMPTY }]); setMessage(null); }}>+ Nuovo codice</button>
        <button type="button" className="gestione-btn gestione-btn-blue" disabled={saving} onClick={save}>{saving ? "Salvataggio..." : "Salva codici sconto"}</button>
        {message && <span style={{ fontSize: 12, color: message.color }}>{message.text}</span>}
      </div>
    </div>
  );
}
