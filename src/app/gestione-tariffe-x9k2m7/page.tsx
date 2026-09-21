import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { domRinnovoPrezzi, serviceAddons, serviceCatalog, servicePrices } from "@/db/schema";
import { STAFF_SESSION_COOKIE, getStaffUser } from "@/lib/staff-auth";
import { addPriceAction, deletePriceAction, updateAddonAction, updatePriceAction, updateRinnovoPrezzoAction, updateServiceAction } from "./actions";
import { GestioneShell } from "@/components/GestioneNav";
import { DeleteIconButton } from "@/components/DeleteIconButton";

const SERVICE_LABELS: Record<string, string> = { legal_unit: "Domiciliazione Sede Legale / Unità Locale", postal: "Domiciliazione Postale" };
const euro = (cents: number | null) => cents === null ? "" : (cents / 100).toFixed(2);

export default async function AdminDashboardPage() {
  const store = await cookies();
  const user = await getStaffUser(store.get(STAFF_SESSION_COOKIE)?.value);
  if (!user) redirect("/gestione-tariffe-x9k2m7/login?next=/gestione-tariffe-x9k2m7");
  if (user.role !== "admin") redirect("/gestione-domiciliazioni-x9k2m7");

  const [services, tiers, addons, rinnovoPrezzi] = await Promise.all([
    db.select().from(serviceCatalog),
    db.select().from(servicePrices).orderBy(asc(servicePrices.service), asc(servicePrices.months)),
    db.select().from(serviceAddons).orderBy(asc(serviceAddons.service), asc(serviceAddons.sortOrder)),
    db.select().from(domRinnovoPrezzi).orderBy(asc(domRinnovoPrezzi.mesi)),
  ]);

  return (
    <GestioneShell role={user.role} active="tariffe" username={user.username}>
      <h1 className="gestione-h1" style={{ marginBottom: 20 }}>Gestione tariffe</h1>

      <section className="gestione-card" style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#232f3e", marginTop: 0 }}>Prezzi rinnovi (email di scadenza)</h2>
        <p style={{ fontSize: 12, color: "#666", marginTop: -6 }}>
          Prezzi delle offerte proposte nelle email di promemoria scadenza — separati dalle tariffe di nuova attivazione qui sotto.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table className="gestione-table">
            <thead>
              <tr><th>Mesi</th><th>Prezzo pieno (€)</th><th>Prezzo offerta (€)</th><th>Nota (es. &quot;31€/mese&quot;)</th><th></th></tr>
            </thead>
            <tbody>
              {rinnovoPrezzi.map(row => (
                <tr key={row.mesi}>
                  <td>
                    <form id={`rinnovo-${row.mesi}`} action={updateRinnovoPrezzoAction}>
                      <input type="hidden" name="mesi" value={row.mesi} />
                    </form>
                    {row.mesi}
                  </td>
                  <td><input form={`rinnovo-${row.mesi}`} name="prezzoPieno" type="number" min="0" defaultValue={row.prezzoPieno ?? ""} style={inputStyle} /></td>
                  <td><input form={`rinnovo-${row.mesi}`} name="prezzoOfferta" type="number" min="0" defaultValue={row.prezzoOfferta ?? ""} style={inputStyle} /></td>
                  <td><input form={`rinnovo-${row.mesi}`} name="notaMensile" defaultValue={row.notaMensile ?? ""} style={inputStyle} /></td>
                  <td><button form={`rinnovo-${row.mesi}`} type="submit" className="gestione-btn gestione-btn-blue">Salva</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {services.map(service => {
          const serviceTiers = tiers.filter(t => t.service === service.code);
          const serviceAddonsList = addons.filter(a => a.service === service.code);
          return (
            <section key={service.code} className="gestione-card" style={{ padding: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#232f3e", marginTop: 0 }}>{SERVICE_LABELS[service.code] ?? service.code}</h2>

              <form action={updateServiceAction} style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "end", borderBottom: "1px solid #eee", paddingBottom: 20, marginBottom: 20 }}>
                <input type="hidden" name="code" value={service.code} />
                <div className="gestione-field" style={{ width: 220 }}>
                  <label>Sconto domiciliazioni aggiuntive (%)</label>
                  <input name="additionalDiscountBps" type="number" step="0.01" min="0" max="100" defaultValue={service.additionalDiscountBps / 100} />
                </div>
                <div className="gestione-field" style={{ width: 200 }}>
                  <label>Sconto nuove attivazioni (%)</label>
                  <input name="newActivationDiscountBps" type="number" step="0.01" min="0" max="100" defaultValue={service.newActivationDiscountBps / 100} />
                </div>
                <div className="gestione-field" style={{ width: 180 }}>
                  <label>Offerta valida fino al</label>
                  <input name="offerValidUntil" type="date" defaultValue={service.offerValidUntil ? service.offerValidUntil.toISOString().slice(0, 10) : ""} />
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#232f3e" }}>
                  <input type="checkbox" name="active" defaultChecked={service.active} /> Servizio attivo
                </label>
                <button type="submit" className="gestione-btn gestione-btn-blue">Salva</button>
              </form>

              <div>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: "#232f3e" }}>Durate e prezzi</h3>
                <div style={{ overflowX: "auto" }}>
                  <table className="gestione-table">
                    <thead>
                      <tr>
                        <th>Mesi</th><th>Listino (€)</th><th>Offerta (€)</th><th>Nuova attiv.</th><th>Dom. aggiuntiva</th><th>Attivo</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {serviceTiers.map(tier => (
                        <tr key={tier.id}>
                          <td>
                            <form id={`tier-${tier.id}`} action={updatePriceAction}>
                              <input type="hidden" name="id" value={tier.id} />
                              {tier.months}
                            </form>
                          </td>
                          <td><input form={`tier-${tier.id}`} name="listCents" type="number" step="0.01" min="0" defaultValue={euro(tier.listCents)} style={inputStyle} /></td>
                          <td><input form={`tier-${tier.id}`} name="offerCents" type="number" step="0.01" min="0" defaultValue={euro(tier.offerCents)} style={inputStyle} /></td>
                          <td style={{ textAlign: "center" }}><input form={`tier-${tier.id}`} name="newActivation" type="checkbox" defaultChecked={tier.newActivation} /></td>
                          <td style={{ textAlign: "center" }}><input form={`tier-${tier.id}`} name="additionalDomiciliation" type="checkbox" defaultChecked={tier.additionalDomiciliation} /></td>
                          <td style={{ textAlign: "center" }}><input form={`tier-${tier.id}`} name="active" type="checkbox" defaultChecked={tier.active} /></td>
                          <td style={{ display: "flex", gap: 6 }}><button form={`tier-${tier.id}`} type="submit" className="gestione-btn gestione-btn-blue">Salva</button><DeleteIconButton id={tier.id} action={deletePriceAction} label={`durata ${tier.months} mesi`} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <details style={{ marginTop: 12 }}>
                  <summary style={{ fontSize: 12, color: "#666", cursor: "pointer" }}>Aggiungi nuova durata</summary>
                  <form action={addPriceAction} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end", marginTop: 10 }}>
                    <input type="hidden" name="service" value={service.code} />
                    <div className="gestione-field" style={{ width: 100 }}><label>Mesi</label><input name="months" type="number" min="1" required /></div>
                    <div className="gestione-field" style={{ width: 140 }}><label>Listino (€)</label><input name="listCents" type="number" step="0.01" min="0" required /></div>
                    <div className="gestione-field" style={{ width: 140 }}><label>Offerta (€)</label><input name="offerCents" type="number" step="0.01" min="0" /></div>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600 }}><input type="checkbox" name="newActivation" /> Nuova attiv.</label>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600 }}><input type="checkbox" name="additionalDomiciliation" /> Dom. aggiuntiva</label>
                    <button type="submit" className="gestione-btn gestione-btn-blue">Aggiungi</button>
                  </form>
                </details>
              </div>

              <div style={{ marginTop: 24 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: "#232f3e" }}>Servizi aggiuntivi</h3>
                <div style={{ overflowX: "auto" }}>
                  <table className="gestione-table">
                    <thead>
                      <tr>
                        <th>Codice</th><th>Titolo IT</th><th>Titolo EN</th><th>Prezzo (€)</th><th>Annuo (€)</th><th>Q.tà max</th><th>Selezionabile</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {serviceAddonsList.map(addon => (
                        <tr key={addon.code}>
                          <td style={{ fontFamily: "monospace", fontSize: 11 }}>
                            <form id={`addon-${addon.code}`} action={updateAddonAction}>
                              <input type="hidden" name="code" value={addon.code} />
                            </form>
                            {addon.code}
                          </td>
                          <td><input form={`addon-${addon.code}`} name="titleIt" defaultValue={addon.titleIt} style={inputStyle} /></td>
                          <td><input form={`addon-${addon.code}`} name="titleEn" defaultValue={addon.titleEn} style={inputStyle} /></td>
                          <td><input form={`addon-${addon.code}`} name="priceCents" type="number" step="0.01" min="0" defaultValue={euro(addon.priceCents)} style={inputStyle} /></td>
                          <td><input form={`addon-${addon.code}`} name="annualCents" type="number" step="0.01" min="0" defaultValue={euro(addon.annualCents)} style={inputStyle} /></td>
                          <td><input form={`addon-${addon.code}`} name="maxQuantity" type="number" min="1" defaultValue={addon.maxQuantity} style={inputStyle} /></td>
                          <td style={{ textAlign: "center" }}><input form={`addon-${addon.code}`} name="selectable" type="checkbox" defaultChecked={addon.selectable} /></td>
                          <td><button form={`addon-${addon.code}`} type="submit" className="gestione-btn gestione-btn-blue">Salva</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p style={{ fontSize: 11, color: "#999", marginTop: 8 }}>Il tipo di fatturazione (mensile, a ora, a busta...) non è modificabile qui perché è collegato alla logica di calcolo prezzi.</p>
              </div>
            </section>
          );
        })}
      </div>
    </GestioneShell>
  );
}

const inputStyle = { border: "1px solid #c8c8c8", borderRadius: 4, padding: "5px 8px", fontSize: 12.5, width: "100%", background: "#f8f8f8" };
