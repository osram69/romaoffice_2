"use client";
import { useState } from "react";
import type { InferSelectModel } from "drizzle-orm";
import type { domClients } from "@/db/schema";

type DomClient = InferSelectModel<typeof domClients>;

const STATI = [
  { value: 0, label: "In Attivazione" },
  { value: 1, label: "Attiva" },
  { value: 2, label: "Decaduta" },
  { value: 3, label: "Sospesa" },
  { value: -1, label: "Vuota" },
];
const TIPOLOGIE = [
  { value: 0, label: "Legale" },
  { value: 1, label: "Postale" },
  { value: 2, label: "Professionale" },
  { value: 3, label: "Avvocato" },
];

export function DomForm({ client, action, deleteAction }: { client?: DomClient; action: (formData: FormData) => void; deleteAction?: (formData: FormData) => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <form action={action} className="gestione-card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
        {client && <input type="hidden" name="id" value={client.id} />}
        <div className="dom-form-grid">
          <div className="gestione-field" style={{ gridColumn: "1 / -1" }}>
            <label>Ragione Sociale *</label>
            <input name="ragioneSociale" required defaultValue={client?.ragioneSociale ?? ""} />
          </div>
          <div className="gestione-field"><label>Email</label><input name="emailPosta" type="text" defaultValue={client?.emailPosta ?? ""} /></div>
          <div className="gestione-field"><label>Email PEC</label><input name="emailPec" type="text" defaultValue={client?.emailPec ?? ""} /></div>
          <div className="gestione-field"><label>Amministratore</label><input name="amministratore" defaultValue={client?.amministratore ?? ""} /></div>
          <div className="gestione-field"><label>Telefono amministratore</label><input name="telefonoAmm" defaultValue={client?.telefonoAmm ?? ""} /></div>
          <div className="gestione-field"><label>Persona di riferimento</label><input name="personaRif" defaultValue={client?.personaRif ?? ""} /></div>
          <div className="gestione-field"><label>Telefono</label><input name="telefono" defaultValue={client?.telefono ?? ""} /></div>
          <div className="gestione-field"><label>Telefono urgenze</label><input name="telefonoUrg" defaultValue={client?.telefonoUrg ?? ""} /></div>
          <div className="gestione-field">
            <label>Stato</label>
            <select name="stato" defaultValue={client?.stato ?? 1}>
              {STATI.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="gestione-field">
            <label>Tipologia</label>
            <select name="tipologia" defaultValue={client?.tipologia ?? 0}>
              {TIPOLOGIE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="gestione-field"><label>Inizio domiciliazione</label><input name="inizioDom" type="date" defaultValue={client?.inizioDom ?? ""} /></div>
          <div className="gestione-field"><label>Scadenza domiciliazione</label><input name="scadenzaDom" type="date" defaultValue={client?.scadenzaDom ?? ""} /></div>
          <div className="gestione-field"><label>Scadenza pagamento</label><input name="scadenzaPagamento" type="date" defaultValue={client?.scadenzaPagamento ?? ""} /></div>
          <div className="gestione-field"><label>Prezzo rinnovo (€)</label><input name="prezzoRinnovo" type="number" step="1" defaultValue={client?.prezzoRinnovo ?? ""} /></div>
          <div className="gestione-field"><label>Raccoglitore</label><input name="raccoglitore" type="number" defaultValue={client?.raccoglitore ?? 0} /></div>
          <div className="gestione-field" style={{ gridColumn: "1 / -1" }}><label>Indirizzo spedizione posta</label><input name="indSpedPosta" defaultValue={client?.indSpedPosta ?? ""} /></div>
          <div className="gestione-field" style={{ gridColumn: "1 / -1" }}><label>Note</label><textarea name="note" rows={3} defaultValue={client?.note ?? ""} /></div>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#232f3e", marginBottom: 8 }}>Documenti</label>
          <div className="dom-form-checks">
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}><input type="checkbox" name="contrFirmato" defaultChecked={!!client?.contrFirmato} /> Contratto firmato</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}><input type="checkbox" name="controfirmatoInviato" defaultChecked={!!client?.controfirmatoInviato} /> Controfirmato inviato</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}><input type="checkbox" name="moduloCont" defaultChecked={!!client?.moduloCont} /> Modulo</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}><input type="checkbox" name="docAmmPres" defaultChecked={!!client?.docAmmPres} /> Doc. amministratore</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}><input type="checkbox" name="allegato1Pres" defaultChecked={!!client?.allegato1Pres} /> Allegato 1</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}><input type="checkbox" name="visuraPres" defaultChecked={!!client?.visuraPres} /> Visura</label>
          </div>
        </div>

        <button type="submit" className="gestione-btn gestione-btn-blue" style={{ alignSelf: "flex-start", padding: "9px 20px" }}>
          {client ? "Salva modifiche" : "Crea domiciliazione"}
        </button>
      </form>

      {client && deleteAction && (
        <form action={deleteAction} className="gestione-card" style={{ padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <input type="hidden" name="id" value={client.id} />
          <p style={{ fontSize: 13, color: "#666", margin: 0 }}>Eliminazione permanente del record.</p>
          {confirmDelete ? (
            <button type="submit" className="gestione-btn gestione-btn-red">Conferma eliminazione</button>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} style={{ color: "#dc3545", textDecoration: "underline", fontSize: 13, fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>Elimina domiciliazione</button>
          )}
        </form>
      )}

      <style>{`
        .dom-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .dom-form-checks { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        @media (max-width: 640px) { .dom-form-grid, .dom-form-checks { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
