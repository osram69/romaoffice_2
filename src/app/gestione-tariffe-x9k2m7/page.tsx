import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { serviceAddons, serviceCatalog, servicePrices } from "@/db/schema";
import { STAFF_SESSION_COOKIE, getStaffUser } from "@/lib/staff-auth";
import { staffLogoutAction } from "@/lib/staff-actions";
import { addPriceAction, updateAddonAction, updatePriceAction, updateServiceAction } from "./actions";
import { GestioneNav } from "@/components/GestioneNav";

const SERVICE_LABELS: Record<string, string> = { legal_unit: "Domiciliazione Sede Legale / Unità Locale", postal: "Domiciliazione Postale" };
const euro = (cents: number | null) => cents === null ? "" : (cents / 100).toFixed(2);
const inputClass = "border border-slate-300 rounded px-2 py-1 text-sm w-full";
const btnClass = "bg-slate-800 text-white rounded px-3 py-1.5 text-xs font-semibold hover:bg-slate-700 whitespace-nowrap";

export default async function AdminDashboardPage() {
  const store = await cookies();
  const user = await getStaffUser(store.get(STAFF_SESSION_COOKIE)?.value);
  if (!user) redirect("/gestione-tariffe-x9k2m7/login?next=/gestione-tariffe-x9k2m7");
  if (user.role !== "admin") redirect("/gestione-domiciliazioni-x9k2m7");

  const [services, tiers, addons] = await Promise.all([
    db.select().from(serviceCatalog),
    db.select().from(servicePrices).orderBy(asc(servicePrices.service), asc(servicePrices.months)),
    db.select().from(serviceAddons).orderBy(asc(serviceAddons.service), asc(serviceAddons.sortOrder)),
  ]);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-10">
      <GestioneNav role={user.role} active="tariffe" username={user.username} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Gestione tariffe</h1>
      </div>

      {services.map(service => {
        const serviceTiers = tiers.filter(t => t.service === service.code);
        const serviceAddonsList = addons.filter(a => a.service === service.code);
        return (
          <section key={service.code} className="bg-white rounded-lg shadow p-6 space-y-6">
            <h2 className="text-lg font-semibold text-slate-800">{SERVICE_LABELS[service.code] ?? service.code}</h2>

            <form action={updateServiceAction} className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end border-b border-slate-200 pb-6">
              <input type="hidden" name="code" value={service.code} />
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Sconto domiciliazioni aggiuntive (%)</label>
                <input name="additionalDiscountBps" type="number" step="0.01" min="0" max="100" defaultValue={service.additionalDiscountBps / 100} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Sconto nuove attivazioni (%)</label>
                <input name="newActivationDiscountBps" type="number" step="0.01" min="0" max="100" defaultValue={service.newActivationDiscountBps / 100} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Offerta valida fino al</label>
                <input name="offerValidUntil" type="date" defaultValue={service.offerValidUntil ? service.offerValidUntil.toISOString().slice(0, 10) : ""} className={inputClass} />
              </div>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <input type="checkbox" name="active" defaultChecked={service.active} /> Servizio attivo
              </label>
              <button type="submit" className={btnClass}>Salva</button>
            </form>

            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Durate e prezzi</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 uppercase">
                      <th className="py-1 pr-2">Mesi</th>
                      <th className="py-1 pr-2">Listino (€)</th>
                      <th className="py-1 pr-2">Offerta (€)</th>
                      <th className="py-1 pr-2">Nuova attiv.</th>
                      <th className="py-1 pr-2">Attivo</th>
                      <th className="py-1 pr-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {serviceTiers.map(tier => (
                      <tr key={tier.id} className="border-t border-slate-100">
                        <td className="py-1.5 pr-2">
                          <form id={`tier-${tier.id}`} action={updatePriceAction}>
                            <input type="hidden" name="id" value={tier.id} />
                            {tier.months}
                          </form>
                        </td>
                        <td className="py-1.5 pr-2"><input form={`tier-${tier.id}`} name="listCents" type="number" step="0.01" min="0" defaultValue={euro(tier.listCents)} className={inputClass} /></td>
                        <td className="py-1.5 pr-2"><input form={`tier-${tier.id}`} name="offerCents" type="number" step="0.01" min="0" defaultValue={euro(tier.offerCents)} className={inputClass} /></td>
                        <td className="py-1.5 pr-2 text-center"><input form={`tier-${tier.id}`} name="newActivation" type="checkbox" defaultChecked={tier.newActivation} /></td>
                        <td className="py-1.5 pr-2 text-center"><input form={`tier-${tier.id}`} name="active" type="checkbox" defaultChecked={tier.active} /></td>
                        <td className="py-1.5"><button form={`tier-${tier.id}`} type="submit" className={btnClass}>Salva</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <details className="mt-3">
                <summary className="text-xs text-slate-500 cursor-pointer">Aggiungi nuova durata</summary>
                <form action={addPriceAction} className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end mt-2">
                  <input type="hidden" name="service" value={service.code} />
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Mesi</label><input name="months" type="number" min="1" required className={inputClass} /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Listino (€)</label><input name="listCents" type="number" step="0.01" min="0" required className={inputClass} /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Offerta (€)</label><input name="offerCents" type="number" step="0.01" min="0" className={inputClass} /></div>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-600"><input type="checkbox" name="newActivation" /> Nuova attiv.</label>
                  <button type="submit" className={btnClass}>Aggiungi</button>
                </form>
              </details>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Servizi aggiuntivi</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 uppercase">
                      <th className="py-1 pr-2">Codice</th>
                      <th className="py-1 pr-2">Titolo IT</th>
                      <th className="py-1 pr-2">Titolo EN</th>
                      <th className="py-1 pr-2">Prezzo (€)</th>
                      <th className="py-1 pr-2">Annuo (€)</th>
                      <th className="py-1 pr-2">Q.tà max</th>
                      <th className="py-1 pr-2">Selezionabile</th>
                      <th className="py-1 pr-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {serviceAddonsList.map(addon => (
                      <tr key={addon.code} className="border-t border-slate-100">
                        <td className="py-1.5 pr-2 font-mono text-xs">
                          <form id={`addon-${addon.code}`} action={updateAddonAction}>
                            <input type="hidden" name="code" value={addon.code} />
                          </form>
                          {addon.code}
                        </td>
                        <td className="py-1.5 pr-2"><input form={`addon-${addon.code}`} name="titleIt" defaultValue={addon.titleIt} className={inputClass} /></td>
                        <td className="py-1.5 pr-2"><input form={`addon-${addon.code}`} name="titleEn" defaultValue={addon.titleEn} className={inputClass} /></td>
                        <td className="py-1.5 pr-2"><input form={`addon-${addon.code}`} name="priceCents" type="number" step="0.01" min="0" defaultValue={euro(addon.priceCents)} className={inputClass} /></td>
                        <td className="py-1.5 pr-2"><input form={`addon-${addon.code}`} name="annualCents" type="number" step="0.01" min="0" defaultValue={euro(addon.annualCents)} className={inputClass} /></td>
                        <td className="py-1.5 pr-2"><input form={`addon-${addon.code}`} name="maxQuantity" type="number" min="1" defaultValue={addon.maxQuantity} className={inputClass} /></td>
                        <td className="py-1.5 pr-2 text-center"><input form={`addon-${addon.code}`} name="selectable" type="checkbox" defaultChecked={addon.selectable} /></td>
                        <td className="py-1.5"><button form={`addon-${addon.code}`} type="submit" className={btnClass}>Salva</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-400 mt-2">Il tipo di fatturazione (mensile, a ora, a busta...) non è modificabile qui perché è collegato alla logica di calcolo prezzi.</p>
            </div>
          </section>
        );
      })}
    </div>
  );
}
