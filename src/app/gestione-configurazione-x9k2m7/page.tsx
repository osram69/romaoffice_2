import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { serviceCatalog, siteConfig } from "@/db/schema";
import { STAFF_SESSION_COOKIE, getStaffUser } from "@/lib/staff-auth";
import { updateOnlineDiscountAction, updatePaymentSettingsAction, updatePaymentsTestModeAction, updateScannerConfigAction, updateSmartFlagsAction } from "./actions";
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
  const testBypassToken = process.env.PAYMENTS_TEST_BYPASS_TOKEN;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

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
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#232f3e", marginTop: 0 }}>Modalità test pagamenti</h2>
        <p style={{ fontSize: 12, color: "#666", marginTop: -6 }}>
          Quando attiva, Stripe/PayPal/SumUp scompaiono dalla pagina di attivazione pubblica (il bonifico resta sempre visibile, non passa da un provider). Usa il link con il codice qui sotto per continuare a testare i pagamenti in sandbox: solo chi apre quel link li vede e può usarli.
        </p>
        <form action={updatePaymentsTestModeAction} style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center" }}>
          <label style={checkboxRow}><input type="checkbox" name="paymentsTestMode" defaultChecked={payments?.paymentsTestMode ?? false} /> Attiva</label>
          <button type="submit" className="gestione-btn gestione-btn-blue">Salva</button>
        </form>
        {testBypassToken ? (
          <p style={{ fontSize: 12, color: "#666", marginTop: 12, wordBreak: "break-all" }}>
            Link di test: <code>{siteUrl}/attiva.html?test={testBypassToken}</code> · <code>{siteUrl}/en/activate.html?test={testBypassToken}</code>
          </p>
        ) : (
          <p style={{ fontSize: 12, color: "#A52A2A", marginTop: 12 }}>
            Imposta la variabile d&apos;ambiente PAYMENTS_TEST_BYPASS_TOKEN per generare il link di test.
          </p>
        )}
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

      <section className="gestione-card" style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#232f3e", marginTop: 0 }}>Scanner posta (eSCL)</h2>
        <p style={{ fontSize: 12, color: "#666", marginTop: -6 }}>
          Indirizzo dello scanner di rete e impostazioni proposte di default per il pulsante &quot;Allega&quot; della domiciliazioni (vedi <code>docs/mail-scanning.md</code>). Un solo scanner per tutto l&apos;ufficio: configurato qui una volta, non per singolo operatore/browser. Richiede il bridge locale (<code>npx tsx scripts/escl-bridge.ts</code>) in esecuzione sul PC da cui si scansiona.
        </p>
        <form action={updateScannerConfigAction} style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
          <div className="gestione-field" style={{ width: 180 }}>
            <label>IP scanner</label>
            <input name="scannerHost" type="text" placeholder="192.168.1.50" defaultValue={payments?.scannerHost ?? ""} />
          </div>
          <div className="gestione-field" style={{ width: 90 }}>
            <label>Porta</label>
            <input name="scannerPort" type="text" placeholder="80" defaultValue={payments?.scannerPort ?? ""} />
          </div>
          <label style={checkboxRow}><input type="checkbox" name="scannerHttps" defaultChecked={payments?.scannerHttps ?? false} /> HTTPS</label>
          <div className="gestione-field" style={{ width: 140 }}>
            <label>Colore predefinito</label>
            <select name="scannerColorDefault" defaultValue={payments?.scannerColorDefault ?? "gray"}>
              <option value="gray">Bianco/nero</option>
              <option value="color">Colore</option>
            </select>
          </div>
          <div className="gestione-field" style={{ width: 170 }}>
            <label>Sorgente predefinita</label>
            <select name="scannerSourceDefault" defaultValue={payments?.scannerSourceDefault ?? "platen"}>
              <option value="platen">Piano</option>
              <option value="feeder">Caricatore (ADF)</option>
              <option value="feederDuplex">Caricatore fronte/retro</option>
            </select>
          </div>
          <div className="gestione-field" style={{ width: 120 }}>
            <label>Risoluzione predefinita</label>
            <select name="scannerResolutionDefault" defaultValue={String(payments?.scannerResolutionDefault ?? 200)}>
              <option value="50">50 dpi</option>
              <option value="100">100 dpi</option>
              <option value="150">150 dpi</option>
              <option value="200">200 dpi</option>
              <option value="300">300 dpi</option>
            </select>
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
