import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { serviceCatalog, siteConfig } from "@/db/schema";
import { STAFF_SESSION_COOKIE, getStaffUser } from "@/lib/staff-auth";
import { updateDiscountTogglesAction, updateOnlineDiscountAction, updatePaymentSettingsAction, updateProviderTestModesAction, updateScannerConfigAction, updateSmartFlagsAction } from "./actions";
import { GestioneShell } from "@/components/GestioneNav";
import { RitiroTemplateEditor } from "@/components/RitiroTemplateEditor";
import { FirmaDomiciliatarioUpload } from "@/components/FirmaDomiciliatarioUpload";
import { ConfigForm } from "@/components/ConfigForm";
import { decryptBytes } from "@/lib/dom-archive";

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
  const firmaPreview = payments?.firmaDomiciliatarioPng ? `data:image/png;base64,${decryptBytes(payments.firmaDomiciliatarioPng).toString("base64")}` : null;

  return (
    <GestioneShell role={user.role} active="configurazione" username={user.username}>
      <h1 className="gestione-h1" style={{ marginBottom: 20 }}>Configurazione Web</h1>
      <p style={{ fontSize: 12, color: "#666", marginTop: -12, marginBottom: 24 }}>
        Attivazione/disattivazione di elementi del sito, separata dai prezzi e dalle offerte (vedi Tariffe e Offerte).
      </p>

      <section className="gestione-card" style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#232f3e", marginTop: 0 }}>Metodi di pagamento</h2>
        <p style={{ fontSize: 12, color: "#666", marginTop: -6 }}>
          Stripe e SumUp sono entrambi solo &quot;pagamento con carta&quot; per il cliente, quindi sul sito compare un&apos;unica voce &quot;Carta di credito&quot; — scegli quale dei due la elabora davvero (mai entrambi insieme). I metodi disattivati non compaiono nella pagina di attivazione online. &quot;In sede&quot; (solo domiciliazione postale) non è tra questi perché non passa da un provider online.
        </p>
        <ConfigForm action={updatePaymentSettingsAction} style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#232f3e" }}>Carta di credito tramite:</span>
            <label style={checkboxRow}><input type="radio" name="cardProcessor" value="none" defaultChecked={(payments?.cardProcessor ?? "stripe") === "none"} /> Nessuno</label>
            <label style={checkboxRow}><input type="radio" name="cardProcessor" value="stripe" defaultChecked={(payments?.cardProcessor ?? "stripe") === "stripe"} /> Stripe</label>
            <label style={checkboxRow}><input type="radio" name="cardProcessor" value="sumup" defaultChecked={(payments?.cardProcessor ?? "stripe") === "sumup"} /> SumUp</label>
          </div>
          <label style={checkboxRow}><input type="checkbox" name="paypalEnabled" defaultChecked={payments?.paypalEnabled ?? true} /> PayPal</label>
          <label style={checkboxRow}><input type="checkbox" name="bankTransferEnabled" defaultChecked={payments?.bankTransferEnabled ?? true} /> Bonifico bancario</label>
        </ConfigForm>
      </section>

      <section className="gestione-card" style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#232f3e", marginTop: 0 }}>Modalità sandbox pagamenti</h2>
        <p style={{ fontSize: 12, color: "#666", marginTop: -6 }}>
          Quando attivo, il metodo usa le credenziali sandbox (variabili d&apos;ambiente <code>*_TEST</code>) invece di quelle reali. Resta visibile e selezionabile anche dai clienti sul sito — non viene nascosto — quindi disattivalo appena finito di testare: finché è acceso compare un badge <strong>TEST</strong> accanto al nome del metodo nella pagina di attivazione, proprio per non dimenticartelo acceso. Un solo interruttore per &quot;Carta di credito&quot;, valido per Stripe o SumUp a seconda di quale hai scelto sopra.
        </p>
        <ConfigForm action={updateProviderTestModesAction} style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center" }}>
          <label style={checkboxRow}><input type="checkbox" name="cardProcessorTestMode" defaultChecked={payments?.cardProcessorTestMode ?? false} /> Carta di credito sandbox</label>
          <label style={checkboxRow}><input type="checkbox" name="paypalTestMode" defaultChecked={payments?.paypalTestMode ?? false} /> PayPal sandbox</label>
        </ConfigForm>
      </section>

      <section className="gestione-card" style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#232f3e", marginTop: 0 }}>Sconto attivazione online</h2>
        <p style={{ fontSize: 12, color: "#666", marginTop: -6 }}>
          Sconto extra applicato solo a chi completa l&apos;attivazione da sé sul sito (pagina &quot;Attiva online&quot;) — non su richieste inviate via &quot;Compila il modulo online&quot; o &quot;Richiedi offerta standard&quot;, che restano gestite manualmente. Quando attivo, un banner lo segnala in evidenza sulla pagina di attivazione e sulla pagina Tariffe.
        </p>
        <ConfigForm action={updateOnlineDiscountAction} style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center" }}>
          <label style={checkboxRow}><input type="checkbox" name="onlineDiscountEnabled" defaultChecked={payments?.onlineDiscountEnabled ?? false} /> Attivo</label>
          <div className="gestione-field" style={{ width: 160 }}>
            <label>Sconto (%)</label>
            <input name="onlineDiscountBps" type="number" step="0.01" min="0" max="100" defaultValue={(payments?.onlineDiscountBps ?? 1000) / 100} />
          </div>
        </ConfigForm>
      </section>

      <section className="gestione-card" style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#232f3e", marginTop: 0 }}>Scanner posta (eSCL)</h2>
        <p style={{ fontSize: 12, color: "#666", marginTop: -6 }}>
          Indirizzo dello scanner di rete e impostazioni proposte di default per il pulsante &quot;Allega&quot; della domiciliazioni (vedi <code>docs/mail-scanning.md</code>). Un solo scanner per tutto l&apos;ufficio: configurato qui una volta, non per singolo operatore/browser. Richiede il bridge locale (<code>npx tsx scripts/escl-bridge.ts</code>) in esecuzione sul PC da cui si scansiona.
        </p>
        <ConfigForm action={updateScannerConfigAction} style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
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
        </ConfigForm>
      </section>

      <section className="gestione-card" style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#232f3e", marginTop: 0 }}>Sconti domiciliazione sede legale</h2>
        <p style={{ fontSize: 12, color: "#666", marginTop: -6 }}>
          Quando disattivi uno sconto qui, sparisce ovunque: percentuale e casella nel modulo di attivazione online, nota nelle tariffe, campo e riga nel PDF del preventivo, email di richiesta manuale e di offerta standard. Le percentuali restano modificabili in Tariffe e Offerte anche da spenti. Riguarda solo la sede legale: la domiciliazione postale non ha mai previsto questi sconti.
        </p>
        <ConfigForm action={updateDiscountTogglesAction} style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center" }}>
          <label style={checkboxRow}><input type="checkbox" name="additionalDiscountEnabled" defaultChecked={legalUnit?.additionalDiscountEnabled ?? true} /> Sconto domiciliazioni aggiuntive</label>
          <label style={checkboxRow}><input type="checkbox" name="newActivationDiscountEnabled" defaultChecked={legalUnit?.newActivationDiscountEnabled ?? true} /> Sconto nuove attivazioni</label>
        </ConfigForm>
      </section>

      <section className="gestione-card" style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#232f3e", marginTop: 0 }}>Contratto Smart-Start (sede legale)</h2>
        <p style={{ fontSize: 12, color: "#666", marginTop: -6 }}>
          Quando attivi, compaiono come voci &quot;Smart 3+24&quot; / &quot;Smart 6+24&quot; nel menu a tendina di &quot;Compila il modulo online&quot;.
        </p>
        <ConfigForm action={updateSmartFlagsAction} style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center" }}>
          <label style={checkboxRow}><input type="checkbox" name="smart3x24Active" defaultChecked={legalUnit?.smart3x24Active ?? true} /> Smart 3+24 attivo</label>
          <label style={checkboxRow}><input type="checkbox" name="smart6x24Active" defaultChecked={legalUnit?.smart6x24Active ?? true} /> Smart 6+24 attivo</label>
        </ConfigForm>
      </section>

      <section className="gestione-card" style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#232f3e", marginTop: 0 }}>Firma domiciliatario</h2>
        <p style={{ fontSize: 12, color: "#666", marginTop: -6 }}>
          PNG trasparente usato dallo strumento &quot;Carica Contratto e processa&quot; (Gestione Domiciliazioni) per firmare la pagina &quot;Timbro e firma DOMICILIATARIO&quot;. Conservata cifrata (AES-256) nel database, non come file — sopravvive ad ogni pubblicazione del sito.
        </p>
        <FirmaDomiciliatarioUpload previewDataUrl={firmaPreview} />
      </section>

      <section className="gestione-card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#232f3e", marginTop: 0 }}>Richiesta ritiro corrispondenza</h2>
        <p style={{ fontSize: 12, color: "#666", marginTop: -6 }}>
          Oggetto e testo di base usati dal tab &quot;Ritiro Corrispondenza&quot; nella scheda di ogni società (Gestione Domiciliazioni). L&apos;oggetto si può comunque modificare prima di ogni invio; il testo viene riutilizzato solo se la società non ha già un testo proprio salvato/inviato in precedenza.
        </p>
        <RitiroTemplateEditor initialHtml={payments?.ritiroTestoTemplate ?? null} initialSubject={payments?.ritiroOggettoTemplate ?? null} />
      </section>
    </GestioneShell>
  );
}
