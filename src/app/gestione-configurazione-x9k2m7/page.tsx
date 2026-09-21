import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { serviceCatalog, siteConfig } from "@/db/schema";
import { STAFF_SESSION_COOKIE, getStaffUser } from "@/lib/staff-auth";
import { updateOnlineDiscountAction, updatePaymentSettingsAction, updateSmartFlagsAction } from "./actions";
import { GestioneShell } from "@/components/GestioneNav";

const checkboxRow = { display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#232f3e" } as const;

export default async function ConfigurazioneWebPage() {
  const store = await cookies();
  const user = await getStaffUser(store.get(STAFF_SESSION_COOKIE)?.value);
  if (!user) redirect("/gestione-tariffe-x9k2m7/login?next=/gestione-configurazione-x9k2m7");
  if (user.role !== "admin") redirect("/gestione-domiciliazioni-x9k2m7");

  const [[legalUnit], [payments]] = await Promise.all([
    db.select().from(serviceCatalog).where(eq(serviceCatalog.code, "legal_unit")),
    db.select().from(siteConfig).where(eq(siteConfig.id, 1)),
  ]);

  return (
    <GestioneShell role={user.role} active="configurazione" username={user.username}>
      <h1 className="gestione-h1" style={{ marginBottom: 20 }}>Configurazione Web</h1>
      <p style={{ fontSize: 12, color: "#666", marginTop: -12, marginBottom: 24 }}>
        Attivazione/disattivazione di elementi del sito, separata dai prezzi e dalle offerte (vedi Tariffe e Offerte).
      </p>

      <section className="gestione-card" style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#232f3e", marginTop: 0 }}>Metodi di pagamento</h2>
        <p style={{ fontSize: 12, color: "#666", marginTop: -6 }}>
          I metodi disattivati non compaiono nella pagina di attivazione online. &quot;In sede&quot; (solo domiciliazione postale) non è tra questi perché non passa da un provider online.
        </p>
        <form action={updatePaymentSettingsAction} style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center" }}>
          <label style={checkboxRow}><input type="checkbox" name="stripeEnabled" defaultChecked={payments?.stripeEnabled ?? true} /> Stripe</label>
          <label style={checkboxRow}><input type="checkbox" name="paypalEnabled" defaultChecked={payments?.paypalEnabled ?? true} /> PayPal</label>
          <label style={checkboxRow}><input type="checkbox" name="sumupEnabled" defaultChecked={payments?.sumupEnabled ?? true} /> SumUp</label>
          <label style={checkboxRow}><input type="checkbox" name="bankTransferEnabled" defaultChecked={payments?.bankTransferEnabled ?? true} /> Bonifico bancario</label>
          <button type="submit" className="gestione-btn gestione-btn-blue">Salva</button>
        </form>
      </section>

      <section className="gestione-card" style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#232f3e", marginTop: 0 }}>Sconto attivazione online</h2>
        <p style={{ fontSize: 12, color: "#666", marginTop: -6 }}>
          Sconto extra applicato solo a chi completa l&apos;attivazione da sé sul sito (pagina &quot;Attiva online&quot;) — non su richieste inviate via &quot;Compila il modulo online&quot; o &quot;Richiedi offerta standard&quot;, che restano gestite manualmente. Quando attivo, un banner lo segnala in evidenza sulla pagina di attivazione e sulla pagina Tariffe.
        </p>
        <form action={updateOnlineDiscountAction} style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center" }}>
          <label style={checkboxRow}><input type="checkbox" name="onlineDiscountEnabled" defaultChecked={payments?.onlineDiscountEnabled ?? false} /> Attivo</label>
          <div className="gestione-field" style={{ width: 160 }}>
            <label>Sconto (%)</label>
            <input name="onlineDiscountBps" type="number" step="0.01" min="0" max="100" defaultValue={(payments?.onlineDiscountBps ?? 1000) / 100} />
          </div>
          <button type="submit" className="gestione-btn gestione-btn-blue">Salva</button>
        </form>
      </section>

      <section className="gestione-card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#232f3e", marginTop: 0 }}>Contratto Smart-Start (sede legale)</h2>
        <p style={{ fontSize: 12, color: "#666", marginTop: -6 }}>
          Quando attivi, compaiono come voci &quot;Smart 3+24&quot; / &quot;Smart 6+24&quot; nel menu a tendina di &quot;Compila il modulo online&quot;.
        </p>
        <form action={updateSmartFlagsAction} style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center" }}>
          <label style={checkboxRow}><input type="checkbox" name="smart3x24Active" defaultChecked={legalUnit?.smart3x24Active ?? true} /> Smart 3+24 attivo</label>
          <label style={checkboxRow}><input type="checkbox" name="smart6x24Active" defaultChecked={legalUnit?.smart6x24Active ?? true} /> Smart 6+24 attivo</label>
          <button type="submit" className="gestione-btn gestione-btn-blue">Salva</button>
        </form>
      </section>
    </GestioneShell>
  );
}
