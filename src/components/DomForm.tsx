"use client";
import { useState } from "react";
import type { InferSelectModel } from "drizzle-orm";
import type { domClients } from "@/db/schema";

type DomClient = InferSelectModel<typeof domClients>;

const inputClass = "border border-slate-300 rounded px-2 py-1.5 text-sm w-full";
const labelClass = "block text-xs font-medium text-slate-600 mb-1";
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
    <div className="space-y-6">
      <form action={action} className="bg-white rounded-lg shadow p-6 space-y-5">
        {client && <input type="hidden" name="id" value={client.id} />}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={labelClass}>Ragione Sociale *</label>
            <input name="ragioneSociale" required defaultValue={client?.ragioneSociale ?? ""} className={inputClass} />
          </div>
          <div><label className={labelClass}>Email</label><input name="emailPosta" type="text" defaultValue={client?.emailPosta ?? ""} className={inputClass} /></div>
          <div><label className={labelClass}>Email PEC</label><input name="emailPec" type="text" defaultValue={client?.emailPec ?? ""} className={inputClass} /></div>
          <div><label className={labelClass}>Amministratore</label><input name="amministratore" defaultValue={client?.amministratore ?? ""} className={inputClass} /></div>
          <div><label className={labelClass}>Telefono amministratore</label><input name="telefonoAmm" defaultValue={client?.telefonoAmm ?? ""} className={inputClass} /></div>
          <div><label className={labelClass}>Persona di riferimento</label><input name="personaRif" defaultValue={client?.personaRif ?? ""} className={inputClass} /></div>
          <div><label className={labelClass}>Telefono</label><input name="telefono" defaultValue={client?.telefono ?? ""} className={inputClass} /></div>
          <div><label className={labelClass}>Telefono urgenze</label><input name="telefonoUrg" defaultValue={client?.telefonoUrg ?? ""} className={inputClass} /></div>
          <div>
            <label className={labelClass}>Stato</label>
            <select name="stato" defaultValue={client?.stato ?? 1} className={inputClass}>
              {STATI.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Tipologia</label>
            <select name="tipologia" defaultValue={client?.tipologia ?? 0} className={inputClass}>
              {TIPOLOGIE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div><label className={labelClass}>Inizio domiciliazione</label><input name="inizioDom" type="date" defaultValue={client?.inizioDom ?? ""} className={inputClass} /></div>
          <div><label className={labelClass}>Scadenza domiciliazione</label><input name="scadenzaDom" type="date" defaultValue={client?.scadenzaDom ?? ""} className={inputClass} /></div>
          <div><label className={labelClass}>Scadenza pagamento</label><input name="scadenzaPagamento" type="date" defaultValue={client?.scadenzaPagamento ?? ""} className={inputClass} /></div>
          <div><label className={labelClass}>Prezzo rinnovo (€)</label><input name="prezzoRinnovo" type="number" step="1" defaultValue={client?.prezzoRinnovo ?? ""} className={inputClass} /></div>
          <div><label className={labelClass}>Raccoglitore</label><input name="raccoglitore" type="number" defaultValue={client?.raccoglitore ?? 0} className={inputClass} /></div>
          <div className="md:col-span-2"><label className={labelClass}>Indirizzo spedizione posta</label><input name="indSpedPosta" defaultValue={client?.indSpedPosta ?? ""} className={inputClass} /></div>
          <div className="md:col-span-2"><label className={labelClass}>Note</label><textarea name="note" rows={3} defaultValue={client?.note ?? ""} className={inputClass} /></div>
        </div>

        <div>
          <label className={labelClass}>Documenti</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="contrFirmato" defaultChecked={!!client?.contrFirmato} /> Contratto firmato</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="controfirmatoInviato" defaultChecked={!!client?.controfirmatoInviato} /> Controfirmato inviato</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="moduloCont" defaultChecked={!!client?.moduloCont} /> Modulo</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="docAmmPres" defaultChecked={!!client?.docAmmPres} /> Doc. amministratore</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="allegato1Pres" defaultChecked={!!client?.allegato1Pres} /> Allegato 1</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="visuraPres" defaultChecked={!!client?.visuraPres} /> Visura</label>
          </div>
        </div>

        <button type="submit" className="bg-slate-800 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-slate-700">
          {client ? "Salva modifiche" : "Crea domiciliazione"}
        </button>
      </form>

      {client && deleteAction && (
        <form action={deleteAction} className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
          <input type="hidden" name="id" value={client.id} />
          <p className="text-sm text-slate-500">Eliminazione permanente del record.</p>
          {confirmDelete ? (
            <button type="submit" className="bg-red-600 text-white rounded px-3 py-1.5 text-sm font-semibold hover:bg-red-700">Conferma eliminazione</button>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="text-red-600 underline text-sm font-semibold">Elimina domiciliazione</button>
          )}
        </form>
      )}
    </div>
  );
}
